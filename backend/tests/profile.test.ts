import './setup';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import _pool from '../config/database';
const pool = _pool as any;

// Mock smsService and fileUtils used by profile route
jest.mock('../services/smsService', () => ({
  getSmsEnabled: jest.fn().mockResolvedValue(false),
  consumeVerified: jest.fn().mockReturnValue(true),
}));
jest.mock('../utils/fileUtils', () => ({
  deleteUploadedFile: jest.fn(),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/profile', require('../routes/profile'));
  return app;
}

function makeToken(userId = 5) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}
function mockUser(id = 5) {
  pool.query.mockResolvedValueOnce({
    rows: [{ id, name: 'Test User', role: 'user', is_active: true, phone: '01712345678' }],
  });
}

describe('Profile routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  // ─── GET /profile ─────────────────────────────────────────────────────────────
  describe('GET /api/v1/profile', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/profile');
      expect(res.status).toBe(401);
    });

    it('returns user + pets for authenticated user', async () => {
      mockUser();
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 5, name: 'Test User', pet_count: '2' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Buddy', type: 'dog' }] });
      const res = await request(app)
        .get('/api/v1/profile')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.pets).toBeDefined();
    });
  });

  // ─── PUT /profile ─────────────────────────────────────────────────────────────
  describe('PUT /api/v1/profile', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).put('/api/v1/profile').send({ name: 'New Name' });
      expect(res.status).toBe(401);
    });

    it('returns 400 on empty name string', async () => {
      mockUser();
      const res = await request(app)
        .put('/api/v1/profile')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('returns 400 on invalid email', async () => {
      mockUser();
      const res = await request(app)
        .put('/api/v1/profile')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ email: 'bademail' });
      expect(res.status).toBe(400);
    });

    it('returns 400 on future dob', async () => {
      mockUser();
      const res = await request(app)
        .put('/api/v1/profile')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ dob: '2099-01-01' });
      expect(res.status).toBe(400);
    });

    it('returns 409 if email already in use', async () => {
      mockUser();
      pool.query.mockResolvedValueOnce({ rows: [{ id: 99 }] }); // email exists for another user
      const res = await request(app)
        .put('/api/v1/profile')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ email: 'taken@example.com' });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/email/i);
    });

    it('updates profile successfully', async () => {
      mockUser();
      // Only sending name (no email/phone) → no extra checks → just UPDATE
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 5, name: 'Updated Name', phone: '01712345678' }],
      });
      const res = await request(app)
        .put('/api/v1/profile')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ name: 'Updated Name' });
      expect(res.status).toBe(200);
      expect(res.body.user.name).toBe('Updated Name');
    });
  });

  // ─── PUT /profile/password ────────────────────────────────────────────────────
  describe('PUT /api/v1/profile/password', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).put('/api/v1/profile/password').send({
        current_password: 'old', new_password: 'new1234',
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 on missing current_password', async () => {
      mockUser();
      const res = await request(app)
        .put('/api/v1/profile/password')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ new_password: 'NewPass1' });
      expect(res.status).toBe(400);
    });

    it('returns 400 on weak new_password (no numbers)', async () => {
      mockUser();
      const res = await request(app)
        .put('/api/v1/profile/password')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ current_password: 'OldPass1', new_password: 'onlyletters' });
      expect(res.status).toBe(400);
    });

    it('returns 400 when new_password same as current', async () => {
      mockUser();
      const res = await request(app)
        .put('/api/v1/profile/password')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ current_password: 'Same123', new_password: 'Same123' });
      expect(res.status).toBe(400);
    });
  });

  // ─── GET /profile/completion ─────────────────────────────────────────────────
  describe('GET /api/v1/profile/completion', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/profile/completion');
      expect(res.status).toBe(401);
    });

    it('returns completion percentage and badge', async () => {
      mockUser();
      pool.query.mockResolvedValueOnce({
        rows: [{ user_filled: '5', pet_filled: '10', pet_total: '15' }],
      });
      const res = await request(app)
        .get('/api/v1/profile/completion')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.percentage).toBe('number');
      expect(['bronze', 'gold', 'diamond']).toContain(res.body.badge);
    });
  });
});
