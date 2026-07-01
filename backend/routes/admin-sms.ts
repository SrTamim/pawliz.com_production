import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import pool from '../config/database';
import { authenticate, requirePermission } from '../middleware/auth';
import * as smsService from '../services/smsService';
import logger from '../utils/logger';

// GET /api/v1/admin/sms/balance
router.get("/balance", authenticate, requirePermission("sms-settings"), async (req: Request, res: Response) => {
  try {
    const data = await smsService.getBalance();
    res.json({ balance: data });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Failed to fetch SMS balance" });
  }
});

// GET /api/v1/admin/sms/settings
router.get("/settings", authenticate, requirePermission("sms-settings"), async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT key, value FROM site_settings WHERE key IN ('sms_enabled', 'admin_phone')",
    );
    const settings: Record<string, any> = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    res.json({
      sms_enabled: settings.sms_enabled === "true",
      admin_phone: settings.admin_phone || "",
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Failed to fetch SMS settings" });
  }
});

// PATCH /api/v1/admin/sms/settings
router.patch("/settings", authenticate, requirePermission("sms-settings.edit"), async (req: Request, res: Response) => {
  try {
    const { sms_enabled, admin_phone } = req.body;
    // Validate before writing: sms_enabled must be boolean; admin_phone must be a
    // valid BD number (01XXXXXXXXX) or empty string to clear it. Prevents garbage/
    // oversized values silently breaking the low-balance SMS alert target.
    if (sms_enabled !== undefined && typeof sms_enabled !== "boolean") {
      return res.status(400).json({ error: "sms_enabled must be a boolean" });
    }
    if (admin_phone !== undefined && admin_phone !== "" && !/^01[3-9]\d{8}$/.test(String(admin_phone).trim())) {
      return res.status(400).json({ error: "Valid Bangladeshi phone number required (01XXXXXXXXX)" });
    }
    const updates = [];
    if (sms_enabled !== undefined) {
      updates.push(
        pool.query(
          "INSERT INTO site_settings (key, value) VALUES ('sms_enabled', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
          [String(sms_enabled)],
        ),
      );
    }
    if (admin_phone !== undefined) {
      updates.push(
        pool.query(
          "INSERT INTO site_settings (key, value) VALUES ('admin_phone', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()",
          [admin_phone],
        ),
      );
    }
    await Promise.all(updates);
    smsService.bustSmsSettingsCache();
    res.json({ message: "SMS settings updated" });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Failed to update SMS settings" });
  }
});

export = router;
