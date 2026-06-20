import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import { authenticate, requireVet } from '../middleware/auth';
import upload from '../middleware/upload';
import { deleteUploadedFile } from '../utils/fileUtils';
import logger from '../utils/logger';
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN } from '../utils/constants';
import { getOwnedVet } from '../utils/vetHelpers';
import * as vetsCache from '../utils/vetsCache';

router.use(authenticate, requireVet);

/**
 * GET vet profile
 */
async function getVetProfile(req: Request, res: Response) {
  try {
    const vet = await getOwnedVet(req.user!.id);
    if (!vet) return res.status(404).json({ error: 'Vet profile not found' });

    const [docsResult, contactsResult, clinicVetsResult, reviewsResult, claimedVetResult, ownerResult] = await Promise.all([
      pool.query('SELECT id, vet_id, doc_type, file_path, original_name, created_at FROM vet_documents WHERE vet_id = $1 ORDER BY created_at DESC', [vet.id]),
      pool.query('SELECT id, vet_id, contact_type, contact_value, created_at FROM clinic_contacts WHERE vet_id = $1 ORDER BY id', [vet.id]),
      pool.query(`
        SELECT cv.*,
          COALESCE(json_agg(cvq ORDER BY cvq.id) FILTER (WHERE cvq.id IS NOT NULL), '[]') AS qualifications
        FROM clinic_vets cv
        LEFT JOIN clinic_vet_qualifications cvq ON cvq.clinic_vet_id = cv.id
        WHERE cv.clinic_id = $1 AND cv.is_active = true
        GROUP BY cv.id ORDER BY cv.id
      `, [vet.id]),
      pool.query(
        `SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.vet_id = $1 AND r.is_active = true ORDER BY r.created_at DESC`,
        [vet.id]
      ),
      pool.query(
        `SELECT id, name, status, approval_status, claim_requested_at, claimed_at FROM vets WHERE claimed_by = $1 LIMIT 1`,
        [req.user!.id]
      ),
      pool.query(
        `SELECT name, email, phone FROM users WHERE id = $1 LIMIT 1`,
        [req.user!.id]
      ),
    ]);

    res.json({
      vet,
      qualifications: [],
      documents: docsResult.rows,
      clinic_contacts: contactsResult.rows,
      clinic_vets: clinicVetsResult.rows,
      reviews: reviewsResult.rows,
      claimed_vet: claimedVetResult.rows[0] || null,
      owner: ownerResult.rows[0] || null,
    });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

router.get('/profile', getVetProfile);

/**
 * PUT vet profile
 */
const updateVetProfileValidation = [
  body('name').optional().isLength({ max: 150 }).withMessage('Name max 150 chars'),
  body('description').optional().isLength({ max: 2000 }).withMessage('Description max 2000 chars'),
  body('address').optional().isLength({ max: 300 }).withMessage('Address max 300 chars'),
  body('website').optional().isLength({ max: 255 }).withMessage('Website max 255 chars'),
  body('social_facebook').optional().isLength({ max: 255 }).withMessage('Facebook link max 255 chars'),
  body('social_instagram').optional().isLength({ max: 255 }).withMessage('Instagram link max 255 chars'),
  body('social_linkedin').optional().isLength({ max: 255 }).withMessage('LinkedIn link max 255 chars'),
  body('social_whatsapp').optional().isLength({ max: 255 }).withMessage('WhatsApp link max 255 chars'),
];

async function updateVetProfile(req: Request, res: Response) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  try {
    const vet = await getOwnedVet(req.user!.id);
    if (!vet) return res.status(404).json({ error: 'Vet profile not found' });

    const {
      name, latitude, longitude, address, email,
      website, description, services,
      clinic_reg_number,
      checkup_start, checkup_end, weekly_holidays, weekly_schedule, account_owner_name,
      social_facebook, social_instagram, social_linkedin, social_whatsapp,
      location_name,
    } = req.body;

    const updates = [];
    const values = [];
    let p = 1;

    const fields: Record<string, any> = {
      name, address, email, website, description,
      clinic_reg_number,
      checkup_start, checkup_end, account_owner_name,
      social_facebook, social_instagram, social_linkedin, social_whatsapp,
    };
    // location_name is set explicitly by the vet (short label e.g. "Dhanmondi")
    // Do NOT auto-derive from address — that would corrupt location search filters
    if (location_name !== undefined) { fields.location_name = location_name || null; }
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) {
        updates.push(`${key}=$${p++}`);
        values.push(val || null);
      }
    }
    if (latitude !== undefined) { updates.push(`latitude=$${p++}`); values.push(latitude ? parseFloat(latitude) : null); }
    if (longitude !== undefined) { updates.push(`longitude=$${p++}`); values.push(longitude ? parseFloat(longitude) : null); }
    if (services !== undefined) { updates.push(`services=$${p++}`); values.push(Array.isArray(services) ? services : []); }
    if (weekly_holidays !== undefined) { updates.push(`weekly_holidays=$${p++}`); values.push(Array.isArray(weekly_holidays) ? weekly_holidays : []); }
    if (weekly_schedule !== undefined) { updates.push(`weekly_schedule=$${p++}`); values.push(weekly_schedule ? JSON.stringify(weekly_schedule) : null); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at=CURRENT_TIMESTAMP');
    values.push(vet.id);

    const result = await pool.query(
      `UPDATE vets SET ${updates.join(', ')} WHERE id=$${p} RETURNING *`,
      values
    );
    vetsCache.bust();
    res.json({ vet: result.rows[0] });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

router.put('/profile', updateVetProfileValidation, updateVetProfile);

/**
 * PUT password
 */
async function updateVetPassword(req: Request, res: Response) {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return res.status(400).json({ errors: errors.array() });

  const { current_password, new_password } = req.body;

  try {
    const userResult = await pool.query(
      'SELECT password FROM users WHERE id = $1',
      [req.user!.id],
    );
    if (!userResult.rows[0])
      return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(
      current_password,
      userResult.rows[0].password,
    );
    if (!valid)
      return res.status(400).json({ error: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(new_password, 12);
    await pool.query(
      'UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2',
      [hashed, req.user!.id],
    );
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

const passwordValidation = [
  body('current_password')
    .notEmpty()
    .withMessage('Current password is required'),
  body('new_password')
    .isLength({ min: PASSWORD_MIN_LENGTH })
    .withMessage(`New password must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .matches(PASSWORD_PATTERN)
    .withMessage('Password must contain uppercase, lowercase, number, and special character (@$!%*?&)'),
  body('new_password').custom((val, { req }) => {
    if (val === req.body.current_password)
      throw new Error('New password must be different from current password');
    return true;
  }),
];

router.put('/profile/password', passwordValidation, updateVetPassword);

/**
 * POST cover-image
 */
async function uploadCoverImage(req: Request, res: Response) {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  try {
    const vet = await getOwnedVet(req.user!.id);
    if (!vet) return res.status(404).json({ error: 'Vet profile not found' });

    const oldImage = vet.cover_image;
    const imageUrl = `/uploads/public/${req.file.filename}`;
    await pool.query('UPDATE vets SET cover_image=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [imageUrl, vet.id]);
    vetsCache.bust();
    if (oldImage) deleteUploadedFile(oldImage);
    res.json({ cover_image: imageUrl });
  } catch (err) {
    deleteUploadedFile(`/uploads/public/${req.file.filename}`);
    res.status(500).json({ error: 'Server error' });
  }
}

const uploadMiddleware = (req: Request, res: Response, next: NextFunction) => {
  req.uploadDir = 'public';
  upload.single('image')(req, res, next);
};

router.post('/cover-image', uploadMiddleware, uploadCoverImage);

/**
 * POST vet-image
 */
async function uploadVetImage(req: Request, res: Response) {
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });
  try {
    const vet = await getOwnedVet(req.user!.id);
    if (!vet) return res.status(404).json({ error: 'Vet profile not found' });

    const oldImage = vet.image;
    const imageUrl = `/uploads/public/${req.file.filename}`;
    await pool.query('UPDATE vets SET image=$1, updated_at=CURRENT_TIMESTAMP WHERE id=$2', [imageUrl, vet.id]);
    vetsCache.bust();
    if (oldImage) deleteUploadedFile(oldImage);
    res.json({ image: imageUrl });
  } catch (err) {
    deleteUploadedFile(`/uploads/public/${req.file.filename}`);
    res.status(500).json({ error: 'Server error' });
  }
}

router.post('/vet-image', uploadMiddleware, uploadVetImage);

export = router;
