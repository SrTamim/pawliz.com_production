import { validationResult } from 'express-validator';
import type { Request, Response, NextFunction } from 'express';

/**
 * Express-validator result middleware
 * Returns 400 with errors array if validation chains find issues
 * Use after body() chains: [body(...), body(...)], validate, handler
 */
const validate = (req: Request, res: Response, next: NextFunction): any => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

export = validate;
