import type { MigrationBuilder } from 'node-pg-migrate';
'use strict';

export const shorthands = undefined;

// Pet health tracking: replace the flat vaccination fields on `pets`
// (vaccination_status / last_vaccination_date / next_vaccination_date) with a
// real per-dose history table, add a dated weight-log table, and add flat
// food/diet columns. Vaccination status is derived from records going forward.

export const up = (pgm: MigrationBuilder): void => {
  // ── Vaccination records (one row per dose) ────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS pet_vaccination_records (
      id            SERIAL PRIMARY KEY,
      pet_id        INTEGER REFERENCES pets(id) ON DELETE CASCADE,
      vaccine_name  VARCHAR(100) NOT NULL,
      date_given    DATE,
      next_due_date DATE,
      vet_name      VARCHAR(100),
      notes         TEXT,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_pet_vaccination_records_pet_id ON pet_vaccination_records (pet_id)`);

  // ── Weight logs (one row per weigh-in) ────────────────────────────────────
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS pet_weight_logs (
      id          SERIAL PRIMARY KEY,
      pet_id      INTEGER REFERENCES pets(id) ON DELETE CASCADE,
      weight      DECIMAL(5,2) NOT NULL,
      logged_date DATE NOT NULL,
      notes       TEXT,
      created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_pet_weight_logs_pet_id ON pet_weight_logs (pet_id)`);

  // ── Food flat columns on pets ─────────────────────────────────────────────
  pgm.sql(`ALTER TABLE pets ADD COLUMN IF NOT EXISTS food_types TEXT`);
  pgm.sql(`ALTER TABLE pets ADD COLUMN IF NOT EXISTS meals_per_day VARCHAR(50)`);
  pgm.sql(`ALTER TABLE pets ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT`);
  pgm.sql(`ALTER TABLE pets ADD COLUMN IF NOT EXISTS appetite_notes TEXT`);

  // ── Backfill legacy vaccination data into the new records table ────────────
  // One "General vaccination" row per pet that had any legacy date set.
  pgm.sql(`
    INSERT INTO pet_vaccination_records (pet_id, vaccine_name, date_given, next_due_date, notes)
    SELECT id, 'General vaccination', last_vaccination_date, next_vaccination_date, 'Migrated from legacy record'
    FROM pets
    WHERE last_vaccination_date IS NOT NULL OR next_vaccination_date IS NOT NULL
  `);

  // ── Drop the flat vaccination columns (status now derived) ─────────────────
  pgm.sql(`ALTER TABLE pets DROP COLUMN IF EXISTS last_vaccination_date`);
  pgm.sql(`ALTER TABLE pets DROP COLUMN IF EXISTS next_vaccination_date`);
  pgm.sql(`ALTER TABLE pets DROP COLUMN IF EXISTS vaccination_status`);
};

export const down = (pgm: MigrationBuilder): void => {
  // Re-add the flat vaccination columns.
  pgm.sql(`ALTER TABLE pets ADD COLUMN IF NOT EXISTS vaccination_status VARCHAR(50)`);
  pgm.sql(`ALTER TABLE pets ADD COLUMN IF NOT EXISTS last_vaccination_date DATE`);
  pgm.sql(`ALTER TABLE pets ADD COLUMN IF NOT EXISTS next_vaccination_date DATE`);

  // Best-effort restore of the single legacy date pair from the earliest record.
  pgm.sql(`
    UPDATE pets p SET
      last_vaccination_date = v.date_given,
      next_vaccination_date = v.next_due_date
    FROM (
      SELECT DISTINCT ON (pet_id) pet_id, date_given, next_due_date
      FROM pet_vaccination_records
      ORDER BY pet_id, created_at ASC
    ) v
    WHERE v.pet_id = p.id
  `);

  pgm.sql(`ALTER TABLE pets DROP COLUMN IF EXISTS food_types`);
  pgm.sql(`ALTER TABLE pets DROP COLUMN IF EXISTS meals_per_day`);
  pgm.sql(`ALTER TABLE pets DROP COLUMN IF EXISTS dietary_restrictions`);
  pgm.sql(`ALTER TABLE pets DROP COLUMN IF EXISTS appetite_notes`);

  pgm.sql(`DROP TABLE IF EXISTS pet_weight_logs`);
  pgm.sql(`DROP TABLE IF EXISTS pet_vaccination_records`);
};
