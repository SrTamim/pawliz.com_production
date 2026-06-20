import pool from '../config/database';

/** Loose payload from request bodies — fields validated upstream. */
type HealthData = Record<string, any>;

/**
 * Verify the pet exists, is active, and is owned by the user.
 * Mirrors the ownership guard used in petService.updatePet.
 * @returns true if owned
 */
async function assertOwnership(petDbId: number, userId: number): Promise<boolean> {
  const check = await pool.query(
    'SELECT id FROM pets WHERE id = $1 AND user_id = $2 AND is_active = true',
    [petDbId, userId],
  );
  return !!check.rows[0];
}

// ==================== Vaccination records ====================

/**
 * List a pet's vaccination records (soonest due first), owner-scoped.
 * @returns rows, or null if pet not found/owned
 */
export async function listVaccinations(petDbId: number, userId: number): Promise<Record<string, any>[] | null> {
  if (!(await assertOwnership(petDbId, userId))) return null;
  const result = await pool.query(
    `SELECT id, pet_id, vaccine_name, date_given, next_due_date, vet_name, notes, created_at
     FROM pet_vaccination_records
     WHERE pet_id = $1
     ORDER BY next_due_date ASC NULLS LAST, date_given DESC NULLS LAST, created_at DESC`,
    [petDbId],
  );
  return result.rows;
}

/**
 * Add a vaccination record for an owned pet.
 * @returns the created row, or null if pet not found/owned
 */
export async function addVaccination(petDbId: number, userId: number, data: HealthData): Promise<Record<string, any> | null> {
  if (!(await assertOwnership(petDbId, userId))) return null;
  const { vaccine_name, date_given, next_due_date, vet_name, notes } = data;
  const result = await pool.query(
    `INSERT INTO pet_vaccination_records (pet_id, vaccine_name, date_given, next_due_date, vet_name, notes)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [petDbId, vaccine_name, date_given || null, next_due_date || null, vet_name || null, notes || null],
  );
  return result.rows[0];
}

/**
 * Update a vaccination record (owner-scoped via pet_id).
 * @returns the updated row, or null if not found/owned
 */
export async function updateVaccination(recordId: number, petDbId: number, userId: number, data: HealthData): Promise<Record<string, any> | null> {
  if (!(await assertOwnership(petDbId, userId))) return null;
  const { vaccine_name, date_given, next_due_date, vet_name, notes } = data;
  const result = await pool.query(
    `UPDATE pet_vaccination_records SET
       vaccine_name = COALESCE($1, vaccine_name),
       date_given = $2, next_due_date = $3, vet_name = $4, notes = $5
     WHERE id = $6 AND pet_id = $7
     RETURNING *`,
    [
      vaccine_name || null,
      date_given !== undefined ? date_given || null : null,
      next_due_date !== undefined ? next_due_date || null : null,
      vet_name !== undefined ? vet_name || null : null,
      notes !== undefined ? notes || null : null,
      recordId, petDbId,
    ],
  );
  return result.rows[0] || null;
}

/**
 * Delete a vaccination record (owner-scoped via pet_id).
 * @returns true if deleted, false if not found/owned
 */
export async function deleteVaccination(recordId: number, petDbId: number, userId: number): Promise<boolean> {
  if (!(await assertOwnership(petDbId, userId))) return false;
  const result = await pool.query(
    'DELETE FROM pet_vaccination_records WHERE id = $1 AND pet_id = $2',
    [recordId, petDbId],
  );
  return (result.rowCount || 0) > 0;
}

// ==================== Weight logs ====================

/**
 * List a pet's weight logs (oldest first, for trend rendering), owner-scoped.
 * @returns rows, or null if pet not found/owned
 */
export async function listWeightLogs(petDbId: number, userId: number): Promise<Record<string, any>[] | null> {
  if (!(await assertOwnership(petDbId, userId))) return null;
  const result = await pool.query(
    `SELECT id, pet_id, weight, logged_date, notes, created_at
     FROM pet_weight_logs
     WHERE pet_id = $1
     ORDER BY logged_date ASC, created_at ASC`,
    [petDbId],
  );
  return result.rows;
}
// Weight logs are written automatically by petService.updatePet when the pet's
// weight value changes — there is no manual add/delete path.
