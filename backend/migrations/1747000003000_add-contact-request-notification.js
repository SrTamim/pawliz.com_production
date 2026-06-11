/**
 * Migration: add contact_request notification type
 * - Drops and recreates the CHECK constraint on notifications.type
 * - Creates contact_notifications table to store contact messages tied to posts
 */

exports.up = (pgm) => {
  // Drop old CHECK constraint and add contact_request type
  pgm.sql(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check`);
  pgm.sql(`ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('comment_on_post', 'post_commented', 'post_reunited', 'follow', 'contact_request'))`);

  // Table to store the contact messages (so we can delete them when post is deleted)
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS contact_notifications (
      id SERIAL PRIMARY KEY,
      notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
      post_id INTEGER NOT NULL,
      post_type VARCHAR(10) NOT NULL CHECK (post_type IN ('lost', 'found', 'rescue', 'adoption', 'pet')),
      sender_phone VARCHAR(20) NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_contact_notifications_post ON contact_notifications(post_id, post_type)`);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS contact_notifications CASCADE`);
  pgm.sql(`ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check`);
  pgm.sql(`ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN ('comment_on_post', 'post_commented', 'post_reunited', 'follow'))`);
};
