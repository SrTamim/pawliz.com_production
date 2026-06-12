import type { Request, Response } from 'express';
import logger from './logger';

interface ErrorDef {
  code: number;
  status: number;
  message: string;
}

export const ERROR_CODES: Record<string, ErrorDef> = {
  // Auth errors (4000-4099)
  INVALID_CREDENTIALS: { code: 4001, status: 401, message: 'Invalid credentials' },
  EXPIRED_TOKEN: { code: 4002, status: 401, message: 'Token expired' },
  INVALID_TOKEN: { code: 4003, status: 401, message: 'Invalid token' },
  USER_INACTIVE: { code: 4004, status: 401, message: 'User account is inactive' },
  PHONE_ALREADY_REGISTERED: { code: 4005, status: 409, message: 'Phone number already registered' },
  EMAIL_ALREADY_REGISTERED: { code: 4006, status: 409, message: 'Email already registered' },
  WEAK_PASSWORD: { code: 4007, status: 400, message: 'Password does not meet security requirements' },

  // Authorization errors (4100-4199)
  UNAUTHORIZED: { code: 4101, status: 403, message: 'Unauthorized' },
  ADMIN_ONLY: { code: 4102, status: 403, message: 'Admin access required' },
  VET_ONLY: { code: 4103, status: 403, message: 'Vet access required' },

  // Validation errors (4200-4299)
  INVALID_INPUT: { code: 4200, status: 400, message: 'Invalid input' },
  MISSING_FIELD: { code: 4201, status: 400, message: 'Missing required field' },
  INVALID_ID: { code: 4202, status: 400, message: 'Invalid ID format' },
  INVALID_PAGINATION: { code: 4203, status: 400, message: 'Invalid pagination parameters' },

  // Resource errors (4300-4399)
  NOT_FOUND: { code: 4300, status: 404, message: 'Resource not found' },
  USER_NOT_FOUND: { code: 4301, status: 404, message: 'User not found' },
  VET_NOT_FOUND: { code: 4302, status: 404, message: 'Vet not found' },
  PET_NOT_FOUND: { code: 4303, status: 404, message: 'Pet not found' },
  NOTIFICATION_NOT_FOUND: { code: 4304, status: 404, message: 'Notification not found' },

  // File errors (4400-4499)
  FILE_UPLOAD_ERROR: { code: 4400, status: 400, message: 'File upload failed' },
  FILE_TOO_LARGE: { code: 4401, status: 413, message: 'File size exceeds limit' },
  INVALID_FILE_TYPE: { code: 4402, status: 400, message: 'Invalid file type' },
  FILE_NOT_FOUND: { code: 4403, status: 404, message: 'File not found' },

  // Rate limiting (4290)
  RATE_LIMIT_EXCEEDED: { code: 4290, status: 429, message: 'Too many requests' },

  // Database errors (5000-5099)
  DATABASE_ERROR: { code: 5000, status: 500, message: 'Database error' },
  QUERY_ERROR: { code: 5001, status: 500, message: 'Query execution failed' },

  // Server errors (5100-5199)
  INTERNAL_SERVER_ERROR: { code: 5100, status: 500, message: 'Internal server error' },
  TIMEOUT: { code: 5101, status: 504, message: 'Request timeout' },
};

export class AppError extends Error {
  code: number;
  status: number;
  details: unknown;
  type: string;

  constructor(errorType: string, details: unknown = {}) {
    const error = ERROR_CODES[errorType] || ERROR_CODES.INTERNAL_SERVER_ERROR;
    super(error.message);
    this.code = error.code;
    this.status = error.status;
    this.details = details;
    this.type = errorType;
  }
}

export function handleError(err: any, req: Request, res: Response): void {
  const isProduction = process.env.NODE_ENV === 'production';

  if (err instanceof AppError) {
    if (err.status >= 500) {
      logger.error(`${err.type} (${err.code}):`, err);
    }
    res.status(err.status).json({
      error: err.message,
      code: err.code,
      ...(req.user && { userId: req.user.id }),
      ...(!isProduction && { details: err.details }),
    });
    return;
  }

  // Unknown error
  logger.error('Unhandled error:', err);
  const status = err.status || 500;
  const message = isProduction ? 'Internal server error' : err.message;

  res.status(status).json({
    error: message,
    code: ERROR_CODES.INTERNAL_SERVER_ERROR.code,
    ...(req.user && { userId: req.user.id }),
    ...(!isProduction && { stack: err.stack }),
  });
}
