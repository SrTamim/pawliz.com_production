import type { MigrationBuilder } from 'node-pg-migrate';
export const up = (pgm: MigrationBuilder): void => {
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS pet_count`);
};

export const down = (): void => {};
