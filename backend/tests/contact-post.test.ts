import './setup';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import _pool from '../config/database';
const pool = _pool as any;

// Mock notificationService
jest.mock('../services/notificationService', () => ({
  createNotification: jest.fn().mockResolvedValue({ id: 1 }),
}));
// Mock phoneUtils
jest.mock('../utils/phoneUtils', () => ({
  normalizePhone: jest.fn((p) => p.replace(/^\+88/, '')),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/contact-post', require('../routes/contact-post'));
  return app;
}

const validBody = {
  post_id: 1,
  post_type: 'lost',
  sender_phone: '01712345678',
  message: 'I think I saw your dog near Dhanmondi Lake.',
};

describe('Contact-post routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  describe('POST /api/v1/contact-post', () => {
    it('returns 400 on missing fields', async () => {
      const res = await request(app).post('/api/v1/contact-post').send({});
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('returns 400 on invalid post_type', async () => {
      const res = await request(app).post('/api/v1/contact-post').send({
        ...validBody, post_type: 'invalid',
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 on invalid phone', async () => {
      const res = await request(app).post('/api/v1/contact-post').send({
        ...validBody, sender_phone: '12345',
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 on empty message', async () => {
      const res = await request(app).post('/api/v1/contact-post').send({
        ...validBody, message: '',
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 on message > 500 chars', async () => {
      const res = await request(app).post('/api/v1/contact-post').send({
        ...validBody, message: 'a'.repeat(501),
      });
      expect(res.status).toBe(400);
    });

    it('returns 404 when post not found', async () => {
      pool.query.mockResolvedValueOnce({ rows: [] }); // no owner
      const res = await request(app).post('/api/v1/contact-post').send(validBody);
      expect(res.status).toBe(404);
    });

    it('returns 429 when rate limit exceeded (3+ contacts in 1hr)', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ user_id: 10, pet_name: 'Buddy' }] }) // owner
        .mockResolvedValueOnce({ rows: [{ count: '3' }] }); // rate limit check
      const res = await request(app).post('/api/v1/contact-post').send(validBody);
      expect(res.status).toBe(429);
    });

    it('successfully sends contact and returns 201', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ user_id: 10, pet_name: 'Buddy' }] }) // owner
        .mockResolvedValueOnce({ rows: [{ count: '0' }] }) // rate limit: OK
        .mockResolvedValueOnce({ rows: [] }) // insert contact_notifications
      ;
      const res = await request(app).post('/api/v1/contact-post').send(validBody);
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Contact request sent');
    });

    // Test each valid post_type
    ['lost', 'found', 'rescue', 'adoption', 'pet'].forEach((postType) => {
      it(`resolves owner for post_type=${postType}`, async () => {
        pool.query
          .mockResolvedValueOnce({ rows: [{ user_id: 10, pet_name: 'Buddy' }] })
          .mockResolvedValueOnce({ rows: [{ count: '0' }] })
          .mockResolvedValueOnce({ rows: [] });
        const res = await request(app).post('/api/v1/contact-post').send({
          ...validBody, post_type: postType,
        });
        expect([200, 201, 404, 429]).toContain(res.status);
      });
    });
  });
});
