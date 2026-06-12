import pool from '../config/database';

/** Vet row owned by a user (SELECT * — loose record, columns per schema). */
export async function getOwnedVet(userId: number): Promise<Record<string, any> | null> {
  const result = await pool.query(
    'SELECT * FROM vets WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return result.rows[0] || null;
}
