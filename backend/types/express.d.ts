import type { AuthUser } from './models';

declare global {
  namespace Express {
    interface Request {
      /** Set by middleware/auth authenticate/optionalAuth. */
      user?: AuthUser;
      /** Set by middleware/upload destination resolver and several routes. */
      uploadDir?: string;
    }
  }
}

export {};
