import pool from '../config/database';
import { getIO } from '../socket';
import logger from '../utils/logger';

/**
 * Create notification + emit via Socket.IO to user.
 * @param userId Recipient user ID
 * @param type Notification type (e.g., comment, like, follow)
 * @param title Short title
 * @param message Notification message
 * @param relatedPostId Related post/pet ID
 * @param relatedPostType Post type (pet, lost_found, rescue, adoption)
 * @param actorUserId User who triggered notification
 * @param actionUrl Optional action URL
 * @returns Notification record or null on error
 */
export async function createNotification(
  userId: number,
  type: string,
  title: string,
  message: string,
  relatedPostId: number | null = null,
  relatedPostType: string | null = null,
  actorUserId: number | null = null,
  actionUrl: string | null = null,
): Promise<Record<string, any> | null> {
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
      io.to(`user:${userId}`).emit('notification', notification);
    }
    return notification;
  } catch (err) {
    logger.error('Create notification error:', err);
    logger.warn('createNotification returning null — caller should handle missing notification');
    return null;
  }
}
