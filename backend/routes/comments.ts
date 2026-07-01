import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import pool from '../config/database';
import { authenticate } from '../middleware/auth';
import requireIntParam from '../middleware/requireIntParam';
import { body, validationResult } from 'express-validator';
import logger from '../utils/logger';

const REPORT_HIDE_THRESHOLD = 3;
const VALID_REASONS = ["spam", "harassment", "inappropriate", "misinformation", "other"];

/**
 * Comment reporting routes
 * POST /:id/report - Report comment as spam/inappropriate (auth, reason)
 * Auto-hides comment after 3+ reports
 */

/**
 * POST /api/v1/comments/:id/report
 * Report comment for moderation
 * Returns: { message, hidden: boolean }
 */
router.post(
  "/:id/report",
  authenticate,
  requireIntParam("id"),
  [body("reason").isIn(VALID_REASONS).withMessage("Invalid reason")],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const commentId = parseInt(req.params.id);

    const { reason } = req.body;

    try {
      const commentCheck = await pool.query(
        "SELECT id, user_id FROM post_comments WHERE id = $1 AND is_active = true",
        [commentId]
      );
      if (!commentCheck.rows[0])
        return res.status(404).json({ error: "Comment not found" });

      if (commentCheck.rows[0].user_id === req.user!.id)
        return res.status(400).json({ error: "Cannot report your own comment" });

      try {
        await pool.query(
          "INSERT INTO comment_reports (comment_id, user_id, reason) VALUES ($1, $2, $3)",
          [commentId, req.user!.id, reason]
        );
      } catch (uniqueErr: any) {
        if (uniqueErr.code === "23505")
          return res.status(409).json({ error: "Already reported" });
        throw uniqueErr;
      }

      const updated = await pool.query(
        `UPDATE post_comments
         SET report_count = report_count + 1,
             is_hidden = CASE WHEN report_count + 1 >= $1 THEN true ELSE is_hidden END
         WHERE id = $2
         RETURNING report_count, is_hidden`,
        [REPORT_HIDE_THRESHOLD, commentId]
      );

      res.json({ message: "Comment reported", hidden: updated.rows[0].is_hidden });
    } catch (err) {
      logger.error("Report comment error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

export = router;
