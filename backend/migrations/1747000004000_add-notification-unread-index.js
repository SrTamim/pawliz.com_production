/**
 * Migration: add partial index on notifications(user_id) WHERE is_read = false
 *
 * Why a partial index instead of a composite index on (user_id, is_read):
 *   - The unread-count query (SELECT COUNT(*) WHERE user_id = $1 AND is_read = false)
 *     only ever needs the FALSE side of is_read.
 *   - A partial index only stores rows matching the WHERE clause, so it is a fraction
 *     of the size of a full composite index and fits entirely in PostgreSQL's
 *     shared_buffers at scale.
 *   - Read notifications are never queried via this path — they are retrieved by
 *     the main GET /notifications list which already uses idx_notifications_user_id.
 *
 * Expected impact:
 *   - getUnreadCount query time: from O(user's total notifications) → O(user's unread count)
 *   - At 20k users with ~10 unread notifications each the index is ~200k rows vs potentially
 *     millions in a full composite index.
 */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id)
    WHERE is_read = false
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS idx_notifications_user_unread`);
};
