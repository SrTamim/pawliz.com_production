import type { MigrationBuilder } from 'node-pg-migrate';
'use strict';

export const shorthands = undefined;

export const up = (pgm: MigrationBuilder): void => {
  // Task 4: Rename donations.qr_code_image → qr_code_image_path
  pgm.renameColumn('donations', 'qr_code_image', 'qr_code_image_path');

  // Task 6: Add user_id to adoption_posts (orphan handling on user delete)
  pgm.addColumn('adoption_posts', {
    user_id: {
      type: 'integer',
      references: 'users(id)',
      onDelete: 'cascade' as any, // runtime accepts lowercase; v8 type wants 'CASCADE'
      notNull: false,
    },
  });

  // Task 6: Index adoption_posts(user_id) for ownership checks
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_adoption_posts_user_id ON adoption_posts(user_id)`);

  // Task 7: Composite index for efficient notification queries (user_id, is_read, created_at)
  // Replace three single-column indexes with one composite
  pgm.sql(`DROP INDEX IF EXISTS idx_notifications_is_read CASCADE`);
  pgm.sql(`DROP INDEX IF EXISTS idx_notifications_created_at CASCADE`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications(user_id, is_read, created_at DESC)`);

  // Task 8: Change vets.user_id ON DELETE from SET NULL → CASCADE (cleanup vet orphans)
  pgm.sql(`
    ALTER TABLE vets
    DROP CONSTRAINT IF EXISTS vets_user_id_fkey,
    ADD CONSTRAINT vets_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  `);

  // Task 5: Add meta JSONB column to users (notification preferences, settings)
  pgm.addColumn('users', {
    meta: {
      type: 'jsonb',
      notNull: false,
    },
  });

  // Task 5: Add notification_sound_paused flag for web push notifications
  pgm.addColumn('users', {
    notification_sound_paused: {
      type: 'boolean',
      default: false,
      notNull: false,
    },
  });

  // Task 5: Add push_notification_enabled for browser/mobile push
  pgm.addColumn('users', {
    push_notification_enabled: {
      type: 'boolean',
      default: false,
      notNull: false,
    },
  });
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.renameColumn('donations', 'qr_code_image_path', 'qr_code_image');
  pgm.dropColumn('adoption_posts', 'user_id');
  pgm.sql(`DROP INDEX IF EXISTS idx_adoption_posts_user_id CASCADE`);
  pgm.sql(`DROP INDEX IF EXISTS idx_notifications_user_read_created CASCADE`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)`);
  pgm.sql(`
    ALTER TABLE vets
    DROP CONSTRAINT IF EXISTS vets_user_id_fkey,
    ADD CONSTRAINT vets_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  `);
  pgm.dropColumn('users', 'meta');
  pgm.dropColumn('users', 'notification_sound_paused');
  pgm.dropColumn('users', 'push_notification_enabled');
};
