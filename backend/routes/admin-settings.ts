import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import pool from '../config/database';
import { authenticate, requirePermission } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';

// Only these keys may be updated via PUT /admin/settings
// SMS settings (sms_enabled, admin_phone) are managed by PATCH /admin/sms/settings
const ALLOWED_SETTINGS_KEYS = ['logo_text', 'logo_image'];

// GET /api/v1/admin/stats
router.get("/stats", authenticate, requirePermission("overview"), async (req: Request, res: Response) => {
  try {
    const [users, vets, reviews, pets, lostPets, foundReports, rescueReports, adoptionPosts, totalComments, spamReports] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM users WHERE role = 'user' AND is_active = true"),
      pool.query("SELECT COUNT(*) FROM vets WHERE is_active = true"),
      pool.query("SELECT COUNT(*) FROM reviews WHERE is_active = true"),
      pool.query("SELECT COUNT(*) FROM pets WHERE is_active = true"),
      pool.query("SELECT COUNT(*) FROM lost_pet_reports WHERE is_active = true AND is_found = false"),
      pool.query("SELECT COUNT(*) FROM found_pet_reports WHERE is_active = true"),
      pool.query("SELECT COUNT(*) FROM rescue_posts WHERE is_active = true"),
      pool.query("SELECT COUNT(*) FROM adoption_posts WHERE is_active = true"),
      pool.query("SELECT COUNT(*) FROM post_comments WHERE is_active = true"),
      pool.query("SELECT COUNT(*) FROM post_comments WHERE report_count >= 1 AND is_active = true"),
    ]);
    res.json({
      users: parseInt(users.rows[0].count),
      vets: parseInt(vets.rows[0].count),
      reviews: parseInt(reviews.rows[0].count),
      pets: parseInt(pets.rows[0].count),
      lostPets: parseInt(lostPets.rows[0].count),
      foundReports: parseInt(foundReports.rows[0].count),
      rescueReports: parseInt(rescueReports.rows[0].count),
      adoptionPosts: parseInt(adoptionPosts.rows[0].count),
      totalComments: parseInt(totalComments.rows[0].count),
      spamReports: parseInt(spamReports.rows[0].count),
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/v1/admin/settings
router.get("/settings", authenticate, requirePermission("settings"), async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM site_settings");
    const settings: Record<string, any> = {};
    result.rows.forEach((r) => (settings[r.key] = r.value));
    res.json({ settings });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/v1/admin/settings
router.put("/settings", authenticate, requirePermission("settings.edit"), async (req: Request, res: Response) => {
  const { settings } = req.body;
  if (!settings || typeof settings !== "object") {
    return res.status(400).json({ error: "settings object required" });
  }
  const unknownKeys = Object.keys(settings).filter(k => !ALLOWED_SETTINGS_KEYS.includes(k));
  if (unknownKeys.length > 0) {
    return res.status(400).json({ error: `Unknown setting key(s): ${unknownKeys.join(", ")}` });
  }
  const filteredEntries = Object.entries(settings).filter(([k]) => ALLOWED_SETTINGS_KEYS.includes(k));
  if (filteredEntries.length === 0) {
    return res.status(400).json({ error: "No valid settings keys provided" });
  }
  try {
    await Promise.all(filteredEntries.map(([key, value]) =>
      pool.query(
        `INSERT INTO site_settings (key, value) VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = CURRENT_TIMESTAMP`,
        [key, value],
      )
    ));
    logActivity(req.user!.id, "admin_settings_update", { details: { keys: filteredEntries.map(([k]) => k) } });
    res.json({ message: "Settings updated" });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/v1/admin/activity-logs
router.get("/activity-logs", authenticate, requirePermission("overview"), async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;
  const { event_type } = req.query;
  try {
    const params = [];
    let where = "WHERE 1=1";
    if (event_type) {
      params.push(event_type);
      where += ` AND event_type = $${params.length}`;
    }
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT al.*, u.name AS user_name, u.phone AS user_phone, u.email AS user_email
       FROM activity_logs al
       LEFT JOIN users u ON u.id = al.user_id
       ${where} ORDER BY al.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const countParams = params.slice(0, -2);
    const count = await pool.query(`SELECT COUNT(*) FROM activity_logs al ${where}`, countParams);
    res.json({ logs: result.rows, total: parseInt(count.rows[0].count), page, limit });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

export = router;
