exports.up = (pgm) => {
  // Bounds + enum integrity (verified: existing data conforms)
  pgm.sql(`
    ALTER TABLE vets DROP CONSTRAINT IF EXISTS vets_avg_rating_check;
    ALTER TABLE vets ADD CONSTRAINT vets_avg_rating_check CHECK (avg_rating >= 0 AND avg_rating <= 5);
    ALTER TABLE vets DROP CONSTRAINT IF EXISTS vets_approval_status_check;
    ALTER TABLE vets ADD CONSTRAINT vets_approval_status_check CHECK (approval_status IN ('approved','rejected','pending'));
  `);
  // One active "available" adoption listing per pet
  pgm.sql(`CREATE UNIQUE INDEX IF NOT EXISTS adoption_posts_pet_available_uniq
    ON adoption_posts(pet_id) WHERE status = 'available'`);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS adoption_posts_pet_available_uniq;
    ALTER TABLE vets DROP CONSTRAINT IF EXISTS vets_avg_rating_check;
    ALTER TABLE vets DROP CONSTRAINT IF EXISTS vets_approval_status_check;
  `);
};
