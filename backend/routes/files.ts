import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import pool from '../config/database';
import { authenticate } from '../middleware/auth';
import logger from '../utils/logger';
import * as r2 from '../utils/r2';

// GET /api/v1/files/:filename — serve private files (vet docs, etc.) from R2.
// The object lives in the PRIVATE bucket (no public access); bytes are streamed
// through this authed endpoint after an ownership check. The R2 URL is never
// exposed to the client.
router.get("/:filename", authenticate, async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;

    // Block path traversal + SQL LIKE wildcard chars
    if (filename.includes("..") || filename.includes("/") || filename.includes("\\")
        || filename.includes("%") || filename.includes("_")) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    const isAdmin = req.user!.role === "admin";

    if (!isAdmin) {
      // Exact-match ownership check (file_path stored as /api/v1/files/<filename>)
      const docCheck = await pool.query(
        `SELECT vd.id FROM vet_documents vd
         JOIN vets v ON v.id = vd.vet_id
         WHERE vd.file_path = $1 AND v.user_id = $2`,
        [`/api/v1/files/${filename}`, req.user!.id]
      );
      if (docCheck.rows.length === 0) {
        return res.status(403).json({ error: "Access denied" });
      }
    }

    // Stream the object from the private R2 bucket. resolveLocation maps
    // "/api/v1/files/<filename>" → private bucket, key "private/<filename>".
    let object;
    try {
      object = await r2.getObjectStream(`/api/v1/files/${filename}`);
    } catch (err: any) {
      if (err.name === "NoSuchKey" || err.$metadata?.httpStatusCode === 404) {
        return res.status(404).json({ error: "File not found" });
      }
      throw err;
    }

    if (object.contentType) res.setHeader("Content-Type", object.contentType);
    if (object.contentLength != null) res.setHeader("Content-Length", object.contentLength);

    object.body.on("error", (err) => {
      logger.error(`Stream error for ${filename}:`, err);
      if (!res.headersSent) res.status(500).json({ error: "Server error" });
      else res.destroy(err);
    });
    object.body.pipe(res);
  } catch (err: any) {
    logger.error(err);
    if (!res.headersSent) res.status(500).json({ error: "Server error" });
  }
});

export = router;
