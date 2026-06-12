import type { Request, Response, NextFunction } from 'express';
import express from 'express';
const router = express.Router();
import pool from '../config/database';
import { authenticate, requireVet } from '../middleware/auth';
import upload from '../middleware/upload';
import { deleteUploadedFile } from '../utils/fileUtils';
import logger from '../utils/logger';
import { getOwnedVet } from '../utils/vetHelpers';

router.use(authenticate, requireVet);

/**
 * POST /api/v1/vet-documents
 * Upload vet document (certificate, license, etc.) — stored privately
 */
router.post('/', (req: Request, res: Response, next: NextFunction) => {
  req.uploadDir = 'private';
  upload.single('file')(req, res, next);
}, async (req: Request, res: Response) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const { doc_type } = req.body;
  const validTypes = ['reg_certificate', 'clinic_certificate', 'trade_licence', 'vat_certificate', 'tin_certificate', 'vet_image'];
  if (!doc_type || !validTypes.includes(doc_type)) {
    deleteUploadedFile(`/uploads/private/${req.file.filename}`);
    return res.status(400).json({ error: 'Invalid doc_type' });
  }
  try {
    const vet = await getOwnedVet(req.user!.id);
    if (!vet) {
      deleteUploadedFile(`/uploads/private/${req.file.filename}`);
      return res.status(404).json({ error: 'Vet profile not found' });
    }

    const fileUrl = `/api/v1/files/${req.file.filename}`;
    const result = await pool.query(
      'INSERT INTO vet_documents (vet_id, doc_type, file_path, original_name) VALUES ($1, $2, $3, $4) RETURNING *',
      [vet.id, doc_type, fileUrl, req.file.originalname]
    );
    res.status(201).json({ document: result.rows[0] });
  } catch (err) {
    deleteUploadedFile(`/uploads/private/${req.file.filename}`);
    logger.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /api/v1/vet-documents/:id
 * Remove vet document
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const vet = await getOwnedVet(req.user!.id);
    if (!vet) return res.status(404).json({ error: 'Vet profile not found' });

    if (vet.approval_status === 'approved') {
      return res.status(403).json({ error: 'Certificates are locked after account approval' });
    }

    const result = await pool.query(
      'DELETE FROM vet_documents WHERE id=$1 AND vet_id=$2 RETURNING file_path',
      [req.params.id, vet.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Document not found' });
    deleteUploadedFile(result.rows[0].file_path);
    res.json({ message: 'Document removed' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

export = router;
