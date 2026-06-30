import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import pool from '../config/database';
import { authenticate, requirePermission } from '../middleware/auth';
import requireIntParam from '../middleware/requireIntParam';
import { hasPermission } from '../utils/permissions';
import { body, validationResult } from 'express-validator';
import logger from '../utils/logger';
import * as vetsCache from '../utils/vetsCache';

/**
 * Vet review routes
 * POST / - Add review for vet (auth, rating 1-5)
 * GET /vet/:vetId - Get all reviews for vet
 * PUT /:id - Update review (auth, owner)
 * DELETE /:id - Delete review (auth, owner or admin)
 */

async function syncVetRating(vetId: any): Promise<void> {
  await pool.query(
    `UPDATE vets SET
      avg_rating = COALESCE((SELECT AVG(rating)::DECIMAL(3,2) FROM reviews WHERE vet_id = $1 AND is_active = true), 0),
      review_count = (SELECT COUNT(*) FROM reviews WHERE vet_id = $1 AND is_active = true)
    WHERE id = $1`,
    [vetId],
  );
  vetsCache.bust();
}

/**
 * POST /api/v1/reviews
 * Create new review for vet
 */
router.post(
  "/",
  authenticate,
  [
    body("vet_id").isInt(),
    body("rating").isInt({ min: 1, max: 5 }),
    body("comment").optional().trim().isLength({ max: 1000 }).withMessage("Comment max 1000 chars"),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { vet_id, rating, comment } = req.body;
    try {
      const vetExists = await pool.query(
        "SELECT id FROM vets WHERE id = $1 AND is_active = true",
        [vet_id],
      );
      if (!vetExists.rows[0])
        return res.status(404).json({ error: "Vet not found" });

      const existing = await pool.query(
        "SELECT id FROM reviews WHERE user_id = $1 AND vet_id = $2",
        [req.user!.id, vet_id],
      );
      if (existing.rows[0]) {
        const result = await pool.query(
          `UPDATE reviews SET rating=$1, comment=$2, updated_at=CURRENT_TIMESTAMP
         WHERE user_id=$3 AND vet_id=$4 RETURNING *`,
          [rating, comment, req.user!.id, vet_id],
        );
        await syncVetRating(vet_id);
        return res.json({ review: result.rows[0], message: "Review updated" });
      }

      const result = await pool.query(
        `INSERT INTO reviews (user_id, vet_id, rating, comment) VALUES ($1,$2,$3,$4) RETURNING *`,
        [req.user!.id, vet_id, rating, comment],
      );
      await syncVetRating(vet_id);
      res.status(201).json({ review: result.rows[0], message: "Review added" });
    } catch (err) {
      logger.error("Review error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// GET /api/reviews - Admin: Get all reviews
router.get("/", authenticate, requirePermission("reviews"), async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;
  const { search } = req.query;
  try {
    const params = [];
    let where = "WHERE r.is_active = true";
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (u.name ILIKE $${params.length} OR v.name ILIKE $${params.length} OR r.comment ILIKE $${params.length})`;
    }
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT r.*, u.name as user_name, v.name as vet_name
       FROM reviews r
       JOIN users u ON r.user_id = u.id
       JOIN vets v ON r.vet_id = v.id
       ${where}
       ORDER BY r.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const countParams = params.slice(0, -2);
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM reviews r JOIN users u ON r.user_id = u.id JOIN vets v ON r.vet_id = v.id ${where}`,
      countParams,
    );
    res.json({
      reviews: result.rows,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/reviews/:id - Admin or own review
router.delete("/:id", authenticate, requireIntParam("id"), async (req: Request, res: Response) => {
  try {
    const review = await pool.query("SELECT * FROM reviews WHERE id = $1", [
      req.params.id,
    ]);
    if (!review.rows[0])
      return res.status(404).json({ error: "Review not found" });
    // Allowed: the review's owner, OR a staff member with reviews.delete (admin
    // passes via superuser short-circuit inside hasPermission).
    const isOwner = review.rows[0].user_id === req.user!.id;
    if (!isOwner && !hasPermission(req.user, "reviews.delete")) {
      return res.status(403).json({ error: "Not authorized" });
    }
    await pool.query("UPDATE reviews SET is_active = false WHERE id = $1", [
      req.params.id,
    ]);
    await syncVetRating(review.rows[0].vet_id);
    res.json({ message: "Review deleted" });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export = router;
