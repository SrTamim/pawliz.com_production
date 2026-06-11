require('./setup');
const request = require('supertest');
const express = require('express');
const cookieParser = require('cookie-parser');

// Mock smsService before requiring router
jest.mock('../services/smsService', () => ({
  getSmsEnabled: jest.fn(),
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
  markVerified: jest.fn(),
}));
const smsService = require('../services/smsService');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v1/otp', require('../routes/otp'));
  return app;
}

describe('OTP routes', () => {
  let app;
  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  // ─── POST /send ──────────────────────────────────────────────────────────────

  describe('POST /api/v1/otp/send', () => {
    it('returns 400 on invalid phone', async () => {
      const res = await request(app).post('/api/v1/otp/send').send({ phone: '12345' });
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('returns { skipped: true } when SMS disabled', async () => {
      smsService.getSmsEnabled.mockResolvedValueOnce(false);
      const res = await request(app).post('/api/v1/otp/send').send({ phone: '01712345678' });
      expect(res.status).toBe(200);
      expect(res.body.skipped).toBe(true);
      expect(smsService.sendOtp).not.toHaveBeenCalled();
    });

    it('sends OTP when SMS enabled', async () => {
      smsService.getSmsEnabled.mockResolvedValueOnce(true);
      smsService.sendOtp.mockResolvedValueOnce({ sent: true });
      const res = await request(app).post('/api/v1/otp/send').send({ phone: '01712345678' });
      expect(res.status).toBe(200);
      expect(res.body.sent).toBe(true);
      expect(smsService.sendOtp).toHaveBeenCalledWith('01712345678');
    });

    it('returns 500 if sendOtp throws', async () => {
      smsService.getSmsEnabled.mockResolvedValueOnce(true);
      smsService.sendOtp.mockRejectedValueOnce(new Error('SMS failure'));
      const res = await request(app).post('/api/v1/otp/send').send({ phone: '01712345678' });
      expect(res.status).toBe(500);
    });
  });

  // ─── POST /verify ─────────────────────────────────────────────────────────────

  describe('POST /api/v1/otp/verify', () => {
    it('returns 400 on invalid phone', async () => {
      const res = await request(app).post('/api/v1/otp/verify').send({ phone: 'bad', otp: '123456' });
      expect(res.status).toBe(400);
    });

    it('returns 400 on non-6-digit OTP', async () => {
      const res = await request(app).post('/api/v1/otp/verify').send({ phone: '01712345678', otp: '123' });
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    it('returns 400 when OTP expired', async () => {
      smsService.verifyOtp.mockReturnValueOnce({ valid: false, expired: true });
      const res = await request(app).post('/api/v1/otp/verify').send({ phone: '01712345678', otp: '123456' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/expired/i);
    });

    it('returns 429 when locked out', async () => {
      smsService.verifyOtp.mockReturnValueOnce({ valid: false, locked: true });
      const res = await request(app).post('/api/v1/otp/verify').send({ phone: '01712345678', otp: '000000' });
      expect(res.status).toBe(429);
    });

    it('returns 400 with attemptsLeft when OTP invalid', async () => {
      smsService.verifyOtp.mockReturnValueOnce({ valid: false, expired: false, attemptsLeft: 2 });
      const res = await request(app).post('/api/v1/otp/verify').send({ phone: '01712345678', otp: '999999' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/2 attempt/);
    });

    it('marks verified and returns { verified: true } on correct OTP', async () => {
      smsService.verifyOtp.mockReturnValueOnce({ valid: true, expired: false });
      const res = await request(app).post('/api/v1/otp/verify').send({ phone: '01712345678', otp: '123456' });
      expect(res.status).toBe(200);
      expect(res.body.verified).toBe(true);
      expect(smsService.markVerified).toHaveBeenCalledWith('01712345678');
    });
  });
});
