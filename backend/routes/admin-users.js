const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const pool = require("../config/database");
const { authenticate, requirePermission, requireAnyPermission, evictUser } = require("../middleware/auth");
const { hasPermission } = require("../utils/permissions");
const { body } = require("express-validator");
const validate = require("../middleware/validate");
const { logActivity } = require("../utils/activityLogger");

// GET /api/v1/admin/users
router.get("/", authenticate, requirePermission("users"), async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const offset = (page - 1) * limit;
  const { search } = req.query;
  try {
    const params = [];
    let where = "WHERE 1=1";
    if (search) {
      params.push(`%${search}%`);
      where += ` AND (u.name ILIKE $${params.length} OR u.phone ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }
    params.push(limit, offset);
    const result = await pool.query(
      `SELECT u.id, u.name, u.phone, u.email, u.role, u.dob, u.address, COALESCE(pc.pet_count, 0) AS pet_count, u.is_active, u.created_at
       FROM users u
       LEFT JOIN (
         SELECT user_id, COUNT(*) AS pet_count FROM pets WHERE is_active = true GROUP BY user_id
       ) pc ON pc.user_id = u.id
       ${where} ORDER BY u.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const countParams = params.slice(0, -2);
    const count = await pool.query(`SELECT COUNT(*) FROM users u ${where}`, countParams);
    res.json({ users: result.rows, total: parseInt(count.rows[0].count), page, limit });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/v1/admin/users/:id
// Base gate: any of the three user actions can reach this route; each field is
// then guarded individually below (default-deny). name/email/dob/address edits
// require admin superuser (no staff flag exists for them).
router.put("/:id", authenticate, requireAnyPermission("users.reset_password", "users.deactivate", "users.role"), [
  body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
  body("email").optional({ checkFalsy: true }).isEmail().withMessage("Valid email required"),
  // Role is validated against the live roles table in the handler (any existing,
  // non-system role). Admin/system roles are rejected there (Security #1).
  body("role").optional().trim().notEmpty().withMessage("Invalid role"),
  body("is_active").optional().isBoolean(),
  body("new_password").optional().isLength({ min: 6 }).withMessage("Password must be at least 6 characters").matches(/^(?=.*[A-Za-z])(?=.*\d).{6,}$/).withMessage("Password must contain letters and numbers"),
], validate, async (req, res) => {
  const { name, email, role, dob, address, is_active, new_password } = req.body;
  try {
    const updates = [];
    const values = [];
    let p = 1;
    // Profile fields (name/email/dob/address) have no per-page staff flag — only
    // the admin superuser may edit them. Non-admin staff → 403 (default-deny).
    const editsProfile = [name, email, dob, address].some((v) => v !== undefined);
    if (editsProfile && req.user.role !== "admin") {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    if (name !== undefined) { updates.push(`name=$${p++}`); values.push(name); }
    if (email !== undefined) { updates.push(`email=$${p++}`); values.push(email); }
    if (role !== undefined) {
      // users.role flag required (admin passes via superuser short-circuit).
      if (!hasPermission(req.user, "users.role")) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      // Security #1: admin (and any system role) is UNASSIGNABLE via the API.
      // Admin is granted only by direct DB edit. This blocks a hijacked admin
      // session from minting more admins.
      const SYSTEM_ROLES = new Set(['admin', 'vet']);
      const target = String(role).toLowerCase();
      if (SYSTEM_ROLES.has(target)) {
        return res.status(403).json({ error: `Cannot assign the '${target}' role via the dashboard` });
      }
      // Role must exist (FK would reject otherwise, but check for a clean 400).
      const roleRow = await pool.query('SELECT 1 FROM roles WHERE name = $1', [target]);
      if (!roleRow.rows[0]) {
        return res.status(400).json({ error: 'Unknown role' });
      }
      updates.push(`role=$${p++}`); values.push(target);
      evictUser(parseInt(req.params.id));
      logActivity(req.user.id, 'role_changed', { details: { targetUserId: req.params.id, newRole: target } });
    }
    if (dob !== undefined) { updates.push(`dob=$${p++}`); values.push(dob); }
    if (address !== undefined) { updates.push(`address=$${p++}`); values.push(address); }
    if (is_active !== undefined) {
      // Activate/deactivate both require users.deactivate (admin passes via
      // superuser short-circuit). Default-deny otherwise.
      if (!hasPermission(req.user, "users.deactivate")) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      updates.push(`is_active=$${p++}`); values.push(is_active);
      if (is_active === false) {
        logActivity(req.user.id, 'user_deactivated', { details: { targetUserId: req.params.id } });
        evictUser(parseInt(req.params.id));
      }
    }
    if (new_password !== undefined) {
      // Reset password requires users.reset_password.
      if (!hasPermission(req.user, "users.reset_password")) {
        return res.status(403).json({ error: "Insufficient permissions" });
      }
      const hashed = await bcrypt.hash(new_password, 12);
      updates.push(`password=$${p++}`); values.push(hashed);
    }
    updates.push(`updated_at=CURRENT_TIMESTAMP`);
    values.push(req.params.id);
    if (updates.length === 1) return res.status(400).json({ error: "No fields to update" });
    const result = await pool.query(
      `UPDATE users SET ${updates.join(", ")} WHERE id=$${p} RETURNING id, name, phone, email, role, is_active`,
      values,
    );
    if (!result.rows[0]) return res.status(404).json({ error: "User not found" });
    res.json({ user: result.rows[0] });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/v1/admin/users/:id
// Soft delete (deactivate) needs users.deactivate; permanent delete needs the
// stronger users.delete. Base allows either; the permanent branch is guarded below.
router.delete("/:id", authenticate, requireAnyPermission("users.deactivate", "users.delete"), async (req, res) => {
  const permanent = req.query.permanent === 'true';
  const userId = parseInt(req.params.id);

  if (isNaN(userId)) return res.status(400).json({ error: "Invalid user ID" });
  if (userId === req.user.id) return res.status(400).json({ error: "You cannot delete your own account" });
  // Permanent (hard) delete requires users.delete specifically.
  if (permanent && !hasPermission(req.user, "users.delete")) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  try {
    if (permanent) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await logActivity(req.user.id, 'user_deleted_permanent', { details: { targetUserId: userId } });
        // id != $2 is defense-in-depth: DB enforces the no-self-delete rule even if the early check is ever removed
        await client.query('DELETE FROM users WHERE id = $1 AND id != $2', [userId, req.user.id]);
        evictUser(userId);
        await client.query('COMMIT');
        res.json({ message: "User permanently deleted (all related posts and data deleted)" });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } else {
      if (userId === req.user.id) return res.status(400).json({ error: "You cannot delete your own account" });
      await pool.query("UPDATE users SET is_active = false WHERE id = $1", [userId]);
      evictUser(userId);
      logActivity(req.user.id, 'user_deactivated', { details: { targetUserId: userId } });
      res.json({ message: "User deactivated" });
    }
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;
