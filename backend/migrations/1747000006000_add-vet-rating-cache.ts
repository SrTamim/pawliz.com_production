import type { MigrationBuilder } from 'node-pg-migrate';
export const up = (pgm: MigrationBuilder): void => {
  pgm.sql(`
    ALTER TABLE vets ADD COLUMN IF NOT EXISTS avg_rating DECIMAL(3,2) DEFAULT 0;
    ALTER TABLE vets ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0;
    UPDATE vets v SET
      avg_rating = COALESCE((SELECT AVG(rating)::DECIMAL(3,2) FROM reviews WHERE vet_id = v.id AND is_active = true), 0),
      review_count = (SELECT COUNT(*) FROM reviews WHERE vet_id = v.id AND is_active = true);
  `);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.sql(`
    ALTER TABLE vets DROP COLUMN IF EXISTS avg_rating;
    ALTER TABLE vets DROP COLUMN IF EXISTS review_count;
  `);
};
