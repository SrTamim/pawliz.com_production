const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const pool = require("../config/database");
const { optionalAuth } = require("../middleware/auth");
const { createNotification } = require("../services/notificationService");
const validate = require("../middleware/validate");
const logger = require("../utils/logger");
const { normalizePhone } = require("../utils/phoneUtils");

/**
 * POST /api/v1/contact-post
 * Send contact request to post owner. No auth required.
 * Body: { post_id, post_type, sender_phone, message }
 * post_type: 'lost' | 'found' | 'rescue' | 'adoption' | 'pet'
 */
router.post(
  "/",
  optionalAuth,
  [
    body("post_id").isInt({ min: 1 }).withMessage("Invalid post ID"),
    body("post_type").isIn(["lost", "found", "rescue", "adoption", "pet"]).withMessage("Invalid post type"),
    body("sender_phone").trim().notEmpty().withMessage("Phone number is required").isLength({ max: 20 }).matches(/^(?:\+8801|01)[3-9]\d{8}$/).withMessage("Enter valid BD mobile number"),
    body("message").trim().notEmpty().withMessage("Message is required").isLength({ max: 500 }).withMessage("Message max 500 chars"),
  ],
  validate,
  async (req, res) => {
    const { post_id, post_type, message } = req.body;
    // Normalize phone to 01XXXXXXXXX — prevents rate limit bypass via +8801... vs 01... variants
    const sender_phone = normalizePhone(req.body.sender_phone);

    try {
      // Resolve post owner
      let ownerRow;
      if (post_type === "lost") {
        const r = await pool.query(
          `SELECT p.user_id, p.name as pet_name FROM lost_pet_reports lpr JOIN pets p ON p.id = lpr.pet_id WHERE lpr.id = $1 AND lpr.is_active = true AND p.is_active = true`,
          [post_id],
        );
        ownerRow = r.rows[0];
      } else if (post_type === "found") {
        const r = await pool.query(
          `SELECT user_id, (pet_type || ' pet') as pet_name FROM found_pet_reports WHERE id = $1 AND is_active = true`,
          [post_id],
        );
        ownerRow = r.rows[0];
      } else if (post_type === "rescue") {
        const r = await pool.query(
          `SELECT user_id, (pet_type || ' rescue') as pet_name FROM rescue_posts WHERE id = $1 AND is_active = true`,
          [post_id],
        );
        ownerRow = r.rows[0];
      } else if (post_type === "adoption") {
        const r = await pool.query(
          `SELECT p.user_id, p.name as pet_name FROM adoption_posts ap JOIN pets p ON p.id = ap.pet_id WHERE ap.id = $1 AND p.is_active = true`,
          [post_id],
        );
        ownerRow = r.rows[0];
      } else if (post_type === "pet") {
        const r = await pool.query(
          `SELECT user_id, name as pet_name FROM pets WHERE id = $1 AND is_active = true`,
          [post_id],
        );
        ownerRow = r.rows[0];
      }

      if (!ownerRow) return res.status(404).json({ error: "Post not found" });
      const { user_id: ownerId, pet_name: petName } = ownerRow;

      const senderId = req.user?.id || null;
      if (senderId && ownerId === senderId) {
        return res.status(400).json({ error: "Cannot contact yourself" });
      }

      // DB-level throttle: same sender_phone → same post, max 3 per hour
      const recentContacts = await pool.query(
        `SELECT COUNT(*) FROM contact_notifications
         WHERE sender_phone = $1 AND post_id = $2 AND post_type = $3
         AND created_at > NOW() - INTERVAL '1 hour'`,
        [sender_phone, post_id, post_type]
      );
      if (parseInt(recentContacts.rows[0].count) >= 3) {
        return res.status(429).json({ error: "You have already contacted this post owner recently. Please wait before trying again." });
      }

      let senderName = "Anonymous";
      if (senderId) {
        const senderResult = await pool.query("SELECT name FROM users WHERE id = $1", [senderId]);
        senderName = senderResult.rows[0]?.name || "Someone";
      }

      const notificationTitle =
        post_type === "pet"
          ? `${senderName} contacted you from your ${petName} profile page`
          : `${senderName} contacted your ${post_type} post`;

      const notification = await createNotification(
        ownerId,
        "contact_request",
        notificationTitle,
        `${sender_phone}: ${message}`,
        post_id,
        post_type,
        senderId,
        null,
      );

      if (notification) {
        await pool.query(
          `INSERT INTO contact_notifications (notification_id, post_id, post_type, sender_phone, message)
           VALUES ($1, $2, $3, $4, $5)`,
          [notification.id, post_id, post_type, sender_phone, message],
        );
      }

      res.status(201).json({ message: "Contact request sent" });
    } catch (err) {
      logger.error("Contact post error:", err);
      res.status(500).json({ error: "Server error" });
    }
  },
);

module.exports = router;
