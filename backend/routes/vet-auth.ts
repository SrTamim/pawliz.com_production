import express from 'express';
const router = express.Router();
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import { setCookies, createTokens, hashPassword } from '../utils/authHelpers';
import logger from '../utils/logger';
import { VET_PASSWORD_PATTERN } from '../utils/constants';
import * as smsService from '../services/smsService';

const normalizePhone = (phone) => {
  const p = (phone || '').trim();
  if (/^88(01[3-9]\d{8})$/.test(p)) return p.slice(2);
  return p;
};

// POST /api/vet-auth/register
// Creates user with role='vet' + pending vet entry, returns token for auto-login
router.post('/register', [
  body('phone').trim().customSanitizer(normalizePhone).matches(/^01[3-9]\d{8}$/).withMessage('Valid Bangladeshi phone number required (01XXXXXXXXX or 8801XXXXXXXXX)'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(VET_PASSWORD_PATTERN).withMessage('Password must contain at least one letter and one number'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('clinic_name').trim().notEmpty().withMessage('Clinic name is required'),
  body('account_owner_name').trim().notEmpty().withMessage('Account owner name is required'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { phone, email, password, address, clinic_name, account_owner_name, skipMatch } = req.body;
  const displayName = account_owner_name || clinic_name;
  const vetName = clinic_name;

  // OTP guard — check (non-consuming) before match logic; consume only when creating account
  try {
    const smsEnabled = await smsService.getSmsEnabled();
    if (smsEnabled) {
      const verified = smsService.checkVerified(phone);
      if (!verified) return res.status(403).json({ error: 'Phone verification required' });
    }
  } catch (err) {
    logger.error('OTP check error (vet register):', err);
    return res.status(500).json({ error: 'Server error' });
  }

  // Pre-check: match form data against seeded vets (skip if user confirmed "Not Mine")
  if (!skipMatch) {
    try {
      const match = await pool.query(
        `SELECT id, name, name AS clinic_name, contact, email, address, image
         FROM vets
         WHERE status = 'unverified' AND claimed_by IS NULL
           AND (contact = $1 OR (email IS NOT NULL AND email = $2) OR name ILIKE $3)
         LIMIT 1`,
        [phone, email || '', vetName]
      );
      if (match.rows.length > 0) {
        const { id, name: vName, clinic_name: vClinic, contact, email: vEmail, address: vAddress, image } = match.rows[0];
        return res.status(200).json({
          matchFound: true,
          vet: { id, name: vName, clinic_name: vClinic, contact, email: vEmail, address: vAddress, image }
        });
      }
    } catch (err) {
      logger.error('Vet match check error:', err);
    }
  }

  // Consume verified token now — account creation is happening
  try {
    const smsEnabled = await smsService.getSmsEnabled();
    if (smsEnabled && !smsService.consumeVerified(phone)) {
      return res.status(403).json({ error: 'Phone verification expired. Please verify again.' });
    }
  } catch (err) {
    logger.error('OTP consume error (vet register):', err);
    return res.status(500).json({ error: 'Server error' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existingPhone = await client.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existingPhone.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Phone number already registered' });
    }
    if (email) {
      const existingEmail = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingEmail.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Email already registered' });
      }
    }

    const hashedPassword = await hashPassword(password);
    const userResult = await client.query(
      `INSERT INTO users (name, phone, email, password, role, address)
       VALUES ($1, $2, $3, $4, 'vet', $5) RETURNING id, name, phone, email, role`,
      [displayName, phone, email || null, hashedPassword, address]
    );
    const user = userResult.rows[0];

    const vetResult = await client.query(
      `INSERT INTO vets (name, address, contact, email, vet_type, approval_status, user_id, account_owner_name)
       VALUES ($1, $2, $3, $4, 'clinic', 'pending', $5, $6) RETURNING id`,
      [vetName, address, phone, email || null, user.id, account_owner_name]
    );
    const vetId = vetResult.rows[0].id;

    await client.query('COMMIT');

    const { accessToken, refreshToken } = await createTokens(user.id);
    setCookies(res, accessToken, refreshToken);
    res.status(201).json({ message: 'Registration successful', user, vet_id: vetId });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Vet register error:', err);
    res.status(500).json({ error: 'Server error during registration' });
  } finally {
    client.release();
  }
});

// POST /api/v1/vet-auth/:vetId/claim
// Creates user account, verifies clinic OTP, marks vet claimed + approved + active. No auth required.
router.post('/:vetId/claim', [
  body('phone').trim().customSanitizer(normalizePhone).matches(/^01[3-9]\d{8}$/).withMessage('Valid Bangladeshi phone number required (01XXXXXXXXX or 8801XXXXXXXXX)'),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(VET_PASSWORD_PATTERN).withMessage('Password must contain at least one letter and one number'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('clinic_name').trim().notEmpty().withMessage('Clinic name is required'),
  body('account_owner_name').trim().notEmpty().withMessage('Account owner name is required'),
  body('clinic_otp').trim().matches(/^\d{6}$/).withMessage('Clinic OTP must be 6 digits'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { phone, email, password, address, clinic_name, account_owner_name, clinic_otp } = req.body;
  const vetId = req.params.vetId;
  const displayName = account_owner_name || clinic_name;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch clinic phone server-side + verify still claimable
    const vetRow = await client.query(
      `SELECT contact FROM vets WHERE id=$1 AND status='unverified' AND claimed_by IS NULL`,
      [vetId]
    );
    if (!vetRow.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Profile not available for claim' });
    }
    const clinicPhone = normalizePhone(vetRow.rows[0].contact);

    // OTP guards
    const smsEnabled = await smsService.getSmsEnabled();
    if (smsEnabled) {
      if (!smsService.consumeVerified(phone)) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Phone verification required' });
      }
      const clinicOtpResult = smsService.verifyOtp(clinicPhone, clinic_otp);
      if (clinicOtpResult.expired) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Clinic OTP expired' });
      }
      if (!clinicOtpResult.valid) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Invalid clinic OTP' });
      }
      smsService.clearOtp(clinicPhone);
    }

    // Check phone/email not already registered
    const existingPhone = await client.query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (existingPhone.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Phone number already registered' });
    }
    if (email) {
      const existingEmail = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existingEmail.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Email already registered' });
      }
    }

    const hashedPassword = await hashPassword(password);
    const userResult = await client.query(
      `INSERT INTO users (name, phone, email, password, role, address)
       VALUES ($1, $2, $3, $4, 'vet', $5) RETURNING id, name, phone, email, role`,
      [displayName, phone, email || null, hashedPassword, address]
    );
    const user = userResult.rows[0];

    const claimResult = await client.query(
      `UPDATE vets SET status='claimed', claimed_by=$1, user_id=$1,
              claim_requested_at=NOW(),
              approval_status='pending', is_active=false,
              updated_at=CURRENT_TIMESTAMP
       WHERE id=$2 AND status='unverified' AND claimed_by IS NULL
       RETURNING id`,
      [user.id, vetId]
    );
    if (!claimResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Profile not available for claim' });
    }

    await client.query('COMMIT');

    smsService.sendAdminNotification('Someone claimed a clinic in pawliz, please check').catch(() => {});

    const { accessToken, refreshToken } = await createTokens(user.id);
    setCookies(res, accessToken, refreshToken);
    res.status(201).json({ message: 'Claim successful', user, vet_id: vetId });
  } catch (err) {
    await client.query('ROLLBACK');
    logger.error('Vet claim error:', err);
    res.status(500).json({ error: 'Server error during claim' });
  } finally {
    client.release();
  }
});

export = router;
