const express = require("express");
const router = express.Router();
const pool = require("../config/database");
const { authenticate, requirePermission } = require("../middleware/auth");
const smsService = require("../services/smsService");

// GET /api/v1/admin/sms/balance
router.get("/balance", authenticate, requirePermission("sms-settings"), async (req, res) => {
  try {
    const data = await smsService.getBalance();
    res.json({ balance: data });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch SMS balance" });
  }
});

// GET /api/v1/admin/sms/settings
router.get("/settings", authenticate, requirePermission("sms-settings"), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT key, value FROM site_settings WHERE key IN ('sms_enabled', 'admin_phone')",
    );
    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }
    res.json({
      sms_enabled: settings.sms_enabled === "true",
      admin_phone: settings.admin_phone || "",
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch SMS settings" });
  }
});

// PATCH /api/v1/admin/sms/settings
router.patch("/settings", authenticate, requirePermission("sms-settings.edit"), async (req, res) => {
  try {
    const { sms_enabled, admin_phone } = req.body;
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
    res.status(500).json({ error: "Failed to update SMS settings" });
  }
});

module.exports = router;
