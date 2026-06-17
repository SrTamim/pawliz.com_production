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
  app.use('/api/v1/community', require('../routes/community'));
  return app;
}

describe('Community routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  describe('GET /api/v1/community/tags', () => {
    it('returns active tags', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, slug: 'help', label: 'Help' }] });
      const res = await request(app).get('/api/v1/community/tags');
      expect(res.status).toBe(200);
      expect(res.body.tags).toHaveLength(1);
    });
  });

  describe('GET /api/v1/community/posts', () => {
    it('returns keyset feed shape and anonymous cache header', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // feed query
      const res = await request(app).get('/api/v1/community/posts');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('posts');
      expect(res.body).toHaveProperty('next_cursor');
      expect(res.body).toHaveProperty('has_more');
      expect(res.headers['cache-control']).toContain('s-maxage');
      // anonymous payload must not leak per-user reaction
      expect(JSON.stringify(res.body)).not.toContain('user_reaction');
    });
  });

  describe('GET /api/v1/community/posts/:id', () => {
    it('returns 400 for non-numeric id', async () => {
      const res = await request(app).get('/api/v1/community/posts/abc');
      expect(res.status).toBe(400);
    });
    it('returns 404 for missing post', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/v1/community/posts/999');
      expect(res.status).toBe(404);
    });
  });

  describe('auth-gated writes', () => {
    it('POST /posts → 401 without token', async () => {
      const res = await request(app).post('/api/v1/community/posts').field('body', 'hi');
      expect(res.status).toBe(401);
    });
    it('DELETE /posts/:id → 401 without token', async () => {
      const res = await request(app).delete('/api/v1/community/posts/1');
      expect(res.status).toBe(401);
    });
    it('POST /reactions → 401 without token', async () => {
      const res = await request(app).post('/api/v1/community/reactions').send({ post_id: 1, reaction_type: 'love' });
      expect(res.status).toBe(401);
    });
    it('POST /posts/:id/report → 401 without token', async () => {
      const res = await request(app).post('/api/v1/community/posts/1/report').send({ reason: 'spam' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/community/comments/:postId', () => {
    it('returns comments + total', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, comment_text: 'hi' }] }) // getComments rows
        .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // total
      const res = await request(app).get('/api/v1/community/comments/5');
      expect(res.status).toBe(200);
      expect(res.body.comments).toBeDefined();
      expect(res.body.total).toBe(1);
    });
  });
});
