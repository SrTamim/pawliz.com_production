require('./setup');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/admin/comments', require('../routes/admin-comments'));
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

describe('Admin comments routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  // ─── GET /reported ────────────────────────────────────────────────────────────
  describe('GET /api/v1/admin/comments/reported', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/admin/comments/reported');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin', async () => {
      mockUser();
      const res = await request(app)
        .get('/api/v1/admin/comments/reported')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(403);
    });

    it('returns reported comments list for admin', async () => {
      mockAdmin();
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, comment_text: 'Spam', report_count: 2, commenter_name: 'User1' }],
      });
      const res = await request(app)
        .get('/api/v1/admin/comments/reported')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.comments).toHaveLength(1);
    });
  });

  // ─── DELETE /:id ──────────────────────────────────────────────────────────────
  describe('DELETE /api/v1/admin/comments/:id', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).delete('/api/v1/admin/comments/1');
      expect(res.status).toBe(401);
    });

    it('returns 400 for non-numeric id', async () => {
      mockAdmin();
      const res = await request(app)
        .delete('/api/v1/admin/comments/abc')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(400);
    });

    it('returns 404 when comment not found', async () => {
      mockAdmin();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .delete('/api/v1/admin/comments/999')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(404);
    });

    it('soft-deletes comment and returns 200', async () => {
      mockAdmin();
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // update returns row
      pool.query.mockResolvedValueOnce({ rows: [] }); // activity log
      const res = await request(app)
        .delete('/api/v1/admin/comments/1')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Comment deleted');
    });
  });

  // ─── POST /:id/dismiss ────────────────────────────────────────────────────────
  describe('POST /api/v1/admin/comments/:id/dismiss', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/v1/admin/comments/1/dismiss');
      expect(res.status).toBe(401);
    });

    it('returns 400 for non-numeric id', async () => {
      mockAdmin();
      const res = await request(app)
        .post('/api/v1/admin/comments/abc/dismiss')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(400);
    });

    it('dismisses reports and returns 200', async () => {
      mockAdmin();
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // update comment (RETURNING id)
      pool.query.mockResolvedValueOnce({ rows: [] }); // delete reports
      const res = await request(app)
        .post('/api/v1/admin/comments/1/dismiss')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Comment cleared');
    });
  });
});
