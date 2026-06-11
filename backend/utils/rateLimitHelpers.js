const jwt = require('jsonwebtoken');
const { ipKeyGenerator } = require('express-rate-limit');
const logger = require('./logger');

const suspiciousPatterns = {
  multipleFailedAuth: { threshold: 10, window: 15 * 60 * 1000 },
  rapidTokenRequests: { threshold: 20, window: 60 * 1000 },
  bruteForceAttempt: { threshold: 50, window: 60 * 1000 },
};

const failureTracking = new Map();

function recordAuthFailure(key) {
  if (!failureTracking.has(key)) {
    failureTracking.set(key, []);
  }
  const attempts = failureTracking.get(key);
  attempts.push(Date.now());
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
  const recentAttempts = attempts.filter(t => t > twoHoursAgo);
  failureTracking.set(key, recentAttempts);
  return recentAttempts.length;
}

function checkSuspiciousPattern(key, attempts) {
  if (attempts > suspiciousPatterns.multipleFailedAuth.threshold) {
    logger.warn(`Suspicious activity: Multiple auth failures for ${key}. Attempts: ${attempts}`);
    return { suspicious: true, pattern: 'multipleFailedAuth', attempts };
  }
  return { suspicious: false };
}

function rateLimitKeyWithLogging(req) {
  const token = req.cookies?.pawliz_access ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null);

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      if (decoded?.userId) {
        const key = `uid:${decoded.userId}`;
        logger.debug(`Rate limit key extracted from JWT: ${key}`);
        return key;
      }
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        logger.debug('Expired token in rate limit check');
      } else if (err.name === 'JsonWebTokenError') {
        const ipKey = ipKeyGenerator(req);
        logger.warn(`Invalid JWT signature detected from ${ipKey}`);
        recordAuthFailure(ipKey);
      }
    }
  }
  return ipKeyGenerator(req);
}

function logRateLimitEvent(req, res) {
  const key = rateLimitKeyWithLogging(req);
  if (req.rateLimit && req.rateLimit.current >= req.rateLimit.limit * 0.9) {
    logger.warn(`Rate limit near threshold: ${key}, ${req.rateLimit.current}/${req.rateLimit.limit}`);
  }
}

module.exports = {
  rateLimitKeyWithLogging,
  recordAuthFailure,
  checkSuspiciousPattern,
  logRateLimitEvent,
};
