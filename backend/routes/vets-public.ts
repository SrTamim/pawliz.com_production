import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import pool from '../config/database';
import logger from '../utils/logger';
import * as vetsCache from '../utils/vetsCache';

const SLIM_COLS = `SELECT v.id, v.name, v.location_name, v.latitude, v.longitude, v.address, v.contact, v.image, v.cover_image, v.vet_type, v.avg_rating, v.review_count, v.status, v.approval_status, v.user_id`;
const FULL_COLS = `SELECT v.id, v.name, v.location_name, v.latitude, v.longitude, v.address, v.contact, v.email, v.website, v.image, v.cover_image, v.description, v.services, v.vet_type, v.checkup_start, v.checkup_end, v.weekly_holidays, v.weekly_schedule, v.is_active, v.created_at, v.updated_at, v.avg_rating, v.review_count, v.status, v.approval_status, v.user_id`;

/**
 * GET /api/v1/vets
 * List approved vets. Home-default request (no search/location/cursor) is
 * served from in-memory cache with slim columns + ETag/304 + Cache-Control.
 * Search/location/paginated cursor paths bypass cache and return full columns.
 */
router.get("/", async (req: Request, res: Response) => {
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 50));
  const { location, search } = req.query;

  const useCursor = "cursor" in req.query;
  const rawCursor = req.query.cursor as string | undefined;
  const cursorId = rawCursor ? parseInt(Buffer.from(rawCursor, "base64").toString(), 10) : null;

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const offset = req.query.offset !== undefined ? parseInt(req.query.offset as string) : (page - 1) * limit;

  const isCacheableHome =
    !search &&
    !location &&
    (!useCursor || (!Number.isFinite(cursorId) && (rawCursor === "" || rawCursor === undefined))) &&
    page === 1 &&
    (req.query.offset === undefined || parseInt(req.query.offset as string) === 0) &&
    limit === 50;

  const cacheKey = isCacheableHome ? (useCursor ? "home:cursor" : "home:offset") : null;

  if (cacheKey) {
    const cached = vetsCache.get(cacheKey);
    if (cached) {
      if (req.headers["if-none-match"] === cached.etag) {
        res.setHeader("ETag", cached.etag);
        res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
        return res.status(304).end();
      }
      res.setHeader("ETag", cached.etag);
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      return res.json(cached.body);
    }
  }

  try {
    let baseWhere = `FROM vets v WHERE v.is_active = true AND (v.approval_status = 'approved' OR v.approval_status IS NULL) AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL`;
    const params = [];
    if (location) { params.push(`%${location}%`); baseWhere += ` AND v.location_name ILIKE $${params.length}`; }
    if (search) { params.push(`%${search}%`); baseWhere += ` AND (v.name ILIKE $${params.length} OR v.address ILIKE $${params.length} OR v.location_name ILIKE $${params.length})`; }
    if (useCursor && Number.isFinite(cursorId)) { params.push(cursorId); baseWhere += ` AND v.id > $${params.length}`; }

    const selectCols = isCacheableHome ? SLIM_COLS : FULL_COLS;

    let total = null;
    if (!useCursor) {
      const countResult = await pool.query(`SELECT COUNT(*) ${baseWhere}`, params);
      total = parseInt(countResult.rows[0].count);
    }

    params.push(limit + 1);
    const limitIdx = params.length;

    let queryStr;
    if (useCursor) {
      queryStr = `${selectCols} ${baseWhere} ORDER BY v.id ASC LIMIT $${limitIdx}`;
    } else {
      params.push(offset);
      queryStr = `${selectCols} ${baseWhere} ORDER BY v.avg_rating DESC, v.name ASC LIMIT $${limitIdx} OFFSET $${params.length}`;
    }

    const result = await pool.query(queryStr, params);
    const hasMore = result.rows.length > limit;
    const vets: any[] = hasMore ? result.rows.slice(0, limit) : result.rows;
    const nextCursor = hasMore
      ? Buffer.from(String(vets[vets.length - 1].id)).toString("base64")
      : null;

    const response: Record<string, any> = { vets };
    if (useCursor) {
      response.next_cursor = nextCursor;
    } else {
      response.total = total;
      response.page = page;
      response.limit = limit;
    }

    if (cacheKey) {
      const entry = vetsCache.set(cacheKey, response);
      res.setHeader("ETag", entry.etag);
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    }

    res.json(response);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/v1/vets/locations
 * Get distinct location names for filter
 */
router.get("/locations", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT DISTINCT location_name FROM vets WHERE is_active = true AND (approval_status = 'approved' OR approval_status IS NULL) AND location_name IS NOT NULL ORDER BY location_name",
    );
    res.json({ locations: result.rows.map((r) => r.location_name) });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/v1/vets/nearby?lat=&lng=&radius=10&limit=20
 * Server-side Haversine distance filter. No PostGIS required.
 */
router.get("/nearby", async (req: Request, res: Response) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: "lat and lng are required" });
  }
  const radius = Math.min(50, parseFloat(req.query.radius as string) || 10);
  const limit = Math.min(50, parseInt(req.query.limit as string) || 20);
  const boxDelta = radius / 111.0;
  try {
    const result = await pool.query(
      `SELECT * FROM (
        SELECT v.id, v.name, v.location_name, v.latitude, v.longitude, v.address, v.contact, v.image, v.avg_rating, v.review_count, v.vet_type, v.status, v.approval_status, v.user_id,
          (6371 * acos(LEAST(1.0, cos(radians($1)) * cos(radians(v.latitude)) * cos(radians(v.longitude) - radians($2)) + sin(radians($1)) * sin(radians(v.latitude))))) AS distance
        FROM vets v
        WHERE v.is_active = true
          AND (v.approval_status = 'approved' OR v.approval_status IS NULL)
          AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL
          AND v.latitude BETWEEN $3 AND $4
          AND v.longitude BETWEEN $5 AND $6
      ) nearby
      WHERE distance <= $7
      ORDER BY distance ASC
      LIMIT $8`,
      [lat, lng, lat - boxDelta, lat + boxDelta, lng - boxDelta, lng + boxDelta, radius, limit],
    );
    res.json({ vets: result.rows, count: result.rows.length });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/v1/vets/map
 * ALL approved vets, slim columns only — for map pins + sidebar badge logic.
 * No pagination. Cached in-memory (60s) + ETag/304 + Cache-Control.
 * Registered BEFORE /:id so "map" is not captured as an id param.
 */
const MAP_COLS = `SELECT v.id, v.name, v.location_name, v.latitude, v.longitude, v.vet_type, v.avg_rating, v.review_count, v.status, v.approval_status, v.user_id`;

router.get("/map", async (req: Request, res: Response) => {
  const cacheKey = "map:all";
  const cached = vetsCache.get(cacheKey);
  if (cached) {
    if (req.headers["if-none-match"] === cached.etag) {
      res.setHeader("ETag", cached.etag);
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
      return res.status(304).end();
    }
    res.setHeader("ETag", cached.etag);
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    return res.json(cached.body);
  }

  try {
    const result = await pool.query(
      `${MAP_COLS} FROM vets v WHERE v.is_active = true AND (v.approval_status = 'approved' OR v.approval_status IS NULL) AND v.latitude IS NOT NULL AND v.longitude IS NOT NULL ORDER BY v.avg_rating DESC, v.name ASC`,
    );
    const response = { vets: result.rows };
    const entry = vetsCache.set(cacheKey, response);
    res.setHeader("ETag", entry.etag);
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json(response);
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/v1/vets/:id/reviews
 * Paginated reviews for a vet
 */
router.get("/:id/reviews", async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));
    const offset = (page - 1) * limit;
    const [reviewsResult, countResult] = await Promise.all([
      pool.query(
        `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS user_name FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.vet_id = $1 AND r.is_active = true ORDER BY r.created_at DESC LIMIT $2 OFFSET $3`,
        [req.params.id, limit, offset],
      ),
      pool.query(
        `SELECT COUNT(*) FROM reviews r WHERE r.vet_id = $1 AND r.is_active = true`,
        [req.params.id],
      ),
    ]);
    res.json({
      reviews: reviewsResult.rows,
      total: parseInt(countResult.rows[0].count),
      page,
      limit,
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/v1/vets/:id
 * Get single vet details with reviews, qualifications, documents
 */
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const vetResult = await pool.query(
      `SELECT v.id, v.name, v.location_name, v.latitude, v.longitude, v.address, v.contact, v.email, v.website, v.image, v.cover_image, v.description, v.services, v.clinic_reg_number, v.vet_type, v.checkup_start, v.checkup_end, v.weekly_holidays, v.weekly_schedule, v.social_facebook, v.social_instagram, v.social_linkedin, v.social_whatsapp, v.is_active, v.created_at, v.updated_at, v.status, v.approval_status, v.user_id, COALESCE(AVG(r.rating), 0)::DECIMAL(3,2) AS avg_rating, COUNT(r.id)::INTEGER AS review_count FROM vets v LEFT JOIN reviews r ON v.id = r.vet_id AND r.is_active = true WHERE v.id = $1 AND v.is_active = true AND (v.approval_status = 'approved' OR v.approval_status IS NULL) GROUP BY v.id`,
      [req.params.id],
    );
    if (!vetResult.rows[0])
      return res.status(404).json({ error: "Vet not found" });
    const vet = vetResult.rows[0];
    const [reviewsResult, qualsResult, docsResult, contactsResult, clinicVetsResult] = await Promise.all([
      pool.query(
        `SELECT r.id, r.rating, r.comment, r.created_at, u.name AS user_name FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.vet_id = $1 AND r.is_active = true ORDER BY r.created_at DESC LIMIT 10`,
        [req.params.id],
      ),
      Promise.resolve({ rows: [] }),
      pool.query(`SELECT id, doc_type, original_name, created_at FROM vet_documents WHERE vet_id = $1 ORDER BY created_at DESC`, [req.params.id]),
      pool.query('SELECT * FROM clinic_contacts WHERE vet_id = $1 ORDER BY id', [req.params.id]),
      pool.query(`
        SELECT cv.*,
          COALESCE(json_agg(cvq ORDER BY cvq.id) FILTER (WHERE cvq.id IS NOT NULL), '[]') AS qualifications
        FROM clinic_vets cv
        LEFT JOIN clinic_vet_qualifications cvq ON cvq.clinic_vet_id = cv.id
        WHERE cv.clinic_id = $1 AND cv.is_active = true
        GROUP BY cv.id ORDER BY cv.id
      `, [req.params.id]),
    ]);

    if (vet.vet_type === 'clinic') {
      clinicVetsResult.rows = clinicVetsResult.rows.map(cv => {
        const { ...cvData } = cv;
        return cvData;
      });
    }

    res.json({
      vet,
      reviews: reviewsResult.rows,
      qualifications: qualsResult.rows,
      documents: docsResult.rows,
      clinic_contacts: contactsResult.rows,
      clinic_vets: clinicVetsResult.rows,
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export = router;
