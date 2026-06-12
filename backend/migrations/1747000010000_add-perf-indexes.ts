import type { MigrationBuilder } from 'node-pg-migrate';
export const up = (pgm: MigrationBuilder): void => {
  pgm.sql(`
    CREATE INDEX IF NOT EXISTS idx_vets_rating_name ON vets(avg_rating DESC, name ASC)
      WHERE is_active = true AND approval_status = 'approved';
    CREATE INDEX IF NOT EXISTS idx_vets_latlon ON vets(latitude, longitude) WHERE is_active = true;
    CREATE INDEX IF NOT EXISTS idx_vets_claimed_by ON vets(claimed_by);
    CREATE INDEX IF NOT EXISTS idx_vets_status ON vets(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_actor ON notifications(actor_user_id);
    CREATE INDEX IF NOT EXISTS idx_lost_reports_active_created ON lost_pet_reports(is_active, reported_at DESC);
    CREATE INDEX IF NOT EXISTS idx_found_reports_active_created ON found_pet_reports(is_active, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_rescue_active_created ON rescue_posts(is_active, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_adoption_active_created ON adoption_posts(is_active, posted_at DESC);
    -- redundant with the UNIQUE constraint on refresh_tokens.token
    DROP INDEX IF EXISTS idx_refresh_tokens_token;
  `);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.sql(`
    DROP INDEX IF EXISTS idx_vets_rating_name;
    DROP INDEX IF EXISTS idx_vets_latlon;
    DROP INDEX IF EXISTS idx_vets_claimed_by;
    DROP INDEX IF EXISTS idx_vets_status;
    DROP INDEX IF EXISTS idx_notifications_actor;
    DROP INDEX IF EXISTS idx_lost_reports_active_created;
    DROP INDEX IF EXISTS idx_found_reports_active_created;
    DROP INDEX IF EXISTS idx_rescue_active_created;
    DROP INDEX IF EXISTS idx_adoption_active_created;
  `);
};
