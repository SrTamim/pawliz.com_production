import pool from '../config/database';
import { deleteUploadedFiles } from '../utils/fileUtils';
import { logActivity } from '../utils/activityLogger';

/** Loose pet payload from request bodies — fields validated upstream. */
type PetData = Record<string, any>;

/**
 * Generate unique PAW-XXXXXX pet ID (6 alphanum suffix).
 */
function generatePetId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let suffix = '';
  for (let i = 0; i < 6; i++)
    suffix += chars[Math.floor(Math.random() * chars.length)];
  return `PAW-${suffix}`;
}

/**
 * List user's active pets + lost report metadata.
 */
export async function listUserPets(userId: number): Promise<Record<string, any>[]> {
  const result = await pool.query(
    `SELECT p.*,
      lpr.lost_date, lpr.lost_location_name, lpr.lost_latitude, lpr.lost_longitude, lpr.additional_details,
      vsum.next_vaccination_due,
      vsum.vaccination_status
     FROM pets p
     LEFT JOIN lost_pet_reports lpr ON lpr.pet_id = p.id AND lpr.is_found = false
     LEFT JOIN LATERAL (
       SELECT
         MIN(next_due_date) FILTER (WHERE next_due_date >= CURRENT_DATE) AS next_vaccination_due,
         CASE
           WHEN COUNT(*) = 0 THEN NULL
           WHEN MIN(next_due_date) < CURRENT_DATE THEN 'overdue'
           WHEN BOOL_OR(next_due_date >= CURRENT_DATE) THEN 'up-to-date'
           ELSE 'up-to-date'
         END AS vaccination_status
       FROM pet_vaccination_records WHERE pet_id = p.id
     ) vsum ON true
     WHERE p.user_id = $1 AND p.is_active = true
     ORDER BY p.created_at ASC`,
    [userId],
  );
  return result.rows;
}

/**
 * Fetch public pet record by pet_id (QR code lookup).
 */
export async function getPublicPet(petId: string): Promise<Record<string, any> | null> {
  const result = await pool.query(
    `SELECT p.id, p.pet_id, p.name, p.type, p.breed, p.gender, p.age, p.color, p.weight, p.images,
            p.medical_conditions, p.allergies, p.is_lost,
            p.temperament, p.potty_trained, p.knows_commands,
            p.good_with_strangers, p.good_with_kids, p.good_with_pets, p.special_notes,
            p.food_types, p.meals_per_day, p.dietary_restrictions, p.appetite_notes,
            u.name as owner_name,
            vsum.next_vaccination_due,
            vsum.vaccination_status
     FROM pets p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN LATERAL (
       SELECT
         MIN(next_due_date) FILTER (WHERE next_due_date >= CURRENT_DATE) AS next_vaccination_due,
         CASE
           WHEN COUNT(*) = 0 THEN NULL
           WHEN MIN(next_due_date) < CURRENT_DATE THEN 'overdue'
           ELSE 'up-to-date'
         END AS vaccination_status
       FROM pet_vaccination_records WHERE pet_id = p.id
     ) vsum ON true
     WHERE p.pet_id = $1 AND p.is_active = true`,
    [petId],
  );
  return result.rows[0] || null;
}

/**
 * Create pet for user (transaction with unique pet_id generation).
 * @throws {Error} If pet ID generation fails after retries
 */
