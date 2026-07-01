require("dotenv").config();
import http from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import cron from 'node-cron';
import pool from './config/database';
import logger from './utils/logger';
import * as smsService from './services/smsService';
import * as communityService from './services/communityService';
import * as socketModule from './socket';
import { REQUEST_TIMEOUT_MS, RATE_LIMIT_API_MAX } from './utils/constants';

// Public R2 base URL for redirecting legacy /uploads/* paths (trailing slash stripped).
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "");

// Validate NODE_ENV
if (!process.env.NODE_ENV) {
  logger.warn("NODE_ENV not set, defaulting to development");
  process.env.NODE_ENV = "development";
}
if (!["development", "production", "test"].includes(process.env.NODE_ENV)) {
  logger.error(`Invalid NODE_ENV: ${process.env.NODE_ENV}. Must be development, production, or test`);
  process.exit(1);
}

// Validate critical environment variables
const required = ['JWT_SECRET', 'FRONTEND_URL'];
const hasDatabase = process.env.DATABASE_URL || (process.env.DB_HOST && process.env.DB_PASSWORD);
const missing = required.filter(k => !process.env[k]);
if (!hasDatabase) missing.push('DATABASE_URL or (DB_HOST and DB_PASSWORD)');
if (missing.length) {
  logger.error(`Missing required environment variables: ${missing.join(', ')}`);
  process.exit(1);
}
// Warn if SMS_API_KEY missing — OTP registration/reset will fail silently without it
if (!process.env.SMS_API_KEY) {
  logger.warn('SMS_API_KEY not set — SMS/OTP features will fail. Set SMS_API_KEY in .env');
}

const app = express();
const httpServer = http.createServer(app);
httpServer.setTimeout(REQUEST_TIMEOUT_MS);
const PORT = process.env.PORT || 5000;
const isProduction = process.env.NODE_ENV === "production";

// Security headers
const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
// FRONTEND_URL may be a comma-separated list (apex + www). Build an origin list
// so CSP allows all of them; new URL() on the raw comma string would be invalid.
const frontendOrigins = frontendUrl
  .split(",")
  .map((u) => u.trim())
  .filter(Boolean)
  .map((u) => new URL(u).origin);

// Trust first proxy (Railway/nginx) so req.ip is the real client IP — required for per-client rate limiting
app.set("trust proxy", 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", ...frontendOrigins],
      mediaSrc: ["'self'"],
      connectSrc: ["'self'", ...frontendOrigins],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseSrc: ["'self'"],
      formAction: ["'self'"],
      frameOptions: ["DENY"],
      upgradeInsecureRequests: isProduction ? [] : null,
      reportUri: [isProduction && process.env.APP_URL ? `${process.env.APP_URL}/api/v1/csp-report` : null].filter(Boolean) as string[],
    },
  },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: isProduction },
  noSniff: true,
  xssFilter: true,
}));

// Rate limiting
import { rateLimitKeyWithLogging, logRateLimitEvent } from './utils/rateLimitHelpers';

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: RATE_LIMIT_API_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyWithLogging,
  message: { error: "Too many requests, please try again later." },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyWithLogging,
  message: { error: "Too many auth attempts, please try again later." },
});
app.use("/api/", apiLimiter);
app.use("/api/v1/auth/login", authLimiter);
app.use("/api/v1/auth/register", authLimiter);
app.use("/api/v1/vet-auth/register", authLimiter);
app.use("/api/v1/vet-auth", authLimiter);
app.use("/api/v1/auth/forgot-password", authLimiter);

const contactPostLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: rateLimitKeyWithLogging,
  message: { error: "Too many contact requests. Please wait before trying again." },
});
app.use("/api/v1/contact-post", contactPostLimiter);

// CORS
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("CORS not allowed"));
    },
    credentials: true,
  }),
);

