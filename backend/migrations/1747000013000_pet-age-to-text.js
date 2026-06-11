exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE pets ALTER COLUMN age TYPE VARCHAR(30) USING age::text`);
};
exports.down = (pgm) => {
  // best-effort: non-numeric ages will fail this cast
  pgm.sql(`ALTER TABLE pets ALTER COLUMN age TYPE INTEGER USING age::integer`);
};
