import type { MigrationBuilder } from 'node-pg-migrate';
export const up = (pgm: MigrationBuilder): void => {
  pgm.sql(`ALTER TABLE pets ALTER COLUMN age TYPE VARCHAR(30) USING age::text`);
};
export const down = (pgm: MigrationBuilder): void => {
  // best-effort: non-numeric ages will fail this cast
  pgm.sql(`ALTER TABLE pets ALTER COLUMN age TYPE INTEGER USING age::integer`);
};
