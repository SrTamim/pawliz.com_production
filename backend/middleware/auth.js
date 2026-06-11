const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const { hasPermission, hasAnyAdminAccess } = require('../utils/permissions');

// SELECT used by authenticate/optionalAuth on cache miss. Joins the role's
// permissions so req.user carries them for requirePermission checks. `permissions`
// is additive — every existing reader of req.user (id/name/phone/email/role/
// is_active) is unaffected.
const USER_SELECT = `
  SELECT u.id, u.name, u.phone, u.email, u.role, u.is_active, r.permissions
  FROM users u
  LEFT JOIN roles r ON r.name = u.role
  WHERE u.id = $1
`;

// In-process user cache
// Purpose: eliminate the SELECT FROM users query that fires on every protected
// API request. At 20k+ concurrent users this query is the primary DB bottleneck.
//
// TTL is set to 14 minutes — just under the 15-minute JWT access token lifetime.
// A banned user's cache entry therefore expires no later than their token does,
// meaning they cannot make authenticated requests beyond 14 minutes after being
// banned. This is the same security window that JWT-only auth systems accept.
//
// When an admin explicitly bans or deletes a user, call evictUser(userId) to
// invalidate their cache entry immediately (see admin-users.js).
//
// This is a plain Map — no external dependency. It is process-local, which is
// fine because Pawliz runs a single Railway process. If multiple instances
// are ever introduced (with Redis adapter), each process evicts independently;
// the worst case is a 14-minute delay before a ban propagates to all instances,
// which is acceptable for this application.

// TTL reduced from 14 min to 60 sec — limits window where deactivated user stays
// active if evictUser() is missed (e.g. direct DB update, script, future route).
// Admin deactivations still call evictUser() for instant effect.
const USER_CACHE_TTL_MS = 60 * 1000; // 60 seconds
const _userCache = new Map();

function _getCached(userId) {
  const entry = _userCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _userCache.delete(userId);
    return null;
  }
  return entry.user;
}

function _setCache(userId, user) {
  _userCache.set(userId, {
    user,
    expiresAt: Date.now() + USER_CACHE_TTL_MS,
  });
}

/**
 * Immediately remove a user from the auth cache.
 * REQUIRED: Call this whenever is_active=false is set on a user (ban, deactivate, delete).
 * Without this, the deactivated user stays active for up to 14 minutes (TTL).
 * Currently called by: admin-users.js (role change, deactivation, deletion).
 * Any new route that sets is_active=false MUST also call evictUser(userId).
 * @param {number} userId
 */
function evictUser(userId) {
  _userCache.delete(userId);
}

// Sweep expired entries every 15 minutes to prevent unbounded Map growth.
// Each entry is ~200 bytes; 50k entries → 10 MB → acceptable, but no need to
// let stale entries accumulate indefinitely.
setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of _userCache) {
    if (now > entry.expiresAt) _userCache.delete(id);
  }
}, 15 * 60 * 1000).unref(); // .unref() so the timer does not block process exit

// Token extraction

/**
 * Extract JWT from httpOnly cookie or Authorization header.
 * @param {object} req - Express request
 * @returns {string|null}
 */
function extractToken(req) {
  const fromCookie = req.cookies?.pawliz_access;
  if (fromCookie) return fromCookie;
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) return authHeader.split(' ')[1];
  return null;
}

// Middleware

/**
 * Middleware: Verify JWT + fetch user (cache-first). Blocks inactive users.
 * Sets req.user. Cache hit = 0 DB queries. Cache miss = 1 DB query, then cached.
 */
const authenticate = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    // Cache hit — skip the DB query entirely.
    const cached = _getCached(decoded.userId);
    if (cached) {
      req.user = cached;
      return next();
    }

    // Cache miss — query DB and populate cache for subsequent requests.
    const result = await pool.query(USER_SELECT, [decoded.userId]);
    if (!result.rows[0] || !result.rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    _setCache(decoded.userId, result.rows[0]);
    req.user = result.rows[0];
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Middleware: Block non-admin users. Requires authenticate to run first.
 */
const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Middleware factory: block unless the user holds permission `key`.
 * admin role passes everything (superuser short-circuit, in hasPermission).
 * Default-deny: missing/malformed perms → 403. Requires authenticate first.
 * @param {string} key - page key ("users") or action key ("users.delete")
 */
const requirePermission = (key) => (req, res, next) => {
  if (hasPermission(req.user, key)) return next();
  return res.status(403).json({ error: 'Insufficient permissions' });
};

/**
 * Middleware factory: block unless the user holds AT LEAST ONE of `keys`.
 * Used where a single endpoint backs multiple dashboard pages (e.g. the admin
 * pets list serves the Manage Pets, Lost Pets and Adoptable Pets sections).
 * @param {...string} keys
 */
const requireAnyPermission = (...keys) => (req, res, next) => {
  if (keys.some((k) => hasPermission(req.user, k))) return next();
  return res.status(403).json({ error: 'Insufficient permissions' });
};

/**
 * Middleware: hard admin-superuser gate. Used for Role Manager / RBAC routes
 * which must NEVER be reachable by a custom role (Security #2). Distinct from
 * requireAdmin only in intent/naming; both check role === 'admin'.
 */
const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

/**
 * Middleware: Block users with no admin-dashboard access at all (admin OR any
 * page permission). Lets a staff role reach the dashboard shell; per-page gating
 * is handled by requirePermission on individual routes.
 */
const requireStaff = (req, res, next) => {
  if (hasAnyAdminAccess(req.user)) return next();
  return res.status(403).json({ error: 'Admin access required' });
};

/**
 * Middleware: Block non-vet users. Requires authenticate to run first.
 */
const requireVet = (req, res, next) => {
  if (req.user?.role !== 'vet') {
    return res.status(403).json({ error: 'Vet/Clinic access required' });
  }
  next();
};

/**
 * Middleware: Attempt JWT auth, continue regardless. Sets req.user if valid.
 * Also cache-first for optional auth routes.
 */
const optionalAuth = async (req, res, next) => {
  const token = extractToken(req);
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, {
      algorithms: ['HS256'],
    });

    const cached = _getCached(decoded.userId);
    if (cached) {
      req.user = cached;
      return next();
    }

    const result = await pool.query(USER_SELECT, [decoded.userId]);
    if (result.rows[0]?.is_active) {
      _setCache(decoded.userId, result.rows[0]);
      req.user = result.rows[0];
    }
  } catch {}
  next();
};

/**
 * Evict every cached user holding a given role. Call when a role's permissions
 * change so affected users pick up new perms on their next request (instead of
 * waiting out the ≤60s cache TTL). Best-effort; failures are non-fatal.
 * @param {string} roleName
 */
async function evictUsersByRole(roleName) {
  try {
    const { rows } = await pool.query('SELECT id FROM users WHERE role = $1', [roleName]);
    for (const r of rows) _userCache.delete(r.id);
  } catch {
    // Non-fatal: stale entries still expire within the 60s TTL.
  }
}

module.exports = {
  authenticate,
  requireAdmin,
  requireVet,
  requirePermission,
  requireAnyPermission,
  requireSuperAdmin,
  requireStaff,
  optionalAuth,
  evictUser,
  evictUsersByRole,
};
