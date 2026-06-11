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
  app.use('/api/v1/admin', require('../routes/admin-pets'));
  return app;
}
function makeToken() {
  return jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
}
function mockAdmin() {
  pool.query.mockResolvedValueOnce({ rows: [{ id: 1, name: 'Admin', role: 'admin', is_active: true }] });
}

describe('Admin pets/found/rescue routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  // ─── GET /pets ────────────────────────────────────────────────────────────────
  describe('GET /api/v1/admin/pets', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).get('/api/v1/admin/pets');
      expect(res.status).toBe(401);
    });

    it('returns paginated pets list for admin', async () => {
      mockAdmin();
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Buddy', type: 'dog', owner_name: 'Ali' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const res = await request(app)
        .get('/api/v1/admin/pets')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.pets).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('filters by type', async () => {
      mockAdmin();
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });
      const res = await request(app)
        .get('/api/v1/admin/pets?type=cat')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
    });

    it('filters lost pets', async () => {
      mockAdmin();
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 2, name: 'Lost Cat', is_lost: true }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const res = await request(app)
        .get('/api/v1/admin/pets?filter=lost')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
    });
  });

  // ─── PUT /pets/:id ────────────────────────────────────────────────────────────
  describe('PUT /api/v1/admin/pets/:id', () => {
    it('returns 400 when no fields to update', async () => {
      mockAdmin();
      // No petOwner query needed since validation happens first... but route fetches owner first
      pool.query.mockResolvedValueOnce({ rows: [{ user_id: 5 }] }); // pet owner
      const res = await request(app)
        .put('/api/v1/admin/pets/1')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('returns 404 when pet not found', async () => {
      mockAdmin();
      pool.query.mockResolvedValueOnce({ rows: [] }); // pet owner not found
      const res = await request(app)
        .put('/api/v1/admin/pets/999')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ name: 'New Name' });
      expect(res.status).toBe(404);
    });

    it('updates pet name', async () => {
      mockAdmin();
      const mockClient = pool._mockClient;
      pool.query.mockResolvedValueOnce({ rows: [{ user_id: 5 }] }); // owner
      // connect → client.query(BEGIN) → UPDATE → COMMIT
      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'New Name', type: 'dog' }] }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }); // COMMIT
      const res = await request(app)
        .put('/api/v1/admin/pets/1')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ name: 'New Name' });
      expect(res.status).toBe(200);
    });
  });

  // ─── DELETE /pets/:id ─────────────────────────────────────────────────────────
  describe('DELETE /api/v1/admin/pets/:id', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).delete('/api/v1/admin/pets/1');
      expect(res.status).toBe(401);
    });

    it('soft-deletes pet', async () => {
      mockAdmin();
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // UPDATE ... RETURNING id
      const res = await request(app)
        .delete('/api/v1/admin/pets/1')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Pet deactivated');
    });
  });

  // ─── GET /found-pets ──────────────────────────────────────────────────────────
  describe('GET /api/v1/admin/found-pets', () => {
    it('returns paginated found pet reports', async () => {
      mockAdmin();
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, pet_type: 'dog' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const res = await request(app)
        .get('/api/v1/admin/found-pets')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.posts).toBeDefined();
    });
  });

  // ─── DELETE /found-pets/:id ───────────────────────────────────────────────────
  describe('DELETE /api/v1/admin/found-pets/:id', () => {
    it('soft-deletes found pet report', async () => {
      mockAdmin();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .delete('/api/v1/admin/found-pets/1')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Report deactivated');
    });
  });

  // ─── GET /rescue-pets ─────────────────────────────────────────────────────────
  describe('GET /api/v1/admin/rescue-pets', () => {
    it('returns paginated rescue posts', async () => {
      mockAdmin();
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, pet_type: 'cat' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const res = await request(app)
        .get('/api/v1/admin/rescue-pets')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.posts).toBeDefined();
    });
  });

  // ─── PUT /rescue-pets/:id ─────────────────────────────────────────────────────
  describe('PUT /api/v1/admin/rescue-pets/:id', () => {
    it('returns 400 when no fields to update', async () => {
      mockAdmin();
      const res = await request(app)
        .put('/api/v1/admin/rescue-pets/1')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({});
      expect(res.status).toBe(400);
    });

    it('updates rescue post status', async () => {
      mockAdmin();
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'resolved' }] });
      const res = await request(app)
        .put('/api/v1/admin/rescue-pets/1')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ status: 'resolved' });
      expect(res.status).toBe(200);
    });
  });
});
