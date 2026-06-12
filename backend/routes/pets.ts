import express from 'express';
const router = express.Router();
import { body } from 'express-validator';
import QRCode from 'qrcode';
import { authenticate } from '../middleware/auth';
import validate from '../middleware/validate';
import logger from '../utils/logger';
import * as petService from '../services/petService';

/**
 * Pet routes (user and public)
 * GET / - List user's pets (auth)
 * GET /public/:petId - Get public pet details
 * GET /public/:petId/qr - Generate QR code PNG
 * POST / - Create pet (auth)
 * PUT /:id - Update pet (auth, owner)
 * DELETE /:id - Delete pet (auth, owner)
 */

/**
 * GET /api/v1/pets
 * List authenticated user's pets
 */
router.get("/", authenticate, async (req, res) => {
  try {
    const pets = await petService.listUserPets(req.user.id);
    res.json({ pets });
  } catch (err) {
    logger.error("Get pets error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/public/:petId/qr", async (req, res) => {
  try {
    const raw = (process.env.FRONTEND_URL || "http://localhost:3000")
      .split(",")[0]
      .trim();
    const base = new URL(raw).origin; // strips any stray path / trailing slash / extra origins
    const url = `${base}/pet/${req.params.petId}`;
    res.setHeader("Content-Type", "image/png");
    QRCode.toFileStream(res, url, { type: "png" }, (err) => {
      if (err) {
        logger.error("QR code generation error:", err);
        if (!res.headersSent) res.status(500).json({ error: "Failed to generate QR code" });
      }
    });
  } catch (err) {
    logger.error("QR endpoint error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.get("/public/:petId", async (req, res) => {
  try {
    const pet = await petService.getPublicPet(req.params.petId);
    if (!pet) return res.status(404).json({ error: "Pet not found" });
    res.json({ pet });
  } catch {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/", authenticate, [
  body("name").trim().notEmpty().withMessage("Pet name is required").isLength({ max: 100 }).withMessage("Pet name max 100 chars"),
  body("type").isIn(["dog", "cat", "other"]).withMessage("Pet type must be dog, cat, or other"),
  body("breed").optional().isLength({ max: 100 }).withMessage("Breed max 100 chars"),
  body("color").optional().isLength({ max: 100 }).withMessage("Color max 100 chars"),
  body("medical_conditions").optional().isLength({ max: 1000 }).withMessage("Medical conditions max 1000 chars"),
  body("allergies").optional().isLength({ max: 1000 }).withMessage("Allergies max 1000 chars"),
  body("current_medicines").optional().isLength({ max: 1000 }).withMessage("Current medicines max 1000 chars"),
  body("temperament").optional().isLength({ max: 1000 }).withMessage("Temperament max 1000 chars"),
  body("special_notes").optional().isLength({ max: 1000 }).withMessage("Special notes max 1000 chars"),
  body("gender").optional().isIn(["male", "female", "unknown"]).withMessage("Gender must be male, female, or unknown"),
], validate, async (req, res) => {
  try {
    const pet = await petService.createPet(req.user.id, req.body);
    res.status(201).json({ message: "Pet created successfully", pet });
  } catch (err) {
    logger.error("Create pet error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.put("/:id", authenticate, [
  body("name").optional().trim().notEmpty().withMessage("Pet name cannot be empty").isLength({ max: 100 }).withMessage("Pet name max 100 chars"),
  body("type").optional().isIn(["dog", "cat", "other"]).withMessage("Invalid pet type"),
  body("breed").optional().isLength({ max: 100 }).withMessage("Breed max 100 chars"),
  body("color").optional().isLength({ max: 100 }).withMessage("Color max 100 chars"),
  body("medical_conditions").optional().isLength({ max: 1000 }).withMessage("Medical conditions max 1000 chars"),
  body("allergies").optional().isLength({ max: 1000 }).withMessage("Allergies max 1000 chars"),
  body("current_medicines").optional().isLength({ max: 1000 }).withMessage("Current medicines max 1000 chars"),
  body("temperament").optional().isLength({ max: 1000 }).withMessage("Temperament max 1000 chars"),
  body("special_notes").optional().isLength({ max: 1000 }).withMessage("Special notes max 1000 chars"),
  body("gender").optional().isIn(["male", "female", "unknown"]).withMessage("Gender must be male, female, or unknown"),
], validate, async (req, res) => {
  const petDbId = parseInt(req.params.id);
  if (isNaN(petDbId)) return res.status(400).json({ error: "Invalid pet ID" });
  try {
    const pet = await petService.updatePet(petDbId, req.user.id, req.body);
    if (!pet) return res.status(404).json({ error: "Pet not found" });
    res.json({ message: "Pet updated successfully", pet });
  } catch (err) {
    logger.error("Update pet error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.delete("/:id", authenticate, async (req, res) => {
  const petDbId = parseInt(req.params.id);
  if (isNaN(petDbId)) return res.status(400).json({ error: "Invalid pet ID" });
  try {
    const deleted = await petService.deletePet(petDbId, req.user.id);
    if (!deleted) return res.status(404).json({ error: "Pet not found" });
    res.json({ message: "Pet removed successfully" });
  } catch (err) {
    logger.error("Delete pet error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

router.use("/", require("./pets-media"));
router.use("/", require("./pets-status"));

export = router;
