const { body } = require('express-validator');
const { PASSWORD_MIN_LENGTH, PASSWORD_PATTERN, PHONE_PATTERN } = require('./constants');

// Password validation chain
const passwordValidation = (fieldName = 'password') =>
  body(fieldName)
    .isLength({ min: PASSWORD_MIN_LENGTH }).withMessage(`${fieldName} must be at least ${PASSWORD_MIN_LENGTH} characters`)
    .matches(PASSWORD_PATTERN).withMessage(`${fieldName} must contain uppercase, lowercase, number, and special character (@$!%*?&)`);

// Phone validation chain
const phoneValidation = (fieldName = 'phone') =>
  body(fieldName)
    .trim()
    .matches(PHONE_PATTERN)
    .withMessage('Valid Bangladeshi phone number required (01XXXXXXXXX)');

// Email validation chain
const emailValidation = (fieldName = 'email') =>
  body(fieldName)
    .trim()
    .isEmail()
    .withMessage('Valid email address required');

// Name validation chain
const nameValidation = (fieldName = 'name') =>
  body(fieldName)
    .trim()
    .notEmpty()
    .withMessage(`${fieldName} is required`)
    .isLength({ min: 2, max: 255 })
    .withMessage(`${fieldName} must be between 2 and 255 characters`);

// Pagination helpers
function getPaginationParams(req) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
  const rawOffset = req.query.offset !== undefined ? parseInt(req.query.offset) : null;
  const offset = (rawOffset !== null && !isNaN(rawOffset) && rawOffset >= 0)
    ? rawOffset
    : (page - 1) * limit;
  return { page, limit, offset };
}

// ID validation helper
const idValidation = (fieldName = 'id') =>
  body(fieldName)
    .isInt({ min: 1 })
    .withMessage(`${fieldName} must be a valid positive integer`);

module.exports = {
  passwordValidation,
  phoneValidation,
  emailValidation,
  nameValidation,
  idValidation,
  getPaginationParams,
};
