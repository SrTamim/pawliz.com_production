-- Pawliz Database Schema
-- Run this file to initialize the database on a fresh install.
-- Reflects all migrations up to 1747000009000_add-sms-settings.

-- CREATE DATABASE pawliz;  -- run separately if needed

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── ROLES (RBAC) ────────────────────────────────────────────────────────────
-- Role identity + per-role permissions. users.role is a FK to roles(name).
-- admin.permissions stays empty: superuser is a code-level short-circuit, not data.
CREATE TABLE IF NOT EXISTS roles (
  name                      VARCHAR(50) PRIMARY KEY,
  description               TEXT,
  permissions               JSONB NOT NULL DEFAULT '{"pages":[],"ui":[]}',
  is_system                 BOOLEAN DEFAULT false,
  created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO roles (name, description, is_system) VALUES
  ('user',  'Default end user',          true),
  ('admin', 'Full system administrator', true),
  ('vet',   'Vet clinic owner',          true)
ON CONFLICT (name) DO NOTHING;

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                        SERIAL PRIMARY KEY,
  name                      VARCHAR(100) NOT NULL,
  phone                     VARCHAR(20) UNIQUE NOT NULL,
  email                     VARCHAR(150) UNIQUE,
  password                  VARCHAR(255) NOT NULL,
  role                      VARCHAR(20) DEFAULT 'user' REFERENCES roles(name) ON UPDATE CASCADE ON DELETE SET DEFAULT,
  dob                       DATE,
  address                   TEXT,
  occupation                VARCHAR(100),
  profile_picture           VARCHAR(255),
  meta                      JSONB,
  notification_sound_paused BOOLEAN DEFAULT false,
  push_notification_enabled BOOLEAN DEFAULT false,
  is_active                 BOOLEAN DEFAULT true,
  created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── VETS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vets (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name                VARCHAR(200) NOT NULL,
  vet_type            VARCHAR(20) DEFAULT 'clinic',
  approval_status     VARCHAR(20) DEFAULT 'approved',
  location_name       VARCHAR(100),
  latitude            DECIMAL(10,8),
  longitude           DECIMAL(11,8),
  address             TEXT,
  contact             VARCHAR(50),
  email               VARCHAR(150),
  website             VARCHAR(255),
  image               VARCHAR(255),
  cover_image         VARCHAR(255),
  description         TEXT,
  services            TEXT[],
  clinic_reg_number   VARCHAR(100),
  checkup_start       TIME,
  checkup_end         TIME,
  weekly_holidays     TEXT[],
  weekly_schedule     JSONB,
  account_owner_name  VARCHAR(200),
  rejection_reason    TEXT,
  social_facebook     VARCHAR(300),
  social_instagram    VARCHAR(300),
  social_linkedin     VARCHAR(300),
  social_whatsapp     VARCHAR(50),
  avg_rating          DECIMAL(3,2) DEFAULT 0,
  review_count        INTEGER DEFAULT 0,
  status              VARCHAR(20) DEFAULT 'unverified' CHECK (status IN ('unverified', 'pending_claim', 'claimed')),
  claimed_by          INTEGER REFERENCES users(id),
  claim_requested_at  TIMESTAMP,
  claimed_at          TIMESTAMP,
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (name, address)
);

-- ─── REVIEWS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reviews (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  vet_id     INTEGER REFERENCES vets(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment    TEXT,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, vet_id)
);

-- ─── VET QUALIFICATIONS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vet_qualifications (
  id            SERIAL PRIMARY KEY,
  vet_id        INTEGER REFERENCES vets(id) ON DELETE CASCADE NOT NULL,
  qualification VARCHAR(300) NOT NULL,
  institute     VARCHAR(300),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── VET DOCUMENTS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vet_documents (
  id            SERIAL PRIMARY KEY,
  vet_id        INTEGER REFERENCES vets(id) ON DELETE CASCADE NOT NULL,
  doc_type      VARCHAR(50) NOT NULL,
  file_path     VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── CLINIC CONTACTS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_contacts (
  id            SERIAL PRIMARY KEY,
  vet_id        INTEGER REFERENCES vets(id) ON DELETE CASCADE NOT NULL,
  contact_type  VARCHAR(20) DEFAULT 'phone',
  contact_value VARCHAR(150) NOT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── CLINIC VETS (staff) ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_vets (
  id               SERIAL PRIMARY KEY,
  clinic_id        INTEGER REFERENCES vets(id) ON DELETE CASCADE NOT NULL,
  vet_image        VARCHAR(255),
  name             VARCHAR(200) NOT NULL,
  designation      VARCHAR(200),
  bvc_reg_number   VARCHAR(100),
  bmdc_reg_number  VARCHAR(100),
  checkup_start    TIME,
  checkup_end      TIME,
  weekly_holidays  TEXT[],
  weekly_schedule  JSONB,
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── CLINIC VET QUALIFICATIONS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinic_vet_qualifications (
  id             SERIAL PRIMARY KEY,
  clinic_vet_id  INTEGER REFERENCES clinic_vets(id) ON DELETE CASCADE NOT NULL,
  qualification  VARCHAR(300) NOT NULL,
  institute      VARCHAR(300),
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── DONATIONS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS donations (
  id                 SERIAL PRIMARY KEY,
  qr_code_image_path VARCHAR(255),
  message            TEXT,
  title              VARCHAR(200),
  is_active          BOOLEAN DEFAULT true,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── SITE SETTINGS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_settings (
  id         SERIAL PRIMARY KEY,
  key        VARCHAR(100) UNIQUE NOT NULL,
  value      TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── PETS ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pets (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER REFERENCES users(id) ON DELETE CASCADE,
  pet_id               VARCHAR(20) UNIQUE NOT NULL,
  name                 VARCHAR(100) NOT NULL,
  type                 VARCHAR(20) NOT NULL CHECK (type IN ('dog', 'cat', 'other')),
  breed                VARCHAR(100),
  gender               VARCHAR(10) CHECK (gender IN ('male', 'female', 'unknown')),
  age                  VARCHAR(30),
  color                VARCHAR(100),
  weight               DECIMAL(5,2),
  vaccination_status   VARCHAR(50),
  last_vaccination_date DATE,
  next_vaccination_date DATE,
  medical_conditions   TEXT,
  allergies            TEXT,
  current_medicines    TEXT,
  temperament          VARCHAR(20) CHECK (temperament IN ('friendly', 'aggressive', 'shy', 'bites')),
  potty_trained        BOOLEAN,
  knows_commands       BOOLEAN,
  good_with_strangers  BOOLEAN,
  good_with_kids       BOOLEAN,
  good_with_pets       BOOLEAN,
  special_notes        TEXT,
  images               JSONB,
  is_lost              BOOLEAN DEFAULT false,
  is_for_adoption      BOOLEAN DEFAULT false,
  status               VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'safe', 'lost')),
  is_active            BOOLEAN DEFAULT true,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── LOST PET REPORTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lost_pet_reports (
  id                 SERIAL PRIMARY KEY,
  pet_id             INTEGER REFERENCES pets(id) ON DELETE CASCADE,
  lost_date          DATE NOT NULL,
  lost_location_name TEXT,
  lost_latitude      DECIMAL(10,8),
  lost_longitude     DECIMAL(11,8),
  additional_details TEXT,
  is_found           BOOLEAN DEFAULT false,
  is_active          BOOLEAN DEFAULT true,
  reported_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── FOUND PET REPORTS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS found_pet_reports (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER REFERENCES users(id) ON DELETE CASCADE,
  pet_type           VARCHAR(20) NOT NULL CHECK (pet_type IN ('dog', 'cat', 'other')),
  color              TEXT,
  gender             VARCHAR(10),
  breed              VARCHAR(100),
  found_location_name TEXT,
  found_latitude     DECIMAL(10,8),
  found_longitude    DECIMAL(11,8),
  found_date         DATE NOT NULL,
  images             JSONB,
  description        TEXT,
  status             VARCHAR(20) DEFAULT 'found' CHECK (status IN ('found', 'resolved')),
  is_active          BOOLEAN DEFAULT true,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── RESCUE POSTS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rescue_posts (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER REFERENCES users(id) ON DELETE CASCADE,
  pet_type             VARCHAR(20) NOT NULL CHECK (pet_type IN ('dog', 'cat', 'other')),
  color                TEXT,
  gender               VARCHAR(10),
  breed                VARCHAR(100),
  rescue_location_name TEXT,
  rescue_latitude      DECIMAL(10,8),
  rescue_longitude     DECIMAL(11,8),
  rescue_date          DATE NOT NULL,
  images               JSONB,
  description          TEXT,
  urgency              VARCHAR(20) DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  status               VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'rescued', 'resolved')),
  is_active            BOOLEAN DEFAULT true,
  created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── ADOPTION POSTS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS adoption_posts (
  id                   SERIAL PRIMARY KEY,
  pet_id               INTEGER REFERENCES pets(id) ON DELETE CASCADE,
  user_id              INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reason               TEXT,
  adoption_requirements TEXT,
  contact_preference   VARCHAR(100),
  status               VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'adopted', 'withdrawn')),
  is_active            BOOLEAN DEFAULT true,
  posted_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── POST COMMENTS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_comments (
  id           SERIAL PRIMARY KEY,
  post_id      INTEGER NOT NULL,
  post_type    VARCHAR(10) NOT NULL CHECK (post_type IN ('lost', 'found', 'rescue', 'adoption')),
  user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  report_count INTEGER DEFAULT 0,
  is_hidden    BOOLEAN DEFAULT false,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── COMMENT REPORTS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comment_reports (
  id         SERIAL PRIMARY KEY,
  comment_id INTEGER NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason     VARCHAR(20) NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'misinformation', 'other')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(comment_id, user_id)
);

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type              VARCHAR(50) NOT NULL CHECK (type IN ('comment_on_post', 'post_commented', 'post_reunited', 'follow', 'contact_request')),
  title             VARCHAR(255) NOT NULL,
  message           TEXT NOT NULL,
  related_post_id   INTEGER,
  related_post_type VARCHAR(10),
  actor_user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_read           BOOLEAN DEFAULT false,
  action_url        VARCHAR(255),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── CONTACT NOTIFICATIONS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_notifications (
  id              SERIAL PRIMARY KEY,
  notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
  post_id         INTEGER NOT NULL,
  post_type       VARCHAR(10) NOT NULL CHECK (post_type IN ('lost', 'found', 'rescue', 'adoption', 'pet')),
  sender_phone    VARCHAR(20) NOT NULL,
  message         TEXT NOT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── REFRESH TOKENS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── ACTIVITY LOGS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id                 SERIAL PRIMARY KEY,
  event_type         VARCHAR(50) NOT NULL,
  post_id            INTEGER,
  post_type          VARCHAR(20),
  pet_db_id          INTEGER,
  pet_uid            VARCHAR(20),
  pet_name           VARCHAR(100),
  pet_type           VARCHAR(20),
  pet_breed          VARCHAR(100),
  pet_gender         VARCHAR(10),
  pet_age            INTEGER,
  pet_color          VARCHAR(100),
  pet_weight         DECIMAL(5,2),
  potty_trained      BOOLEAN,
  user_id            INTEGER,
  location_name      TEXT,
  event_date         DATE,
  additional_details TEXT,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

CREATE INDEX IF NOT EXISTS idx_vets_user_id ON vets(user_id);
CREATE INDEX IF NOT EXISTS idx_vets_location ON vets(location_name);
CREATE INDEX IF NOT EXISTS idx_vets_approval_status ON vets(approval_status);
CREATE INDEX IF NOT EXISTS idx_vets_is_active ON vets(is_active);
CREATE INDEX IF NOT EXISTS idx_vets_name_trgm ON vets USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vets_address_trgm ON vets USING GIN (address gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vets_location_name_trgm ON vets USING GIN (location_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vets_name_claimable ON vets(name) WHERE status = 'unverified' AND claimed_by IS NULL;
CREATE INDEX IF NOT EXISTS idx_vets_contact_claimable ON vets(contact) WHERE status = 'unverified' AND claimed_by IS NULL;
CREATE INDEX IF NOT EXISTS idx_vets_email_claimable ON vets(email) WHERE status = 'unverified' AND claimed_by IS NULL AND email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_vet_id ON reviews(vet_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_vet_active ON reviews(vet_id, is_active);

CREATE INDEX IF NOT EXISTS idx_vet_qualifications_vet_id ON vet_qualifications(vet_id);
CREATE INDEX IF NOT EXISTS idx_vet_documents_vet_id ON vet_documents(vet_id);
CREATE INDEX IF NOT EXISTS idx_clinic_contacts_vet_id ON clinic_contacts(vet_id);
CREATE INDEX IF NOT EXISTS idx_clinic_vets_clinic_id ON clinic_vets(clinic_id);

CREATE INDEX IF NOT EXISTS idx_pets_user_id ON pets(user_id);
CREATE INDEX IF NOT EXISTS idx_pets_pet_id ON pets(pet_id);
CREATE INDEX IF NOT EXISTS idx_pets_is_active ON pets(is_active);
CREATE INDEX IF NOT EXISTS idx_pets_status ON pets(status);
CREATE INDEX IF NOT EXISTS idx_pets_is_for_adoption ON pets(is_for_adoption);

CREATE INDEX IF NOT EXISTS idx_lost_pets_pet_id ON lost_pet_reports(pet_id);
CREATE INDEX IF NOT EXISTS idx_lost_pets_created ON lost_pet_reports(reported_at);
CREATE INDEX IF NOT EXISTS idx_lost_pet_reports_is_found ON lost_pet_reports(is_found);

CREATE INDEX IF NOT EXISTS idx_found_pets_user_id ON found_pet_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_found_pets_created ON found_pet_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_found_pet_reports_status ON found_pet_reports(status);
CREATE INDEX IF NOT EXISTS idx_found_pet_reports_is_active ON found_pet_reports(is_active);

CREATE INDEX IF NOT EXISTS idx_rescue_posts_user_id ON rescue_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_rescue_posts_created ON rescue_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_rescue_posts_status ON rescue_posts(status);
CREATE INDEX IF NOT EXISTS idx_rescue_posts_is_active ON rescue_posts(is_active);

CREATE INDEX IF NOT EXISTS idx_adoption_posts_pet_id ON adoption_posts(pet_id);
CREATE INDEX IF NOT EXISTS idx_adoption_posts_user_id ON adoption_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_adoption_posts_posted ON adoption_posts(posted_at);
CREATE INDEX IF NOT EXISTS idx_adoption_posts_status ON adoption_posts(status);

CREATE INDEX IF NOT EXISTS idx_comments_post ON post_comments(post_id, post_type);
CREATE INDEX IF NOT EXISTS idx_comments_user ON post_comments(user_id);

CREATE INDEX IF NOT EXISTS idx_contact_notifications_post ON contact_notifications(post_id, post_type);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_created ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
-- token already has an implicit index from its UNIQUE constraint; no separate index needed

CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON activity_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);

-- Performance indexes (migration 1747000010000)
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

-- Data integrity constraints (migration 1747000011000)
DO $$ BEGIN
  ALTER TABLE vets ADD CONSTRAINT vets_avg_rating_check CHECK (avg_rating >= 0 AND avg_rating <= 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE vets ADD CONSTRAINT vets_approval_status_check CHECK (approval_status IN ('approved','rejected','pending'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS adoption_posts_pet_available_uniq
  ON adoption_posts(pet_id) WHERE status = 'available';

-- ─── TRIGGERS (auto updated_at) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_vets_updated_at ON vets;
CREATE TRIGGER trigger_vets_updated_at BEFORE UPDATE ON vets
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_reviews_updated_at ON reviews;
CREATE TRIGGER trigger_reviews_updated_at BEFORE UPDATE ON reviews
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_pets_updated_at ON pets;
CREATE TRIGGER trigger_pets_updated_at BEFORE UPDATE ON pets
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_rescue_posts_updated_at ON rescue_posts;
CREATE TRIGGER trigger_rescue_posts_updated_at BEFORE UPDATE ON rescue_posts
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_adoption_posts_updated_at ON adoption_posts;
CREATE TRIGGER trigger_adoption_posts_updated_at BEFORE UPDATE ON adoption_posts
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_vet_documents_updated_at ON vet_documents;
CREATE TRIGGER trigger_vet_documents_updated_at BEFORE UPDATE ON vet_documents
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_notifications_updated_at ON notifications;
CREATE TRIGGER trigger_notifications_updated_at BEFORE UPDATE ON notifications
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_clinic_vets_updated_at ON clinic_vets;
CREATE TRIGGER trigger_clinic_vets_updated_at BEFORE UPDATE ON clinic_vets
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

DROP TRIGGER IF EXISTS trigger_found_pet_reports_updated_at ON found_pet_reports;
CREATE TRIGGER trigger_found_pet_reports_updated_at BEFORE UPDATE ON found_pet_reports
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- ─── SEED DATA ───────────────────────────────────────────────────────────────
INSERT INTO users (name, phone, email, password, role, address)
VALUES (
  'Admin', '01700000000', 'pawlizbd@gmail.com',
  '$2a$10$rQZ8K5mYkl.VXZ2TnJXHZeZmEqBQ8K8Y9pM3Lz7vN2wX1uD4cF6Ky',
  'admin', 'Dhaka, Bangladesh'
) ON CONFLICT (phone) DO NOTHING;

INSERT INTO donations (title, message, qr_code_image_path)
VALUES (
  'Support Pawliz',
  'Your donation helps us provide better veterinary care to animals across Bangladesh. Every taka counts!',
  NULL
) ON CONFLICT DO NOTHING;

INSERT INTO site_settings (key, value) VALUES ('logo_text', 'Pawliz') ON CONFLICT (key) DO NOTHING;
INSERT INTO site_settings (key, value) VALUES ('logo_image', NULL) ON CONFLICT (key) DO NOTHING;
INSERT INTO site_settings (key, value) VALUES ('sms_enabled', 'true') ON CONFLICT (key) DO NOTHING;
INSERT INTO site_settings (key, value) VALUES ('admin_phone', '') ON CONFLICT (key) DO NOTHING;
