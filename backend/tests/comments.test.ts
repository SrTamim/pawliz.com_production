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
  app.use('/api/v1/comments', require('../routes/comments'));
  return app;
}

function makeToken(userId = 99) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function mockUser(id = 99, role = 'user') {
  pool.query.mockResolvedValueOnce({
    rows: [{ id, name: 'User', role, is_active: true }],
  });
}

describe('Comments routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.resetAllMocks();
  });

  describe('POST /api/v1/comments/:id/report', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/v1/comments/1/report').send({ reason: 'spam' });
      expect(res.status).toBe(401);
    });

    it('returns 400 on invalid reason', async () => {
      mockUser();
      const res = await request(app)
        .post('/api/v1/comments/1/report')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ reason: 'bad_reason' });
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('returns 400 for non-numeric comment id', async () => {
      mockUser();
      const res = await request(app)
        .post('/api/v1/comments/abc/report')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ reason: 'spam' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when comment not found', async () => {
      mockUser();
      pool.query.mockResolvedValueOnce({ rows: [] }); // comment not found
      const res = await request(app)
        .post('/api/v1/comments/999/report')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ reason: 'spam' });
      expect(res.status).toBe(404);
    });

    it('returns 400 when user reports own comment', async () => {
      mockUser(5);
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, user_id: 5 }] }); // same user_id
      const res = await request(app)
        .post('/api/v1/comments/1/report')
        .set('Authorization', `Bearer ${makeToken(5)}`)
        .send({ reason: 'spam' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/own/i);
    });

    it('returns 409 if already reported by same user', async () => {
      mockUser(10);
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, user_id: 20 }] }); // comment by different user
      const uniqueErr: any = new Error('duplicate key');
      uniqueErr.code = '23505';
      pool.query.mockRejectedValueOnce(uniqueErr); // duplicate report insert
      const res = await request(app)
        .post('/api/v1/comments/1/report')
        .set('Authorization', `Bearer ${makeToken(10)}`)
        .send({ reason: 'spam' });
      expect(res.status).toBe(409);
    });

    it('successfully reports comment and returns hidden status', async () => {
      mockUser(10);
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, user_id: 20 }] }); // comment exists
      pool.query.mockResolvedValueOnce({ rows: [] }); // insert report OK
      pool.query.mockResolvedValueOnce({ rows: [{ report_count: 1, is_hidden: false }] }); // update
      const res = await request(app)
        .post('/api/v1/comments/1/report')
        .set('Authorization', `Bearer ${makeToken(10)}`)
        .send({ reason: 'spam' });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Comment reported');
      expect(typeof res.body.hidden).toBe('boolean');
    });

    it('auto-hides comment after reaching threshold (3 reports)', async () => {
      mockUser(10);
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, user_id: 20 }] });
      pool.query.mockResolvedValueOnce({ rows: [] });
      pool.query.mockResolvedValueOnce({ rows: [{ report_count: 3, is_hidden: true }] });
      const res = await request(app)
        .post('/api/v1/comments/1/report')
        .set('Authorization', `Bearer ${makeToken(10)}`)
        .send({ reason: 'harassment' });
      expect(res.status).toBe(200);
      expect(res.body.hidden).toBe(true);
    });
  });
});
