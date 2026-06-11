require('./setup');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

jest.mock('../services/smsService', () => ({
  getBalance: jest.fn(),
  getSmsEnabled: jest.fn(),
  bustSmsSettingsCache: jest.fn(),
}));
const smsService = require('../services/smsService');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/admin/sms', require('../routes/admin-sms'));
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

describe('Admin SMS routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  // ─── GET /balance ─────────────────────────────────────────────────────────────
  describe('GET /api/v1/admin/sms/balance', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/admin/sms/balance');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin', async () => {
      mockUser();
      const res = await request(app)
        .get('/api/v1/admin/sms/balance')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(403);
    });

    it('returns balance for admin', async () => {
      mockAdmin();
      smsService.getBalance.mockResolvedValueOnce({ balance: '10.00', currency: 'BDT' });
      const res = await request(app)
        .get('/api/v1/admin/sms/balance')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.balance).toBeDefined();
    });

    it('returns 500 if getBalance throws', async () => {
      mockAdmin();
      smsService.getBalance.mockRejectedValueOnce(new Error('API error'));
      const res = await request(app)
        .get('/api/v1/admin/sms/balance')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(500);
    });
  });

  // ─── GET /settings ────────────────────────────────────────────────────────────
  describe('GET /api/v1/admin/sms/settings', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/admin/sms/settings');
      expect(res.status).toBe(401);
    });

    it('returns sms settings with defaults', async () => {
      mockAdmin();
      pool.query.mockResolvedValueOnce({ rows: [] }); // no settings in DB
      const res = await request(app)
        .get('/api/v1/admin/sms/settings')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.sms_enabled).toBe('boolean');
      expect(typeof res.body.admin_phone).toBe('string');
    });

    it('returns correct sms_enabled and admin_phone from DB', async () => {
      mockAdmin();
      pool.query.mockResolvedValueOnce({
        rows: [
          { key: 'sms_enabled', value: 'true' },
          { key: 'admin_phone', value: '01700000000' },
        ],
      });
      const res = await request(app)
        .get('/api/v1/admin/sms/settings')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.sms_enabled).toBe(true);
      expect(res.body.admin_phone).toBe('01700000000');
    });
  });

  // ─── PATCH /settings ──────────────────────────────────────────────────────────
  describe('PATCH /api/v1/admin/sms/settings', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).patch('/api/v1/admin/sms/settings').send({ sms_enabled: true });
      expect(res.status).toBe(401);
    });

    it('updates sms_enabled', async () => {
      mockAdmin();
      pool.query.mockResolvedValueOnce({ rows: [] }); // upsert
      const res = await request(app)
        .patch('/api/v1/admin/sms/settings')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ sms_enabled: true });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('SMS settings updated');
      expect(smsService.bustSmsSettingsCache).toHaveBeenCalled();
    });

    it('updates admin_phone', async () => {
      mockAdmin();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .patch('/api/v1/admin/sms/settings')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ admin_phone: '01700000000' });
      expect(res.status).toBe(200);
    });

    it('updates both at once', async () => {
      mockAdmin();
      pool.query.mockResolvedValueOnce({ rows: [] });
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .patch('/api/v1/admin/sms/settings')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ sms_enabled: false, admin_phone: '01700000000' });
      expect(res.status).toBe(200);
    });
  });
});
