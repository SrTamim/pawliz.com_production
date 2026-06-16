import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import { body, validationResult } from 'express-validator';
import { authenticate, optionalAuth } from '../middleware/auth';
import upload from '../middleware/upload';
import * as lostFoundService from '../services/lostFoundService';
import * as reactionService from '../services/reactionService';
import logger from '../utils/logger';
import pool from '../config/database';

/**
 * Lost & Found Pet routes
 * GET /lost - List lost pets (public, paginated, filter by type/location)
 * GET /lost/:id - Get lost post details
 * POST /lost - Create lost post (auth)
 * PUT /lost/:id - Update lost post (auth, owner)
 * DELETE /lost/:id - Delete lost post (auth, owner)
 * GET /found - List found pets
 * POST /found - Create found post (auth)
 */

/**
 * GET /api/v1/lost-found/lost
 * Get lost pet posts with pagination and filters
 */
router.get("/lost", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = req.query.offset !== undefined ? parseInt(req.query.offset as string) : (page - 1) * limit;
    const { pet_type, location } = req.query;

    const { posts, total } = await lostFoundService.getLostFeed(
      { pet_type: pet_type as string, location: location as string },
      { page, limit, offset },
    );
    res.json({ posts, total, page, limit });
  } catch (err) {
    logger.error("Get lost pets error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/lost/:id", async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });

    const post = await lostFoundService.getLostById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json({ post });
  } catch (err) {
    logger.error("Get lost pet error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/lost/:id", authenticate, async (req: Request, res: Response) => {
  const reportId = parseInt(req.params.id);
  if (isNaN(reportId)) return res.status(400).json({ error: "Invalid report ID" });

  try {
    const check = await pool.query(
      `SELECT lpr.id FROM lost_pet_reports lpr
       JOIN pets p ON p.id = lpr.pet_id
       WHERE lpr.id = $1 AND p.user_id = $2 AND lpr.is_active = true`,
      [reportId, req.user!.id],
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Report not found" });

    const { lost_location_name, lost_latitude, lost_longitude, additional_details } = req.body;
    const result = await pool.query(
      `UPDATE lost_pet_reports SET
        lost_location_name = COALESCE($1, lost_location_name),
        lost_latitude = COALESCE($2, lost_latitude),
        lost_longitude = COALESCE($3, lost_longitude),
        additional_details = COALESCE($4, additional_details)
       WHERE id = $5
       RETURNING *`,
      [
        lost_location_name || null,
        lost_latitude ? parseFloat(lost_latitude) : null,
        lost_longitude ? parseFloat(lost_longitude) : null,
        additional_details || null,
        reportId,
      ],
    );
    res.json({ message: "Report updated successfully", report: result.rows[0] });
  } catch (err) {
    logger.error("Update lost report error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/lost/:id", authenticate, async (req: Request, res: Response) => {
  const reportId = parseInt(req.params.id);
  if (isNaN(reportId)) return res.status(400).json({ error: "Invalid report ID" });

  try {
    const check = await pool.query(
      `SELECT lpr.id FROM lost_pet_reports lpr
       JOIN pets p ON p.id = lpr.pet_id
       WHERE lpr.id = $1 AND p.user_id = $2 AND lpr.is_active = true`,
      [reportId, req.user!.id],
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Report not found" });

    await pool.query(
      "UPDATE lost_pet_reports SET is_active = false WHERE id = $1",
      [reportId],
    );
    res.json({ message: "Lost report deleted" });
  } catch (err) {
    logger.error("Delete lost report error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/v1/lost-found/lost/:id/found — Mark lost pet as reunited/found
router.put("/lost/:id/found", authenticate, async (req: Request, res: Response) => {
  const reportId = parseInt(req.params.id);
  if (isNaN(reportId)) return res.status(400).json({ error: "Invalid report ID" });

  try {
    // Ownership check — only the pet owner can mark as found
    const check = await pool.query(
      `SELECT lpr.id, lpr.pet_id FROM lost_pet_reports lpr
       JOIN pets p ON p.id = lpr.pet_id
       WHERE lpr.id = $1 AND p.user_id = $2 AND lpr.is_active = true AND lpr.is_found = false`,
      [reportId, req.user!.id],
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Active lost report not found" });

    const { pet_id } = check.rows[0];

    await pool.query(
      "UPDATE lost_pet_reports SET is_found = true, updated_at = NOW() WHERE id = $1",
      [reportId],
    );
    await pool.query(
      "UPDATE pets SET status = 'safe', is_lost = false, updated_at = NOW() WHERE id = $1",
      [pet_id],
    );

    res.json({ message: "Pet marked as reunited" });
  } catch (err) {
    logger.error("Mark lost pet found error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==================== FOUND PET FEED ====================

router.get("/found", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = req.query.offset !== undefined ? parseInt(req.query.offset as string) : (page - 1) * limit;
    const { pet_type, location } = req.query;

    const { posts, total } = await lostFoundService.getFoundFeed(
      { pet_type: pet_type as string, location: location as string },
      { page, limit, offset },
    );
    res.json({ posts, total, page, limit });
  } catch (err) {
    logger.error("Get found pets error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/found/:id", async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });

    const post = await lostFoundService.getFoundById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json({ post });
  } catch (err) {
    logger.error("Get found pet error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post(
  "/found",
  authenticate,
  upload.array("images", 3),
  [
    body("pet_type").isIn(["dog", "cat", "other"]).withMessage("Invalid pet type"),
    body("found_date").notEmpty().withMessage("Found date is required")
      .isISO8601().withMessage("Found date must be a valid date (YYYY-MM-DD)")
      .custom((val) => { if (new Date(val) > new Date()) throw new Error("Found date cannot be in the future"); return true; }),
    body("found_location_name").notEmpty().withMessage("Location name is required"),
    body("found_latitude").optional({ nullable: true, checkFalsy: true }).isFloat({ min: -90, max: 90 }).withMessage("Latitude must be between -90 and 90"),
    body("found_longitude").optional({ nullable: true, checkFalsy: true }).isFloat({ min: -180, max: 180 }).withMessage("Longitude must be between -180 and 180"),
    body("description").optional().isLength({ max: 2000 }).withMessage("Description max 2000 chars"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const imagePaths = req.files ? (req.files as Express.Multer.File[]).map((f) => `/uploads/public/${f.filename}`) : [];

    try {
      const post = await lostFoundService.createFoundReport(req.user!.id, req.body, imagePaths);
      res.status(201).json({ message: "Found pet report created successfully", post });
    } catch (err) {
      logger.error("Create found pet error:", err);
      if (imagePaths.length > 0) {
        try { require("../utils/fileUtils").deleteUploadedFiles(imagePaths); } catch {}
      }
      res.status(500).json({ error: "Server error" });
    }
  },
);

router.put("/found/:id", authenticate, upload.array("images", 3), async (req: Request, res: Response) => {
  const postId = parseInt(req.params.id);
  if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });

  const newImagePaths = req.files ? (req.files as Express.Multer.File[]).map((f) => `/uploads/public/${f.filename}`) : [];

  try {
    const post = await lostFoundService.updateFoundReport(postId, req.user!.id, req.body, newImagePaths);
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json({ message: "Post updated successfully", post });
  } catch (err) {
    logger.error("Update found pet error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/found/:id", authenticate, async (req: Request, res: Response) => {
  const postId = parseInt(req.params.id);
  if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });

  try {
    const deleted = await lostFoundService.deleteFoundReport(postId, req.user!.id);
    if (!deleted) return res.status(404).json({ error: "Post not found" });

    pool.query(
      `DELETE FROM notifications WHERE id IN (SELECT notification_id FROM contact_notifications WHERE post_id = $1 AND post_type = 'found')`,
      [postId],
    ).catch((err) => logger.error("Cleanup found-post notifications failed:", err.message));

    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    logger.error("Delete found pet error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==================== COMMENTS ====================

router.post(
  "/comments",
  authenticate,
  [
    body("post_id").isInt().withMessage("Invalid post ID"),
    body("post_type").isIn(["lost", "found"]).withMessage("Invalid post type"),
    body("comment_text").trim().notEmpty().withMessage("Comment cannot be empty").isLength({ max: 1000 }).withMessage("Comment max 1000 chars"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { post_id, post_type, comment_text } = req.body;
    try {
      const comment = await lostFoundService.addComment(post_id, post_type, req.user!.id, comment_text, req.user!.name);
      res.status(201).json({ message: "Comment added successfully", comment });
    } catch (err) {
      logger.error("Add comment error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

router.get("/comments/:postType/:postId", async (req: Request, res: Response) => {
  try {
    const { postType, postId } = req.params;
    if (!["lost", "found"].includes(postType))
      return res.status(400).json({ error: "Invalid post type" });

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;
    const { rows, total } = await lostFoundService.getComments(postType, postId, limit, offset);
    res.json({ comments: rows, total, hasMore: offset + rows.length < total });
  } catch (err) {
    logger.error("Get comments error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/comments/:id", authenticate, async (req: Request, res: Response) => {
  const commentId = parseInt(req.params.id);
  if (isNaN(commentId)) return res.status(400).json({ error: "Invalid comment ID" });

  try {
    const result = await lostFoundService.deleteComment(commentId, req.user!.id);
    if (result === "not_found") return res.status(404).json({ error: "Comment not found" });
    if (result === "forbidden") return res.status(403).json({ error: "Unauthorized" });
    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    logger.error("Delete comment error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==================== REACTIONS ====================

// POST /api/v1/lost-found/reactions - Toggle a reaction (love/sad/angry) on a post
router.post(
  "/reactions",
  authenticate,
  [
    body("post_id").isInt().withMessage("Invalid post ID"),
    body("post_type").isIn(["lost", "found"]).withMessage("Invalid post type"),
    body("reaction_type").isIn(["love", "sad", "angry"]).withMessage("Invalid reaction type"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { post_id, post_type, reaction_type } = req.body;
    try {
      const state = await reactionService.toggleReaction(post_type, parseInt(post_id), req.user!.id, reaction_type);
      res.json(state);
    } catch (err) {
      logger.error("Toggle reaction error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// GET /api/v1/lost-found/reactions/:postType/:postId - Counts + this user's reaction
router.get("/reactions/:postType/:postId", optionalAuth, async (req: Request, res: Response) => {
  try {
    const { postType, postId } = req.params;
    if (!reactionService.isPostType(postType))
      return res.status(400).json({ error: "Invalid post type" });
    const id = parseInt(postId);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid post ID" });

    const state = await reactionService.getReactionState(postType, id, req.user?.id ?? null);
    res.json(state);
  } catch (err) {
    logger.error("Get reactions error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export = router;
