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

/**
 * Stacked comment notification for community posts. One unread notification row
 * per (recipient, post): the first comment inserts it, later comments bump
 * event_count and rewrite the message ("{name} and N others commented…").
 *
 * The ON CONFLICT target MUST match the partial unique index
 * `uniq_notif_comment_post_community` exactly (type='comment_on_post' AND
 * related_post_type='community' AND is_read=false) or Postgres inserts a
 * duplicate instead of stacking. Re-emits the resulting row so the bell updates.
 */
export async function upsertStackedCommentNotification(
  recipientId: number,
  postId: number,
  latestActorId: number,
  latestActorName: string,
  actionUrl: string | null = null,
): Promise<Record<string, any> | null> {
  try {
    const title = 'New comment';
    const single = `${latestActorName} commented on your post`;
    const result = await pool.query(
      `INSERT INTO notifications
         (user_id, type, title, message, related_post_id, related_post_type, actor_user_id, action_url, event_count)
       VALUES ($1, 'comment_on_post', $2, $3, $4, 'community', $5, $6, 1)
       ON CONFLICT (user_id, related_post_id, related_post_type)
         WHERE type = 'comment_on_post' AND related_post_type = 'community' AND is_read = false
       DO UPDATE SET
         event_count = notifications.event_count + 1,
         actor_user_id = EXCLUDED.actor_user_id,
         message = CASE
           WHEN notifications.event_count + 1 = 1 THEN $3
           ELSE $7 || ' and ' || (notifications.event_count)::text ||
                CASE WHEN notifications.event_count = 1 THEN ' other commented on your post'
                     ELSE ' others commented on your post' END
         END,
         created_at = NOW(),
         updated_at = NOW()
       RETURNING *`,
      [recipientId, title, single, postId, latestActorId, actionUrl, latestActorName],
    );
    const notification = result.rows[0];
    const io = getIO();
    if (io && notification) {
      io.to(`user:${recipientId}`).emit('notification', notification);
    }
    return notification;
  } catch (err) {
    logger.error('Stacked comment notification error:', err);
    return null;
  }
}
