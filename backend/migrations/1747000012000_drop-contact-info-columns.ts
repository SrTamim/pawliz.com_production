import type { MigrationBuilder } from 'node-pg-migrate';
export const up = (pgm: MigrationBuilder): void => {
  pgm.sql(`ALTER TABLE found_pet_reports DROP COLUMN IF EXISTS contact_info`);
  pgm.sql(`ALTER TABLE rescue_posts DROP COLUMN IF EXISTS contact_info`);
};
export const down = (): void => {};
