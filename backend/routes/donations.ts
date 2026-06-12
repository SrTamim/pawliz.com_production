import express from 'express';
const router = express.Router();
import pool from '../config/database';
import { authenticate, requirePermission } from '../middleware/auth';
import { body, validationResult } from 'express-validator';
import upload from '../middleware/upload';
import { deleteUploadedFile } from '../utils/fileUtils';

const donationValidation = [
  body('title').optional().trim().isLength({ max: 200 }).withMessage('Title too long'),
  body('message').optional().trim().isLength({ max: 2000 }).withMessage('Message too long'),
];

// GET /api/donations - Get active donation info
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, message, qr_code_image_path FROM donations WHERE is_active = true ORDER BY id DESC LIMIT 1'
    );
    const donation = result.rows[0];
    if (donation && donation.qr_code_image_path) {
      donation.qr_code_image_url = `/uploads/public/${donation.qr_code_image_path.split('/').pop()}`;
    }
    res.json({ donation: donation || null });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/donations/:id - Admin: Update donation info
router.put('/:id', authenticate, requirePermission('donation.edit'), (req, res, next) => {
  req.uploadDir = 'public';
  upload.single('qr_code_image')(req, res, next);
}, donationValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { title, message } = req.body;
  try {
    const oldDonation = await pool.query('SELECT qr_code_image_path FROM donations WHERE id = $1', [req.params.id]);
    if (!oldDonation.rows[0]) return res.status(404).json({ error: 'Not found' });

    const oldImage = oldDonation.rows[0].qr_code_image_path;
    const qrPath = req.file ? `/uploads/public/${req.file.filename}` : oldImage;

    const result = await pool.query(
      `UPDATE donations SET title=$1, message=$2, qr_code_image_path=$3, updated_at=CURRENT_TIMESTAMP
       WHERE id=$4 RETURNING *`,
      [title || null, message || null, qrPath, req.params.id]
    );
    // Delete the old image only after the DB write succeeds
    if (req.file && oldImage) deleteUploadedFile(oldImage);
    res.json({ donation: result.rows[0] });
  } catch (err) {
    if (req.file) deleteUploadedFile(`/uploads/public/${req.file.filename}`);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/donations - Admin: Create donation entry
router.post('/', authenticate, requirePermission('donation.edit'), (req, res, next) => {
  req.uploadDir = 'public';
  upload.single('qr_code_image')(req, res, next);
}, donationValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const { title, message } = req.body;
  try {
    const qrPath = req.file ? `/uploads/public/${req.file.filename}` : null;
    const result = await pool.query(
      `INSERT INTO donations (title, message, qr_code_image_path) VALUES ($1,$2,$3) RETURNING *`,
      [title || null, message || null, qrPath]
    );
    res.status(201).json({ donation: result.rows[0] });
  } catch (err) {
    if (req.file) deleteUploadedFile(`/uploads/public/${req.file.filename}`);
    res.status(500).json({ error: 'Server error' });
  }
});

export = router;
