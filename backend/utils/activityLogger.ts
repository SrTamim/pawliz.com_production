import pool from '../config/database';

/**
 * Activity logging utility
 * Records user actions (login, post create, delete, etc) to activity_logs table
 * Non-blocking: failures don't crash requests
 */

export interface ActivityMetadata {
  postId?: number | null;
  postType?: string | null;
  petDbId?: number | null;
  petUid?: string | null;
  petName?: string | null;
  petType?: string | null;
  details?: unknown;
}

/**
 * Log user activity event
 * @param userId User performing action
 * @param eventType Event type (user_registered, pet_created, lost_report, etc)
 * @param metadata Optional metadata { postId, postType, petDbId, petName, details, ... }
 */
export async function logActivity(
  userId: number | null | undefined,
  eventType: string,
  metadata: ActivityMetadata = {},
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO activity_logs
        (user_id, event_type, post_id, post_type, pet_db_id, pet_uid, pet_name, pet_type,
         additional_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        userId || null,
        eventType,
        metadata.postId || null,
        metadata.postType || null,
        metadata.petDbId || null,
        metadata.petUid || null,
        metadata.petName || null,
        metadata.petType || null,
        metadata.details ? JSON.stringify(metadata.details) : null,
      ]
    );
  } catch {
    // Non-blocking — log failures must not crash request
  }
}
