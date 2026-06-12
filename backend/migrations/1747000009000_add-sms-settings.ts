import type { MigrationBuilder } from 'node-pg-migrate';
export const up = (pgm: MigrationBuilder): void => {
  pgm.sql(`INSERT INTO site_settings (key, value) VALUES ('sms_enabled', 'true') ON CONFLICT (key) DO NOTHING`);
  pgm.sql(`INSERT INTO site_settings (key, value) VALUES ('admin_phone', '') ON CONFLICT (key) DO NOTHING`);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.sql(`DELETE FROM site_settings WHERE key IN ('sms_enabled', 'admin_phone')`);
};
