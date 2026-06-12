import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import { body } from 'express-validator';
import pool from '../config/database';
import { authenticate } from '../middleware/auth';
import validate from '../middleware/validate';
import logger from '../utils/logger';
import { logActivity } from '../utils/activityLogger';

// POST /api/v1/pets/:id/lost
router.post("/:id/lost", authenticate, [
  body("lost_date").notEmpty().withMessage("Lost date is required"),
], validate, async (req: Request, res: Response) => {
  const petDbId = parseInt(req.params.id);
  const { lost_date, lost_location_name, lost_latitude, lost_longitude, additional_details } = req.body;
  const client = await pool.connect();
  try {
    const check = await client.query(
      "SELECT id, pet_id, name, type FROM pets WHERE id = $1 AND user_id = $2 AND is_active = true",
      [petDbId, req.user!.id],
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Pet not found" });

    await client.query("BEGIN");

    await client.query(
      "UPDATE pets SET is_lost = true, status = 'lost', updated_at = NOW() WHERE id = $1",
      [petDbId],
    );
    const lostInsert = await client.query(
      `INSERT INTO lost_pet_reports (pet_id, lost_date, lost_location_name, lost_latitude, lost_longitude, additional_details)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [petDbId, lost_date, lost_location_name || null,
       lost_latitude ? parseFloat(lost_latitude) : null,
       lost_longitude ? parseFloat(lost_longitude) : null,
       additional_details || null],
    );

    await client.query("COMMIT");

    const pi = check.rows[0];
    logActivity(req.user!.id, 'pet_marked_lost', {
      postId: lostInsert.rows[0].id, postType: 'lost',
      petDbId, petUid: pi.pet_id, petName: pi.name, petType: pi.type,
    });

    res.json({ message: "Pet marked as lost" });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("Mark lost error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// PUT /api/v1/pets/:id/found
router.put("/:id/found", authenticate, async (req: Request, res: Response) => {
  const petDbId = parseInt(req.params.id);
  const client = await pool.connect();
  try {
    const check = await client.query(
      "SELECT id FROM pets WHERE id = $1 AND user_id = $2 AND is_active = true",
      [petDbId, req.user!.id],
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Pet not found" });

    await client.query("BEGIN");
    await client.query("UPDATE pets SET is_lost = false, status = 'safe', updated_at = NOW() WHERE id = $1", [petDbId]);
    const lostReports = await client.query("SELECT id FROM lost_pet_reports WHERE pet_id = $1 AND is_found = false", [petDbId]);
    await client.query("UPDATE lost_pet_reports SET is_found = true WHERE pet_id = $1 AND is_found = false", [petDbId]);
    await client.query("COMMIT");

    // Delete contact notifications for resolved lost posts
    for (const row of lostReports.rows) {
      pool.query(
        `DELETE FROM notifications WHERE id IN (SELECT notification_id FROM contact_notifications WHERE post_id = $1 AND post_type = 'lost')`,
        [row.id],
      ).catch((err) => logger.error("Cleanup lost-post notifications failed:", err.message));
    }

    logActivity(req.user!.id, 'pet_marked_found', { petDbId });

    res.json({ message: "Pet marked as found" });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("Mark found error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// POST /api/v1/pets/:id/adoption
router.post("/:id/adoption", authenticate, async (req: Request, res: Response) => {
  const petDbId = parseInt(req.params.id);
  const { reason, adoption_requirements, contact_preference } = req.body;
  const client = await pool.connect();
  try {
    const check = await client.query(
      "SELECT id, name FROM pets WHERE id = $1 AND user_id = $2 AND is_active = true",
      [petDbId, req.user!.id],
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Pet not found" });

    await client.query("BEGIN");

    await client.query("UPDATE pets SET is_for_adoption = true, updated_at = NOW() WHERE id = $1", [petDbId]);
    await client.query(
      "UPDATE adoption_posts SET status = 'withdrawn', updated_at = NOW() WHERE pet_id = $1 AND status = 'available'",
      [petDbId],
    );
    await client.query(
      `INSERT INTO adoption_posts (pet_id, reason, adoption_requirements, contact_preference)
       VALUES ($1, $2, $3, $4)`,
      [petDbId, reason || null, adoption_requirements || null, contact_preference || null],
    );

    await client.query("COMMIT");

    logActivity(req.user!.id, 'pet_marked_for_adoption', { petDbId, petName: check.rows[0].name });

    res.json({ message: "Pet marked for adoption" });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("Mark adoption error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// PUT /api/v1/pets/:id/adopted
router.put("/:id/adopted", authenticate, async (req: Request, res: Response) => {
  const petDbId = parseInt(req.params.id);
  const client = await pool.connect();
  try {
    const check = await client.query("SELECT id FROM pets WHERE id = $1 AND user_id = $2 AND is_active = true", [petDbId, req.user!.id]);
    if (!check.rows[0]) return res.status(404).json({ error: "Pet not found" });

    await client.query("BEGIN");
    await client.query("UPDATE pets SET is_for_adoption = false, updated_at = NOW() WHERE id = $1", [petDbId]);
    await client.query(
      "UPDATE adoption_posts SET status = 'adopted', updated_at = NOW() WHERE pet_id = $1 AND status = 'available'",
      [petDbId],
    );
    await client.query("COMMIT");

    res.json({ message: "Pet marked as adopted" });
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error("Mark adopted error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

export = router;
