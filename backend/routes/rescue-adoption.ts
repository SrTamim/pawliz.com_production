import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import { authenticate } from '../middleware/auth';
import upload from '../middleware/upload';
import { deleteUploadedFiles } from '../utils/fileUtils';
import { createNotification } from '../services/notificationService';
import logger from '../utils/logger';
import validate from '../middleware/validate';

/**
 * Rescue & Adoption routes
 * GET /rescue - List rescue posts (public, paginated, filter by type/location)
 * GET /rescue/:id - Get rescue post details
 * POST /rescue - Create rescue post (auth)
 * PUT /rescue/:id - Update rescue post (auth, owner)
 * DELETE /rescue/:id - Delete rescue post (auth, owner)
 * GET /adoption - List adoption posts
 * POST /adoption - Create adoption post (auth)
 */

/**
 * GET /api/v1/rescue-adoption/rescue
 * Get rescue posts with pagination and filters
 */
router.get("/rescue", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = req.query.offset !== undefined ? parseInt(req.query.offset as string) : (page - 1) * limit;
    const { pet_type, location } = req.query;
    const baseFrom = `FROM rescue_posts rp
      JOIN users u ON u.id = rp.user_id`;
    let where = ` WHERE rp.is_active = true AND rp.status = 'active'`;
    const params = [];

    if (pet_type) { params.push(pet_type); where += ` AND rp.pet_type = $${params.length}`; }
    if (location) { params.push(`%${location}%`); where += ` AND rp.rescue_location_name ILIKE $${params.length}`; }

    const countResult = await pool.query(`SELECT COUNT(*) ${baseFrom}${where}`, params);
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT rp.*, u.id as owner_id, u.name as owner_name, u.profile_picture,
             COALESCE(cc.comment_count, 0) as comment_count
      ${baseFrom}
      LEFT JOIN (
        SELECT post_id, COUNT(*) AS comment_count
        FROM post_comments WHERE post_type = 'rescue' AND is_active = true
        GROUP BY post_id
      ) cc ON cc.post_id = rp.id
      ${where}
      ORDER BY rp.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ posts: result.rows, total: parseInt(countResult.rows[0].count), page, limit });
  } catch (err) {
    logger.error("Get rescue posts error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/rescue-adoption/rescue/:id - Get rescue post details
router.get("/rescue/:id", async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });

    const result = await pool.query(
      `SELECT rp.*, u.id as owner_id, u.name as owner_name, u.profile_picture
       FROM rescue_posts rp
       JOIN users u ON u.id = rp.user_id
       WHERE rp.id = $1 AND rp.is_active = true`,
      [postId],
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Post not found" });
    res.json({ post: result.rows[0] });
  } catch (err) {
    logger.error("Get rescue post error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/rescue-adoption/rescue - Create a rescue post
router.post(
  "/rescue",
  authenticate,
  upload.array("images", 3),
  [
    body("pet_type").isIn(["dog", "cat", "other"]).withMessage("Invalid pet type"),
    body("rescue_date").notEmpty().withMessage("Rescue date is required")
      .isISO8601().withMessage("Rescue date must be a valid date (YYYY-MM-DD)")
      .custom((val) => { if (new Date(val) > new Date()) throw new Error("Rescue date cannot be in the future"); return true; }),
    body("rescue_location_name").notEmpty().withMessage("Rescue location name is required"),
    body("rescue_latitude").optional({ nullable: true, checkFalsy: true }).isFloat({ min: -90, max: 90 }).withMessage("Latitude must be between -90 and 90"),
    body("rescue_longitude").optional({ nullable: true, checkFalsy: true }).isFloat({ min: -180, max: 180 }).withMessage("Longitude must be between -180 and 180"),
    body("description").optional().isLength({ max: 2000 }).withMessage("Description max 2000 chars"),
    body("urgency").optional().isIn(["low", "medium", "high", "critical"]).withMessage("urgency must be low, medium, high, or critical"),
  ],
  validate,
  async (req: Request, res: Response) => {

    const {
      pet_type, color, gender, breed,
      rescue_location_name, rescue_latitude, rescue_longitude,
      rescue_date, description, urgency,
    } = req.body;

    try {
      let imagePaths: string[] = [];
      if (req.files && (req.files as Express.Multer.File[]).length > 0) {
        imagePaths = (req.files as Express.Multer.File[]).map((f) => `/uploads/public/${f.filename}`);
      }

      const result = await pool.query(
        `INSERT INTO rescue_posts
        (user_id, pet_type, color, gender, breed, rescue_location_name, rescue_latitude, rescue_longitude, rescue_date, images, description, urgency)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *`,
        [
          req.user!.id, pet_type,
          color || null, gender || null, breed || null,
          rescue_location_name || null,
          rescue_latitude ? parseFloat(rescue_latitude) : null,
          rescue_longitude ? parseFloat(rescue_longitude) : null,
          rescue_date,
          imagePaths.length > 0 ? JSON.stringify(imagePaths) : null,
          description || null,
          urgency || "medium",
        ],
      );

      pool.query(
        `INSERT INTO activity_logs (event_type, post_id, post_type, pet_type, pet_color, pet_gender, pet_breed, user_id, location_name, event_date, additional_details)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        ['rescue_report', result.rows[0].id, 'rescue', pet_type, color || null, gender || null, breed || null, req.user!.id, rescue_location_name || null, rescue_date, description || null],
      ).catch((err) => logger.error('Activity log insert failed:', err));

      res.status(201).json({ message: "Rescue post created successfully", post: result.rows[0] });
    } catch (err) {
      logger.error("Create rescue post error:", err);
      if (req.files && (req.files as Express.Multer.File[]).length > 0) {
        try { deleteUploadedFiles((req.files as Express.Multer.File[]).map((f) => `/uploads/public/${f.filename}`)); } catch {}
      }
      res.status(500).json({ error: "Server error" });
    }
  },
);

// PUT /api/rescue-adoption/rescue/:id - Update rescue post
router.put(
  "/rescue/:id",
  authenticate,
  upload.array("images", 3),
  [
    body("pet_type").optional().isIn(["dog", "cat", "other"]).withMessage("Invalid pet type"),
    body("status").optional().isIn(["active", "closed", "found"]).withMessage("Invalid status"),
    body("description").optional().isLength({ max: 2000 }).withMessage("Description max 2000 chars"),
    body("urgency").optional().isIn(["low", "medium", "high", "critical"]).withMessage("urgency must be low, medium, high, or critical"),
  ],
  validate,
  async (req: Request, res: Response) => {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });

  try {
    const check = await pool.query(
      "SELECT images FROM rescue_posts WHERE id = $1 AND user_id = $2 AND is_active = true",
      [postId, req.user!.id],
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Post not found" });

    let images = check.rows[0].images || [];

    if (req.files && (req.files as Express.Multer.File[]).length > 0) {
      const newImages = (req.files as Express.Multer.File[]).map((f) => `/uploads/public/${f.filename}`);
      images = [...images, ...newImages].slice(-3);
    }

    const { pet_type, color, gender, breed, rescue_location_name, rescue_latitude, rescue_longitude, description, urgency, status } = req.body;

    const result = await pool.query(
      `UPDATE rescue_posts SET
      pet_type = COALESCE($1, pet_type),
      color = COALESCE($2, color),
      gender = COALESCE($3, gender),
      breed = COALESCE($4, breed),
      rescue_location_name = COALESCE($5, rescue_location_name),
      rescue_latitude = COALESCE($6, rescue_latitude),
      rescue_longitude = COALESCE($7, rescue_longitude),
      images = $8,
      description = COALESCE($9, description),
      urgency = COALESCE($10, urgency),
      status = COALESCE($11, status),
      updated_at = NOW()
      WHERE id = $12 AND user_id = $13
      RETURNING *`,
      [
        pet_type || null, color || null, gender || null, breed || null,
        rescue_location_name || null,
        rescue_latitude ? parseFloat(rescue_latitude) : null,
        rescue_longitude ? parseFloat(rescue_longitude) : null,
        images.length > 0 ? JSON.stringify(images) : null,
        description || null,
        urgency || null, status || null,
        postId, req.user!.id,
      ],
    );

    res.json({ message: "Post updated successfully", post: result.rows[0] });
  } catch (err) {
    logger.error("Update rescue post error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/rescue-adoption/rescue/:id - Delete rescue post (owner or admin)
router.delete("/rescue/:id", authenticate, async (req: Request, res: Response) => {
  const postId = parseInt(req.params.id);
  if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });

  try {
    const isAdmin = req.user!.role === "admin";
    const check = await pool.query(
      "SELECT images FROM rescue_posts WHERE id = $1" + (isAdmin ? "" : " AND user_id = $2"),
      isAdmin ? [postId] : [postId, req.user!.id],
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Post not found" });

    const imgs = check.rows[0].images || [];
    if (imgs.length > 0) deleteUploadedFiles(imgs);

    await pool.query(
      "UPDATE rescue_posts SET is_active = false, updated_at = NOW() WHERE id = $1",
      [postId],
    );

    pool.query(
      `DELETE FROM notifications WHERE id IN (SELECT notification_id FROM contact_notifications WHERE post_id = $1 AND post_type = 'rescue')`,
      [postId],
    ).catch(() => {});

    pool.query(
      `INSERT INTO activity_logs (event_type, post_id, post_type, user_id)
       VALUES ('rescue_report_deleted', $1, 'rescue', $2)`,
      [postId, req.user!.id],
    ).catch((err) => logger.error('Activity log insert failed:', err));

    res.json({ message: "Post deleted successfully" });
  } catch (err) {
    logger.error("Delete rescue post error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==================== ADOPTION FEED ====================

// GET /api/rescue-adoption/adoption - Get adoptable pets with filters
router.get("/adoption", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = req.query.offset !== undefined ? parseInt(req.query.offset as string) : (page - 1) * limit;
    const { pet_type, location } = req.query;
    const baseFrom = `FROM adoption_posts ap
      JOIN pets p ON p.id = ap.pet_id
      JOIN users u ON u.id = p.user_id`;
    let where = ` WHERE p.is_active = true AND ap.status = 'available'`;
    const params = [];

    if (pet_type) { params.push(pet_type); where += ` AND p.type = $${params.length}`; }
    if (location) { params.push(`%${location}%`); where += ` AND u.address ILIKE $${params.length}`; }

    const countResult = await pool.query(`SELECT COUNT(*) ${baseFrom}${where}`, params);
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT ap.*, p.id as pet_db_id, p.pet_id, p.name, p.type, p.breed, p.color, p.images, p.gender, p.age, p.weight, p.potty_trained,
             u.id as owner_id, u.name as owner_name, u.profile_picture,
             COALESCE(cc.comment_count, 0) as comment_count
      ${baseFrom}
      LEFT JOIN (
        SELECT post_id, COUNT(*) AS comment_count
        FROM post_comments WHERE post_type = 'adoption' AND is_active = true
        GROUP BY post_id
      ) cc ON cc.post_id = ap.id
      ${where}
      ORDER BY ap.posted_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    res.json({ posts: result.rows, total: parseInt(countResult.rows[0].count), page, limit });
  } catch (err) {
    logger.error("Get adoption posts error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/rescue-adoption/adoption/:id - Get adoption post details
router.get("/adoption/:id", async (req: Request, res: Response) => {
  try {
    const postId = parseInt(req.params.id);
    if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });

    const result = await pool.query(
      `SELECT ap.*, p.id as pet_db_id, p.pet_id, p.name, p.type, p.breed, p.color, p.images, p.gender, p.age, p.weight, p.potty_trained,
              u.id as owner_id, u.name as owner_name, u.profile_picture
       FROM adoption_posts ap
       JOIN pets p ON p.id = ap.pet_id
       JOIN users u ON u.id = p.user_id
       WHERE ap.id = $1 AND p.is_active = true`,
      [postId],
    );

    if (!result.rows[0]) return res.status(404).json({ error: "Post not found" });
    res.json({ post: result.rows[0] });
  } catch (err) {
    logger.error("Get adoption post error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/rescue-adoption/adoption - Create adoption post
router.post(
  "/adoption",
  authenticate,
  [
    body("pet_id").isInt().withMessage("Invalid pet ID"),
    body("adoption_requirements").optional().isLength({ max: 1000 }).withMessage("Adoption requirements max 1000 chars"),
  ],
  validate,
  async (req: Request, res: Response) => {
    const { pet_id, adoption_requirements } = req.body;
    try {
      const petCheck = await pool.query(
        "SELECT id FROM pets WHERE id = $1 AND user_id = $2 AND is_active = true",
        [pet_id, req.user!.id]
      );
      if (!petCheck.rows[0]) return res.status(404).json({ error: "Pet not found" });

      const result = await pool.query(
        `INSERT INTO adoption_posts (pet_id, user_id, adoption_requirements, status)
         VALUES ($1, $2, $3, 'available')
         RETURNING *`,
        [pet_id, req.user!.id, adoption_requirements || null]
      );
      res.status(201).json({ message: "Adoption post created", post: result.rows[0] });
    } catch (err) {
      logger.error("Create adoption post error:", err);
      res.status(500).json({ error: "Server error" });
    }
  }
);

// DELETE /api/rescue-adoption/adoption/:id - Delete adoption post (owner or admin)
router.delete("/adoption/:id", authenticate, async (req: Request, res: Response) => {
  const postId = parseInt(req.params.id);
  if (isNaN(postId)) return res.status(400).json({ error: "Invalid post ID" });

  try {
    const isAdmin = req.user!.role === "admin";
    const check = await pool.query(
      `SELECT ap.id FROM adoption_posts ap
       WHERE ap.id = $1` + (isAdmin ? "" : " AND ap.user_id = $2"),
      isAdmin ? [postId] : [postId, req.user!.id]
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Post not found" });

    await pool.query(
      "UPDATE adoption_posts SET status = 'withdrawn', updated_at = NOW() WHERE id = $1",
      [postId]
    );

    pool.query(
      `DELETE FROM notifications WHERE id IN (SELECT notification_id FROM contact_notifications WHERE post_id = $1 AND post_type = 'adoption')`,
      [postId],
    ).catch(() => {});

    pool.query(
      `INSERT INTO activity_logs (event_type, post_id, post_type, user_id)
       VALUES ('adoption_post_closed', $1, 'adoption', $2)`,
      [postId, req.user!.id]
    ).catch((err) => logger.error('Activity log insert failed:', err));

    res.json({ message: "Adoption post deleted" });
  } catch (err) {
    logger.error("Delete adoption post error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==================== COMMENTS ====================

// POST /api/rescue-adoption/comments - Add comment
router.post(
  "/comments",
  authenticate,
  [
    body("post_id").isInt().withMessage("Invalid post ID"),
    body("post_type").isIn(["rescue", "adoption"]).withMessage("Invalid post type"),
    body("comment_text").trim().notEmpty().withMessage("Comment cannot be empty"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { post_id, post_type, comment_text } = req.body;

    try {
      const ownerQuery = post_type === "rescue"
        ? `SELECT user_id FROM rescue_posts WHERE id = $1 AND is_active = true`
        : `SELECT p.user_id FROM adoption_posts ap JOIN pets p ON p.id = ap.pet_id WHERE ap.id = $1 AND ap.is_active = true AND p.is_active = true`;

      const [commentResult, ownerResult] = await Promise.all([
        pool.query(
          `WITH inserted AS (
             INSERT INTO post_comments (post_id, post_type, user_id, comment_text)
             VALUES ($1, $2, $3, $4) RETURNING *
           )
           SELECT i.*, u.name, u.profile_picture
           FROM inserted i JOIN users u ON u.id = i.user_id`,
          [post_id, post_type, req.user!.id, comment_text],
        ),
        pool.query(ownerQuery, [post_id]),
      ]);

      if (ownerResult.rows[0]) {
        const { user_id: postOwnerId } = ownerResult.rows[0];
        if (postOwnerId !== req.user!.id) {
          const commenterName = req.user!.name || "Someone";
          await createNotification(
            postOwnerId,
            "comment_on_post",
            `New comment on your ${post_type} post`,
            `${commenterName} commented: "${comment_text.substring(0, 50)}${comment_text.length > 50 ? "..." : ""}"`,
            post_id,
            post_type,
            req.user!.id,
            `/rescue?post=${post_id}&type=${post_type}`,
          );
        }
      }

      res.status(201).json({ message: "Comment added successfully", comment: commentResult.rows[0] });
    } catch (err) {
      logger.error("Add comment error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// GET /api/rescue-adoption/comments/:postType/:postId - Get comments for a post
router.get("/comments/:postType/:postId", async (req: Request, res: Response) => {
  try {
    const { postType, postId } = req.params;

    if (!["rescue", "adoption"].includes(postType)) {
      return res.status(400).json({ error: "Invalid post type" });
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const offset = parseInt(req.query.offset as string) || 0;

    const [result, countResult] = await Promise.all([
      pool.query(
        `SELECT pc.*, u.name, u.profile_picture FROM post_comments pc
         JOIN users u ON u.id = pc.user_id
         WHERE pc.post_id = $1 AND pc.post_type = $2 AND pc.is_active = true AND pc.is_hidden = false
         ORDER BY pc.created_at DESC
         LIMIT $3 OFFSET $4`,
        [postId, postType, limit, offset],
      ),
      pool.query(
        `SELECT COUNT(*) FROM post_comments WHERE post_id = $1 AND post_type = $2 AND is_active = true AND is_hidden = false`,
        [postId, postType],
      ),
    ]);

    const total = parseInt(countResult.rows[0].count);
    res.json({ comments: result.rows, total, hasMore: offset + result.rows.length < total });
  } catch (err) {
    logger.error("Get comments error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/rescue-adoption/comments/:id - Delete a comment
router.delete("/comments/:id", authenticate, async (req: Request, res: Response) => {
  const commentId = parseInt(req.params.id);
  if (isNaN(commentId)) return res.status(400).json({ error: "Invalid comment ID" });

  try {
    const check = await pool.query("SELECT user_id FROM post_comments WHERE id = $1", [commentId]);
    if (!check.rows[0]) return res.status(404).json({ error: "Comment not found" });

    if (check.rows[0].user_id !== req.user!.id) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    await pool.query("UPDATE post_comments SET is_active = false WHERE id = $1", [commentId]);
    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    logger.error("Delete comment error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export = router;
