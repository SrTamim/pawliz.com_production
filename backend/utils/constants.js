/**
 * Application-wide constants
 * Organized by category: security, pagination, file upload, timeouts, rate limiting
 */

// Security & validation
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
const VET_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
const PHONE_PATTERN = /^01[0-9]{9}$/;
const JWT_EXPIRES_IN = '15m';
const REFRESH_TOKEN_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000;

// Pagination
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// File upload
// 15MB: phone photos run 2–11MB; multer caps the raw upload here, then the upload
// middleware resizes images down to ~KB webp before storing (see middleware/upload.js).
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

// Timeouts
const DB_CONNECT_TIMEOUT_MS = 5000;
const DB_IDLE_TIMEOUT_MS = 30000;
const REQUEST_TIMEOUT_MS = 30000;
const SOCKET_HEARTBEAT_INTERVAL_MS = 25000;

// Rate limiting (per minute/hour)
const RATE_LIMIT_API_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_API_MAX = 500; // shared NAT IPs (e.g. university) can have 50+ users
const RATE_LIMIT_AUTH_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_AUTH_MAX = 20;

// Token cleanup cron (3am daily)
const TOKEN_CLEANUP_CRON = '0 3 * * *';

// Comment report threshold for auto-hide
const COMMENT_REPORT_AUTO_HIDE_THRESHOLD = 3;

module.exports = {
  PASSWORD_MIN_LENGTH,
  PASSWORD_PATTERN,
  VET_PASSWORD_PATTERN,
  PHONE_PATTERN,
  JWT_EXPIRES_IN,
  REFRESH_TOKEN_EXPIRES_MS,
  DEFAULT_PAGE,
  DEFAULT_LIMIT,
  MAX_LIMIT,
  MAX_FILE_SIZE,
  ALLOWED_IMAGE_TYPES,
  ALLOWED_DOC_TYPES,
  DB_CONNECT_TIMEOUT_MS,
  DB_IDLE_TIMEOUT_MS,
  REQUEST_TIMEOUT_MS,
  SOCKET_HEARTBEAT_INTERVAL_MS,
  RATE_LIMIT_API_WINDOW_MS,
  RATE_LIMIT_API_MAX,
  RATE_LIMIT_AUTH_WINDOW_MS,
  RATE_LIMIT_AUTH_MAX,
  TOKEN_CLEANUP_CRON,
  COMMENT_REPORT_AUTO_HIDE_THRESHOLD,
};