// Reject no-Origin requests on mutating endpoints in production.
// Browsers always send Origin; missing Origin → curl/scripts bypassing CORS.
if (isProduction) {
  app.use("/api/v1/", (req, res, next) => {
    const mutating = ["POST", "PUT", "PATCH", "DELETE"];
    if (mutating.includes(req.method) && !req.headers.origin) {
      return res.status(403).json({ error: "Forbidden: direct API access not allowed" });
    }
    next();
  });
}

socketModule.init(httpServer, allowedOrigins);

// HTTPS redirect (check X-Forwarded-Proto for reverse proxies)
if (isProduction) {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] === "http") {
      return res.redirect(301, `https://${req.headers.host}${req.originalUrl}`);
    }
    next();
  });
}

app.use(compression({ level: 6, threshold: 1024 }));
app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({ extended: true, limit: "100kb" }));
app.use(cookieParser());
app.use(morgan("combined", { stream: logger.stream }));
// Private vet docs must go through the authed /api/v1/files/:filename endpoint — never served statically
app.use("/uploads/private", (req, res) => res.status(403).json({ error: "Access denied. Use /api/v1/files/:filename" }));
// Public uploads live in Cloudflare R2. Redirect legacy /uploads/public/<file>
// (and bare /uploads/<file>) paths to the R2 public URL so existing DB paths and
// frontend links keep working. Private files are never redirected (handled above).
app.use("/uploads", (req, res) => {
  const filename = req.path.split("/").filter(Boolean).pop();
  if (!filename || !R2_PUBLIC_URL) return res.status(404).json({ error: "File not found" });
  res.redirect(302, `${R2_PUBLIC_URL}/public/${encodeURIComponent(filename)}`);
});

const otpLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 3, // Reduced to 3: each call sends an SMS + overwrites the OTP store; cap SMS cost and store churn. Phone-absent reqs fall to IP key.
  standardHeaders: true,
  legacyHeaders: false,
  // Always key on valid phone when present; fall back to IP for missing/invalid phone
  keyGenerator: (req) => {
    const phone = req.body?.phone;
    // Key on a valid phone when present; otherwise fall back to the real client
    // IP. ipKeyGenerator expects an IP string (req.ip, available via trust proxy)
    // and normalizes IPv6 subnets — so each anonymous client gets its own bucket.
    return (phone && /^01[3-9]\d{8}$/.test(phone.trim())) ? phone.trim() : ipKeyGenerator(req.ip ?? '');
  },
  message: { error: "Too many OTP requests. Please wait 5 minutes." },
});
app.use("/api/v1/otp", otpLimiter);

// Routes
app.use("/api/v1/auth", require("./routes/auth"));
app.use("/api/v1/vet-auth", require("./routes/vet-auth"));
app.use("/api/v1/vet-dashboard", require("./routes/vet-profile"));
app.use("/api/v1/vet-dashboard/qualifications", require("./routes/vet-qualifications"));
app.use("/api/v1/vet-dashboard/documents", require("./routes/vet-documents"));
const { contactsRouter, vetsRouter } = require("./routes/vet-clinic");
app.use("/api/v1/vet-dashboard/clinic-contacts", contactsRouter);
app.use("/api/v1/vet-dashboard/clinic-vets", vetsRouter);
app.use("/api/v1/vets-admin", require("./routes/vets-admin"));
app.use("/api/v1/vets", require("./routes/vets-public"));
app.use("/api/v1/reviews", require("./routes/reviews"));
app.use("/api/v1/admin", require("./routes/admin"));
app.use("/api/v1/donations", require("./routes/donations"));
app.use("/api/v1/pets", require("./routes/pets"));
app.use("/api/v1/lost-found", require("./routes/lost-found"));
app.use("/api/v1/community", require("./routes/community"));
app.use("/api/v1/rescue-adoption", require("./routes/rescue-adoption"));
app.use("/api/v1/notifications", require("./routes/notifications"));
app.use("/api/v1/profile", require("./routes/profile"));
app.use("/api/v1/comments", require("./routes/comments"));
app.use("/api/v1/contact-post", require("./routes/contact-post"));
app.use("/api/v1/client-error", require("./routes/client-error"));
app.use("/api/v1/files", require("./routes/files"));
app.use("/api/v1/otp", require("./routes/otp"));

