import './setup';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import _pool from '../config/database';
const pool = _pool as any;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  // Mount all admin setting routes
  app.use('/api/v1/admin', require('../routes/admin-settings'));
  return app;
}
function makeToken() {
  return jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
}
function mockAdmin() {
  pool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Admin', role: 'admin', is_active: true }] });
}
function mockUser() {
  pool.query.mockResolvedValueOnce({ rows: [{ id: 2, name: 'User', role: 'user', is_active: true }] });
}

describe('Admin settings routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  // ─── GET /stats ──────────────────────────────────────────────────────────────
  describe('GET /api/v1/admin/stats', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/admin/stats');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin', async () => {
      mockUser();
      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(403);
    });

    it('returns stats object with all counts', async () => {
      mockAdmin();
      // Endpoint fires many parallel COUNT queries (standalone aggregates +
      // total/cur/prev windows per trend entity). Stub generously so every
      // pool.query resolves to a count row.
      for (let i = 0; i < 40; i++) {
        pool.query.mockResolvedValueOnce({ rows: [{ count: String(i) }] });
      }
      const res = await request(app)
        .get('/api/v1/admin/stats')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.users).toBe('number');
      expect(typeof res.body.vets).toBe('number');
      expect(typeof res.body.pets).toBe('number');
      expect(typeof res.body.lostPets).toBe('number');
      // new aggregate shapes
      expect(res.body.queues).toBeDefined();
      expect(typeof res.body.queues.pendingVets).toBe('number');
      expect(res.body.deltas).toBeDefined();
      expect(res.body.reunion).toBeDefined();
      expect(typeof res.body.reunion.rate).toBe('number');
    });
  });

  // ─── GET /settings ───────────────────────────────────────────────────────────
  describe('GET /api/v1/admin/settings', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/admin/settings');
      expect(res.status).toBe(401);
    });

    it('returns settings object', async () => {
      mockAdmin();
      pool.query.mockResolvedValueOnce({
        rows: [
          { key: 'logo_text', value: 'Pawliz' },
          { key: 'logo_image', value: '/logo.png' },
        ],
      });
      const res = await request(app)
        .get('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.settings.logo_text).toBe('Pawliz');
    });
  });

  // ─── PUT /settings ───────────────────────────────────────────────────────────
  describe('PUT /api/v1/admin/settings', () => {
    it('returns 400 without settings object', async () => {
      mockAdmin();
      const res = await request(app)
        .put('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 for unknown settings keys', async () => {
      mockAdmin();
      const res = await request(app)
        .put('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ settings: { unknown_key: 'value' } });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Unknown/);
    });

    it('updates allowed settings keys', async () => {
      mockAdmin();
      pool.query.mockResolvedValueOnce({ rows: [] }); // upsert
      pool.query.mockResolvedValueOnce({ rows: [] }); // activity log
      const res = await request(app)
        .put('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ settings: { logo_text: 'Pawliz BD' } });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Settings updated');
    });

    it('rejects sms_enabled key (managed by sms route)', async () => {
      mockAdmin();
      const res = await request(app)
        .put('/api/v1/admin/settings')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ settings: { sms_enabled: 'true' } });
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /activity-logs ───────────────────────────────────────────────────────
  describe('GET /api/v1/admin/activity-logs', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/admin/activity-logs');
      expect(res.status).toBe(401);
    });

    it('returns paginated activity logs', async () => {
      mockAdmin();
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, event_type: 'user_login', user_name: 'Ali' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const res = await request(app)
        .get('/api/v1/admin/activity-logs')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.logs).toBeDefined();
      expect(res.body.total).toBe(1);
    });

    it('filters by event_type', async () => {
      mockAdmin();
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });
      const res = await request(app)
        .get('/api/v1/admin/activity-logs?event_type=user_login')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
    });
  });
});
