const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const { REFRESH_TOKEN_EXPIRES_MS } = require('./constants');
const logger = require('./logger');

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Set authentication cookies on response.
 * @param {object} res - Express response object
 * @param {string} accessToken - JWT access token (15 min expiry)
 * @param {string} refreshToken - Refresh token string
 * @param {boolean} [rememberMe=false] - If true, refresh cookie persists 30 days across browser restarts
 */
function setCookies(res, accessToken, refreshToken, rememberMe = false) {
  const cookieOpts = {
    httpOnly: true,
    sameSite: isProduction ? 'none' : 'lax',
    secure: isProduction,
  };
  res.cookie('pawliz_access', accessToken, { ...cookieOpts, maxAge: 15 * 60 * 1000 });
  const refreshOpts = rememberMe
    ? { ...cookieOpts, maxAge: REFRESH_TOKEN_EXPIRES_MS }
    : { ...cookieOpts };
  res.cookie('pawliz_refresh', refreshToken, refreshOpts);
  // Non-httpOnly preference marker — carries no credentials, value is '1' only
  const prefOpts = { sameSite: isProduction ? 'none' : 'lax', secure: isProduction };
  if (rememberMe) {
    res.cookie('pawliz_remember', '1', { ...prefOpts, maxAge: REFRESH_TOKEN_EXPIRES_MS });
  } else {
    res.clearCookie('pawliz_remember', prefOpts);
  }
}

/**
 * Clear authentication cookies from response.
 * @param {object} res - Express response object
 */
function clearCookies(res) {
  const opts = { httpOnly: true, sameSite: isProduction ? 'none' : 'lax', secure: isProduction };
  res.clearCookie('pawliz_access', opts);
  res.clearCookie('pawliz_refresh', opts);
  res.clearCookie('pawliz_remember', { sameSite: isProduction ? 'none' : 'lax', secure: isProduction });
}

/**
 * Create JWT access + refresh token pair. Stores refresh token in DB.
 * @param {number} userId - User ID
 * @param {object} [client] - Optional pg client for transaction use. If omitted, uses pool.
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
async function createTokens(userId, client) {
  const db = client || pool;
  const accessTokenExpiry = process.env.JWT_EXPIRES_IN || '15m';
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: accessTokenExpiry,
    algorithm: 'HS256',
  });
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS);
  try {
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, refreshToken, expiresAt]
    );
  } catch (err) {
    logger.error('Failed to create refresh token:', err);
    throw err;
  }
  return { accessToken, refreshToken };
}

/**
 * Hash password with bcrypt (cost: 12).
 * @param {string} password - Plain password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

/**
 * Verify plain password against bcrypt hash.
 * @param {string} password - Plain password
 * @param {string} hash - Bcrypt hash
 * @returns {Promise<boolean>} True if match
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

module.exports = {
  setCookies,
  clearCookies,
  createTokens,
  hashPassword,
  verifyPassword,
};
