const express = require("express");
const router = express.Router();
const { body, validationResult } = require("express-validator");
const pool = require("../config/database");
const { authenticate } = require("../middleware/auth");
const { createNotification } = require("../services/notificationService");
const validate = require("../middleware/validate");
const logger = require("../utils/logger");

// ==================== GET NOTIFICATIONS ====================

/**
 * GET /api/v1/notifications - Get user notifications (filtered by read status + type).
 * Query params:
 *   - is_read: "true" or "false" (null = all)
 *   - type: filter by type (comment, like, follow, etc.)
 *   - page, limit (pagination)
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = req.query.offset !== undefined ? parseInt(req.query.offset) : (page - 1) * limit;
    const { is_read, type } = req.query;
    const isReadFilter = is_read !== undefined ? is_read === "true" : null;

    const [countResult, dataResult] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE ($2::boolean IS NULL OR is_read = $2) AND ($3::text IS NULL OR type = $3)) AS filtered_total,
          COUNT(*) FILTER (WHERE is_read = false) AS unread_total
         FROM notifications
         WHERE user_id = $1`,
        [req.user.id, isReadFilter, type || null],
      ),
      pool.query(
        `SELECT n.*, u.name AS actor_name, u.profile_picture AS actor_avatar
         FROM notifications n
         LEFT JOIN users u ON u.id = n.actor_user_id
         WHERE n.user_id = $1
           AND ($2::boolean IS NULL OR n.is_read = $2)
           AND ($3::text IS NULL OR n.type = $3)
         ORDER BY n.created_at DESC
         LIMIT $4 OFFSET $5`,
        [req.user.id, isReadFilter, type || null, limit, offset],
      ),
    ]);

    res.json({
      notifications: dataResult.rows,
      total: parseInt(countResult.rows[0].filtered_total),
      unread_count: parseInt(countResult.rows[0].unread_total),
      page,
      limit,
    });
  } catch (err) {
    logger.error("Get notifications error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/notifications/unread-count - Get unread notification count
router.get("/unread-count", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false",
      [req.user.id],
    );

    res.json({ unread_count: parseInt(result.rows[0].count) });
  } catch (err) {
    logger.error("Get unread count error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==================== MARK AS READ ====================

// PUT /api/notifications/read-all/all - Mark all notifications as read
// IMPORTANT: this must be registered BEFORE /:id/read — otherwise Express
// matches "read-all" as the :id parameter and returns 400 before reaching here.
router.put("/read-all/all", authenticate, async (req, res) => {
  try {
    await pool.query(
      "UPDATE notifications SET is_read = true, updated_at = NOW() WHERE user_id = $1 AND is_read = false",
      [req.user.id],
    );

    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    logger.error("Mark all as read error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/notifications/:id/read - Mark single notification as read
router.put("/:id/read", authenticate, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    if (isNaN(notificationId))
      return res.status(400).json({ error: "Invalid notification ID" });

    const result = await pool.query(
      "UPDATE notifications SET is_read = true, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING *",
      [notificationId, req.user.id],
    );

    if (!result.rows[0])
      return res.status(404).json({ error: "Notification not found" });

    res.json({
      message: "Notification marked as read",
      notification: result.rows[0],
    });
  } catch (err) {
    logger.error("Mark as read error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==================== DELETE NOTIFICATIONS ====================

// DELETE /api/notifications/:id - Delete notification
router.delete("/:id", authenticate, async (req, res) => {
  try {
    const notificationId = parseInt(req.params.id);
    if (isNaN(notificationId))
      return res.status(400).json({ error: "Invalid notification ID" });

    const result = await pool.query(
      "DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING id",
      [notificationId, req.user.id],
    );

    if (!result.rows[0])
      return res.status(404).json({ error: "Notification not found" });

    res.json({ message: "Notification deleted" });
  } catch (err) {
    logger.error("Delete notification error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/notifications - Delete all notifications
router.delete("/", authenticate, async (req, res) => {
  try {
    await pool.query("DELETE FROM notifications WHERE user_id = $1", [
      req.user.id,
    ]);

    res.json({ message: "All notifications deleted" });
  } catch (err) {
    logger.error("Delete all notifications error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==================== PREFERENCES ====================

/**
 * GET /api/v1/notifications/preferences - Get user notification preferences.
 */
router.get("/preferences/settings", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        COALESCE((meta->>'notifications_enabled')::boolean, true) AS notifications_enabled,
        COALESCE((meta->>'notifications_email')::boolean, false) AS notifications_email,
        COALESCE(meta->>'notification_types', 'all') AS notification_types
       FROM users
       WHERE id = $1`,
      [req.user.id],
    );
    const prefs = result.rows[0] || {};
    res.json({
      notifications_enabled: prefs.notifications_enabled !== false,
      notifications_email: prefs.notifications_email === true,
      notification_types: prefs.notification_types || 'all',
    });
  } catch (err) {
    logger.error("Get preferences error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /api/v1/notifications/preferences - Update notification preferences.
 * Body: { notifications_enabled, notifications_email, notification_types }
 */
router.put("/preferences/settings", authenticate, [
  body("notifications_enabled").optional().isBoolean(),
  body("notifications_email").optional().isBoolean(),
  body("notification_types").optional().isIn(['all', 'comments', 'system']),
], validate, async (req, res) => {
  try {
    const { notifications_enabled, notifications_email, notification_types } = req.body;
    const updates = {};
    if (notifications_enabled !== undefined) updates.notifications_enabled = notifications_enabled;
    if (notifications_email !== undefined) updates.notifications_email = notifications_email;
    if (notification_types) updates.notification_types = notification_types;

    await pool.query(
      `UPDATE users SET meta = COALESCE(meta, '{}') || $1::jsonb WHERE id = $2`,
      [JSON.stringify(updates), req.user.id],
    );

    res.json({ message: "Preferences updated", preferences: updates });
  } catch (err) {
    logger.error("Update preferences error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /api/v1/notifications/sound-pause - Pause/resume notification sounds
 * Body: { paused: boolean }
 */
router.put("/sound-pause", authenticate, [
  body("paused").isBoolean().withMessage("paused must be a boolean"),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { paused } = req.body;
    await pool.query(
      "UPDATE users SET notification_sound_paused = $1, updated_at = NOW() WHERE id = $2",
      [paused, req.user.id],
    );

    res.json({ message: "Notification sound preference updated", notification_sound_paused: paused });
  } catch (err) {
    logger.error("Update sound pause error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
