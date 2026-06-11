const pool = require('../config/database');

/**
 * Activity logging utility
 * Records user actions (login, post create, delete, etc) to activity_logs table
 * Non-blocking: failures don't crash requests
 */

/**
 * Log user activity event
 * @param {number} userId - User performing action
 * @param {string} eventType - Event type (user_registered, pet_created, lost_report, etc)
 * @param {object} metadata - Optional metadata { postId, postType, petDbId, petName, details, ... }
 */
async function logActivity(userId, eventType, metadata = {}) {
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

module.exports = { logActivity };
