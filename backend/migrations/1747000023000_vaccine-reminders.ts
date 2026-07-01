import type { MigrationBuilder } from 'node-pg-migrate';
/**
 * Migration: vaccine reminders + web push
 * - Adds 'vaccine_reminder' to the notifications.type CHECK constraint
 * - Creates vaccine_reminder_log (idempotency guard so the daily cron never
 *   double-sends a given milestone for a given record/due-date)
 * - Creates web_push_subscriptions (browser Web Push endpoints per user)
 * - Adds a partial index on pet_vaccination_records.next_due_date for the
 *   date-windowed reminder query
 */

export const up = (pgm: MigrationBuilder): void => {
  // Extend the notifications type CHECK constraint (add-only — no existing row can break)
  pgm.sql(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check`);
  pgm.sql(`ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('comment_on_post', 'post_commented', 'post_reunited', 'follow', 'contact_request', 'vaccine_reminder'))`);

  // Idempotency log: one row per (record, due-date, milestone) actually sent.
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS vaccine_reminder_log (
      id                    SERIAL PRIMARY KEY,
      vaccination_record_id INTEGER REFERENCES pet_vaccination_records(id) ON DELETE CASCADE,
      next_due_date         DATE NOT NULL,
      milestone             VARCHAR(20) NOT NULL,
      sent_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (vaccination_record_id, next_due_date, milestone)
    )
  `);

  // Web Push subscriptions (browser PushSubscription endpoints).
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS web_push_subscriptions (
      id         SERIAL PRIMARY KEY,
      user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      endpoint   TEXT UNIQUE NOT NULL,
      p256dh     TEXT NOT NULL,
      auth       TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_web_push_subscriptions_user_id ON web_push_subscriptions (user_id)`);

  // Partial index for the date-windowed reminder scan (only pet_id was indexed before).
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_pet_vaccination_records_next_due ON pet_vaccination_records (next_due_date) WHERE next_due_date IS NOT NULL`);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.sql(`DROP INDEX IF EXISTS idx_pet_vaccination_records_next_due`);
  pgm.sql(`DROP TABLE IF EXISTS web_push_subscriptions CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS vaccine_reminder_log CASCADE`);
  pgm.sql(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check`);
  pgm.sql(`ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('comment_on_post', 'post_commented', 'post_reunited', 'follow', 'contact_request'))`);
};
