import type { MigrationBuilder } from 'node-pg-migrate';
export const up = (pgm: MigrationBuilder): void => {
  pgm.dropColumns('pets', ['qr_code']);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.addColumn('pets', {
    qr_code: { type: 'text', notNull: false },
  });
};
