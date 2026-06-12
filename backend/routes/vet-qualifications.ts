import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import pool from '../config/database';
import { authenticate, requireVet } from '../middleware/auth';
import { deleteUploadedFile } from '../utils/fileUtils';
import logger from '../utils/logger';
import { getOwnedVet } from '../utils/vetHelpers';

router.use(authenticate, requireVet);

/**
 * POST /api/v1/vet-qualifications
 * Add vet qualification
 */
router.post('/', async (req: Request, res: Response) => {
  const { qualification, institute } = req.body;
  if (!qualification) return res.status(400).json({ error: 'Qualification is required' });
  try {
    const vet = await getOwnedVet(req.user!.id);
    if (!vet) return res.status(404).json({ error: 'Vet profile not found' });

    const result = await pool.query(
      'INSERT INTO vet_qualifications (vet_id, qualification, institute) VALUES ($1, $2, $3) RETURNING *',
      [vet.id, qualification, institute || null]
    );
    res.status(201).json({ qualification: result.rows[0] });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/v1/vet-qualifications/:id
 * Remove vet qualification
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const vet = await getOwnedVet(req.user!.id);
    if (!vet) return res.status(404).json({ error: 'Vet profile not found' });

    const result = await pool.query(
      'DELETE FROM vet_qualifications WHERE id=$1 AND vet_id=$2 RETURNING id',
      [req.params.id, vet.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Qualification not found' });
    res.json({ message: 'Qualification removed' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export = router;
