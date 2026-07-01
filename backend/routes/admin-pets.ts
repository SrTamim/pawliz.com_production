import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import pool from '../config/database';
import { authenticate, requirePermission, requireAnyPermission } from '../middleware/auth';
import requireIntParam from '../middleware/requireIntParam';
import logger from '../utils/logger';

// GET /api/v1/admin/pets
// Serves Manage Pets + Lost Pets + Adoptable Pets sections (filtered) — allow any.
router.get("/pets", authenticate, requireAnyPermission("pets", "lost-pets-mgmt", "adoptable-pets"), async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;
  const { search, type, filter } = req.query;
  try {
    let where = "WHERE p.is_active = true";
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (p.name ILIKE $${params.length} OR p.pet_id ILIKE $${params.length})`;
    }
    if (type) {
      params.push(type);
      where += ` AND p.type = $${params.length}`;
    }
    if (filter === 'lost') where += ` AND p.is_lost = true`;
    else if (filter === 'adoption') where += ` AND p.is_for_adoption = true`;
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT p.id, p.pet_id, p.name, p.type, p.breed, p.gender, p.age, p.color, p.weight,
              p.potty_trained, p.is_lost, p.is_for_adoption, p.is_active, p.status, p.created_at,
              u.id as owner_id, u.name as owner_name, u.phone as owner_phone
       FROM pets p JOIN users u ON u.id = p.user_id
       ${where}
       ORDER BY p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const countParams = params.slice(0, -2);
    const countResult = await pool.query(`SELECT COUNT(*) FROM pets p ${where}`, countParams);
    res.json({ pets: result.rows, total: parseInt(countResult.rows[0].count), page, limit });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/v1/admin/pets/:id
router.put("/pets/:id", authenticate, requirePermission("pets.edit"), requireIntParam("id"), async (req: Request, res: Response) => {
  const { name, type, breed, gender, age, color, weight, potty_trained, is_active, status } = req.body;
  const petId = parseInt(req.params.id);
  try {
    const updates = [];
    const values = [];
    let p = 1;
    if (name !== undefined) { updates.push(`name=$${p++}`); values.push(name); }
    if (type !== undefined) { updates.push(`type=$${p++}`); values.push(type); }
    if (breed !== undefined) { updates.push(`breed=$${p++}`); values.push(breed || null); }
    if (gender !== undefined) { updates.push(`gender=$${p++}`); values.push(gender || null); }
    if (age !== undefined) { updates.push(`age=$${p++}`); values.push(age ? String(age).trim().slice(0, 30) : null); }
    if (color !== undefined) { updates.push(`color=$${p++}`); values.push(color || null); }
    if (weight !== undefined) { updates.push(`weight=$${p++}`); values.push(weight ? parseFloat(weight) : null); }
    if (potty_trained !== undefined) { updates.push(`potty_trained=$${p++}`); values.push(potty_trained); }
    if (is_active !== undefined) { updates.push(`is_active=$${p++}`); values.push(is_active); }
    if (status !== undefined) {
      const dbStatus = status === 'adoption' ? 'active' : status;
      updates.push(`status=$${p++}`); values.push(dbStatus);
      updates.push(`is_lost=$${p++}`); values.push(status === 'lost');
      updates.push(`is_for_adoption=$${p++}`); values.push(status === 'adoption');
    }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    updates.push(`updated_at=NOW()`);
    values.push(petId);
    // Fetch pet owner before transaction (needed for adoption post user_id)
    const petOwnerResult = await pool.query('SELECT user_id FROM pets WHERE id = $1', [petId]);
    if (!petOwnerResult.rows[0]) return res.status(404).json({ error: "Pet not found" });
    const petOwnerId = petOwnerResult.rows[0].user_id;

    const client = await pool.connect();
    let pet;
    try {
      await client.query('BEGIN');
      const result = await client.query(
        `UPDATE pets SET ${updates.join(", ")} WHERE id=$${p} RETURNING id, pet_id, name, type, breed, gender, age, color, weight, potty_trained, is_active, status, is_lost, is_for_adoption`,
        values,
      );
      if (!result.rows[0]) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: "Pet not found" });
      }
      pet = result.rows[0];
      if (status !== undefined) {
        if (status === 'lost') {
          const openReport = await client.query(`SELECT id FROM lost_pet_reports WHERE pet_id = $1 AND is_found = false`, [petId]);
          if (openReport.rows.length === 0) {
            await client.query(`INSERT INTO lost_pet_reports (pet_id, lost_date) VALUES ($1, CURRENT_DATE)`, [petId]);
          }
          await client.query(`UPDATE adoption_posts SET status = 'withdrawn', updated_at = NOW() WHERE pet_id = $1 AND status = 'available'`, [petId]);
        } else if (status === 'adoption') {
          await client.query(`UPDATE lost_pet_reports SET is_found = true WHERE pet_id = $1 AND is_found = false`, [petId]);
          const openAdoption = await client.query(`SELECT id FROM adoption_posts WHERE pet_id = $1 AND status = 'available'`, [petId]);
          if (openAdoption.rows.length === 0) {
            await client.query(`INSERT INTO adoption_posts (pet_id, user_id) VALUES ($1, $2)`, [petId, petOwnerId]);
          }
        } else {
          await client.query(`UPDATE lost_pet_reports SET is_found = true WHERE pet_id = $1 AND is_found = false`, [petId]);
          await client.query(`UPDATE adoption_posts SET status = 'withdrawn', updated_at = NOW() WHERE pet_id = $1 AND status = 'available'`, [petId]);
        }
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
    res.json({ pet });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/v1/admin/pets/:id
router.delete("/pets/:id", authenticate, requirePermission("pets.delete"), requireIntParam("id"), async (req: Request, res: Response) => {
  try {
    const r = await pool.query("UPDATE pets SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING id", [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: "Pet not found" });
    res.json({ message: "Pet deactivated" });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/v1/admin/found-pets
router.get("/found-pets", authenticate, requirePermission("found-pets"), async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;
  const { search } = req.query;
  try {
    const params = [];
    let where = "WHERE f.is_active = true";
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (f.pet_type ILIKE $${params.length} OR f.found_location_name ILIKE $${params.length} OR f.breed ILIKE $${params.length})`;
    }
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT f.*, u.name as reporter_name, u.phone as reporter_phone
       FROM found_pet_reports f LEFT JOIN users u ON u.id = f.user_id
       ${where}
       ORDER BY f.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const countParams = params.slice(0, -2);
    const count = await pool.query(`SELECT COUNT(*) FROM found_pet_reports f ${where}`, countParams);
    res.json({ posts: result.rows, total: parseInt(count.rows[0].count), page, limit });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/v1/admin/found-pets/:id
router.put("/found-pets/:id", authenticate, requirePermission("found-pets.edit"), requireIntParam("id"), async (req: Request, res: Response) => {
  const { pet_type, color, gender, breed, found_location_name, found_date, description, status, is_active } = req.body;
  try {
    const updates = [];
    const values = [];
    let p = 1;
    if (pet_type !== undefined) { updates.push(`pet_type=$${p++}`); values.push(pet_type); }
    if (color !== undefined) { updates.push(`color=$${p++}`); values.push(color || null); }
    if (gender !== undefined) { updates.push(`gender=$${p++}`); values.push(gender || null); }
    if (breed !== undefined) { updates.push(`breed=$${p++}`); values.push(breed || null); }
    if (found_location_name !== undefined) { updates.push(`found_location_name=$${p++}`); values.push(found_location_name || null); }
    if (found_date !== undefined) { updates.push(`found_date=$${p++}`); values.push(found_date); }
    if (description !== undefined) { updates.push(`description=$${p++}`); values.push(description || null); }
    if (status !== undefined) { updates.push(`status=$${p++}`); values.push(status); }
    if (is_active !== undefined) { updates.push(`is_active=$${p++}`); values.push(is_active); }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    updates.push(`updated_at=NOW()`);
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE found_pet_reports SET ${updates.join(", ")} WHERE id=$${p} RETURNING *`,
      values,
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Report not found" });
    res.json({ post: result.rows[0] });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/v1/admin/found-pets/:id
router.delete("/found-pets/:id", authenticate, requirePermission("found-pets.delete"), requireIntParam("id"), async (req: Request, res: Response) => {
  try {
    await pool.query("UPDATE found_pet_reports SET is_active = false, updated_at = NOW() WHERE id = $1", [req.params.id]);
    res.json({ message: "Report deactivated" });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET /api/v1/admin/rescue-pets
router.get("/rescue-pets", authenticate, requirePermission("rescue-pets"), async (req: Request, res: Response) => {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const offset = (page - 1) * limit;
  const { search } = req.query;
  try {
    const params = [];
    let where = "WHERE 1=1";
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (r.pet_type ILIKE $${params.length} OR r.rescue_location_name ILIKE $${params.length} OR r.breed ILIKE $${params.length})`;
    }
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT r.*, u.name as reporter_name, u.phone as reporter_phone
       FROM rescue_posts r LEFT JOIN users u ON u.id = r.user_id
       ${where}
       ORDER BY r.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const countParams = params.slice(0, -2);
    const count = await pool.query(`SELECT COUNT(*) FROM rescue_posts r ${where}`, countParams);
    res.json({ posts: result.rows, total: parseInt(count.rows[0].count), page, limit });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/v1/admin/rescue-pets/:id
router.put("/rescue-pets/:id", authenticate, requirePermission("rescue-pets.edit"), requireIntParam("id"), async (req: Request, res: Response) => {
  const { pet_type, color, gender, breed, rescue_location_name, rescue_date, description, urgency, status, is_active } = req.body;
  try {
    const updates = [];
    const values = [];
    let p = 1;
    if (pet_type !== undefined) { updates.push(`pet_type=$${p++}`); values.push(pet_type); }
    if (color !== undefined) { updates.push(`color=$${p++}`); values.push(color || null); }
    if (gender !== undefined) { updates.push(`gender=$${p++}`); values.push(gender || null); }
    if (breed !== undefined) { updates.push(`breed=$${p++}`); values.push(breed || null); }
    if (rescue_location_name !== undefined) { updates.push(`rescue_location_name=$${p++}`); values.push(rescue_location_name || null); }
    if (rescue_date !== undefined) { updates.push(`rescue_date=$${p++}`); values.push(rescue_date); }
    if (description !== undefined) { updates.push(`description=$${p++}`); values.push(description || null); }
    if (urgency !== undefined) { updates.push(`urgency=$${p++}`); values.push(urgency); }
    if (status !== undefined) { updates.push(`status=$${p++}`); values.push(status); }
    if (is_active !== undefined) { updates.push(`is_active=$${p++}`); values.push(is_active); }
    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });
    updates.push(`updated_at=NOW()`);
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE rescue_posts SET ${updates.join(", ")} WHERE id=$${p} RETURNING *`,
      values,
    );
    if (!result.rows[0]) return res.status(404).json({ error: "Report not found" });
    res.json({ post: result.rows[0] });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/v1/admin/rescue-pets/:id
router.delete("/rescue-pets/:id", authenticate, requirePermission("rescue-pets.delete"), requireIntParam("id"), async (req: Request, res: Response) => {
  try {
    await pool.query("UPDATE rescue_posts SET is_active = false, updated_at = NOW() WHERE id = $1", [req.params.id]);
    res.json({ message: "Report deactivated" });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

export = router;
