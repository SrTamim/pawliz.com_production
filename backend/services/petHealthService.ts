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
  // Partial update: only fields PRESENT in the payload are touched. An omitted
  // key preserves the existing column (via the `$provided` flag → CASE ELSE col);
  // an explicitly sent empty string clears the column. This avoids the previous
  // behaviour where updating one field nulled every other field.
  // vaccine_name intentionally differs: it uses COALESCE (not the $flag/CASE
  // pattern) because it is a required field — the PUT validator in
  // routes/pet-health.ts rejects an empty vaccine_name with 400, so an empty
  // string never reaches this query and the column cannot be cleared by design.
  // The other four fields are optional and clearable.
  const result = await pool.query(
    `UPDATE pet_vaccination_records SET
       vaccine_name  = COALESCE($1, vaccine_name),
       date_given    = CASE WHEN $2 THEN $3::date ELSE date_given END,
       next_due_date = CASE WHEN $4 THEN $5::date ELSE next_due_date END,
       vet_name      = CASE WHEN $6 THEN $7 ELSE vet_name END,
       notes         = CASE WHEN $8 THEN $9 ELSE notes END
     WHERE id = $10 AND pet_id = $11
     RETURNING *`,
    [
      vaccine_name || null,
      date_given !== undefined,    date_given || null,
      next_due_date !== undefined, next_due_date || null,
      vet_name !== undefined,      vet_name || null,
      notes !== undefined,         notes || null,
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
