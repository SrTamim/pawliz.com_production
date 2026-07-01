import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import pool from '../config/database';
import { authenticate, requirePermission } from '../middleware/auth';
import requireIntParam from '../middleware/requireIntParam';
import upload from '../middleware/upload';
import { body, validationResult } from 'express-validator';
import { deleteUploadedFile } from '../utils/fileUtils';
import logger from '../utils/logger';
import * as vetsCache from '../utils/vetsCache';

/**
 * POST /api/v1/vets-admin
 * Create new vet (admin only)
 */
router.post(
  "/",
  authenticate,
  requirePermission("vets.create"),
  [
    body("name").trim().notEmpty().isLength({ max: 200 }),
    body("location_name").trim().notEmpty().isLength({ max: 200 }),
    body("latitude").isFloat(),
    body("longitude").isFloat(),
    body("address").trim().notEmpty().isLength({ max: 300 }),
    body("contact").optional().isLength({ max: 50 }),
    body("description").optional().isLength({ max: 2000 }),
    body("image").optional().isLength({ max: 255 }),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });
    const {
      name,
      location_name,
      latitude,
      longitude,
      address,
      contact,
      email,
      website,
      image,
      description,
      services,
    } = req.body;
    try {
      const result = await pool.query(
        `INSERT INTO vets (name, location_name, latitude, longitude, address, contact, email, website, image, description, services) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          name,
          location_name,
          latitude,
          longitude,
          address,
          contact || null,
          email || null,
          website || null,
          image || null,
          description || null,
          services || [],
        ],
      );
      vetsCache.bust();
      res.status(201).json({ vet: result.rows[0] });
    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

/**
 * PUT /api/v1/vets-admin/:id
 * Update vet (admin only)
 */
router.put("/:id", authenticate, requirePermission("vets.edit"), requireIntParam("id"), [
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty").isLength({ max: 200 }),
  body("location_name").optional().trim().notEmpty().isLength({ max: 200 }),
  body("latitude").optional().isFloat({ min: -90, max: 90 }),
  body("longitude").optional().isFloat({ min: -180, max: 180 }),
  body("address").optional().trim().notEmpty().isLength({ max: 300 }),
  body("contact").optional().isLength({ max: 50 }),
  body("description").optional().isLength({ max: 2000 }),
  body("image").optional().isLength({ max: 255 }),
  body("email").optional({ checkFalsy: true }).isEmail().withMessage("Valid email required"),
  body("website").optional({ checkFalsy: true }).isURL().withMessage("Valid URL required"),
  body("is_active").optional().isBoolean(),
], async (req: Request, res: Response) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const allowed = ["name", "location_name", "latitude", "longitude", "address", "contact", "email", "website", "image", "description", "services", "is_active"];
  const fields = [];
  const values = [];
  let idx = 1;
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      fields.push(`${key}=$${idx++}`);
      values.push(key === "services" ? (req.body[key] || []) : req.body[key]);
    }
  }
  if (!fields.length) return res.status(400).json({ error: "No fields to update" });
  values.push(req.params.id);
  try {
    const result = await pool.query(
      `UPDATE vets SET ${fields.join(", ")}, updated_at=CURRENT_TIMESTAMP WHERE id=$${idx} RETURNING *`,
      values,
    );
    if (!result.rows[0])
      return res.status(404).json({ error: "Vet not found" });
    vetsCache.bust();
    res.json({ vet: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /api/v1/vets-admin/:id
 * Soft delete vet (admin only)
 */
router.delete("/:id", authenticate, requirePermission("vets.delete"), requireIntParam("id"), async (req: Request, res: Response) => {
  try {
    const vetCheck = await pool.query("SELECT image FROM vets WHERE id = $1", [
      req.params.id,
    ]);
    if (!vetCheck.rows[0]) return res.status(404).json({ error: "Vet not found" });
    const oldImage = vetCheck.rows[0]?.image;

    await pool.query("UPDATE vets SET is_active = false WHERE id = $1", [
      req.params.id,
    ]);

    if (oldImage) {
      deleteUploadedFile(oldImage);
    }

    vetsCache.bust();
    res.json({ message: "Vet deleted successfully" });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/v1/vets-admin/:id/image
 * Upload vet image (admin only)
 */
router.post(
  "/:id/image",
  authenticate,
  requirePermission("vets.edit"),
  requireIntParam("id"),
  upload.single("image"),
  async (req: Request, res: Response) => {
    if (!req.file) return res.status(400).json({ error: "No image uploaded" });
    try {
      const vetCheck = await pool.query(
        "SELECT image FROM vets WHERE id = $1",
        [req.params.id],
      );
      const oldImage = vetCheck.rows[0]?.image;

      const imageUrl = `/uploads/public/${req.file.filename}`;
      await pool.query(
        "UPDATE vets SET image = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
        [imageUrl, req.params.id],
      );

      if (oldImage) {
        deleteUploadedFile(oldImage);
      }

      vetsCache.bust();
      res.json({ image: imageUrl, message: "Image uploaded" });
    } catch (err) {
      logger.error(err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

export = router;
