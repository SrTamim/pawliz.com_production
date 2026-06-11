const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { authenticate, requirePermission } = require("../middleware/auth");
const { logActivity } = require("../utils/activityLogger");
const logger = require("../utils/logger");

// GET /api/v1/admin/comments/reported
router.get("/reported", authenticate, requirePermission("comments"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pc.id, pc.post_id, pc.post_type, pc.comment_text, pc.report_count,
              pc.is_hidden, pc.created_at, u.name as commenter_name, u.phone as commenter_phone,
              json_agg(json_build_object('reason', cr.reason, 'reporter', ru.name) ORDER BY cr.created_at) as reports
       FROM post_comments pc
       JOIN users u ON u.id = pc.user_id
       JOIN comment_reports cr ON cr.comment_id = pc.id
       JOIN users ru ON ru.id = cr.user_id
       WHERE pc.report_count >= 1
       GROUP BY pc.id, u.name, u.phone
       ORDER BY pc.report_count DESC, pc.created_at DESC`
    );
    res.json({ comments: result.rows });
  } catch (err) {
    logger.error("Get reported comments error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/v1/admin/comments/:id
router.delete("/:id", authenticate, requirePermission("comments.delete"), async (req, res) => {
  const commentId = parseInt(req.params.id);
  if (isNaN(commentId)) return res.status(400).json({ error: "Invalid comment ID" });
  try {
    const result = await pool.query(
      "UPDATE post_comments SET is_active = false WHERE id = $1 RETURNING id",
      [commentId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Comment not found" });
    logActivity(req.user.id, 'comment_deleted_admin', { postId: commentId, postType: 'comment' });
    res.json({ message: "Comment deleted" });
  } catch (err) {
    logger.error("Admin delete comment error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/v1/admin/comments/:id/dismiss
router.post("/:id/dismiss", authenticate, requirePermission("comments.delete"), async (req, res) => {
  const commentId = parseInt(req.params.id);
  if (isNaN(commentId)) return res.status(400).json({ error: "Invalid comment ID" });
  try {
    const r = await pool.query("UPDATE post_comments SET is_hidden = false, report_count = 0 WHERE id = $1 RETURNING id", [commentId]);
    if (!r.rows[0]) return res.status(404).json({ error: "Comment not found" });
    await pool.query("DELETE FROM comment_reports WHERE comment_id = $1", [commentId]);
    res.json({ message: "Comment cleared" });
  } catch (err) {
    logger.error("Admin dismiss comment error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
