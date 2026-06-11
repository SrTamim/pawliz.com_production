const pool = require("../config/database");
const { getIO } = require("../socket");
const logger = require("../utils/logger");

/**
 * Create notification + emit via Socket.IO to user.
 * @param {number} userId - Recipient user ID
 * @param {string} type - Notification type (e.g., comment, like, follow)
 * @param {string} title - Short title
 * @param {string} message - Notification message
 * @param {number} [relatedPostId] - Related post/pet ID
 * @param {string} [relatedPostType] - Post type (pet, lost_found, rescue, adoption)
 * @param {number} [actorUserId] - User who triggered notification
 * @param {string} [actionUrl] - Optional action URL
 * @returns {Promise<object|null>} Notification record or null on error
 */
async function createNotification(
  userId,
  type,
  title,
  message,
  relatedPostId = null,
  relatedPostType = null,
  actorUserId = null,
  actionUrl = null,
) {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, type, title, message, related_post_id, related_post_type, actor_user_id, action_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, type, title, message, relatedPostId, relatedPostType, actorUserId, actionUrl],
    );
    const notification = result.rows[0];
    const io = getIO();
    if (io) {
      io.to(`user:${userId}`).emit("notification", notification);
    }
    return notification;
  } catch (err) {
    logger.error("Create notification error:", err);
    logger.warn("createNotification returning null — caller should handle missing notification");
    return null;
  }
}

module.exports = { createNotification };
