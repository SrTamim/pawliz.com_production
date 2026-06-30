import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import pool from '../config/database';
import { authenticate } from '../middleware/auth';
import requireIntParam from '../middleware/requireIntParam';
import upload from '../middleware/upload';
import { deleteUploadedFile, deleteUploadedFiles } from '../utils/fileUtils';
import logger from '../utils/logger';

// POST /api/v1/pets/:id/images
router.post("/:id/images", authenticate, requireIntParam("id"), upload.array("images", 3), async (req: Request, res: Response) => {
  const petDbId = parseInt(req.params.id);
  if (isNaN(petDbId)) return res.status(400).json({ error: "Invalid pet ID" });
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: "No images uploaded" });
    }
    const check = await pool.query(
      "SELECT images FROM pets WHERE id = $1 AND user_id = $2 AND is_active = true",
      [petDbId, req.user!.id],
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Pet not found" });

    const existingImages = check.rows[0].images || [];
    const newImages = (req.files as Express.Multer.File[]).map((f) => `/uploads/public/${f.filename}`);
    const allImages = [...existingImages, ...newImages].slice(-3);
    const removedImages = [...existingImages, ...newImages].slice(0, -3);
    if (removedImages.length > 0) deleteUploadedFiles(removedImages);

    const result = await pool.query(
      "UPDATE pets SET images = $1, updated_at = NOW() WHERE id = $2 RETURNING images",
      [JSON.stringify(allImages), petDbId],
    );
    res.json({
      message: "Images uploaded successfully",
      images: result.rows[0].images || [],
    });
  } catch (err) {
    logger.error("Upload images error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/v1/pets/:id/images/:imageIndex
router.delete("/:id/images/:imageIndex", authenticate, async (req: Request, res: Response) => {
  const petDbId = parseInt(req.params.id);
  const imageIndex = parseInt(req.params.imageIndex);
  if (isNaN(petDbId) || isNaN(imageIndex)) {
    return res.status(400).json({ error: "Invalid parameters" });
  }
  try {
    const check = await pool.query(
      "SELECT images FROM pets WHERE id = $1 AND user_id = $2 AND is_active = true",
      [petDbId, req.user!.id],
    );
    if (!check.rows[0]) return res.status(404).json({ error: "Pet not found" });

    const images = check.rows[0].images || [];
    let deletedImagePath = null;
    if (imageIndex >= 0 && imageIndex < images.length) {
      deletedImagePath = images[imageIndex];
      images.splice(imageIndex, 1);
    }
    const result = await pool.query(
      "UPDATE pets SET images = $1, updated_at = NOW() WHERE id = $2 RETURNING images",
      [images.length > 0 ? JSON.stringify(images) : null, petDbId],
    );
    if (deletedImagePath) deleteUploadedFile(deletedImagePath);
    res.json({
      message: "Image removed successfully",
      images: result.rows[0].images || [],
    });
  } catch (err) {
    logger.error("Delete image error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export = router;
