import type { MigrationBuilder } from 'node-pg-migrate';
'use strict';

export const shorthands = undefined;

export const up = (pgm: MigrationBuilder): void => {
  pgm.sql(`UPDATE vets SET vet_type = 'clinic' WHERE vet_type != 'clinic' OR vet_type IS NULL`);
  pgm.sql(`ALTER TABLE vets ALTER COLUMN vet_type SET DEFAULT 'clinic'`);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.sql(`ALTER TABLE vets ALTER COLUMN vet_type SET DEFAULT 'individual'`);
};
