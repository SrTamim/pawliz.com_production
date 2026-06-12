#!/usr/bin/env node
// Kept for backward compatibility. Runs pending migrations instead of raw schema.sql.
require('./migrate.js');
