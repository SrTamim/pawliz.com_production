import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import pool from '../config/database';
import { authenticate, requirePermission } from '../middleware/auth';
import { logActivity } from '../utils/activityLogger';

// Only these keys may be updated via PUT /admin/settings
// SMS settings (sms_enabled, admin_phone) are managed by PATCH /admin/sms/settings
const ALLOWED_SETTINGS_KEYS = ['logo_text', 'logo_image'];

// Each core entity declares its table + the timestamp column used for trends.
// Timestamp columns differ across tables (lost uses reported_at, adoption uses
// posted_at, the rest use created_at) — keep this map as the single source of truth.
const TREND_ENTITIES = {
  users: { table: "users", ts: "created_at", filter: "role = 'user' AND is_active = true" },
  pets: { table: "pets", ts: "created_at", filter: "is_active = true" },
  reviews: { table: "reviews", ts: "created_at", filter: "is_active = true" },
  lostPets: { table: "lost_pet_reports", ts: "reported_at", filter: "is_active = true AND is_found = false" },
  foundReports: { table: "found_pet_reports", ts: "created_at", filter: "is_active = true" },
  rescueReports: { table: "rescue_posts", ts: "created_at", filter: "is_active = true" },
  adoptionPosts: { table: "adoption_posts", ts: "posted_at", filter: "is_active = true" },
} as const;

const num = (r: any) => parseInt(r.rows[0].count, 10) || 0;

// GET /api/v1/admin/stats
router.get("/stats", authenticate, requirePermission("overview"), async (req: Request, res: Response) => {
  try {
    // For each entity: total, count in last 7d window, count in the prior 7d window.
    // The two windowed counts let the UI show a "+N this week" delta and a trend
    // direction vs. the previous week — all derived from existing timestamps.
    const windowed = (e: { table: string; ts: string; filter: string }) => ({
      total: pool.query(`SELECT COUNT(*) FROM ${e.table} WHERE ${e.filter}`),
      cur: pool.query(
        `SELECT COUNT(*) FROM ${e.table} WHERE ${e.filter} AND ${e.ts} >= NOW() - INTERVAL '7 days'`,
      ),
      prev: pool.query(
        `SELECT COUNT(*) FROM ${e.table} WHERE ${e.filter} AND ${e.ts} >= NOW() - INTERVAL '14 days' AND ${e.ts} < NOW() - INTERVAL '7 days'`,
      ),
    });

    const entities = Object.entries(TREND_ENTITIES).map(([key, e]) => ({ key, ...windowed(e) }));

    const [
      totalComments,
      spamReports,
      reportedCommunityPosts,
      pendingVets,
      approvedVets,
      rejectedVets,
      urgentRescues,
      lostTotal,
      lostFound,
      ...entityResults
    ] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM post_comments WHERE is_active = true"),
      pool.query("SELECT COUNT(*) FROM post_comments WHERE report_count >= 1 AND is_active = true"),
      pool.query("SELECT COUNT(*) FROM community_posts WHERE report_count >= 1 AND is_active = true"),
      pool.query("SELECT COUNT(*) FROM vets WHERE approval_status = 'pending'"),
      pool.query("SELECT COUNT(*) FROM vets WHERE approval_status = 'approved' AND is_active = true"),
      pool.query("SELECT COUNT(*) FROM vets WHERE approval_status = 'rejected'"),
      pool.query("SELECT COUNT(*) FROM rescue_posts WHERE is_active = true AND status = 'active' AND urgency IN ('high','critical')"),
      pool.query("SELECT COUNT(*) FROM lost_pet_reports WHERE is_active = true"),
      pool.query("SELECT COUNT(*) FROM lost_pet_reports WHERE is_found = true"),
      // entity windowed queries flattened: [total, cur, prev] per entity, in order
      ...entities.flatMap((e) => [e.total, e.cur, e.prev]),
    ]);

    // Reassemble entity results into totals + 7d deltas keyed by entity name.
    const totals: Record<string, number> = {};
    const deltas: Record<string, { current: number; previous: number }> = {};
    entities.forEach((e, i) => {
      const base = i * 3;
      totals[e.key] = num(entityResults[base]);
      deltas[e.key] = { current: num(entityResults[base + 1]), previous: num(entityResults[base + 2]) };
    });

    const lostTotalN = num(lostTotal);
    const lostFoundN = num(lostFound);

    res.json({
      // ── existing keys (back-compat) ──
      users: totals.users,
      vets: num(approvedVets),
      reviews: totals.reviews,
      pets: totals.pets,
      lostPets: totals.lostPets,
      foundReports: totals.foundReports,
      rescueReports: totals.rescueReports,
      adoptionPosts: totals.adoptionPosts,
      totalComments: num(totalComments),
      spamReports: num(spamReports),
      // ── 7-day deltas (current vs previous week) ──
      deltas,
      // ── action queues (what needs admin attention) ──
      queues: {
        pendingVets: num(pendingVets),
        reportedComments: num(spamReports),
        reportedCommunityPosts: num(reportedCommunityPosts),
        urgentRescues: num(urgentRescues),
      },
      // ── vet approval funnel ──
      vetFunnel: {
        pending: num(pendingVets),
        approved: num(approvedVets),
        rejected: num(rejectedVets),
      },
      // ── reunion / resolution signal ──
      reunion: {
        found: lostFoundN,
        total: lostTotalN,
        rate: lostTotalN > 0 ? Math.round((lostFoundN / lostTotalN) * 100) : 0,
      },
    });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/v1/admin/stats/timeseries?days=30
// Daily new-row counts per core entity, zero-filled across the full range so the
// frontend can draw a continuous growth chart without gap handling.
router.get("/stats/timeseries", authenticate, requirePermission("overview"), async (req: Request, res: Response) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days as string) || 30));
  try {
    // One row per day in range; LEFT JOIN each entity's daily counts onto the series.
    const result = await pool.query(
      `WITH series AS (
         SELECT generate_series(
           (CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day'),
           CURRENT_DATE,
           INTERVAL '1 day'
         )::date AS day
       )
       SELECT
         s.day,
         COALESCE(u.c, 0)  AS users,
         COALESCE(p.c, 0)  AS pets,
         COALESCE(po.c, 0) AS posts
       FROM series s
       LEFT JOIN (
         SELECT created_at::date d, COUNT(*) c FROM users
         WHERE role = 'user' AND created_at >= CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day'
         GROUP BY 1
       ) u  ON u.d = s.day
       LEFT JOIN (
         SELECT created_at::date d, COUNT(*) c FROM pets
         WHERE created_at >= CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day'
         GROUP BY 1
       ) p  ON p.d = s.day
       LEFT JOIN (
         SELECT day::date d, COUNT(*) c FROM (
           SELECT reported_at AS day FROM lost_pet_reports
           UNION ALL SELECT created_at FROM found_pet_reports
           UNION ALL SELECT created_at FROM rescue_posts
           UNION ALL SELECT posted_at FROM adoption_posts
         ) allposts
         WHERE day >= CURRENT_DATE - ($1::int - 1) * INTERVAL '1 day'
         GROUP BY 1
       ) po ON po.d = s.day
       ORDER BY s.day ASC`,
      [days],
    );
    res.json({
      days,
      series: result.rows.map((r) => ({
        date: r.day,
        users: parseInt(r.users, 10),
        pets: parseInt(r.pets, 10),
        posts: parseInt(r.posts, 10),
      })),
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
