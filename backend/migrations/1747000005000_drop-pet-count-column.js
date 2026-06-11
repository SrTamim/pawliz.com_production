exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS pet_count`);
};

exports.down = () => {};
