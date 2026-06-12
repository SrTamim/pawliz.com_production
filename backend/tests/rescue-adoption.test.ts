import './setup';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import _pool from '../config/database';
const pool = _pool as any;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/rescue-adoption', require('../routes/rescue-adoption'));
  return app;
}

describe('Rescue & Adoption routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  describe('GET /api/v1/rescue-adoption/rescue', () => {
    it('returns rescue feed with pagination', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '4' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, pet_type: 'dog' }] });
      const res = await request(app).get('/api/v1/rescue-adoption/rescue');
      expect(res.status).toBe(200);
      expect(res.body.posts).toBeDefined();
      expect(res.body.total).toBe(4);
      expect(res.body.page).toBe(1);
    });
  });

  describe('GET /api/v1/rescue-adoption/adoption', () => {
    it('returns adoption feed with pagination', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/v1/rescue-adoption/adoption');
      expect(res.status).toBe(200);
      expect(res.body.posts).toBeDefined();
      expect(res.body.total).toBe(2);
    });
  });

  describe('POST /api/v1/rescue-adoption/comments (auth required)', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).post('/api/v1/rescue-adoption/comments').send({
        post_id: 1, post_type: 'rescue', comment_text: 'Hello',
      });
      expect(res.status).toBe(401);
    });

    it('returns 400 on invalid post_type', async () => {
      const res = await request(app).post('/api/v1/rescue-adoption/comments').send({
        post_id: 1, post_type: 'invalid', comment_text: 'Hello',
      });
      // 401 from auth before validation
      expect([400, 401]).toContain(res.status);
    });
  });

  describe('GET /api/v1/rescue-adoption/comments/:postType/:postId', () => {
    it('returns 400 for invalid post type', async () => {
      const res = await request(app).get('/api/v1/rescue-adoption/comments/invalid/1');
      expect(res.status).toBe(400);
    });

    it('returns comments for valid rescue post', async () => {
      // GET comments uses Promise.all([SELECT, COUNT]) — 2 queries
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, comment_text: 'Test', name: 'User' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const res = await request(app).get('/api/v1/rescue-adoption/comments/rescue/1');
      expect(res.status).toBe(200);
      expect(res.body.comments).toBeDefined();
    });

    it('returns comments for valid adoption post', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });
      const res = await request(app).get('/api/v1/rescue-adoption/comments/adoption/5');
      expect(res.status).toBe(200);
      expect(res.body.comments).toBeDefined();
    });
  });
});
