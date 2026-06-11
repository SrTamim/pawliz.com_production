require('./setup');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const mockClient = pool._mockClient;

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/pets', require('../routes/pets'));
  return app;
}

function makeToken() {
  return jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function mockUser() {
  pool.query.mockResolvedValueOnce({
    rows: [{ id: 1, name: 'Test User', role: 'user', is_active: true }],
  });
}

describe('Pet lifecycle (creation, QR, status changes)', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
    mockClient.query.mockResolvedValue({ rows: [] });
    pool.connect.mockResolvedValue(mockClient);
  });

  // ── Pet creation ──────────────────────────────────────────────────────────

  describe('POST /api/v1/pets — create pet with QR', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app).post('/api/v1/pets').send({ name: 'Max', type: 'dog' });
      expect(res.status).toBe(401);
    });

    it('returns 400 on missing name', async () => {
      mockUser();
      const res = await request(app)
        .post('/api/v1/pets')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ type: 'dog' });
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('returns 400 on invalid pet type', async () => {
      mockUser();
      const res = await request(app)
        .post('/api/v1/pets')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ name: 'Max', type: 'fish' });
      expect(res.status).toBe(400);
    });

    it('creates pet — response includes PAW-XXXXXX pet_id', async () => {
      mockUser();
      // createPet uses pool.connect() → client.query for all ops
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })                                           // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1, pet_id: 'PAW-ABC123', name: 'Max', type: 'dog', user_id: 1 }], rowCount: 1 }) // INSERT pets
        .mockResolvedValueOnce({ rows: [] });                                          // COMMIT

      const res = await request(app)
        .post('/api/v1/pets')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ name: 'Max', type: 'dog' });

      expect(res.status).toBe(201);
      expect(res.body.pet.pet_id).toMatch(/^PAW-[A-Z0-9]{6}$/);
      expect(res.body.pet.qr_code).toBeUndefined();
      expect(res.body.message).toBe('Pet created successfully');
    });

    it('retries generatePetId on collision — succeeds on second unique ID', async () => {
      mockUser();
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })                                                             // BEGIN
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })                                               // INSERT — conflict, DO NOTHING
        .mockResolvedValueOnce({ rows: [{ id: 2, pet_id: 'PAW-XYZ789', name: 'Bella', type: 'cat' }], rowCount: 1 }) // INSERT — success
        .mockResolvedValueOnce({ rows: [] })                                                             // UPDATE users
        .mockResolvedValueOnce({ rows: [] });                                                            // COMMIT

      const res = await request(app)
        .post('/api/v1/pets')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ name: 'Bella', type: 'cat' });

      expect(res.status).toBe(201);
    });
  });

  // ── Pet soft delete ───────────────────────────────────────────────────────

  describe('DELETE /api/v1/pets/:id — soft delete', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).delete('/api/v1/pets/1');
      expect(res.status).toBe(401);
    });

    it('returns 404 when pet not owned by user', async () => {
      mockUser();
      // deletePet uses pool.connect() → BEGIN, then SELECT ... FOR UPDATE
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })  // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // SELECT ... FOR UPDATE — not found
      const res = await request(app)
        .delete('/api/v1/pets/999')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(404);
    });

    it('soft-deletes pet and decrements user pet_count', async () => {
      mockUser();
      mockClient.query
        .mockResolvedValueOnce({ rows: [] })                 // BEGIN
        .mockResolvedValueOnce({ rows: [{ images: null }] }) // SELECT ... FOR UPDATE
        .mockResolvedValueOnce({ rows: [{ id: 1 }] })        // UPDATE is_active=false
        .mockResolvedValueOnce({ rows: [] });                // COMMIT

      const res = await request(app)
        .delete('/api/v1/pets/1')
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Pet removed successfully');
    });
  });

  // ── Mark lost ─────────────────────────────────────────────────────────────

  describe('POST /api/v1/pets/:id/lost — mark pet lost', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/v1/pets/1/lost').send({ lost_date: '2026-01-01' });
      expect(res.status).toBe(401);
    });

    it('returns 400 when lost_date missing', async () => {
      mockUser();
      const res = await request(app)
        .post('/api/v1/pets/1/lost')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('returns 404 when pet not owned by user', async () => {
      mockUser();
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // ownership check — not found
      const res = await request(app)
        .post('/api/v1/pets/999/lost')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ lost_date: '2026-01-01' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Pet not found');
    });

    it('marks pet lost — inserts lost_pet_reports row', async () => {
      mockUser();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1, pet_id: 'PAW-ABC123', name: 'Max', type: 'dog' }] }) // ownership check
        .mockResolvedValueOnce({ rows: [] })              // BEGIN
        .mockResolvedValueOnce({ rows: [] })              // UPDATE pets is_lost=true
        .mockResolvedValueOnce({ rows: [{ id: 42 }] })   // INSERT lost_pet_reports
        .mockResolvedValueOnce({ rows: [] });             // COMMIT

      const res = await request(app)
        .post('/api/v1/pets/1/lost')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ lost_date: '2026-01-01', lost_location_name: 'Dhaka' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Pet marked as lost');
    });
  });

  // ── Mark found ────────────────────────────────────────────────────────────

  describe('PUT /api/v1/pets/:id/found — close lost report', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).put('/api/v1/pets/1/found');
      expect(res.status).toBe(401);
    });

    it('returns 404 when pet not owned by user', async () => {
      mockUser();
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // ownership check — not found
      const res = await request(app)
        .put('/api/v1/pets/999/found')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(404);
    });

    it('marks pet found — updates pets AND closes lost_pet_reports', async () => {
      mockUser();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // ownership check
        .mockResolvedValueOnce({ rows: [] })           // BEGIN
        .mockResolvedValueOnce({ rows: [] })           // UPDATE pets is_lost=false
        .mockResolvedValueOnce({ rows: [] })           // UPDATE lost_pet_reports is_found=true
        .mockResolvedValueOnce({ rows: [] });          // COMMIT

      const res = await request(app)
        .put('/api/v1/pets/1/found')
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Pet marked as found');
      const updateCalls = mockClient.query.mock.calls.filter(
        ([sql]) => typeof sql === 'string' && sql.includes('UPDATE')
      );
      expect(updateCalls.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Adoption flow ─────────────────────────────────────────────────────────

  describe('POST /api/v1/pets/:id/adoption — list for adoption', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).post('/api/v1/pets/1/adoption');
      expect(res.status).toBe(401);
    });

    it('returns 404 when pet not owned by user', async () => {
      mockUser();
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // ownership check — not found
      const res = await request(app)
        .post('/api/v1/pets/1/adoption')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(404);
    });

    it('creates adoption post and marks pet is_for_adoption=true', async () => {
      mockUser();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Max' }] }) // ownership check
        .mockResolvedValueOnce({ rows: [] })                        // BEGIN
        .mockResolvedValueOnce({ rows: [] })                        // UPDATE pets is_for_adoption=true
        .mockResolvedValueOnce({ rows: [] })                        // UPDATE adoption_posts withdrawn
        .mockResolvedValueOnce({ rows: [] })                        // INSERT adoption_posts
        .mockResolvedValueOnce({ rows: [] });                       // COMMIT

      const res = await request(app)
        .post('/api/v1/pets/1/adoption')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ reason: 'Moving abroad', adoption_requirements: 'Experienced owner' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Pet marked for adoption');
    });
  });

  describe('PUT /api/v1/pets/:id/adopted — mark as adopted', () => {
    it('returns 401 without auth', async () => {
      const res = await request(app).put('/api/v1/pets/1/adopted');
      expect(res.status).toBe(401);
    });

    it('marks pet adopted and closes adoption post', async () => {
      mockUser();
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // ownership check
        .mockResolvedValueOnce({ rows: [] })           // BEGIN
        .mockResolvedValueOnce({ rows: [] })           // UPDATE pets is_for_adoption=false
        .mockResolvedValueOnce({ rows: [] })           // UPDATE adoption_posts adopted
        .mockResolvedValueOnce({ rows: [] });          // COMMIT

      const res = await request(app)
        .put('/api/v1/pets/1/adopted')
        .set('Authorization', `Bearer ${makeToken()}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Pet marked as adopted');
    });
  });

  // ── Pet update ────────────────────────────────────────────────────────────

  describe('PUT /api/v1/pets/:id — update pet profile', () => {
    it('returns 400 on invalid pet type', async () => {
      mockUser();
      // validate runs before route handler → no ownership query needed
      const res = await request(app)
        .put('/api/v1/pets/1')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ type: 'fish' });
      expect(res.status).toBe(400);
    });

    it('returns 404 when pet not owned by user', async () => {
      mockUser();
      pool.query.mockResolvedValueOnce({ rows: [] }); // ownership check
      const res = await request(app)
        .put('/api/v1/pets/1')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ name: 'Rex' });
      expect(res.status).toBe(404);
    });

    it('updates pet and returns updated record', async () => {
      mockUser();
      // ownership check
      pool.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      // UPDATE pets
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Rex', type: 'dog' }],
      });
      const res = await request(app)
        .put('/api/v1/pets/1')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ name: 'Rex' });
      expect(res.status).toBe(200);
      expect(res.body.pet.name).toBe('Rex');
    });
  });
});