// CSP violation reporting
app.post("/api/v1/csp-report", express.json({ type: "application/csp-report" }), (req, res) => {
  const { "csp-report": report } = req.body;
  if (report) {
    logger.warn("CSP violation:", {
      documentUri: report["document-uri"],
      violatedDirective: report["violated-directive"],
      blockedUri: report["blocked-uri"],
      sourceFile: report["source-file"],
      lineNumber: report["line-number"],
    });
  }
  res.status(204).send();
});

// Health check (no version prefix)
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "ok",
      db: "connected",
      timestamp: new Date().toISOString(),
      // Pool saturation signal: alert on waiting > 0 before connections starve.
      pool: { total: pool.totalCount, idle: pool.idleCount, waiting: pool.waitingCount },
    });
  } catch {
    res.status(500).json({ status: "error", db: "disconnected" });
  }
});

// 404 handler
app.use((req, res) => res.status(404).json({ error: "Route not found" }));

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  if (isProduction) {
    res.status(500).json({ error: "Internal server error" });
  } else {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

cron.schedule("0 3 * * *", () => {
  pool.query("DELETE FROM refresh_tokens WHERE expires_at < NOW()")
    .then(({ rowCount }) => logger.info(`Token cleanup: removed ${rowCount} expired refresh tokens`))
    .catch((err) => logger.error("Token cleanup failed:", err));
});

// Batched delete to avoid long locks / WAL bloat on large tables
async function batchedDelete(label: string, sql: string): Promise<void> {
  let total = 0, deleted;
  try {
    do {
      const r = await pool.query(sql);
      deleted = r.rowCount;
      total += deleted!;
    } while (deleted === 5000);
    logger.info(`${label}: removed ${total} rows`);
  } catch (err) {
    logger.error(`${label} failed:`, err);
  }
}

cron.schedule("30 3 * * *", () => {
  batchedDelete(
    "Notification cleanup",
    `DELETE FROM notifications WHERE id IN (
       SELECT id FROM notifications
       WHERE is_read = true AND created_at < NOW() - INTERVAL '30 days'
       LIMIT 5000)`,
  );
});

cron.schedule("0 4 * * *", () => {
  batchedDelete(
    "Activity log cleanup",
    `DELETE FROM activity_logs WHERE id IN (
       SELECT id FROM activity_logs
       WHERE created_at < NOW() - INTERVAL '90 days'
       LIMIT 5000)`,
  );
});

// 16:00 UTC = 22:00 (10 PM) Asia/Dhaka — Render runs UTC
cron.schedule("0 16 * * *", () => {
  smsService.checkAndAlertLowBalance().catch((err) => logger.error("SMS balance check failed:", err));
});

// Community maintenance: 45-day media purge + denormalized-counter drift heal.
// NOTE (infra phase): when multi-instance, move these to a single-runner cron so
// they don't double-run.
cron.schedule("15 4 * * *", () => {
  communityService.purgeOldMedia().catch((err) => logger.error("Community media purge failed:", err));
});
cron.schedule("45 4 * * *", () => {
  communityService.reconcileCounts().catch((err) => logger.error("Community count reconcile failed:", err));
});

httpServer.listen(PORT, () => {
  logger.info(`Pawliz Server running on port ${PORT}`);
  logger.warn("OTP store is in-memory — OTPs lost on process restart. Acceptable for single-instance deployment.");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  httpServer.close(async () => {
    logger.info("HTTP server closed");
    await pool.end();
    logger.info("Database pool closed");
    process.exit(0);
  });
  // Force exit after 30s
  setTimeout(() => {
    logger.error("Forced shutdown after 30s timeout");
    process.exit(1);
  }, 30000);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  httpServer.close(async () => {
    logger.info("HTTP server closed");
    await pool.end();
    logger.info("Database pool closed");
    process.exit(0);
  });
});
