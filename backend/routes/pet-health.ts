import type { Request, Response } from 'express';
import express from 'express';
const router = express.Router();
import { body } from 'express-validator';
import { authenticate } from '../middleware/auth';
import requireIntParam from '../middleware/requireIntParam';
import validate from '../middleware/validate';
import logger from '../utils/logger';
import * as petHealthService from '../services/petHealthService';

/**
 * Pet health sub-routes (mounted under /api/v1/pets).
 * Vaccination records and weight logs, all owner-scoped via the pet id.
 */

// ==================== Vaccination records ====================

// GET /api/v1/pets/:id/vaccinations
router.get("/:id/vaccinations", authenticate, requireIntParam("id"), async (req: Request, res: Response) => {
  const petDbId = parseInt(req.params.id);
  try {
    const records = await petHealthService.listVaccinations(petDbId, req.user!.id);
    if (records === null) return res.status(404).json({ error: "Pet not found" });
    res.json({ records });
  } catch (err) {
    logger.error("List vaccinations error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/v1/pets/:id/vaccinations
router.post("/:id/vaccinations", authenticate, requireIntParam("id"), [
  body("vaccine_name").trim().notEmpty().withMessage("Vaccine name is required").isLength({ max: 100 }).withMessage("Vaccine name max 100 chars"),
  body("date_given").optional({ checkFalsy: true }).isISO8601().withMessage("Invalid date given"),
  body("next_due_date").optional({ checkFalsy: true }).isISO8601().withMessage("Invalid next due date"),
  body("vet_name").optional().isLength({ max: 100 }).withMessage("Vet name max 100 chars"),
  body("notes").optional().isLength({ max: 1000 }).withMessage("Notes max 1000 chars"),
], validate, async (req: Request, res: Response) => {
  const petDbId = parseInt(req.params.id);
  try {
    const record = await petHealthService.addVaccination(petDbId, req.user!.id, req.body);
    if (record === null) return res.status(404).json({ error: "Pet not found" });
    res.status(201).json({ message: "Vaccination record added", record });
  } catch (err) {
    logger.error("Add vaccination error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/v1/pets/:id/vaccinations/:recordId
router.put("/:id/vaccinations/:recordId", authenticate, requireIntParam("id", "recordId"), [
  body("vaccine_name").optional().trim().notEmpty().withMessage("Vaccine name cannot be empty").isLength({ max: 100 }).withMessage("Vaccine name max 100 chars"),
  body("date_given").optional({ checkFalsy: true }).isISO8601().withMessage("Invalid date given"),
  body("next_due_date").optional({ checkFalsy: true }).isISO8601().withMessage("Invalid next due date"),
  body("vet_name").optional().isLength({ max: 100 }).withMessage("Vet name max 100 chars"),
  body("notes").optional().isLength({ max: 1000 }).withMessage("Notes max 1000 chars"),
], validate, async (req: Request, res: Response) => {
  const petDbId = parseInt(req.params.id);
  const recordId = parseInt(req.params.recordId);
  try {
    const record = await petHealthService.updateVaccination(recordId, petDbId, req.user!.id, req.body);
    if (record === null) return res.status(404).json({ error: "Record not found" });
    res.json({ message: "Vaccination record updated", record });
  } catch (err) {
    logger.error("Update vaccination error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/v1/pets/:id/vaccinations/:recordId
router.delete("/:id/vaccinations/:recordId", authenticate, requireIntParam("id", "recordId"), async (req: Request, res: Response) => {
  const petDbId = parseInt(req.params.id);
  const recordId = parseInt(req.params.recordId);
  try {
    const deleted = await petHealthService.deleteVaccination(recordId, petDbId, req.user!.id);
    if (!deleted) return res.status(404).json({ error: "Record not found" });
    res.json({ message: "Vaccination record removed" });
  } catch (err) {
    logger.error("Delete vaccination error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ==================== Weight logs ====================

// GET /api/v1/pets/:id/weight-logs
router.get("/:id/weight-logs", authenticate, requireIntParam("id"), async (req: Request, res: Response) => {
  const petDbId = parseInt(req.params.id);
  try {
    const logs = await petHealthService.listWeightLogs(petDbId, req.user!.id);
    if (logs === null) return res.status(404).json({ error: "Pet not found" });
    res.json({ logs });
  } catch (err) {
    logger.error("List weight logs error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Weight logs are append-only and written automatically when the pet's weight
// field changes (see petService.updatePet) — no manual POST/DELETE endpoints.

export = router;
