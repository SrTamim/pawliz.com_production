import type { MigrationBuilder } from 'node-pg-migrate';
'use strict';

// RBAC: roles table + per-role permissions (JSONB), replacing the rigid
// users.role CHECK constraint with a FK to roles(name).
//
// DEPLOYED-SAFETY (render.yaml runs `npm run migrate && node server.js` on every
// deploy — a throw here = full backend outage). Ordering is deliberate so the FK
// can never fail on live data:
//   1. create roles table
//   2. seed system roles (user/admin/vet) + BACKFILL any other live role value
//      straight from users.role — guarantees every existing users.role has a
//      matching roles row before the FK is added
//   3. drop the old CHECK
//   4. add the FK (now provably satisfiable)
// node-pg-migrate wraps each migration in a single transaction, so a partial
// failure rolls back cleanly — no half-migrated prod schema.

export const shorthands = undefined;

export const up = (pgm: MigrationBuilder): void => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS roles (
      name        VARCHAR(50) PRIMARY KEY,
      description TEXT,
      permissions JSONB NOT NULL DEFAULT '{"pages":[],"ui":[]}',
      is_system   BOOLEAN DEFAULT false,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // System roles. admin.permissions stays empty — superuser is a code-level
  // short-circuit (req.user.role === 'admin'), never data, so it can't be
  // weakened by tampering with this row.
  pgm.sql(`
    INSERT INTO roles (name, description, is_system) VALUES
      ('user',  'Default end user',        true),
      ('admin', 'Full system administrator', true),
      ('vet',   'Vet clinic owner',        true)
    ON CONFLICT (name) DO NOTHING
  `);

  // D1: backfill any role value that already exists on a live user but isn't one
  // of the three above (e.g. a hand-edited prod row). Marked is_system so the UI
  // won't let it be deleted/renamed out from under those users.
  pgm.sql(`
    INSERT INTO roles (name, is_system)
    SELECT DISTINCT role, true FROM users WHERE role IS NOT NULL
    ON CONFLICT (name) DO NOTHING
  `);

  // Swap CHECK -> FK. The inline CHECK from the baseline migration is
  // auto-named users_role_check by Postgres.
  pgm.sql(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check`);
  pgm.sql(`
    ALTER TABLE users
      ADD CONSTRAINT users_role_fkey
      FOREIGN KEY (role) REFERENCES roles(name)
      ON UPDATE CASCADE ON DELETE SET DEFAULT
  `);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.sql(`ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_fkey`);
  // Restore the original CHECK. Any custom roles assigned to users would violate
  // this; FK ON DELETE SET DEFAULT already reset them to 'user' on table drop,
  // but guard anyway by coercing unknown roles back to 'user' first.
  pgm.sql(`UPDATE users SET role = 'user' WHERE role NOT IN ('user','admin','vet')`);
  pgm.sql(`
    ALTER TABLE users
      ADD CONSTRAINT users_role_check CHECK (role IN ('user','admin','vet'))
  `);
  pgm.sql(`DROP TABLE IF EXISTS roles`);
};
