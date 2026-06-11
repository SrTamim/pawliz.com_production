require('./setup');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const pool = require('../config/database');
const vetsCache = require('../utils/vetsCache');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/vets', require('../routes/vets-public'));
  return app;
}

describe('Vets routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
    vetsCache.bust();
  });

  describe('GET /api/v1/vets', () => {
    it('returns vets list with pagination metadata (no cursor)', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '5' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Vet', latitude: 23.8, longitude: 90.4 }] });
      const res = await request(app).get('/api/v1/vets');
      expect(res.status).toBe(200);
      expect(res.body.vets).toBeDefined();
      expect(res.body.total).toBeDefined();
      expect(res.body.page).toBe(1);
      expect(res.headers.etag).toBeDefined();
      expect(res.headers['cache-control']).toMatch(/max-age=60/);
    });

    it('serves cached response on second hit without hitting DB', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] });
      const first = await request(app).get('/api/v1/vets');
      expect(first.status).toBe(200);
      const callsAfterFirst = pool.query.mock.calls.length;

      const second = await request(app).get('/api/v1/vets');
      expect(second.status).toBe(200);
      expect(second.headers.etag).toBe(first.headers.etag);
      expect(pool.query.mock.calls.length).toBe(callsAfterFirst);
    });

    it('returns 304 when If-None-Match matches cached ETag', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'A' }] });
      const first = await request(app).get('/api/v1/vets');
      const etag = first.headers.etag;
      expect(etag).toBeDefined();

      const second = await request(app)
        .get('/api/v1/vets')
        .set('If-None-Match', etag);
      expect(second.status).toBe(304);
    });

    it('bypasses cache when search param present', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '0' }] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/v1/vets?search=dhaka');
      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBeUndefined();
    });

    it('busts cache after vetsCache.bust()', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'A' }] });
      await request(app).get('/api/v1/vets');
      const callsBeforeBust = pool.query.mock.calls.length;

      vetsCache.bust();

      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'A' }] });
      await request(app).get('/api/v1/vets');
      expect(pool.query.mock.calls.length).toBeGreaterThan(callsBeforeBust);
    });
  });

  describe('GET /api/v1/vets/locations', () => {
    it('returns locations array', async () => {
      pool.query.mockResolvedValueOnce({ rows: [{ location_name: 'Dhaka' }] });
      const res = await request(app).get('/api/v1/vets/locations');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.locations)).toBe(true);
    });
  });

  describe('GET /api/v1/vets/:id', () => {
    it('returns 404 for non-existent vet', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/v1/vets/9999');
      expect(res.status).toBe(404);
    });
  });
});
