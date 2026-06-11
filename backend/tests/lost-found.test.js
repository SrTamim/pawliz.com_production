require('./setup');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const pool = require('../config/database');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/lost-found', require('../routes/lost-found'));
  return app;
}

describe('Lost & Found routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  describe('GET /api/v1/lost-found/lost', () => {
    it('returns lost feed with pagination', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Buddy' }] });
      const res = await request(app).get('/api/v1/lost-found/lost');
      expect(res.status).toBe(200);
      expect(res.body.posts).toBeDefined();
      expect(res.body.total).toBeDefined();
    });
  });

  describe('GET /api/v1/lost-found/found', () => {
    it('returns found feed with pagination', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/v1/lost-found/found');
      expect(res.status).toBe(200);
      expect(res.body.posts).toBeDefined();
      expect(res.body.total).toBeDefined();
    });
  });

  describe('GET /api/v1/lost-found/lost/:id', () => {
    it('returns 400 for non-numeric id', async () => {
      const res = await request(app).get('/api/v1/lost-found/lost/abc');
      expect(res.status).toBe(400);
    });

    it('returns 404 for missing report', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/v1/lost-found/lost/999');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/lost-found/found (auth required)', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).post('/api/v1/lost-found/found').send({
        pet_type: 'dog', found_date: '2026-01-01',
      });
      expect(res.status).toBe(401);
    });
  });
});
