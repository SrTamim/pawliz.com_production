import { body, type ValidationChain } from 'express-validator';
import type { Request } from 'express';
import { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, PHONE_PATTERN } from './constants';

// Password validation chain
export const passwordValidation = (fieldName = 'password'): ValidationChain =>
  body(fieldName)
    .isLength({ min: PASSWORD_MIN_LENGTH }).withMessage(`${fieldName} must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .matches(PASSWORD_PATTERN).withMessage(`${fieldName} must contain uppercase, lowercase, number, and special character (@$!%*?&)`);

// Phone validation chain
export const phoneValidation = (fieldName = 'phone'): ValidationChain =>
  body(fieldName)
    .trim()
    .matches(PHONE_PATTERN)
    .withMessage('Valid Bangladeshi phone number required (01XXXXXXXXX)');

// Email validation chain
export const emailValidation = (fieldName = 'email'): ValidationChain =>
  body(fieldName)
    .trim()
    .isEmail()
    .withMessage('Valid email address required');

// Name validation chain
export const nameValidation = (fieldName = 'name'): ValidationChain =>
  body(fieldName)
    .trim()
    .notEmpty()
    .withMessage(`${fieldName} is required`)
    .isLength({ min: 2, max: 255 })
    .withMessage(`${fieldName} must be between 2 and 255 characters`);

// Pagination helpers
export function getPaginationParams(req: Request): { page: number; limit: number; offset: number } {
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
  const rawOffset = req.query.offset !== undefined ? parseInt(req.query.offset as string) : null;
  const offset = (rawOffset !== null && !isNaN(rawOffset) && rawOffset >= 0)
    ? rawOffset
    : (page - 1) * limit;
  return { page, limit, offset };
}

// ID validation helper
export const idValidation = (fieldName = 'id'): ValidationChain =>
  body(fieldName)
    .isInt({ min: 1 })
    .withMessage(`${fieldName} must be a valid positive integer`);
