import type { MigrationBuilder } from 'node-pg-migrate';
'use strict';

export const shorthands = undefined;

// Community feed. A logged-in user composes a text post (≤2 images, optional
// linked pet, ≥1 tag); it appears in the feed AND on the author's profile.
//
// Scale-minded shape:
//  - denormalized counter columns (comment/love/sad/angry) on the row so the
//    feed is a single-table indexed scan, no aggregate JOINs.
//  - keyset pagination via the (created_at DESC, id DESC) partial index.
//  - tags are a lookup + join table so new tags need no migration.
//
// Reuses the shared post_comments / post_reactions tables by widening their
// post_type CHECK to add 'community' (additive — existing rows unaffected).

export const up = (pgm: MigrationBuilder): void => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS community_posts (
      id            SERIAL PRIMARY KEY,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      body          TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 5000),
      images        JSONB NOT NULL DEFAULT '[]'::jsonb,
      media_purged  BOOLEAN NOT NULL DEFAULT false,
      pet_id        INTEGER REFERENCES pets(id) ON DELETE SET NULL,
      comment_count INTEGER NOT NULL DEFAULT 0,
      love_count    INTEGER NOT NULL DEFAULT 0,
      sad_count     INTEGER NOT NULL DEFAULT 0,
      angry_count   INTEGER NOT NULL DEFAULT 0,
      report_count  INTEGER NOT NULL DEFAULT 0,
      is_hidden     BOOLEAN NOT NULL DEFAULT false,
      is_active     BOOLEAN NOT NULL DEFAULT true,
      created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT community_images_max2 CHECK (jsonb_array_length(images) <= 2)
    )
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS community_tags (
      id        SERIAL PRIMARY KEY,
      slug      VARCHAR(40) UNIQUE NOT NULL,
      label     VARCHAR(60) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true
    )
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS community_post_tags (
      post_id INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      tag_id  INTEGER NOT NULL REFERENCES community_tags(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, tag_id)
    )
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_community_post_tags_tag ON community_post_tags (tag_id, post_id)`);

  // Keyset feed indexes. Partial predicates keep them tight to visible rows.
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_community_visible_created
      ON community_posts (created_at DESC, id DESC)
      WHERE is_active = true AND is_hidden = false
  `);
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_community_user_created
      ON community_posts (user_id, created_at DESC, id DESC)
      WHERE is_active = true
  `);

  // Per-post reporting — mirrors comment_reports exactly.
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS community_post_reports (
      id         SERIAL PRIMARY KEY,
      post_id    INTEGER NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
      user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason     VARCHAR(20) NOT NULL CHECK (reason IN ('spam','harassment','inappropriate','misinformation','other')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (post_id, user_id)
    )
  `);

  // Seed the initial tag set.
  pgm.sql(`
    INSERT INTO community_tags (slug, label) VALUES
      ('help', 'Help'),
      ('medical', 'Medical'),
      ('emergency', 'Emergency'),
      ('grooming', 'Grooming'),
      ('food', 'Food'),
      ('sick', 'Sick'),
      ('vet', 'Vet')
    ON CONFLICT (slug) DO NOTHING
  `);

  // Widen the shared post_type CHECKs to allow 'community' (additive only).
  pgm.sql(`ALTER TABLE post_reactions DROP CONSTRAINT IF EXISTS post_reactions_post_type_check`);
  pgm.sql(`
    ALTER TABLE post_reactions ADD CONSTRAINT post_reactions_post_type_check
      CHECK (post_type IN ('lost','found','rescue','adoption','community'))
  `);
  pgm.sql(`ALTER TABLE post_comments DROP CONSTRAINT IF EXISTS post_comments_post_type_check`);
  pgm.sql(`
    ALTER TABLE post_comments ADD CONSTRAINT post_comments_post_type_check
      CHECK (post_type IN ('lost','found','rescue','adoption','community'))
  `);

  // Stacked comment notifications. notifications.type already allows
  // 'comment_on_post' so the CHECK is untouched. event_count drives the
  // "{name} and N others" wording; the partial unique index (scoped to
  // community + unread) lets addComment upsert one stacked row per post.
  pgm.sql(`ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_count INTEGER NOT NULL DEFAULT 1`);
  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_notif_comment_post_community
      ON notifications (user_id, related_post_id, related_post_type)
      WHERE type = 'comment_on_post' AND related_post_type = 'community' AND is_read = false
  `);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.sql(`DROP INDEX IF EXISTS uniq_notif_comment_post_community`);
  pgm.sql(`ALTER TABLE notifications DROP COLUMN IF EXISTS event_count`);

  // Restore the original 4-value CHECKs.
  pgm.sql(`ALTER TABLE post_comments DROP CONSTRAINT IF EXISTS post_comments_post_type_check`);
  pgm.sql(`
    ALTER TABLE post_comments ADD CONSTRAINT post_comments_post_type_check
      CHECK (post_type IN ('lost','found','rescue','adoption'))
  `);
  pgm.sql(`ALTER TABLE post_reactions DROP CONSTRAINT IF EXISTS post_reactions_post_type_check`);
  pgm.sql(`
    ALTER TABLE post_reactions ADD CONSTRAINT post_reactions_post_type_check
      CHECK (post_type IN ('lost','found','rescue','adoption'))
  `);

  pgm.sql(`DROP TABLE IF EXISTS community_post_reports`);
  pgm.sql(`DROP TABLE IF EXISTS community_post_tags`);
  pgm.sql(`DROP TABLE IF EXISTS community_tags`);
  pgm.sql(`DROP TABLE IF EXISTS community_posts`);
};
