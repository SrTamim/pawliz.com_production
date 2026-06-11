'use strict';

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.sql(`UPDATE vets SET vet_type = 'clinic' WHERE vet_type != 'clinic' OR vet_type IS NULL`);
  pgm.sql(`ALTER TABLE vets ALTER COLUMN vet_type SET DEFAULT 'clinic'`);
};

exports.down = (pgm) => {
  pgm.sql(`ALTER TABLE vets ALTER COLUMN vet_type SET DEFAULT 'individual'`);
};
