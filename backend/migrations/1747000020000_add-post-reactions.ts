import type { MigrationBuilder } from 'node-pg-migrate';
'use strict';

export const shorthands = undefined;

// Post reactions (love / sad / angry) for lost / found / rescue / adoption posts.
// Mirrors the shared-key shape of post_comments (post_id + post_type). One
// reaction per user per post — the UNIQUE constraint drives Instagram-style
// toggling (switching reaction = UPSERT on conflict).

export const up = (pgm: MigrationBuilder): void => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS post_reactions (
      id            SERIAL PRIMARY KEY,
      post_id       INTEGER NOT NULL,
      post_type     VARCHAR(10) NOT NULL CHECK (post_type IN ('lost', 'found', 'rescue', 'adoption')),
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN ('love', 'sad', 'angry')),
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (post_id, post_type, user_id)
    )
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_post_reactions_post ON post_reactions (post_type, post_id)`);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.sql(`DROP TABLE IF EXISTS post_reactions`);
};
