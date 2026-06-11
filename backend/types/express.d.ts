import type { AuthUser } from './models';

declare global {
  namespace Express {
    interface Request {
      /** Set by middleware/auth authenticate/optionalAuth. */
      user?: AuthUser;
      /** Set by middleware/upload destination resolver and several routes. */
      uploadDir?: string;
      /** Set by express-rate-limit on limited routes. */
      rateLimit?: import('express-rate-limit').RateLimitInfo;
    }
  }
}

export {};
