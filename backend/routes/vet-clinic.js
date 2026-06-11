const express = require('express');
const pool = require('../config/database');
const { authenticate, requireVet } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { deleteUploadedFile } = require('../utils/fileUtils');
const logger = require('../utils/logger');
const { getOwnedVet } = require('../utils/vetHelpers');

function parseHolidays(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return []; }
}

/**
 * Add clinic contact (phone, email, etc.)
 */
async function addClinicContact(req, res) {
  const { contact_type, contact_value } = req.body;
  if (!contact_value) return res.status(400).json({ error: 'contact_value is required' });
  try {
    const vet = await getOwnedVet(req.user.id);
    if (!vet) return res.status(404).json({ error: 'Vet profile not found' });
    if (vet.vet_type !== 'clinic') return res.status(403).json({ error: 'Only clinics can manage contacts' });

    const result = await pool.query(
      'INSERT INTO clinic_contacts (vet_id, contact_type, contact_value) VALUES ($1, $2, $3) RETURNING *',
      [vet.id, contact_type || 'phone', contact_value]
    );
    res.status(201).json({ contact: result.rows[0] });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

/**
 * Remove clinic contact
 */
async function deleteClinicContact(req, res) {
  try {
    const vet = await getOwnedVet(req.user.id);
    if (!vet) return res.status(404).json({ error: 'Vet profile not found' });

    const result = await pool.query(
      'DELETE FROM clinic_contacts WHERE id=$1 AND vet_id=$2 RETURNING id',
      [req.params.id, vet.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Contact not found' });
    res.json({ message: 'Contact removed' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

/**
 * Add clinic vet staff member
 */
async function addClinicVet(req, res) {
  const { name, designation, bvc_reg_number, bmdc_reg_number, checkup_start, checkup_end, weekly_holidays } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const vet = await getOwnedVet(req.user.id);
    if (!vet) return res.status(404).json({ error: 'Vet profile not found' });
    if (vet.vet_type !== 'clinic') return res.status(403).json({ error: 'Only clinics can manage clinic vets' });

    const imageUrl = req.file ? `/uploads/public/${req.file.filename}` : null;
    const holidays = parseHolidays(weekly_holidays);

    const result = await pool.query(
      `INSERT INTO clinic_vets (clinic_id, vet_image, name, designation, bvc_reg_number, bmdc_reg_number, checkup_start, checkup_end, weekly_holidays)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [vet.id, imageUrl, name, designation || null, bvc_reg_number || null, bmdc_reg_number || null, checkup_start || null, checkup_end || null, holidays]
    );
    res.status(201).json({ clinic_vet: result.rows[0] });
  } catch (err) {
    if (req.file) deleteUploadedFile(`/uploads/public/${req.file.filename}`);
    logger.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

// contacts router
const contactsRouter = express.Router();
contactsRouter.use(authenticate, requireVet);
contactsRouter.post('/', addClinicContact);
contactsRouter.delete('/:id', deleteClinicContact);

// vets router
const vetsRouter = express.Router();
vetsRouter.use(authenticate, requireVet);
vetsRouter.post('/', upload.single('vet_image'), addClinicVet);

/**
 * Update clinic vet staff member
 */
async function updateClinicVet(req, res) {
  try {
    const vet = await getOwnedVet(req.user.id);
    if (!vet) return res.status(404).json({ error: 'Vet profile not found' });

    const existing = await pool.query(
      'SELECT * FROM clinic_vets WHERE id=$1 AND clinic_id=$2',
      [req.params.id, vet.id]
    );
    if (!existing.rows[0]) return res.status(404).json({ error: 'Clinic vet not found' });

    const { name, designation, bvc_reg_number, bmdc_reg_number, checkup_start, checkup_end, weekly_holidays } = req.body;
    const updates = [];
    const values = [];
    let p = 1;

    if (name !== undefined) { updates.push(`name=$${p++}`); values.push(name); }
    if (designation !== undefined) { updates.push(`designation=$${p++}`); values.push(designation || null); }
    if (bvc_reg_number !== undefined) { updates.push(`bvc_reg_number=$${p++}`); values.push(bvc_reg_number || null); }
    if (bmdc_reg_number !== undefined) { updates.push(`bmdc_reg_number=$${p++}`); values.push(bmdc_reg_number || null); }
    if (checkup_start !== undefined) { updates.push(`checkup_start=$${p++}`); values.push(checkup_start || null); }
    if (checkup_end !== undefined) { updates.push(`checkup_end=$${p++}`); values.push(checkup_end || null); }
    if (weekly_holidays !== undefined) {
      updates.push(`weekly_holidays=$${p++}`);
      values.push(parseHolidays(weekly_holidays));
    }
    if (req.file) {
      updates.push(`vet_image=$${p++}`);
      values.push(`/uploads/public/${req.file.filename}`);
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });
    updates.push('updated_at=CURRENT_TIMESTAMP');
    values.push(req.params.id);

    const result = await pool.query(
      `UPDATE clinic_vets SET ${updates.join(', ')} WHERE id=$${p} RETURNING *`,
      values
    );
    // Delete the old image only after the DB write succeeds
    if (req.file && existing.rows[0].vet_image) deleteUploadedFile(existing.rows[0].vet_image);
    res.json({ clinic_vet: result.rows[0] });
  } catch (err) {
    if (req.file) deleteUploadedFile(`/uploads/public/${req.file.filename}`);
    logger.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

vetsRouter.put('/:id', upload.single('vet_image'), updateClinicVet);

/**
 * Remove clinic vet staff member (soft delete)
 */
async function deleteClinicVet(req, res) {
  try {
    const vet = await getOwnedVet(req.user.id);
    if (!vet) return res.status(404).json({ error: 'Vet profile not found' });

    const result = await pool.query(
      'UPDATE clinic_vets SET is_active=false, updated_at=CURRENT_TIMESTAMP WHERE id=$1 AND clinic_id=$2 RETURNING id',
      [req.params.id, vet.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Clinic vet not found' });
    res.json({ message: 'Clinic vet removed' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

vetsRouter.delete('/:id', deleteClinicVet);

/**
 * Add clinic vet qualification
 */
async function addClinicVetQualification(req, res) {
  const { qualification, institute } = req.body;
  if (!qualification) return res.status(400).json({ error: 'Qualification is required' });
  try {
    const vet = await getOwnedVet(req.user.id);
    if (!vet) return res.status(404).json({ error: 'Vet profile not found' });

    const cvCheck = await pool.query(
      'SELECT id FROM clinic_vets WHERE id=$1 AND clinic_id=$2 AND is_active=true',
      [req.params.id, vet.id]
    );
    if (!cvCheck.rows[0]) return res.status(404).json({ error: 'Clinic vet not found' });

    const result = await pool.query(
      'INSERT INTO clinic_vet_qualifications (clinic_vet_id, qualification, institute) VALUES ($1, $2, $3) RETURNING *',
      [req.params.id, qualification, institute || null]
    );
    res.status(201).json({ qualification: result.rows[0] });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

vetsRouter.post('/:id/qualifications', addClinicVetQualification);

/**
 * Remove clinic vet qualification
 */
async function deleteClinicVetQualification(req, res) {
  try {
    const vet = await getOwnedVet(req.user.id);
    if (!vet) return res.status(404).json({ error: 'Vet profile not found' });

    const cvCheck = await pool.query(
      'SELECT id FROM clinic_vets WHERE id=$1 AND clinic_id=$2',
      [req.params.vetId, vet.id]
    );
    if (!cvCheck.rows[0]) return res.status(404).json({ error: 'Clinic vet not found' });

    const result = await pool.query(
      'DELETE FROM clinic_vet_qualifications WHERE id=$1 AND clinic_vet_id=$2 RETURNING id',
      [req.params.qualId, req.params.vetId]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Qualification not found' });
    res.json({ message: 'Qualification removed' });
  } catch (err) {
    logger.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}

vetsRouter.delete('/:vetId/qualifications/:qualId', deleteClinicVetQualification);

module.exports = { contactsRouter, vetsRouter };
