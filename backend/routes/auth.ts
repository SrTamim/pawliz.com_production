import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import { body } from 'express-validator';
import bcrypt from 'bcryptjs';
import pool from '../config/database';
import { authenticate, optionalAuth } from '../middleware/auth';
import validate from '../middleware/validate';
import { logActivity } from '../utils/activityLogger';
import logger from '../utils/logger';
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN } from '../utils/constants';
import { setCookies, clearCookies, createTokens, hashPassword, verifyPassword } from '../utils/authHelpers';
import * as smsService from '../services/smsService';

// Pre-computed hash for constant-time comparison when user not found (timing oracle prevention)
const DUMMY_HASH = '$2b$12$invalidhashfortimingprotectionxxxxxxxxxxxxxxxxxxxxxxxx';

/**
 * User authentication routes
 * POST /register - Register new user with validation
 * POST /login - Login user, return JWT tokens
 * POST /logout - Logout user, clear tokens
 * POST /refresh - Refresh access token
 * GET /profile - Get authenticated user profile
 */

/**
 * POST /api/v1/auth/register
 * Register new user with phone, password, email, address
 * Returns: { message, user: {id, name, phone, email, role} }
 */
router.post('/register', [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').trim().matches(/^01[3-9]\d{8}$/).withMessage('Valid Bangladeshi phone number required'),
  body('password')
    .isLength({ min: PASSWORD_MIN_LENGTH }).withMessage(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/).withMessage('Password must contain letters and numbers'),
  body('email').optional().isEmail().withMessage('Valid email required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('dob')
    .optional({ checkFalsy: true })
    .isISO8601().withMessage('Date of birth must be a valid date (YYYY-MM-DD)')
    .custom((val) => {
      const d = new Date(val);
      const now = new Date();
      const minYear = now.getFullYear() - 120;
      if (d > now) throw new Error('Date of birth cannot be in the future');
      if (d.getFullYear() < minYear) throw new Error('Invalid date of birth');
      return true;
    }),
], validate, async (req: Request, res: Response) => {
  const { name, phone, email, password, dob, address } = req.body;
  try {
    const smsEnabled = await smsService.getSmsEnabled();
    if (smsEnabled) {
      const verified = smsService.consumeVerified(phone);
      if (!verified) return res.status(403).json({ error: 'Phone verification required' });
    }

    const existing = await pool.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Phone number already registered' });

    if (email) {
      const emailExists = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
      if (emailExists.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });
    }

    const hashedPassword = await hashPassword(password);
    const result = await pool.query(
      `INSERT INTO users (name, phone, email, password, dob, address)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, phone, email, role`,
      [name, phone, email || null, hashedPassword, dob || null, address]
    );

    const user = result.rows[0];
    const { accessToken, refreshToken } = await createTokens(user.id);
    setCookies(res, accessToken, refreshToken);

    logActivity(user.id, 'user_registered');

    res.status(201).json({ message: 'Registration successful', user });
  } catch (err) {
    logger.error('Register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

/**
 * POST /api/v1/auth/login
 * Login user with phone and password
 * Returns: { message, user: {id, name, phone, email, role, ...} }
 */
router.post('/login', [
  body('phone').trim().notEmpty().withMessage('Phone number is required'),
  body('password').notEmpty().withMessage('Password is required'),
], validate, async (req: Request, res: Response) => {
  const { phone, password, rememberMe } = req.body;
  try {
    const result = await pool.query(
      'SELECT id, phone, name, email, role, profile_picture, is_active, created_at, password FROM users WHERE phone = $1 AND is_active = true',
      [phone]
    );
    if (!result.rows[0]) {
      await bcrypt.compare(password, DUMMY_HASH); // constant-time: prevent phone enumeration via timing
      return res.status(401).json({ error: 'Invalid phone number or password' });
    }

    const user = result.rows[0];
    const valid = await verifyPassword(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid phone number or password' });

    const { accessToken, refreshToken } = await createTokens(user.id);
    setCookies(res, accessToken, refreshToken, !!rememberMe);

    const { password: _, ...userWithoutPassword } = user;

    logActivity(user.id, 'user_login');

    res.json({ message: 'Login successful', user: userWithoutPassword });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// GET /api/v1/auth/me
// Session probe: returns 200 { user } when authenticated, 200 { user: null } when not.
// Uses optionalAuth (not authenticate) so a logged-out visitor gets 200 instead of a
// 401 that clutters the browser console on every page load.
router.get('/me', optionalAuth, async (req: Request, res: Response) => {
  if (!req.user) return res.json({ user: null });
  try {
    const result = await pool.query(
      `SELECT u.id, u.name, u.phone, u.email, u.role, u.dob, u.address,
              (SELECT COUNT(*) FROM pets WHERE user_id = u.id AND is_active = true) AS pet_count,
              u.profile_picture, u.created_at, r.permissions
       FROM users u
       LEFT JOIN roles r ON r.name = u.role
       WHERE u.id = $1`,
      [req.user!.id]
    );
    const row = result.rows[0];
    if (!row) return res.json({ user: null });
    // is_staff drives admin-dashboard visibility on the frontend. admin = always;
    // otherwise any page permission grants dashboard access. (FE gate only —
    // backend routes enforce permissions independently, see requirePermission.)
    const pages = Array.isArray(row.permissions?.pages) ? row.permissions.pages : [];
    row.is_staff = row.role === 'admin' || pages.length > 0;
    res.json({ user: row });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/v1/auth/refresh
router.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.pawliz_refresh;
  if (!token) return res.status(401).json({ error: 'No refresh token' });

  try {
    const stored = await pool.query(
      'SELECT id, user_id FROM refresh_tokens WHERE token = $1 AND expires_at > NOW()',
      [token]
    );
    if (!stored.rows[0]) {
      clearCookies(res);
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    const { user_id, id: tokenId } = stored.rows[0];
    const userResult = await pool.query(
      'SELECT id, is_active FROM users WHERE id = $1',
      [user_id]
    );
    if (!userResult.rows[0]?.is_active) {
      clearCookies(res);
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Delete old token + insert new token atomically — if insert fails, old token is preserved
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM refresh_tokens WHERE id = $1', [stored.rows[0].id]);
      const { accessToken, refreshToken: newRefreshToken } = await createTokens(user_id, client);
      await client.query('COMMIT');
      const rememberMe = req.cookies?.pawliz_remember === '1';
      setCookies(res, accessToken, newRefreshToken, rememberMe);
      res.json({ message: 'Token refreshed' });
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => {});
      throw txErr;
    } finally {
      client.release();
    }
  } catch (err) {
    logger.error('Refresh error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/v1/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  const token = req.cookies?.pawliz_refresh;
  if (token) {
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [token]).catch(() => {});
  }
  clearCookies(res);
  res.json({ message: 'Logged out' });
});

// POST /api/v1/auth/logout-all
router.post('/logout-all', authenticate, async (req: Request, res: Response) => {
  try {
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [req.user!.id]);
    clearCookies(res);
    res.json({ message: 'Logged out from all devices' });
  } catch {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/v1/auth/forgot-password/send-otp
router.post('/forgot-password/send-otp', [
  body('phone').trim().matches(/^01[3-9]\d{8}$/).withMessage('Valid BD phone number required'),
], validate, async (req: Request, res: Response) => {
  const { phone } = req.body;
  try {
    const userResult = await pool.query(
      'SELECT id FROM users WHERE phone = $1 AND is_active = true',
      [phone]
    );
    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'Phone number not found' });
    }
    const smsEnabled = await smsService.getSmsEnabled();
    if (!smsEnabled) {
      return res.json({ skipped: true });
    }
    await smsService.sendOtp(phone);
    res.json({ sent: true });
  } catch (err) {
    logger.error('Forgot password send OTP error:', err);
    res.status(500).json({ error: 'Failed to send OTP. Try again.' });
  }
});

// POST /api/v1/auth/forgot-password/reset
router.post('/forgot-password/reset', [
  body('phone').trim().matches(/^01[3-9]\d{8}$/).withMessage('Valid BD phone number required'),
  body('otp').trim().optional(),
  body('new_password')
    .isLength({ min: PASSWORD_MIN_LENGTH }).withMessage(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/).withMessage('Password must contain letters and numbers'),
], validate, async (req: Request, res: Response) => {
  const { phone, otp, new_password } = req.body;
  try {
    const smsEnabled = await smsService.getSmsEnabled();
    if (!smsEnabled) {
      return res.status(503).json({ error: 'Password reset is temporarily unavailable. Contact support.' });
    }
    const verified = smsService.consumeVerified(phone);
    if (!verified) return res.status(403).json({ error: 'Phone verification required' });

    const userResult = await pool.query(
      'SELECT id FROM users WHERE phone = $1 AND is_active = true',
      [phone]
    );
    if (!userResult.rows.length) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await hashPassword(new_password);
    await pool.query('UPDATE users SET password = $1 WHERE phone = $2', [hashedPassword, phone]);
    // Invalidate all active sessions — attacker cannot reuse old refresh tokens after password reset
    await pool.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userResult.rows[0].id]);
    smsService.invalidateOtp(phone);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    logger.error('Forgot password reset error:', err);
    res.status(500).json({ error: 'Server error during password reset' });
  }
});

export = router;
