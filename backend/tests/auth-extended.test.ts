import './setup';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import _pool from '../config/database';
const pool = _pool as any;

jest.mock('../services/smsService', () => ({
  getSmsEnabled: jest.fn(),
  sendOtp: jest.fn(),
  consumeVerified: jest.fn(),
  invalidateOtp: jest.fn(),
}));
import * as _smsService from '../services/smsService';
const smsService = _smsService as any;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/auth', require('../routes/auth'));
  return app;
}
function makeToken(userId = 5) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}
function mockUser(id = 5, role = 'user') {
  pool.query.mockResolvedValueOnce({ rows: [{ id, name: 'User', role, is_active: true }] });
}

describe('Auth extended routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  // ─── POST /logout-all ─────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/logout-all', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/v1/auth/logout-all');
      expect(res.status).toBe(401);
    });

    it('clears all refresh tokens for user', async () => {
      mockUser();
      pool.query.mockResolvedValueOnce({ rows: [] }); // DELETE refresh_tokens
      const res = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/all devices/i);
    });
  });

  // ─── POST /forgot-password/send-otp ──────────────────────────────────────────
  describe('POST /api/v1/auth/forgot-password/send-otp', () => {
    it('returns 400 for invalid phone', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password/send-otp').send({ phone: '123' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when phone not registered', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // user not found
      const res = await request(app).post('/api/v1/auth/forgot-password/send-otp').send({ phone: '01712345678' });
      expect(res.status).toBe(404);
    });

    it('returns { skipped: true } when SMS disabled', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 5 }] }); // user found
      smsService.getSmsEnabled.mockResolvedValueOnce(false);
      const res = await request(app).post('/api/v1/auth/forgot-password/send-otp').send({ phone: '01712345678' });
      expect(res.status).toBe(200);
      expect(res.body.skipped).toBe(true);
    });

    it('sends OTP when SMS enabled and user exists', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 5 }] });
      smsService.getSmsEnabled.mockResolvedValueOnce(true);
      smsService.sendOtp.mockResolvedValueOnce({ sent: true });
      const res = await request(app).post('/api/v1/auth/forgot-password/send-otp').send({ phone: '01712345678' });
      expect(res.status).toBe(200);
      expect(res.body.sent).toBe(true);
    });
  });

  // ─── POST /forgot-password/reset ─────────────────────────────────────────────
  describe('POST /api/v1/auth/forgot-password/reset', () => {
    it('returns 400 for weak password (no numbers)', async () => {
      const res = await request(app).post('/api/v1/auth/forgot-password/reset').send({
        phone: '01712345678', new_password: 'onlyletters',
      });
      expect(res.status).toBe(400);
    });

    it('returns 503 when SMS disabled', async () => {
      smsService.getSmsEnabled.mockResolvedValueOnce(false);
      const res = await request(app).post('/api/v1/auth/forgot-password/reset').send({
        phone: '01712345678', new_password: 'NewPass123',
      });
      expect(res.status).toBe(503);
    });

    it('returns 403 when phone not verified', async () => {
      smsService.getSmsEnabled.mockResolvedValueOnce(true);
      smsService.consumeVerified.mockReturnValueOnce(false);
      const res = await request(app).post('/api/v1/auth/forgot-password/reset').send({
        phone: '01712345678', new_password: 'NewPass123',
      });
      expect(res.status).toBe(403);
    });

    it('returns 404 when user not found', async () => {
      smsService.getSmsEnabled.mockResolvedValueOnce(true);
      smsService.consumeVerified.mockReturnValueOnce(true);
      pool.query.mockResolvedValueOnce({ rows: [] }); // user not found
      const res = await request(app).post('/api/v1/auth/forgot-password/reset').send({
        phone: '01712345678', new_password: 'NewPass123',
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /register (with SMS check) ─────────────────────────────────────────
  describe('POST /api/v1/auth/register - SMS verification', () => {
    it('returns 403 when SMS enabled and phone not verified', async () => {
      smsService.getSmsEnabled.mockResolvedValueOnce(true);
      smsService.consumeVerified.mockReturnValueOnce(false);
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test', phone: '01712345678', password: 'Test1234', address: 'Dhaka',
      });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/verification/i);
    });

    it('returns 400 on invalid dob (future)', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test', phone: '01712345678', password: 'Test1234', address: 'Dhaka', dob: '2099-01-01',
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 on invalid email', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test', phone: '01712345678', password: 'Test1234', address: 'Dhaka', email: 'bademail',
      });
      expect(res.status).toBe(400);
    });

    it('returns 409 on duplicate email', async () => {
      smsService.getSmsEnabled.mockResolvedValueOnce(false);
      pool.query.mockResolvedValueOnce({ rows: [] }); // phone not taken
      pool.query.mockResolvedValueOnce({ rows: [{ id: 99 }] }); // email taken
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test', phone: '01712345678', password: 'Test1234', address: 'Dhaka', email: 'taken@test.com',
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/email/i);
    });
  });

  // ─── POST /refresh ─────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/refresh', () => {
    it('returns 401 with invalid/expired refresh token', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // token not in DB
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'pawliz_refresh=badtoken');
      expect(res.status).toBe(401);
    });

    it('returns 401 when user is inactive', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 5 }] }) // token found
        .mockResolvedValueOnce({ rows: [{ id: 5, is_active: false }] }); // user inactive
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'pawliz_refresh=validtoken');
      expect(res.status).toBe(401);
    });
  });

  // ─── GET /me ─────────────────────────────────────────────────────────────────
  describe('GET /api/v1/auth/me', () => {
    it('returns user data for authenticated request', async () => {
      mockUser();
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 5, name: 'Test', phone: '01712345678', role: 'user', pet_count: '2' }],
      });
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(5);
    });
  });
});
