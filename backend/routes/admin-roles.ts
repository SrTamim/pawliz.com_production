import express from 'express';
const router = express.Router();
import pool from '../config/database';
import { authenticate, requireSuperAdmin, evictUsersByRole } from '../middleware/auth';
import { body } from 'express-validator';
import validate from '../middleware/validate';
import { logActivity } from '../utils/activityLogger';
const {
  ASSIGNABLE_PAGES,
  sanitizePermissions,
  requestsReservedPage,
} = require('../utils/permissions');

// ─── Role Manager (RBAC) ─────────────────────────────────────────────────────
// ALL routes here are admin-superuser-only (requireSuperAdmin). Role management
// is reserved: a custom role can NEVER reach these endpoints, so a compromised
// manager cannot create/edit roles or escalate (Security #2).

// Role-name policy: lowercase letters, digits, _ and -, 2–50 chars.
const NAME_RE = /^[a-z0-9_-]{2,50}$/;
const SYSTEM_NAMES = new Set(['admin', 'user', 'vet']);

// GET /admin/roles — list roles + user counts
router.get('/', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.name, r.description, r.permissions, r.is_system,
             COALESCE(uc.cnt, 0)::int AS user_count
      FROM roles r
      LEFT JOIN (SELECT role, COUNT(*) AS cnt FROM users GROUP BY role) uc
        ON uc.role = r.name
      ORDER BY r.is_system DESC, r.name ASC
    `);
    res.json({ roles: result.rows });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /admin/roles/registry — permission registry for the role editor.
// Excludes the reserved (adminOnly) roles page so it can't be granted.
router.get('/registry', authenticate, requireSuperAdmin, (req, res) => {
  res.json({ pages: ASSIGNABLE_PAGES });
});

// POST /admin/roles — create a custom role
router.post(
  '/',
  authenticate,
  requireSuperAdmin,
  [
    body('name').trim().toLowerCase().matches(NAME_RE)
      .withMessage('Name must be 2–50 chars: lowercase letters, digits, _ or -'),
    body('description').optional({ checkFalsy: true }).trim().isLength({ max: 200 }),
  ],
  validate,
  async (req, res) => {
    const name = req.body.name.trim().toLowerCase();
    const { description = null, permissions } = req.body;

    // Security #3: cannot create a role colliding with a system role name.
    if (SYSTEM_NAMES.has(name)) {
      return res.status(403).json({ error: 'Cannot create a system role name' });
    }
    // Security #2: cannot grant the reserved Role Manager page.
    if (requestsReservedPage(permissions)) {
      return res.status(403).json({ error: 'That permission cannot be granted' });
    }
    // L5: rebuild perms from validated keys only — never store raw body.
    const safe = sanitizePermissions(permissions);

    try {
      const result = await pool.query(
        `INSERT INTO roles (name, description, permissions, is_system)
         VALUES ($1, $2, $3, false) RETURNING name, description, permissions, is_system`,
        [name, description, JSON.stringify(safe)],
      );
      logActivity(req.user.id, 'role_created', { details: { name, permissions: safe } });
      res.status(201).json({ role: result.rows[0] });
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Role already exists' });
      res.status(500).json({ error: 'Server error' });
    }
  },
);

// PUT /admin/roles/:name — update description/permissions of a custom role
router.put(
  '/:name',
  authenticate,
  requireSuperAdmin,
  [body('description').optional({ checkFalsy: true }).trim().isLength({ max: 200 })],
  validate,
  async (req, res) => {
    const name = String(req.params.name).toLowerCase();
    const { description, permissions } = req.body;

    if (SYSTEM_NAMES.has(name)) {
      return res.status(403).json({ error: 'System roles cannot be edited' });
    }
    if (permissions !== undefined && requestsReservedPage(permissions)) {
      return res.status(403).json({ error: 'That permission cannot be granted' });
    }

    try {
      // Guard: target must exist and not be a system role (defense-in-depth vs the
      // name check above, in case is_system is ever set on a non-reserved name).
      const existing = await pool.query('SELECT is_system FROM roles WHERE name = $1', [name]);
      if (!existing.rows[0]) return res.status(404).json({ error: 'Role not found' });
      if (existing.rows[0].is_system) {
        return res.status(403).json({ error: 'System roles cannot be edited' });
      }

      const updates = [];
      const values = [];
      let p = 1;
      if (description !== undefined) { updates.push(`description=$${p++}`); values.push(description); }
      if (permissions !== undefined) {
        const safe = sanitizePermissions(permissions);
        updates.push(`permissions=$${p++}`); values.push(JSON.stringify(safe));
      }
      if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
      updates.push('updated_at=CURRENT_TIMESTAMP');
      values.push(name);

      const result = await pool.query(
        `UPDATE roles SET ${updates.join(', ')} WHERE name=$${p}
         RETURNING name, description, permissions, is_system`,
        values,
      );
      // Propagate new perms: evict every cached user holding this role (L4).
      await evictUsersByRole(name);
      logActivity(req.user.id, 'role_updated', { details: { name } });
      res.json({ role: result.rows[0] });
    } catch {
      res.status(500).json({ error: 'Server error' });
    }
  },
);

// DELETE /admin/roles/:name — delete a custom role (must be unused)
router.delete('/:name', authenticate, requireSuperAdmin, async (req, res) => {
  const name = String(req.params.name).toLowerCase();
  if (SYSTEM_NAMES.has(name)) {
    return res.status(403).json({ error: 'System roles cannot be deleted' });
  }
  try {
    const existing = await pool.query('SELECT is_system FROM roles WHERE name = $1', [name]);
    if (!existing.rows[0]) return res.status(404).json({ error: 'Role not found' });
    if (existing.rows[0].is_system) {
      return res.status(403).json({ error: 'System roles cannot be deleted' });
    }
    const inUse = await pool.query('SELECT 1 FROM users WHERE role = $1 LIMIT 1', [name]);
    if (inUse.rows[0]) {
      return res.status(409).json({ error: 'Role is assigned to users; reassign them first' });
    }
    await pool.query('DELETE FROM roles WHERE name = $1', [name]);
    logActivity(req.user.id, 'role_deleted', { details: { name } });
    res.json({ message: 'Role deleted' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

export = router;
