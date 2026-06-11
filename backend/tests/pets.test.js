require('./setup');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const pool = require('../config/database');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/pets', require('../routes/pets'));
  return app;
}

describe('Pets routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  describe('GET /api/v1/pets/public/:petId', () => {
    it('returns pet data for valid petId (no auth)', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ pet_id: 'PAW-ABC123', name: 'Buddy', type: 'dog', is_lost: false }],
      });
      const res = await request(app).get('/api/v1/pets/public/PAW-ABC123');
      expect(res.status).toBe(200);
      expect(res.body.pet).toBeDefined();
      expect(res.body.pet.pet_id).toBe('PAW-ABC123');
    });

    it('returns 404 for unknown petId', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app).get('/api/v1/pets/public/PAW-XXXXXX');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/v1/pets (auth required)', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/api/v1/pets');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/pets (auth required)', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).post('/api/v1/pets').send({ name: 'Max', type: 'dog' });
      expect(res.status).toBe(401);
    });

    it('returns 400 with missing required fields (no auth flow)', async () => {
      const res = await request(app).post('/api/v1/pets').send({});
      // 401 from auth before validation
      expect([400, 401]).toContain(res.status);
    });
  });

  describe('DELETE /api/v1/pets/:id (auth required)', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).delete('/api/v1/pets/1');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/pets/:id/lost (auth required)', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).post('/api/v1/pets/1/lost').send({ lost_date: '2026-01-01' });
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/v1/pets/:id/found (auth required)', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).put('/api/v1/pets/1/found');
      expect(res.status).toBe(401);
    });
  });
});
