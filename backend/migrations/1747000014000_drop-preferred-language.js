exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS preferred_language`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'en'`);
};
