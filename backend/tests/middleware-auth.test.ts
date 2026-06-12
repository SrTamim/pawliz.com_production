import './setup';
import jwt from 'jsonwebtoken';
import _pool from '../config/database';
const pool = _pool as any;

// We test middleware functions directly, not via supertest
// This gives granular coverage of all branches

describe('Auth middleware unit tests', () => {
  let authenticate, requireAdmin, requireVet, optionalAuth;

  beforeEach(() => {
    jest.resetModules();
    jest.mock('../config/database', () => ({ query: jest.fn() }));
    const middleware = require('../middleware/auth');
    authenticate = middleware.authenticate;
    requireAdmin = middleware.requireAdmin;
    requireVet = middleware.requireVet;
    optionalAuth = middleware.optionalAuth;
    jest.clearAllMocks();
  });

  function makeReq(overrides: any = {}): any {
    return {
      cookies: {},
      headers: {},
      ...overrides,
    };
  }

  function makeRes() {
    const res = { status: jest.fn(), json: jest.fn() };
    res.status.mockReturnValue(res);
    return res;
  }

  // ─── authenticate ────────────────────────────────────────────────────────────
  describe('authenticate', () => {
    it('returns 401 with no token', async () => {
      const req = makeReq();
      const res = makeRes();
      const next = jest.fn();
      await authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('returns 401 with invalid token', async () => {
      const req = makeReq({ headers: { authorization: 'Bearer badtoken' } });
      const res = makeRes();
      await authenticate(req, res, makeRes().json);
      expect(res.status).toHaveBeenCalledWith(401);
    });

    it('returns 401 when user inactive', async () => {
      const token = jwt.sign({ userId: 5 }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
      const res = makeRes();
      const next = jest.fn();
      const pool2 = require('../config/database');
      pool2.query.mockResolvedValueOnce({ rows: [{ id: 5, role: 'user', is_active: false }] });
      await authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });

    it('calls next and sets req.user for valid active user', async () => {
      const token = jwt.sign({ userId: 5 }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
      const res = makeRes();
      const next = jest.fn();
      const pool2 = require('../config/database');
      pool2.query.mockResolvedValueOnce({ rows: [{ id: 5, name: 'Test', role: 'user', is_active: true }] });
      await authenticate(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user.id).toBe(5);
    });

    it('reads token from cookie', async () => {
      const token = jwt.sign({ userId: 7 }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const req = makeReq({ cookies: { pawliz_access: token } });
      const res = makeRes();
      const next = jest.fn();
      const pool2 = require('../config/database');
      pool2.query.mockResolvedValueOnce({ rows: [{ id: 7, name: 'Test', role: 'user', is_active: true }] });
      await authenticate(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ─── requireAdmin ─────────────────────────────────────────────────────────────
  describe('requireAdmin', () => {
    it('returns 403 when user is not admin', () => {
      const req = makeReq({ user: { role: 'user' } });
      const res = makeRes();
      requireAdmin(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('calls next for admin user', () => {
      const req = makeReq({ user: { role: 'admin' } });
      const res = makeRes();
      const next = jest.fn();
      requireAdmin(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ─── requireVet ──────────────────────────────────────────────────────────────
  describe('requireVet', () => {
    it('returns 403 when user is not vet', () => {
      const req = makeReq({ user: { role: 'user' } });
      const res = makeRes();
      requireVet(req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(403);
    });

    it('calls next for vet user', () => {
      const req = makeReq({ user: { role: 'vet' } });
      const res = makeRes();
      const next = jest.fn();
      requireVet(req, res, next);
      expect(next).toHaveBeenCalled();
    });
  });

  // ─── optionalAuth ─────────────────────────────────────────────────────────────
  describe('optionalAuth', () => {
    it('calls next without setting req.user when no token', async () => {
      const req = makeReq();
      const res = makeRes();
      const next = jest.fn();
      await optionalAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });

    it('sets req.user for valid token', async () => {
      const token = jwt.sign({ userId: 3 }, process.env.JWT_SECRET, { expiresIn: '1h' });
      const req = makeReq({ cookies: { pawliz_access: token } });
      const res = makeRes();
      const next = jest.fn();
      const pool2 = require('../config/database');
      pool2.query.mockResolvedValueOnce({ rows: [{ id: 3, role: 'user', is_active: true }] });
      await optionalAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user?.id).toBe(3);
    });

    it('calls next without user for invalid token (no throw)', async () => {
      const req = makeReq({ cookies: { pawliz_access: 'invalid.token.here' } });
      const res = makeRes();
      const next = jest.fn();
      await optionalAuth(req, res, next);
      expect(next).toHaveBeenCalled();
      expect(req.user).toBeUndefined();
    });
  });
});
