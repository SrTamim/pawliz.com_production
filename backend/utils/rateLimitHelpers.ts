import jwt from 'jsonwebtoken';
import { ipKeyGenerator } from 'express-rate-limit';
import type { Request, Response } from 'express';
import logger from './logger';

const suspiciousPatterns = {
  multipleFailedAuth: { threshold: 10, window: 15 * 60 * 1000 },
  rapidTokenRequests: { threshold: 20, window: 60 * 1000 },
  bruteForceAttempt: { threshold: 50, window: 60 * 1000 },
};

const failureTracking = new Map<string, number[]>();

export function recordAuthFailure(key: string): number {
  if (!failureTracking.has(key)) {
    failureTracking.set(key, []);
  }
  const attempts = failureTracking.get(key)!;
  attempts.push(Date.now());
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const recentAttempts = attempts.filter(t => t > twoHoursAgo);
  failureTracking.set(key, recentAttempts);
  return recentAttempts.length;
}

export function checkSuspiciousPattern(
  key: string,
  attempts: number,
): { suspicious: boolean; pattern?: string; attempts?: number } {
  if (attempts > suspiciousPatterns.multipleFailedAuth.threshold) {
    logger.warn(`Suspicious activity: Multiple auth failures for ${key}. Attempts: ${attempts}`);
    return { suspicious: true, pattern: 'multipleFailedAuth', attempts };
  }
  return { suspicious: false };
}

export function rateLimitKeyWithLogging(req: Request): string {
  const token = req.cookies?.pawliz_access ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null);

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET as string, { algorithms: ['HS256'] }) as jwt.JwtPayload;
      if (decoded?.userId) {
        const key = `uid:${decoded.userId}`;
        logger.debug(`Rate limit key extracted from JWT: ${key}`);
        return key;
      }
    } catch (err) {
      const e = err as Error;
      if (e.name === 'TokenExpiredError') {
        logger.debug('Expired token in rate limit check');
      } else if (e.name === 'JsonWebTokenError') {
        // NOTE(pre-existing): v8 ipKeyGenerator expects an IP string; passing
        // req returns it unchanged, so the effective key for anonymous traffic
        // is "[object Object]" (one shared bucket). Preserved as-is — fixing
        // would change live rate-limit behavior. See migration notes.
        const ipKey = ipKeyGenerator(req as any);
        logger.warn(`Invalid JWT signature detected from ${ipKey}`);
        recordAuthFailure(ipKey);
      }
    }
  }
  return ipKeyGenerator(req as any);
}

export function logRateLimitEvent(req: Request, res: Response): void {
  const key = rateLimitKeyWithLogging(req);
  // NOTE(pre-existing): v8 RateLimitInfo has no `current` (renamed `used`), so
  // this condition is always false at runtime. Preserved as-is; typed via cast.
  const info = req.rateLimit as unknown as { current: number; limit: number } | undefined;
  if (info && info.current >= info.limit * 0.9) {
    logger.warn(`Rate limit near threshold: ${key}, ${info.current}/${info.limit}`);
  }
}
