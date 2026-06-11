const { validationResult } = require('express-validator');

/**
 * Express-validator result middleware
 * Returns 400 with errors array if validation chains find issues
 * Use after body() chains: [body(...), body(...)], validate, handler
 */
module.exports = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};
