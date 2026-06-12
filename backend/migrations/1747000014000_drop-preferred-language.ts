import type { MigrationBuilder } from 'node-pg-migrate';
export const up = (pgm: MigrationBuilder): void => {
  pgm.sql(`ALTER TABLE users DROP COLUMN IF EXISTS preferred_language`);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.sql(`ALTER TABLE users ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'en'`);
};