export async function createPet(userId: number, data: PetData): Promise<Record<string, any>> {
  const {
    name, type, breed, gender, age, color, weight,
    medical_conditions, allergies, current_medicines,
    temperament, potty_trained, knows_commands,
    good_with_strangers, good_with_kids, good_with_pets, special_notes,
    food_types, meals_per_day, dietary_restrictions, appetite_notes,
  } = data;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tryInsert = async () => {
      const petId = generatePetId();
      const r = await client.query(
        `INSERT INTO pets (
          user_id, pet_id, name, type, breed, gender, age, color, weight,
          medical_conditions, allergies, current_medicines,
          temperament, potty_trained, knows_commands, good_with_strangers,
          good_with_kids, good_with_pets, special_notes,
          food_types, meals_per_day, dietary_restrictions, appetite_notes
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,
          $10,$11,$12,
          $13,$14,$15,$16,
          $17,$18,$19,
          $20,$21,$22,$23
        ) ON CONFLICT (pet_id) DO NOTHING RETURNING *`,
        [
          userId, petId, name, type, breed || null, gender || null,
          age ? String(age).trim().slice(0, 30) : null, color || null, weight ? parseFloat(weight) : null,
          medical_conditions || null, allergies || null, current_medicines || null,
          temperament || null,
          potty_trained !== undefined ? potty_trained : null,
          knows_commands !== undefined ? knows_commands : null,
          good_with_strangers !== undefined ? good_with_strangers : null,
          good_with_kids !== undefined ? good_with_kids : null,
          good_with_pets !== undefined ? good_with_pets : null,
          special_notes || null,
          food_types || null,
          meals_per_day ? String(meals_per_day).trim().slice(0, 50) : null,
          dietary_restrictions || null,
          appetite_notes || null,
        ],
      );
      return r;
    };

    let result: { rowCount: number | null; rows: any[] } = { rowCount: 0, rows: [] };
    for (let attempt = 0; attempt < 5 && result.rowCount === 0; attempt++) {
      result = await tryInsert();
    }
    if (result.rowCount === 0) throw new Error('Failed to generate unique pet ID');

    await client.query('COMMIT');

    logActivity(userId, 'pet_created', {
      petDbId: result.rows[0].id, petUid: result.rows[0].pet_id, petName: name, petType: type,
    });

    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update pet (ownership check, soft fields, coalesce provided values).
 * @returns Updated pet or null if not found/owned
 */
export async function updatePet(petDbId: number, userId: number, data: PetData): Promise<Record<string, any> | null> {
  const check = await pool.query(
    'SELECT id, weight FROM pets WHERE id = $1 AND user_id = $2 AND is_active = true',
    [petDbId, userId],
  );
  if (!check.rows[0]) return null;
  const oldWeight = check.rows[0].weight;

  const {
    name, type, breed, gender, age, color, weight,
    medical_conditions, allergies, current_medicines,
    temperament, potty_trained, knows_commands,
    good_with_strangers, good_with_kids, good_with_pets, special_notes,
    food_types, meals_per_day, dietary_restrictions, appetite_notes,
  } = data;

  const result = await pool.query(
    `UPDATE pets SET
      name = COALESCE($1, name), type = COALESCE($2, type),
      breed = $3, gender = $4, age = $5, color = $6, weight = $7,
      medical_conditions = $8, allergies = $9, current_medicines = $10,
      temperament = $11, potty_trained = $12, knows_commands = $13,
      good_with_strangers = $14, good_with_kids = $15, good_with_pets = $16,
      special_notes = $17,
      food_types = $18, meals_per_day = $19,
      dietary_restrictions = $20, appetite_notes = $21,
      updated_at = NOW()
    WHERE id = $22 AND user_id = $23
    RETURNING *`,
    [
      name || null, type || null,
      breed !== undefined ? breed || null : null,
      gender !== undefined ? gender || null : null,
      age !== undefined ? (age ? String(age).trim().slice(0, 30) : null) : null,
      color !== undefined ? color || null : null,
      weight !== undefined ? (weight ? parseFloat(weight) : null) : null,
      medical_conditions !== undefined ? medical_conditions || null : null,
      allergies !== undefined ? allergies || null : null,
      current_medicines !== undefined ? current_medicines || null : null,
      temperament !== undefined ? temperament || null : null,
      potty_trained !== undefined ? potty_trained : null,
      knows_commands !== undefined ? knows_commands : null,
      good_with_strangers !== undefined ? good_with_strangers : null,
      good_with_kids !== undefined ? good_with_kids : null,
      good_with_pets !== undefined ? good_with_pets : null,
      special_notes !== undefined ? special_notes || null : null,
      food_types !== undefined ? food_types || null : null,
      meals_per_day !== undefined ? (meals_per_day ? String(meals_per_day).trim().slice(0, 50) : null) : null,
      dietary_restrictions !== undefined ? dietary_restrictions || null : null,
      appetite_notes !== undefined ? appetite_notes || null : null,
      petDbId, userId,
    ],
  );
  if (!result.rows[0]) return null;

  // Auto-append a weight-log entry when the weight value actually changed.
  // The weight field is the single source; the log is read-only history.
  if (weight !== undefined && weight !== null && weight !== '') {
    const newWeight = parseFloat(weight);
    if (!isNaN(newWeight) && (oldWeight === null || oldWeight === undefined || Number(oldWeight) !== newWeight)) {
      try {
        await pool.query(
          `INSERT INTO pet_weight_logs (pet_id, weight, logged_date) VALUES ($1, $2, CURRENT_DATE)`,
          [petDbId, newWeight],
        );
      } catch (err) {
        // non-fatal: the pet update already succeeded
      }
    }
  }

  return result.rows[0];
}

/**
 * Soft-delete pet + clean images.
 * @returns True if deleted, false if not found/owned
 */
export async function deletePet(petDbId: number, userId: number): Promise<boolean> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ownership check inside the txn with FOR UPDATE to prevent TOCTOU races
    const petCheck = await client.query(
      'SELECT images FROM pets WHERE id = $1 AND user_id = $2 AND is_active = true FOR UPDATE',
      [petDbId, userId],
    );
    if (!petCheck.rows[0]) {
      await client.query('ROLLBACK');
      return false;
    }

    const imagesToDelete: string[] = petCheck.rows[0].images || [];

    await client.query(
      'UPDATE pets SET is_active = false, updated_at = NOW() WHERE id = $1',
      [petDbId],
    );

    await client.query('COMMIT');

    try { if (imagesToDelete.length > 0) deleteUploadedFiles(imagesToDelete); } catch {}
    logActivity(userId, 'pet_deleted', { petDbId });

    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
