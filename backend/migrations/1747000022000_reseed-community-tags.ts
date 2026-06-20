import type { MigrationBuilder } from 'node-pg-migrate';
'use strict';

export const shorthands = undefined;

// Converge community_tags on the final researched, prioritized set. The initial
// set was seeded by 1747000021000 (already run); this re-seeds + adds a
// display_order column so the API can return tags high→low priority.
//
// Final set (priority high→low):
//   Help, Emergency, Grooming, Food, Veterinary, Behaviour, Nutrition, Tips, Vaccine, General

const FINAL_TAGS: Array<[string, string, number]> = [
  ['help', 'Help', 1],
  ['emergency', 'Emergency', 2],
  ['grooming', 'Grooming', 3],
  ['food', 'Food', 4],
  ['veterinary', 'Veterinary', 5],
  ['behaviour', 'Behaviour', 6],
  ['nutrition', 'Nutrition', 7],
  ['tips', 'Tips', 8],
  ['vaccine', 'Vaccine', 9],
  ['general', 'General', 10],
];

export const up = (pgm: MigrationBuilder): void => {
  pgm.sql(`ALTER TABLE community_tags ADD COLUMN IF NOT EXISTS display_order INTEGER NOT NULL DEFAULT 0`);

  for (const [slug, label, order] of FINAL_TAGS) {
    pgm.sql(`
      INSERT INTO community_tags (slug, label, display_order, is_active)
      VALUES ('${slug}', '${label}', ${order}, true)
      ON CONFLICT (slug) DO UPDATE
        SET label = EXCLUDED.label, display_order = EXCLUDED.display_order, is_active = true
    `);
  }

  // Soft-deactivate any tag not in the final set (e.g. the old medical/sick/vet).
  const slugList = FINAL_TAGS.map(([s]) => `'${s}'`).join(', ');
  pgm.sql(`UPDATE community_tags SET is_active = false WHERE slug NOT IN (${slugList})`);
};

export const down = (pgm: MigrationBuilder): void => {
  // Restore the original 1747000021000 seed set (re-activate, clear order).
  const original: Array<[string, string]> = [
    ['help', 'Help'], ['medical', 'Medical'], ['emergency', 'Emergency'],
    ['grooming', 'Grooming'], ['food', 'Food'], ['sick', 'Sick'], ['vet', 'Vet'],
  ];
  for (const [slug, label] of original) {
    pgm.sql(`
      INSERT INTO community_tags (slug, label, is_active)
      VALUES ('${slug}', '${label}', true)
      ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, is_active = true
    `);
  }
  const origList = original.map(([s]) => `'${s}'`).join(', ');
  pgm.sql(`UPDATE community_tags SET is_active = false WHERE slug NOT IN (${origList})`);
  pgm.sql(`ALTER TABLE community_tags DROP COLUMN IF EXISTS display_order`);
};
