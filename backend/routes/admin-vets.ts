import express from 'express';
const router = express.Router();
import pool from '../config/database';
import { authenticate, requirePermission } from '../middleware/auth';
import { hasPermission } from '../utils/permissions';
import { logActivity } from '../utils/activityLogger';
import logger from '../utils/logger';
import * as vetsCache from '../utils/vetsCache';

// POST /api/v1/admin/vets
router.post("/", authenticate, requirePermission("vets.create"), async (req, res) => {
  const {
    name, location_name, latitude, longitude, address, contact, email, website,
    description, services, vet_type,
    checkup_start, checkup_end, weekly_holidays, account_owner_name,
  } = req.body;
  if (!name || !location_name || !address) {
    return res.status(400).json({ error: "name, location_name, address required" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO vets (name, location_name, latitude, longitude, address,
        contact, email, website, description, services, vet_type,
        checkup_start, checkup_end, weekly_holidays,
        account_owner_name, approval_status, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'approved',true)
       RETURNING *`,
      [
        name, location_name,
        latitude ? parseFloat(latitude) : null,
        longitude ? parseFloat(longitude) : null,
        address,
        contact || null, email || null, website || null,
        description || null,
        Array.isArray(services) ? services : [],
        vet_type || 'clinic',
        checkup_start || null, checkup_end || null,
        Array.isArray(weekly_holidays) ? weekly_holidays : [],
        account_owner_name || null,
      ]
    );
    vetsCache.bust();
    logActivity(req.user.id, 'vet_created', { details: { vetId: result.rows[0].id, name } });
    res.status(201).json({ vet: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: "A vet clinic with this name and address already exists." });
    }
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/v1/admin/vets
router.get("/", authenticate, requirePermission("vets"), async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 50));
  const offset = (page - 1) * limit;
  const { search, approval_status, include_inactive, active } = req.query;
  try {
    const params = [];
    const conditions = [];
    // active=true → active only, active=false → inactive only, otherwise fall back to
    // include_inactive (default active only; ?include_inactive=true shows active+inactive).
    if (active === 'true') {
      conditions.push('v.is_active = true');
    } else if (active === 'false') {
      conditions.push('v.is_active = false');
    } else if (include_inactive !== 'true') {
      conditions.push('v.is_active = true');
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(v.name ILIKE $${params.length} OR v.location_name ILIKE $${params.length} OR v.contact ILIKE $${params.length})`);
    }
    if (approval_status) {
      params.push(approval_status);
      conditions.push(`v.approval_status = $${params.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT v.id, v.name, v.location_name, v.latitude, v.longitude, v.address,
              v.contact, v.email, v.website, v.image, v.cover_image, v.description, v.services,
              v.is_active, v.vet_type, v.approval_status, v.user_id,
              v.account_owner_name, v.rejection_reason, v.claimed_by,
              COALESCE(AVG(r.rating), 0)::DECIMAL(3,2) AS avg_rating,
              COUNT(r.id)::INTEGER AS review_count, v.created_at, v.updated_at
       FROM vets v LEFT JOIN reviews r ON v.id = r.vet_id AND r.is_active = true
       ${where}
       GROUP BY v.id ORDER BY v.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const countParams = params.slice(0, -2);
    const count = await pool.query(`SELECT COUNT(*) FROM vets v ${where}`, countParams);
    res.json({ vets: result.rows, total: parseInt(count.rows[0].count), page, limit });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/v1/admin/vets/claim-requests
router.get("/claim-requests", authenticate, requirePermission("claim-requests"), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.id, v.name, v.name AS clinic_name, v.claim_requested_at,
              u.name AS requester_name, u.email, u.phone AS requester_phone,
              COALESCE(json_agg(
                json_build_object('doc_type', d.doc_type, 'file_path', d.file_path, 'original_name', d.original_name)
              ) FILTER (WHERE d.id IS NOT NULL), '[]') AS documents
       FROM vets v
       JOIN users u ON u.id = v.claimed_by
       LEFT JOIN vets nv ON nv.user_id = v.claimed_by
       LEFT JOIN vet_documents d ON d.vet_id = nv.id
       WHERE v.status IN ('pending_claim', 'claimed')
       GROUP BY v.id, u.name, u.email, u.phone
       ORDER BY v.claim_requested_at DESC`
    );
    res.json({ claims: result.rows });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/v1/admin/vets/claim-requests/:vetId/approve
router.patch("/claim-requests/:vetId/approve", authenticate, requirePermission("claim-requests.edit"), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE vets SET status='claimed', claimed_at=NOW(), approval_status='approved', is_active=true,
              updated_at=CURRENT_TIMESTAMP
       WHERE id=$1 AND status IN ('pending_claim', 'claimed') RETURNING id, claimed_by`,
      [req.params.vetId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Claim request not found" });
    vetsCache.bust();
    logActivity(req.user.id, 'vet_claim_approved', { details: { vetId: req.params.vetId } });
    res.json({ message: "Claim approved" });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PATCH /api/v1/admin/vets/claim-requests/:vetId/reject
router.patch("/claim-requests/:vetId/reject", authenticate, requirePermission("claim-requests.edit"), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Read claimed_by BEFORE the UPDATE — RETURNING gives the new (NULL) value otherwise
    const vetResult = await client.query(
      `WITH pre AS (SELECT claimed_by FROM vets WHERE id=$1)
       UPDATE vets SET status='unverified', claimed_by=NULL, user_id=NULL,
              claim_requested_at=NULL, claimed_at=NULL,
              approval_status='pending', is_active=false,
              updated_at=CURRENT_TIMESTAMP
       WHERE id=$1 AND status IN ('pending_claim', 'claimed')
       RETURNING id, (SELECT claimed_by FROM pre) AS old_claimed_by`,
      [req.params.vetId]
    );
    if (!vetResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Claim request not found" });
    }
    const userId = vetResult.rows[0].old_claimed_by;
    if (userId) {
      await client.query(`UPDATE users SET is_active=false WHERE id=$1`, [userId]);
    }
    await client.query('COMMIT');
    vetsCache.bust();
    res.json({ message: "Claim rejected" });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

// PUT /api/v1/admin/vets/:id/approve
router.put("/:id/approve", authenticate, requirePermission("vets.approve"), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE vets SET approval_status='approved', rejection_reason=NULL, is_active=true, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING id, name, approval_status`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Vet not found" });
    vetsCache.bust();
    logActivity(req.user.id, 'vet_approved', { details: { vetId: req.params.id } });
    res.json({ vet: result.rows[0], message: "Vet approved" });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/v1/admin/vets/:id/reject
router.put("/:id/reject", authenticate, requirePermission("vets.approve"), async (req, res) => {
  const { reason } = req.body;
  try {
    const result = await pool.query(
      `UPDATE vets SET approval_status='rejected', rejection_reason=$1, is_active=false, updated_at=CURRENT_TIMESTAMP WHERE id=$2 RETURNING id, name, approval_status`,
      [reason || null, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Vet not found" });
    vetsCache.bust();
    logActivity(req.user.id, 'vet_rejected', { details: { vetId: req.params.id, reason } });
    res.json({ vet: result.rows[0], message: "Vet rejected" });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/v1/admin/vets/:id
router.get("/:id", authenticate, requirePermission("vets"), async (req, res) => {
  try {
    const [vetResult, qualsResult, docsResult, contactsResult, clinicVetsResult] = await Promise.all([
      pool.query(
        `SELECT v.*, COALESCE(AVG(r.rating), 0)::DECIMAL(3,2) AS avg_rating, COUNT(r.id)::INTEGER AS review_count
         FROM vets v LEFT JOIN reviews r ON v.id = r.vet_id AND r.is_active = true
         WHERE v.id = $1 GROUP BY v.id`,
        [req.params.id]
      ),
      pool.query('SELECT * FROM vet_qualifications WHERE vet_id = $1 ORDER BY id', [req.params.id]),
      pool.query('SELECT id, doc_type, file_path, original_name, created_at FROM vet_documents WHERE vet_id = $1 ORDER BY created_at DESC', [req.params.id]),
      pool.query('SELECT * FROM clinic_contacts WHERE vet_id = $1 ORDER BY id', [req.params.id]),
      pool.query(`
        SELECT cv.*,
          COALESCE(json_agg(cvq ORDER BY cvq.id) FILTER (WHERE cvq.id IS NOT NULL), '[]') AS qualifications
        FROM clinic_vets cv
        LEFT JOIN clinic_vet_qualifications cvq ON cvq.clinic_vet_id = cv.id
        WHERE cv.clinic_id = $1
        GROUP BY cv.id ORDER BY cv.id
      `, [req.params.id]),
    ]);
    if (!vetResult.rows[0]) return res.status(404).json({ error: "Vet not found" });
    res.json({
      vet: vetResult.rows[0],
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

// PUT /api/v1/admin/vets/:id
router.put("/:id", authenticate, requirePermission("vets.edit"), async (req, res) => {
  const {
    name, location_name, latitude, longitude, address, contact, email, website,
    image, cover_image, description, services, is_active, approval_status,
    vet_type, checkup_start, checkup_end,
    weekly_holidays, account_owner_name,
  } = req.body;
  // Deactivating a clinic is destructive — gate it behind vets.delete even though
  // the rest of this PUT only needs vets.edit. Admin passes via superuser
  // short-circuit. Reactivation (is_active=true) stays an edit action.
  if (is_active === false && !hasPermission(req.user, "vets.delete")) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }
  try {
    const updates = [];
    const values = [];
    let p = 1;
    if (name !== undefined) { updates.push(`name=$${p++}`); values.push(name); }
    if (location_name !== undefined) { updates.push(`location_name=$${p++}`); values.push(location_name); }
    if (latitude !== undefined) { updates.push(`latitude=$${p++}`); values.push(latitude ? parseFloat(latitude) : null); }
    if (longitude !== undefined) { updates.push(`longitude=$${p++}`); values.push(longitude ? parseFloat(longitude) : null); }
    if (address !== undefined) { updates.push(`address=$${p++}`); values.push(address || null); }
    if (contact !== undefined) { updates.push(`contact=$${p++}`); values.push(contact || null); }
    if (email !== undefined) { updates.push(`email=$${p++}`); values.push(email || null); }
    if (website !== undefined) { updates.push(`website=$${p++}`); values.push(website || null); }
    if (image !== undefined) { updates.push(`image=$${p++}`); values.push(image || null); }
    if (cover_image !== undefined) { updates.push(`cover_image=$${p++}`); values.push(cover_image || null); }
    if (description !== undefined) { updates.push(`description=$${p++}`); values.push(description || null); }
    if (services !== undefined) { updates.push(`services=$${p++}`); values.push(Array.isArray(services) ? services : null); }
    if (is_active !== undefined) { updates.push(`is_active=$${p++}`); values.push(is_active !== false); }
    if (approval_status !== undefined) { updates.push(`approval_status=$${p++}`); values.push(approval_status); }
    if (vet_type !== undefined) { updates.push(`vet_type=$${p++}`); values.push(vet_type || 'clinic'); }
    if (checkup_start !== undefined) { updates.push(`checkup_start=$${p++}`); values.push(checkup_start || null); }
    if (checkup_end !== undefined) { updates.push(`checkup_end=$${p++}`); values.push(checkup_end || null); }
    if (weekly_holidays !== undefined) { updates.push(`weekly_holidays=$${p++}`); values.push(Array.isArray(weekly_holidays) ? weekly_holidays : null); }
    if (account_owner_name !== undefined) { updates.push(`account_owner_name=$${p++}`); values.push(account_owner_name || null); }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    updates.push(`updated_at=CURRENT_TIMESTAMP`);
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE vets SET ${updates.join(", ")} WHERE id=$${p} RETURNING *`,
      values,
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Vet not found" });
    vetsCache.bust();
    res.json({ vet: result.rows[0] });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/v1/admin/vets/:id (soft delete — sets is_active=false, preserves all data)
router.delete("/:id", authenticate, requirePermission("vets.delete"), async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE vets SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id, name`,
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Vet not found" });
    vetsCache.bust();
    logActivity(req.user.id, 'vet_deactivated', { details: { vetId: req.params.id, name: result.rows[0].name } });
    res.json({ message: "Vet deactivated" });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/v1/admin/vet-qualifications/:qualId
router.delete("/vet-qualifications/:qualId", authenticate, requirePermission("vets.delete"), async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM vet_qualifications WHERE id = $1 RETURNING id', [req.params.qualId]);
    if (!r.rows[0]) return res.status(404).json({ error: "Qualification not found" });
    res.json({ message: "Qualification deleted" });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/v1/admin/clinic-contacts/:contactId
router.delete("/clinic-contacts/:contactId", authenticate, requirePermission("vets.delete"), async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM clinic_contacts WHERE id = $1 RETURNING id', [req.params.contactId]);
    if (!r.rows[0]) return res.status(404).json({ error: "Contact not found" });
    res.json({ message: "Contact deleted" });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/v1/admin/clinic-vets/:clinicVetId
router.delete("/clinic-vets/:clinicVetId", authenticate, requirePermission("vets.delete"), async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM clinic_vets WHERE id = $1 RETURNING id', [req.params.clinicVetId]);
    if (!r.rows[0]) return res.status(404).json({ error: "Clinic vet not found" });
    res.json({ message: "Clinic vet removed" });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export = router;
