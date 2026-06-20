import type { MigrationBuilder } from 'node-pg-migrate';
'use strict';

export const shorthands = undefined;

// Per-day opening schedule stored as JSONB:
//   { "saturday": {"open":"10:00","close":"12:00"}, "friday": null, ... }
// null / absent day = closed. Replaces the single checkup_start/end + weekly_holidays
// model (kept as legacy fallback). Days use lowercase full names; weekly_holidays stores
// capitalized names (e.g. "Saturday"), so the backfill matches against the capitalized form.

const DAYS: { key: string; cap: string }[] = [
  { key: 'saturday', cap: 'Saturday' },
  { key: 'sunday', cap: 'Sunday' },
  { key: 'monday', cap: 'Monday' },
  { key: 'tuesday', cap: 'Tuesday' },
  { key: 'wednesday', cap: 'Wednesday' },
  { key: 'thursday', cap: 'Thursday' },
  { key: 'friday', cap: 'Friday' },
];

// Build a jsonb_build_object(...) expression that maps each day to its hours or null.
// A day is closed when it's in weekly_holidays (case-insensitive) or no hours are set.
function backfillExpr(): string {
  const pairs = DAYS.map(({ key, cap }) =>
    `'${key}', CASE
       WHEN COALESCE(weekly_holidays, '{}') @> ARRAY['${cap}']::text[]
         OR EXISTS (SELECT 1 FROM unnest(COALESCE(weekly_holidays, '{}')) h WHERE lower(h) = '${key}')
         OR checkup_start IS NULL
       THEN NULL
       ELSE jsonb_build_object(
         'open', to_char(checkup_start, 'HH24:MI'),
         'close', to_char(checkup_end, 'HH24:MI')
       )
     END`
  ).join(',\n    ');
  return `jsonb_build_object(\n    ${pairs}\n  )`;
}

export const up = (pgm: MigrationBuilder): void => {
  pgm.sql(`ALTER TABLE vets ADD COLUMN IF NOT EXISTS weekly_schedule JSONB`);
  pgm.sql(`ALTER TABLE clinic_vets ADD COLUMN IF NOT EXISTS weekly_schedule JSONB`);

  // Backfill only rows that actually have hours set; leave the rest NULL so the
  // frontend falls through to the legacy single-range display.
  pgm.sql(`
    UPDATE vets
    SET weekly_schedule = ${backfillExpr()}
    WHERE weekly_schedule IS NULL AND checkup_start IS NOT NULL
  `);
  pgm.sql(`
    UPDATE clinic_vets
    SET weekly_schedule = ${backfillExpr()}
    WHERE weekly_schedule IS NULL AND checkup_start IS NOT NULL
  `);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.sql(`ALTER TABLE vets DROP COLUMN IF EXISTS weekly_schedule`);
  pgm.sql(`ALTER TABLE clinic_vets DROP COLUMN IF EXISTS weekly_schedule`);
};
