import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { Response, CookieOptions } from 'express';
import type { Pool, PoolClient } from 'pg';
import pool from '../config/database';
import { REFRESH_TOKEN_EXPIRES_MS } from './constants';
import logger from './logger';

const isProduction = process.env.NODE_ENV === 'production';

/**
 * Set authentication cookies on response.
 * @param rememberMe If true, refresh cookie persists 30 days across browser restarts
 */
export function setCookies(
  res: Response,
  accessToken: string,
  refreshToken: string,
  rememberMe = false,
): void {
  const cookieOpts: CookieOptions = {
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
  const prefOpts: CookieOptions = { sameSite: isProduction ? 'none' : 'lax', secure: isProduction };
  if (rememberMe) {
    res.cookie('pawliz_remember', '1', { ...prefOpts, maxAge: REFRESH_TOKEN_EXPIRES_MS });
  } else {
    res.clearCookie('pawliz_remember', prefOpts);
  }
}

/**
 * Clear authentication cookies from response.
 */
export function clearCookies(res: Response): void {
  const opts: CookieOptions = { httpOnly: true, sameSite: isProduction ? 'none' : 'lax', secure: isProduction };
  res.clearCookie('pawliz_access', opts);
  res.clearCookie('pawliz_refresh', opts);
  res.clearCookie('pawliz_remember', { sameSite: isProduction ? 'none' : 'lax', secure: isProduction });
}

/**
 * Create JWT access + refresh token pair. Stores refresh token in DB.
 * @param client Optional pg client for transaction use. If omitted, uses pool.
 */
export async function createTokens(
  userId: number,
  client?: Pool | PoolClient,
): Promise<{ accessToken: string; refreshToken: string }> {
  const db = client || pool;
  const accessTokenExpiry = process.env.JWT_EXPIRES_IN || '15m';
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET as string, {
    expiresIn: accessTokenExpiry as jwt.SignOptions['expiresIn'],
    algorithm: 'HS256',
  });
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_MS);
  try {
    // Store only the SHA-256 hash — a DB read-leak can't replay sessions.
    await db.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [userId, hashRefreshToken(refreshToken), expiresAt]
    );
  } catch (err) {
    logger.error('Failed to create refresh token:', err);
    throw err;
  }
  return { accessToken, refreshToken };
}

/**
 * Hash password with bcrypt (cost: 12).
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

/**
 * Verify plain password against bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Hash a refresh token for storage/lookup. Plain SHA-256 (no salt) is fine here:
 * the token is 320 bits of crypto.randomBytes entropy, so it's not brute-forceable.
 * We persist and query by this hash so the cleartext only ever lives in the cookie.
 */
export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
