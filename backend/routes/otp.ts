import type { Request, Response, NextFunction } from 'express';
import express from 'express';
import { body, validationResult } from 'express-validator';
import * as smsService from '../services/smsService';

const router = express.Router();

const phoneValidation = body("phone")
  .trim()
  .matches(/^01[3-9]\d{8}$/)
  .withMessage("Valid BD phone number required (01XXXXXXXXX)");

// POST /api/v1/otp/send
router.post(
  "/send",
  phoneValidation,
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { phone } = req.body;
    try {
      const smsEnabled = await smsService.getSmsEnabled();
      if (!smsEnabled) {
        return res.json({ skipped: true });
      }
      await smsService.sendOtp(phone);
      res.json({ sent: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to send OTP. Try again." });
    }
  },
);

// POST /api/v1/otp/verify
router.post(
  "/verify",
  phoneValidation,
  body("otp").trim().matches(/^\d{6}$/).withMessage("OTP must be 6 digits"),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    const { phone, otp } = req.body;
    const result = smsService.verifyOtp(phone, otp);
    if (result.expired) {
      return res.status(400).json({ error: "OTP expired" });
    }
    if (result.locked) {
      return res.status(429).json({ error: "Too many attempts. Request a new OTP." });
    }
    if (!result.valid) {
      const msg = result.attemptsLeft !== undefined
        ? `Invalid OTP. ${result.attemptsLeft} attempt(s) remaining.`
        : "Invalid OTP";
      return res.status(400).json({ error: msg });
    }
    smsService.markVerified(phone);
    res.json({ verified: true });
  },
);

export = router;
