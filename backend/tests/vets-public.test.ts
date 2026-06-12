import './setup';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import _pool from '../config/database';
const pool = _pool as any;

// Mock vetsCache so cache logic doesn't interfere
jest.mock('../utils/vetsCache', () => ({
  get: jest.fn().mockReturnValue(null),
  set: jest.fn().mockImplementation((key, body) => ({ etag: '"test-etag"', body })),
  bust: jest.fn(),
}));
import * as _vetsCache from '../utils/vetsCache';
const vetsCache = _vetsCache as any;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/vets', require('../routes/vets-public'));
  return app;
}

describe('Vets public routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
    // clearAllMocks wipes factory mockImplementation/mockReturnValue — re-apply
    vetsCache.get.mockReturnValue(null);
    vetsCache.set.mockImplementation((key, body) => ({ etag: '"test-etag"', body }));
  });

  // ─── GET /vets ────────────────────────────────────────────────────────────────
  describe('GET /api/v1/vets', () => {
    it('returns paginated vet list', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '3' }] })
        .mockResolvedValueOnce({ rows: [
          { id: 1, name: 'Happy Paws', avg_rating: '4.5', review_count: 10 },
          { id: 2, name: 'Pet Care BD', avg_rating: '4.0', review_count: 5 },
        ]});
      const res = await request(app).get('/api/v1/vets');
      expect(res.status).toBe(200);
      expect(res.body.vets).toBeDefined();
      expect(res.body.total).toBe(3);
      expect(res.body.page).toBe(1);
    });

    it('returns cursor-based pagination with next_cursor', async () => {
      pool.query.mockResolvedValueOnce({ rows: [
        { id: 1, name: 'Clinic A' },
        { id: 2, name: 'Clinic B' },
      ]});
      const res = await request(app).get('/api/v1/vets?cursor=&limit=1');
      expect(res.status).toBe(200);
      expect(res.body.vets).toBeDefined();
    });

    it('filters by search query', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Happy Paws' }] });
      const res = await request(app).get('/api/v1/vets?search=happy');
      expect(res.status).toBe(200);
    });

    it('filters by location', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ count: '2' }] })
        .mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/v1/vets?location=Dhanmondi');
      expect(res.status).toBe(200);
    });
  });

  // ─── GET /vets/locations ──────────────────────────────────────────────────────
  describe('GET /api/v1/vets/locations', () => {
    it('returns distinct location list', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ location_name: 'Dhanmondi' }, { location_name: 'Gulshan' }],
      });
      const res = await request(app).get('/api/v1/vets/locations');
      expect(res.status).toBe(200);
      expect(res.body.locations).toEqual(['Dhanmondi', 'Gulshan']);
    });
  });

  // ─── GET /vets/nearby ─────────────────────────────────────────────────────────
  describe('GET /api/v1/vets/nearby', () => {
    it('returns 400 without lat/lng', async () => {
      const res = await request(app).get('/api/v1/vets/nearby');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/lat and lng/);
    });

    it('returns 400 when lat is non-numeric', async () => {
      const res = await request(app).get('/api/v1/vets/nearby?lat=abc&lng=90');
      expect(res.status).toBe(400);
    });

    it('returns nearby vets for valid coords', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Near Vet', distance: 2.5 }],
      });
      const res = await request(app).get('/api/v1/vets/nearby?lat=23.8&lng=90.4');
      expect(res.status).toBe(200);
      expect(res.body.vets).toBeDefined();
      expect(res.body.count).toBe(1);
    });
  });

  // ─── GET /vets/map ────────────────────────────────────────────────────────────
  describe('GET /api/v1/vets/map', () => {
    it('returns all approved vets (slim) with ETag', async () => {
      pool.query.mockResolvedValueOnce({ rows: [
        { id: 1, name: 'Clinic A', latitude: 23.8, longitude: 90.4, avg_rating: '4.5' },
        { id: 2, name: 'Clinic B', latitude: 23.7, longitude: 90.3, avg_rating: '4.0' },
      ]});
      const res = await request(app).get('/api/v1/vets/map');
      expect(res.status).toBe(200);
      expect(res.body.vets).toHaveLength(2);
      expect(res.headers.etag).toBeDefined();
      // slim: no pagination metadata
      expect(res.body.total).toBeUndefined();
      expect(res.body.next_cursor).toBeUndefined();
    });

    it('is not captured by the /:id route', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/v1/vets/map');
      expect(res.status).toBe(200);
      expect(res.body.vets).toBeDefined();
    });
  });

  // ─── GET /vets/:id ───────────────────────────────────────────────────────────
  describe('GET /api/v1/vets/:id', () => {
    it('returns 404 for unknown vet', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/v1/vets/9999');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Vet not found');
    });

    it('returns full vet detail with reviews and documents', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Clinic', avg_rating: '4.2', vet_type: 'clinic' }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, rating: 5, comment: 'Great', user_name: 'User1' }] })
        .mockResolvedValueOnce({ rows: [] }) // qualifications (skipped internally)
        .mockResolvedValueOnce({ rows: [] }) // documents
        .mockResolvedValueOnce({ rows: [] }) // clinic_contacts
        .mockResolvedValueOnce({ rows: [] }); // clinic_vets
      const res = await request(app).get('/api/v1/vets/1');
      expect(res.status).toBe(200);
      expect(res.body.vet).toBeDefined();
      expect(res.body.reviews).toBeDefined();
    });
  });

  // ─── GET /vets/:id/reviews ────────────────────────────────────────────────────
  describe('GET /api/v1/vets/:id/reviews', () => {
    it('returns paginated reviews', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, rating: 4, comment: 'Good', user_name: 'Ali' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const res = await request(app).get('/api/v1/vets/1/reviews');
      expect(res.status).toBe(200);
      expect(res.body.reviews).toHaveLength(1);
      expect(res.body.total).toBe(1);
    });

    it('returns empty reviews list', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });
      const res = await request(app).get('/api/v1/vets/99/reviews');
      expect(res.status).toBe(200);
      expect(res.body.reviews).toHaveLength(0);
    });
  });
});
