import './setup';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import _pool from '../config/database';
const pool = _pool as any;

// Build minimal app for testing
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/auth', require('../routes/auth'));
  return app;
}

describe('Auth routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  describe('POST /api/v1/auth/register', () => {
    it('returns 400 on missing fields', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({});
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('returns 400 on invalid phone', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test', phone: '12345', password: 'password123',
      });
      expect(res.status).toBe(400);
    });

    it('returns 409 if phone exists', async () => {
      // SMS check first (getSmsEnabled queries DB), then phone exists check
      // But smsService.getSmsEnabled is not mocked in auth.test.js — it queries DB
      // Mock: 1=sms_enabled check, 2=phone exists
      pool.query
        .mockResolvedValueOnce({ rows: [] }) // sms_enabled = disabled
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // phone exists
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test', phone: '01712345678', password: 'Test1234', address: 'Dhaka',
      });
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('returns 400 on missing fields', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({});
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('returns 401 on invalid credentials', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // no user found
      const res = await request(app).post('/api/v1/auth/login').send({
        phone: '01712345678', password: 'wrongpassword',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toBeDefined();
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns 200 { user: null } with no token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
    });

    it('returns 200 { user: null } with invalid token', async () => {
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalidtoken');
      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('clears cookies and returns 200', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // delete refresh token
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('returns 401 with no refresh cookie', async () => {
      const res = await request(app).post('/api/v1/auth/refresh');
      expect(res.status).toBe(401);
    });
  });
});
