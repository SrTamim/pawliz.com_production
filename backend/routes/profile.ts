import express from 'express';
const router = express.Router();
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
import pool from '../config/database';
import { authenticate } from '../middleware/auth';
import upload from '../middleware/upload';
import { deleteUploadedFile } from '../utils/fileUtils';
import logger from '../utils/logger';
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN } from '../utils/constants';
import { createTokens, setCookies } from '../utils/authHelpers';

// GET /api/profile - Full profile with pets
router.get("/", authenticate, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT id, name, phone, email, role, dob, address, occupation,
        (SELECT COUNT(*) FROM pets WHERE user_id=u.id AND is_active=true) AS pet_count,
        profile_picture, created_at FROM users u WHERE u.id = $1`,
      [req.user.id],
    );
    const petsResult = await pool.query(
      `SELECT p.*,
        lpr.lost_date, lpr.lost_location_name, lpr.lost_latitude, lpr.lost_longitude, lpr.additional_details
       FROM pets p
       LEFT JOIN lost_pet_reports lpr ON lpr.id = (
         SELECT id FROM lost_pet_reports
         WHERE pet_id = p.id AND is_found = false
         ORDER BY reported_at DESC LIMIT 1
       )
       WHERE p.user_id = $1 AND p.is_active = true
       ORDER BY p.created_at ASC`,
      [req.user.id],
    );
    res.json({ user: userResult.rows[0], pets: petsResult.rows });
  } catch (err) {
    logger.error("Get profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// PUT /api/profile - Update user profile
router.put(
  "/",
  authenticate,
  [
    body("name")
      .optional()
      .trim()
      .notEmpty()
      .withMessage("Name cannot be empty"),
    body("email")
      .optional({ checkFalsy: true })
      .isEmail()
      .withMessage("Valid email required"),
    body("address").optional({ checkFalsy: true }).isLength({ min: 1, max: 300 }).withMessage("Address max 300 chars"),
    body("occupation").optional().isLength({ max: 150 }).withMessage("Occupation max 150 chars"),
    body("dob")
      .optional({ checkFalsy: true })
      .isISO8601().withMessage("Date of birth must be a valid date (YYYY-MM-DD)")
      .custom((val) => {
        const d = new Date(val);
        const now = new Date();
        const minYear = now.getFullYear() - 120;
        if (d > now) throw new Error("Date of birth cannot be in the future");
        if (d.getFullYear() < minYear) throw new Error("Invalid date of birth");
        return true;
      }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    if (req.body.phone !== undefined) {
      return res.status(400).json({ error: "Phone number cannot be changed after registration" });
    }

    const { name, email, dob, address, occupation } = req.body;

    try {
      if (email) {
        const emailCheck = await pool.query(
          "SELECT id FROM users WHERE email = $1 AND id != $2",
          [email, req.user.id],
        );
        if (emailCheck.rows.length > 0)
          return res.status(409).json({ error: "Email already in use" });
      }
      const result = await pool.query(
        `UPDATE users SET
        name = COALESCE($1, name),
        email = CASE WHEN $2::text IS NOT NULL THEN $2 ELSE email END,
        dob = CASE WHEN $3::text IS NOT NULL THEN $3::date ELSE dob END,
        address = CASE WHEN $4::text IS NOT NULL THEN $4 ELSE address END,
        occupation = $5,
        updated_at = NOW()
       WHERE id = $6
       RETURNING id, name, phone, email, role, dob, address, occupation, profile_picture`,
        [
          name || null,
          email || null,
          dob || null,
          address || null,
          occupation !== undefined ? occupation || null : null,
          req.user.id,
        ],
      );
      res.json({
        message: "Profile updated successfully",
        user: result.rows[0],
      });
    } catch (err) {
      if (err.code === "23505") return res.status(409).json({ error: "Email already in use" });
      logger.error("Update profile error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// PUT /api/profile/password - Secure password update with validation
router.put(
  "/password",
  authenticate,
  [
    body("current_password")
      .notEmpty()
      .withMessage("Current password is required"),
    body("new_password")
      .isLength({ min: PASSWORD_MIN_LENGTH })
      .withMessage(`New password must be at least ${PASSWORD_MIN_LENGTH} characters`)
      .matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/)
      .withMessage("Password must contain letters and numbers"),
    body("new_password").custom((val, { req }) => {
      if (val === req.body.current_password)
        throw new Error("New password must be different from current password");
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty())
      return res.status(400).json({ errors: errors.array() });

    const { current_password, new_password } = req.body;

    try {
      const result = await pool.query(
        "SELECT password FROM users WHERE id = $1",
        [req.user.id],
      );
      const valid = await bcrypt.compare(
        current_password,
        result.rows[0].password,
      );
      if (!valid)
        return res.status(400).json({ error: "Current password is incorrect" });

      const hashed = await bcrypt.hash(new_password, 12);
      await pool.query(
        "UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2",
        [hashed, req.user.id],
      );
      // Invalidate all other sessions — stolen device/token cannot be reused
      await pool.query("DELETE FROM refresh_tokens WHERE user_id = $1", [req.user.id]);
      // Re-issue tokens for current device so user stays logged in
      const { accessToken, refreshToken } = await createTokens(req.user.id);
      setCookies(res, accessToken, refreshToken);
      res.json({ message: "Password updated successfully" });
    } catch (err) {
      logger.error("Update password error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

// GET /api/profile/completion - Profile completion percentage
router.get("/completion", authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        (CASE WHEN u.name IS NOT NULL AND u.name <> '' THEN 1 ELSE 0 END +
         CASE WHEN u.phone IS NOT NULL AND u.phone <> '' THEN 1 ELSE 0 END +
         CASE WHEN u.email IS NOT NULL AND u.email <> '' THEN 1 ELSE 0 END +
         CASE WHEN u.dob IS NOT NULL THEN 1 ELSE 0 END +
         CASE WHEN u.address IS NOT NULL AND u.address <> '' THEN 1 ELSE 0 END +
         CASE WHEN u.occupation IS NOT NULL AND u.occupation <> '' THEN 1 ELSE 0 END +
         CASE WHEN u.profile_picture IS NOT NULL AND u.profile_picture <> '' THEN 1 ELSE 0 END) AS user_filled,
        COALESCE(p.pet_filled, 0) AS pet_filled,
        COALESCE(p.pet_count * 15, 0) AS pet_total
       FROM users u
       LEFT JOIN LATERAL (
         SELECT
           SUM(
             CASE WHEN name IS NOT NULL AND name <> '' THEN 1 ELSE 0 END +
             CASE WHEN type IS NOT NULL AND type <> '' THEN 1 ELSE 0 END +
             CASE WHEN breed IS NOT NULL AND breed <> '' THEN 1 ELSE 0 END +
             CASE WHEN gender IS NOT NULL AND gender <> '' THEN 1 ELSE 0 END +
             CASE WHEN age IS NOT NULL THEN 1 ELSE 0 END +
             CASE WHEN color IS NOT NULL AND color <> '' THEN 1 ELSE 0 END +
             CASE WHEN weight IS NOT NULL THEN 1 ELSE 0 END +
             CASE WHEN images IS NOT NULL THEN 1 ELSE 0 END +
             CASE WHEN medical_conditions IS NOT NULL AND medical_conditions <> '' THEN 1 ELSE 0 END +
             CASE WHEN allergies IS NOT NULL AND allergies <> '' THEN 1 ELSE 0 END +
             CASE WHEN current_medicines IS NOT NULL AND current_medicines <> '' THEN 1 ELSE 0 END +
             CASE WHEN temperament IS NOT NULL AND temperament <> '' THEN 1 ELSE 0 END +
             CASE WHEN potty_trained IS NOT NULL THEN 1 ELSE 0 END +
             CASE WHEN good_with_kids IS NOT NULL THEN 1 ELSE 0 END +
             CASE WHEN special_notes IS NOT NULL AND special_notes <> '' THEN 1 ELSE 0 END
           ) AS pet_filled,
           COUNT(*) AS pet_count
         FROM pets
         WHERE user_id = u.id AND is_active = true
       ) p ON true
       WHERE u.id = $1`,
      [req.user.id],
    );

    const row = result.rows[0];
    const filled = parseInt(row.user_filled) + parseInt(row.pet_filled);
    const total = 7 + parseInt(row.pet_total);
    const percentage = total === 0 ? 0 : Math.round((filled / total) * 100);
    const badge =
      percentage >= 80 ? "diamond" : percentage >= 50 ? "gold" : "bronze";

    res.json({ percentage, badge, filled, total });
  } catch (err) {
    logger.error("Completion error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/profile/picture - Upload profile picture
router.post(
  "/picture",
  authenticate,
  (req, res, next) => {
    req.uploadDir = "public";
    upload.single("image")(req, res, next);
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      // Get old profile picture to delete it
      const oldPictureResult = await pool.query(
        "SELECT profile_picture FROM users WHERE id = $1",
        [req.user.id],
      );
      const oldPicture = oldPictureResult.rows[0]?.profile_picture;

      const imagePath = `/uploads/public/${req.file.filename}`;
      const result = await pool.query(
        "UPDATE users SET profile_picture = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, profile_picture",
        [imagePath, req.user.id],
      );

      // Delete old file after database update succeeds
      if (oldPicture) {
        deleteUploadedFile(oldPicture);
      }

      res.json({
        message: "Profile picture uploaded successfully",
        user: result.rows[0],
      });
    } catch (err) {
      logger.error("Upload profile picture error:", err);
      deleteUploadedFile(`/uploads/public/${req.file.filename}`);
      res.status(500).json({ error: "Server error" });
    }
  },
);

export = router;
