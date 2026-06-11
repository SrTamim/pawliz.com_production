exports.up = (pgm) => {
  pgm.sql(`ALTER TABLE found_pet_reports DROP COLUMN IF EXISTS contact_info`);
  pgm.sql(`ALTER TABLE rescue_posts DROP COLUMN IF EXISTS contact_info`);
};
exports.down = () => {};
