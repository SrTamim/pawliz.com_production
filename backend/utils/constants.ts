/**
 * Application-wide constants
 * Organized by category: security, pagination, file upload, timeouts, rate limiting
 */

// Security & validation
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
export const VET_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*?&]{8,}$/;
export const PHONE_PATTERN = /^01[0-9]{9}$/;
export const JWT_EXPIRES_IN = '15m';
export const REFRESH_TOKEN_EXPIRES_MS = 30 * 24 * 60 * 60 * 1000;

// Pagination
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// File upload
// 15MB: phone photos run 2–11MB; multer caps the raw upload here, then the upload
// middleware resizes images down to ~KB webp before storing (see middleware/upload.js).
export const MAX_FILE_SIZE = 15 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const ALLOWED_DOC_TYPES = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

// Timeouts
export const DB_CONNECT_TIMEOUT_MS = 5000;
export const DB_IDLE_TIMEOUT_MS = 30000;
export const REQUEST_TIMEOUT_MS = 30000;
export const SOCKET_HEARTBEAT_INTERVAL_MS = 25000;

// Rate limiting (per minute/hour)
export const RATE_LIMIT_API_WINDOW_MS = 60 * 1000;
export const RATE_LIMIT_API_MAX = 500; // shared NAT IPs (e.g. university) can have 50+ users
export const RATE_LIMIT_AUTH_WINDOW_MS = 15 * 60 * 1000;
export const RATE_LIMIT_AUTH_MAX = 20;

// Token cleanup cron (3am daily)
export const TOKEN_CLEANUP_CRON = '0 3 * * *';

// Comment report threshold for auto-hide
export const COMMENT_REPORT_AUTO_HIDE_THRESHOLD = 3;
