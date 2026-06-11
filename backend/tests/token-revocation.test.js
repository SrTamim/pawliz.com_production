require('./setup');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/auth', require('../routes/auth'));
  return app;
}

function makeAccessToken(userId = 1) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function mockUser(role = 'user') {
  pool.query.mockResolvedValueOnce({
    rows: [{ id: 1, name: 'Test User', role, is_active: true }],
  });
}

// Pre-computed bcrypt hash of 'Test@12345' with 4 rounds (fast for tests)
const TEST_PASSWORD = 'Test@12345';
let TEST_PASSWORD_HASH;
beforeAll(async () => {
  TEST_PASSWORD_HASH = await bcrypt.hash(TEST_PASSWORD, 4);
});

describe('Token revocation and refresh', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  // ── Refresh token ─────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/refresh', () => {
    it('returns 401 with no refresh cookie', async () => {
      const res = await request(app).post('/api/v1/auth/refresh');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('No refresh token');
    });

    it('returns 401 for expired or missing refresh token in DB', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'pawliz_refresh=bogus-token');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired refresh token');
    });

    it('returns 401 and clears cookies when user is inactive', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 10, user_id: 1 }] })      // stored token found
        .mockResolvedValueOnce({ rows: [{ id: 1, is_active: false }] }); // user inactive
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'pawliz_refresh=validtoken');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('User not found or inactive');
      const cookies = res.headers['set-cookie'].join('');
      expect(cookies).toContain('pawliz_access=;');
    });

    it('issues new token pair and rotates refresh token on valid cookie', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 10, user_id: 1 }] }) // stored token found
        .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] }) // user active
        .mockResolvedValueOnce({ rows: [] })                           // DELETE old token
        .mockResolvedValueOnce({ rows: [] });                          // INSERT new token
      const res = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'pawliz_refresh=validtoken');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Token refreshed');
      const cookies = res.headers['set-cookie'].join('');
      expect(cookies).toContain('pawliz_access');
      expect(cookies).toContain('pawliz_refresh');
    });

    it('old refresh token deleted from DB on rotation', async () => {
      // refresh route uses pool.connect() + client.query() for transaction
      // pool.query: stored token check + user active check (2 queries)
      // client.query: BEGIN + DELETE + INSERT(authHelpers createTokens) + COMMIT
      const mockClient = pool._mockClient;
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 10, user_id: 1 }] })  // stored token
        .mockResolvedValueOnce({ rows: [{ id: 1, is_active: true }] }); // user active
      // client.query for transaction (BEGIN, DELETE, INSERT refresh token, COMMIT)
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] })  // DELETE old token
        .mockResolvedValueOnce({ rows: [] })  // INSERT new refresh token
        .mockResolvedValueOnce({ rows: [] }); // COMMIT
      await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'pawliz_refresh=oldtoken');
      // DELETE uses client.query, not pool.query
      const deleteCalls = mockClient.query.mock.calls.filter(
        ([sql]) => typeof sql === 'string' && sql.includes('DELETE FROM refresh_tokens WHERE id')
      );
      expect(deleteCalls.length).toBe(1);
    });
  });

  // ── Logout ────────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout — single session revocation', () => {
    it('returns 200 and clears cookies when no refresh cookie present', async () => {
      const res = await request(app).post('/api/v1/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out');
    });

    it('deletes refresh token from DB on logout', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', 'pawliz_refresh=sessiontoken');
      expect(res.status).toBe(200);
      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM refresh_tokens WHERE token = $1',
        ['sessiontoken']
      );
    });

    it('clears both cookies in response headers after logout', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', 'pawliz_refresh=sessiontoken');
      const cookies = res.headers['set-cookie'].join('');
      expect(cookies).toContain('pawliz_access=;');
      expect(cookies).toContain('pawliz_refresh=;');
    });
  });

  // ── Logout-all ────────────────────────────────────────────────────────────

  describe('POST /api/v1/auth/logout-all — all session revocation', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).post('/api/v1/auth/logout-all');
      expect(res.status).toBe(401);
    });

    it('deletes ALL refresh tokens for user — not just current session', async () => {
      mockUser();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${makeAccessToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out from all devices');
      expect(pool.query).toHaveBeenCalledWith(
        'DELETE FROM refresh_tokens WHERE user_id = $1',
        [1]
      );
    });

    it('clears cookies after logout-all', async () => {
      mockUser();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${makeAccessToken()}`);
      const cookies = res.headers['set-cookie'].join('');
      expect(cookies).toContain('pawliz_access=;');
      expect(cookies).toContain('pawliz_refresh=;');
    });
  });

  // ── Login happy path ──────────────────────────────────────────────────────

  describe('POST /api/v1/auth/login — successful login sets cookies', () => {
    it('sets pawliz_access and pawliz_refresh cookies on valid credentials', async () => {
      pool.query
        .mockResolvedValueOnce({
          rows: [{
            id: 1,
            name: 'Test User',
            phone: '01712345678',
            role: 'user',
            is_active: true,
            password: TEST_PASSWORD_HASH,
          }],
        })
        .mockResolvedValueOnce({ rows: [] }); // INSERT refresh_tokens
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ phone: '01712345678', password: TEST_PASSWORD });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Login successful');
      expect(res.body.user.password).toBeUndefined();
      const cookies = res.headers['set-cookie'].join('');
      expect(cookies).toContain('pawliz_access');
      expect(cookies).toContain('pawliz_refresh');
    });

    it('returns 401 for inactive user', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // is_active=true filter returns nothing
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ phone: '01712345678', password: TEST_PASSWORD });
      expect(res.status).toBe(401);
    });
  });

  // ── Register happy path ───────────────────────────────────────────────────

  describe('POST /api/v1/auth/register — new user gets token pair', () => {
    it('sets both cookies and returns 201 on successful registration', async () => {
      // Register flow (SMS disabled path):
      // 1. getSmsEnabled → pool.query (site_settings)
      // 2. Phone uniqueness check
      // 3. INSERT user → RETURNING user row
      // 4. INSERT refresh_token (via createTokens)
      pool.query
        .mockResolvedValueOnce({ rows: [] })  // sms_enabled check → disabled
        .mockResolvedValueOnce({ rows: [] })  // phone uniqueness check → not taken
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'New User', phone: '01987654321', email: null, role: 'user' }] }) // INSERT users
        .mockResolvedValueOnce({ rows: [] }); // INSERT refresh_tokens
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ name: 'New User', phone: '01987654321', password: 'Secure123', address: 'Dhaka' });
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Registration successful');
      const cookies = res.headers['set-cookie'].join('');
      expect(cookies).toContain('pawliz_access');
      expect(cookies).toContain('pawliz_refresh');
    });
  });
});
