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
  app.use('/api/v1/admin/vets', require('../routes/admin-vets'));
  return app;
}

function makeToken() {
  return jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function mockAdminUser() {
  pool.query.mockResolvedValueOnce({
    rows: [{ id: 1, name: 'Admin', role: 'admin', is_active: true }],
  });
}

describe('Admin vet routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  describe('GET /api/v1/admin/vets', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/v1/admin/vets');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin user', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 2, name: 'User', role: 'user', is_active: true }],
      });
      const res = await request(app)
        .get('/api/v1/admin/vets')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(403);
    });

    it('returns paginated vet list for admin', async () => {
      mockAdminUser();
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Happy Paws Clinic', approval_status: 'pending' }] })
        .mockResolvedValueOnce({ rows: [{ count: '1' }] });
      const res = await request(app)
        .get('/api/v1/admin/vets')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.vets).toHaveLength(1);
      expect(res.body.total).toBe(1);
      expect(res.body.page).toBe(1);
    });

    it('filters by approval_status query param', async () => {
      mockAdminUser();
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: '0' }] });
      const res = await request(app)
        .get('/api/v1/admin/vets?approval_status=pending')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.vets).toHaveLength(0);
      expect(res.body.total).toBe(0);
    });
  });

  describe('PUT /api/v1/admin/vets/:id/approve', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).put('/api/v1/admin/vets/1/approve');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 2, name: 'User', role: 'user', is_active: true }],
      });
      const res = await request(app)
        .put('/api/v1/admin/vets/1/approve')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(403);
    });

    it('returns 404 when vet does not exist', async () => {
      mockAdminUser();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .put('/api/v1/admin/vets/999/approve')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Vet not found');
    });

    it('approves vet — sets approval_status=approved, is_active=true', async () => {
      mockAdminUser();
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Happy Paws', approval_status: 'approved' }],
      });
      const res = await request(app)
        .put('/api/v1/admin/vets/1/approve')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.vet.approval_status).toBe('approved');
      expect(res.body.message).toBe('Vet approved');
    });
  });

  describe('PUT /api/v1/admin/vets/:id/reject', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).put('/api/v1/admin/vets/1/reject');
      expect(res.status).toBe(401);
    });

    it('returns 404 when vet does not exist', async () => {
      mockAdminUser();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .put('/api/v1/admin/vets/999/reject')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Vet not found');
    });

    it('rejects vet with rejection reason', async () => {
      mockAdminUser();
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Happy Paws', approval_status: 'rejected' }],
      });
      const res = await request(app)
        .put('/api/v1/admin/vets/1/reject')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ reason: 'Documents incomplete' });
      expect(res.status).toBe(200);
      expect(res.body.vet.approval_status).toBe('rejected');
      expect(res.body.message).toBe('Vet rejected');
    });

    it('rejects vet without reason (reason treated as null)', async () => {
      mockAdminUser();
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Happy Paws', approval_status: 'rejected' }],
      });
      const res = await request(app)
        .put('/api/v1/admin/vets/1/reject')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Vet rejected');
    });
  });

  describe('GET /api/v1/admin/vets/:id', () => {
    it('returns 401 with no token', async () => {
      const res = await request(app).get('/api/v1/admin/vets/1');
      expect(res.status).toBe(401);
    });

    it('returns 404 when vet does not exist', async () => {
      mockAdminUser();
      // Promise.all fires 5 real pool.query calls: vet, quals, docs, contacts, clinic_vets
      pool.query
        .mockResolvedValueOnce({ rows: [] })  // vet
        .mockResolvedValueOnce({ rows: [] })  // qualifications
        .mockResolvedValueOnce({ rows: [] })  // documents
        .mockResolvedValueOnce({ rows: [] })  // clinic_contacts
        .mockResolvedValueOnce({ rows: [] }); // clinic_vets
      const res = await request(app)
        .get('/api/v1/admin/vets/999')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Vet not found');
    });

    it('returns full vet detail including qualifications and documents', async () => {
      mockAdminUser();
      // Promise.all: [vet, quals, docs, contacts, clinic_vets] — 5 pool.query calls
      pool.query
        .mockResolvedValueOnce({ rows: [{ id: 1, name: 'Test Vet', approval_status: 'pending', avg_rating: '0.00', review_count: 0 }] }) // vet
        .mockResolvedValueOnce({ rows: [{ id: 1, vet_id: 1, degree: 'BVSc', institution: 'BAU' }] }) // qualifications
        .mockResolvedValueOnce({ rows: [{ id: 1, doc_type: 'registration', original_name: 'reg.pdf' }] }) // docs
        .mockResolvedValueOnce({ rows: [] }) // contacts
        .mockResolvedValueOnce({ rows: [] }); // clinic_vets
      const res = await request(app)
        .get('/api/v1/admin/vets/1')
        .set('Authorization', `Bearer ${makeToken()}`);
      expect(res.status).toBe(200);
      expect(res.body.vet).toBeDefined();
      expect(res.body.qualifications).toHaveLength(1);
      expect(res.body.qualifications[0].degree).toBe('BVSc');
      expect(res.body.documents).toHaveLength(1);
      expect(res.body.clinic_contacts).toBeDefined();
      expect(res.body.clinic_vets).toBeDefined();
    });
  });

  describe('PUT /api/v1/admin/vets/:id (update vet fields)', () => {
    it('returns 400 when no updatable fields sent', async () => {
      mockAdminUser();
      const res = await request(app)
        .put('/api/v1/admin/vets/1')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No fields');
    });

    it('returns 404 when vet does not exist', async () => {
      mockAdminUser();
      pool.query.mockResolvedValueOnce({ rows: [] });
      const res = await request(app)
        .put('/api/v1/admin/vets/999')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ name: 'New Name' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Vet not found');
    });

    it('updates vet fields and returns updated record', async () => {
      mockAdminUser();
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Updated Clinic', is_active: true, approval_status: 'approved' }],
      });
      const res = await request(app)
        .put('/api/v1/admin/vets/1')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ name: 'Updated Clinic', is_active: true });
      expect(res.status).toBe(200);
      expect(res.body.vet.name).toBe('Updated Clinic');
    });

    it('can change approval_status via general update', async () => {
      mockAdminUser();
      pool.query.mockResolvedValueOnce({
        rows: [{ id: 1, name: 'Test Vet', approval_status: 'approved', is_active: true }],
      });
      const res = await request(app)
        .put('/api/v1/admin/vets/1')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({ approval_status: 'approved' });
      expect(res.status).toBe(200);
      expect(res.body.vet.approval_status).toBe('approved');
    });
  });
});
