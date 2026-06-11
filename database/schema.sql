-- Pawliz Database Schema â€” HISTORICAL REFERENCE ONLY
-- Superseded by node-pg-migrate. Run: npm run migrate (from backend/)
-- New changes: npm run migrate:create -- <name>  then edit the generated file in backend/migrations/

-- Create database (run separately if needed)
-- CREATE DATABASE pawliz;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  email VARCHAR(150) UNIQUE,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  dob DATE,
  address TEXT,
  avatar VARCHAR(255),
  profile_picture VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_sound_paused BOOLEAN DEFAULT false;

-- Vets table
CREATE TABLE IF NOT EXISTS vets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  location_name VARCHAR(100) NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT NOT NULL,
  contact VARCHAR(50),
  email VARCHAR(150),
  website VARCHAR(255),
  image VARCHAR(255),
  description TEXT,
  services TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  vet_id INTEGER REFERENCES vets(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, vet_id)
);

-- Donations table
CREATE TABLE IF NOT EXISTS donations (
  id SERIAL PRIMARY KEY,
  qr_code_image VARCHAR(255),
  message TEXT,
  title VARCHAR(200),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Site settings table
CREATE TABLE IF NOT EXISTS site_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default admin user (created via backend seed.js, no hardcoded password) 

-- Insert default donation info
INSERT INTO donations (title, message, qr_code_image)
VALUES (
  'Support Pawliz',
  'Your donation helps us provide better veterinary care to animals across Bangladesh. Every taka counts!',
  NULL
) ON CONFLICT DO NOTHING;

-- Insert default site settings
INSERT INTO site_settings (key, value) VALUES ('logo_text', 'Pawliz') ON CONFLICT (key) DO NOTHING;
INSERT INTO site_settings (key, value) VALUES ('logo_image', NULL) ON CONFLICT (key) DO NOTHING;

-- Pets table
CREATE TABLE IF NOT EXISTS pets (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  pet_id VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('dog', 'cat', 'other')),
  breed VARCHAR(100),
  gender VARCHAR(10) CHECK (gender IN ('male', 'female')),
  age INTEGER,
  color VARCHAR(100),
  weight DECIMAL(5,2),
  vaccination_status VARCHAR(50),
  last_vaccination_date DATE,
  next_vaccination_date DATE,
  medical_conditions TEXT,
  allergies TEXT,
  current_medicines TEXT,
  temperament VARCHAR(20) CHECK (temperament IN ('friendly', 'aggressive', 'shy', 'bites')),
  potty_trained BOOLEAN,
  knows_commands BOOLEAN,
  good_with_strangers BOOLEAN,
  good_with_kids BOOLEAN,
  good_with_pets BOOLEAN,
  special_notes TEXT,
  images JSONB,
  is_lost BOOLEAN DEFAULT false,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'safe', 'lost')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Lost pet reports table
CREATE TABLE IF NOT EXISTS lost_pet_reports (
  id SERIAL PRIMARY KEY,
  pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
  lost_date DATE NOT NULL,
  lost_location_name TEXT,
  lost_latitude DECIMAL(10,8),
  lost_longitude DECIMAL(11,8),
  additional_details TEXT,
  is_found BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  reported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Found pet reports table
CREATE TABLE IF NOT EXISTS found_pet_reports (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  pet_type VARCHAR(20) NOT NULL CHECK (pet_type IN ('dog', 'cat', 'other')),
  color TEXT,
  gender VARCHAR(10),
  breed VARCHAR(100),
  found_location_name TEXT,
  found_latitude DECIMAL(10,8),
  found_longitude DECIMAL(11,8),
  found_date DATE NOT NULL,
  images JSONB,
  description TEXT,
  contact_info TEXT,
  status VARCHAR(20) DEFAULT 'found' CHECK (status IN ('found', 'resolved')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Comments table (for both lost and found posts)
CREATE TABLE IF NOT EXISTS post_comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL,
  post_type VARCHAR(10) NOT NULL CHECK (post_type IN ('lost', 'found')),
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type VARCHAR(50) NOT NULL CHECK (type IN ('comment_on_post', 'post_commented', 'post_reunited', 'follow', 'contact_request')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  related_post_id INTEGER,
  related_post_type VARCHAR(10),
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  action_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact_notifications (
  id SERIAL PRIMARY KEY,
  notification_id INTEGER REFERENCES notifications(id) ON DELETE CASCADE,
  post_id INTEGER NOT NULL,
  post_type VARCHAR(10) NOT NULL CHECK (post_type IN ('lost', 'found', 'rescue', 'adoption', 'pet')),
  sender_phone VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_contact_notifications_post ON contact_notifications(post_id, post_type);

-- Add occupation column to users if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='occupation') THEN
    ALTER TABLE users ADD COLUMN occupation VARCHAR(100);
  END IF;
END $$;

-- Add is_for_adoption column to pets if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='is_for_adoption') THEN
    ALTER TABLE pets ADD COLUMN is_for_adoption BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Add is_active column to lost_pet_reports if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='lost_pet_reports' AND column_name='is_active') THEN
    ALTER TABLE lost_pet_reports ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Add is_active column to adoption_posts if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='adoption_posts' AND column_name='is_active') THEN
    ALTER TABLE adoption_posts ADD COLUMN is_active BOOLEAN DEFAULT true;
  END IF;
END $$;

-- Add report_count column to post_comments if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='post_comments' AND column_name='report_count') THEN
    ALTER TABLE post_comments ADD COLUMN report_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Add is_hidden column to post_comments if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='post_comments' AND column_name='is_hidden') THEN
    ALTER TABLE post_comments ADD COLUMN is_hidden BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Comment reports (one report per user per comment)
CREATE TABLE IF NOT EXISTS comment_reports (
  id SERIAL PRIMARY KEY,
  comment_id INTEGER NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(20) NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'misinformation', 'other')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(comment_id, user_id)
);

-- Rescue posts table (stray/injured animal reports - no linked registered pet)
CREATE TABLE IF NOT EXISTS rescue_posts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  pet_type VARCHAR(20) NOT NULL CHECK (pet_type IN ('dog', 'cat', 'other')),
  color TEXT,
  gender VARCHAR(10),
  breed VARCHAR(100),
  rescue_location_name TEXT,
  rescue_latitude DECIMAL(10,8),
  rescue_longitude DECIMAL(11,8),
  rescue_date DATE NOT NULL,
  images JSONB,
  description TEXT,
  contact_info TEXT,
  urgency VARCHAR(20) DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'critical')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'rescued', 'resolved')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Adoption posts table (registered pets marked for adoption)
CREATE TABLE IF NOT EXISTS adoption_posts (
  id SERIAL PRIMARY KEY,
  pet_id INTEGER REFERENCES pets(id) ON DELETE CASCADE,
  reason TEXT,
  adoption_requirements TEXT,
  contact_preference VARCHAR(100),
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'adopted', 'withdrawn')),
  is_active BOOLEAN DEFAULT true,
  posted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Extend post_comments to support rescue and adoption post types
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'post_comments_post_type_check') THEN
    ALTER TABLE post_comments DROP CONSTRAINT post_comments_post_type_check;
    ALTER TABLE post_comments ADD CONSTRAINT post_comments_post_type_check
      CHECK (post_type IN ('lost', 'found', 'rescue', 'adoption'));
  END IF;
END $$;

-- Refresh tokens table for multi-device auth
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

-- Activity logs for audit trail
-- user_id FK only â€” join users at query time for current name/phone/email
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL,
  post_id INTEGER,
  post_type VARCHAR(20),
  pet_db_id INTEGER,
  pet_uid VARCHAR(20),
  pet_name VARCHAR(100),
  pet_type VARCHAR(20),
  pet_breed VARCHAR(100),
  pet_gender VARCHAR(10),
  pet_age INTEGER,
  pet_color VARCHAR(100),
  pet_weight DECIMAL(5,2),
  potty_trained BOOLEAN,
  user_id INTEGER,
  location_name TEXT,
  event_date DATE,
  additional_details TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Drop stale user-data columns copied at log time (user data must be joined, not snapshotted)
ALTER TABLE activity_logs DROP COLUMN IF EXISTS user_name;
ALTER TABLE activity_logs DROP COLUMN IF EXISTS user_phone;
ALTER TABLE activity_logs DROP COLUMN IF EXISTS user_email;

-- â”€â”€â”€ VET/CLINIC SELF-REGISTRATION EXTENSION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- Extend users role to include 'vet'
DO $$ BEGIN
  ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'vet'));
EXCEPTION WHEN others THEN NULL; END $$;

-- Extend vets table for self-registration
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='user_id') THEN
    ALTER TABLE vets ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='vet_type') THEN
    ALTER TABLE vets ADD COLUMN vet_type VARCHAR(20) DEFAULT 'individual';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='approval_status') THEN
    ALTER TABLE vets ADD COLUMN approval_status VARCHAR(20) DEFAULT 'approved';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='cover_image') THEN
    ALTER TABLE vets ADD COLUMN cover_image VARCHAR(255);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='designation') THEN
    ALTER TABLE vets ADD COLUMN designation VARCHAR(200);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='doc_reg_number') THEN
    ALTER TABLE vets ADD COLUMN doc_reg_number VARCHAR(100);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='checkup_start') THEN
    ALTER TABLE vets ADD COLUMN checkup_start TIME;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='checkup_end') THEN
    ALTER TABLE vets ADD COLUMN checkup_end TIME;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='weekly_holidays') THEN
    ALTER TABLE vets ADD COLUMN weekly_holidays TEXT[];
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='account_owner_name') THEN
    ALTER TABLE vets ADD COLUMN account_owner_name VARCHAR(200);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='rejection_reason') THEN
    ALTER TABLE vets ADD COLUMN rejection_reason TEXT;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='clinic_reg_number') THEN
    ALTER TABLE vets ADD COLUMN clinic_reg_number VARCHAR(100);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='chamber_name') THEN
    ALTER TABLE vets ADD COLUMN chamber_name VARCHAR(200);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='social_facebook') THEN
    ALTER TABLE vets ADD COLUMN social_facebook VARCHAR(300);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='social_instagram') THEN
    ALTER TABLE vets ADD COLUMN social_instagram VARCHAR(300);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='social_linkedin') THEN
    ALTER TABLE vets ADD COLUMN social_linkedin VARCHAR(300);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='vets' AND column_name='social_whatsapp') THEN
    ALTER TABLE vets ADD COLUMN social_whatsapp VARCHAR(50);
  END IF;
END $$;

-- Make location fields nullable (self-registered vets fill these in dashboard)
DO $$ BEGIN
  ALTER TABLE vets ALTER COLUMN location_name DROP NOT NULL;
  ALTER TABLE vets ALTER COLUMN latitude DROP NOT NULL;
  ALTER TABLE vets ALTER COLUMN longitude DROP NOT NULL;
  ALTER TABLE vets ALTER COLUMN address DROP NOT NULL;
EXCEPTION WHEN others THEN NULL; END $$;

-- Vet qualifications (for individual vets)
CREATE TABLE IF NOT EXISTS vet_qualifications (
  id SERIAL PRIMARY KEY,
  vet_id INTEGER REFERENCES vets(id) ON DELETE CASCADE NOT NULL,
  qualification VARCHAR(300) NOT NULL,
  institute VARCHAR(300),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Vet uploaded documents (certificates, etc.)
CREATE TABLE IF NOT EXISTS vet_documents (
  id SERIAL PRIMARY KEY,
  vet_id INTEGER REFERENCES vets(id) ON DELETE CASCADE NOT NULL,
  doc_type VARCHAR(50) NOT NULL,
  file_path VARCHAR(255) NOT NULL,
  original_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clinic contact details (multiple per clinic)
CREATE TABLE IF NOT EXISTS clinic_contacts (
  id SERIAL PRIMARY KEY,
  vet_id INTEGER REFERENCES vets(id) ON DELETE CASCADE NOT NULL,
  contact_type VARCHAR(20) DEFAULT 'phone',
  contact_value VARCHAR(150) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual vets working at a clinic
CREATE TABLE IF NOT EXISTS clinic_vets (
  id SERIAL PRIMARY KEY,
  clinic_id INTEGER REFERENCES vets(id) ON DELETE CASCADE NOT NULL,
  vet_image VARCHAR(255),
  name VARCHAR(200) NOT NULL,
  designation VARCHAR(200),
  doc_reg_number VARCHAR(100),
  checkup_start TIME,
  checkup_end TIME,
  weekly_holidays TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Qualifications for clinic's vets
CREATE TABLE IF NOT EXISTS clinic_vet_qualifications (
  id SERIAL PRIMARY KEY,
  clinic_vet_id INTEGER REFERENCES clinic_vets(id) ON DELETE CASCADE NOT NULL,
  qualification VARCHAR(300) NOT NULL,
  institute VARCHAR(300),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_reviews_vet_id ON reviews(vet_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_vets_location ON vets(location_name);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_pets_user_id ON pets(user_id);
CREATE INDEX IF NOT EXISTS idx_pets_pet_id ON pets(pet_id);
CREATE INDEX IF NOT EXISTS idx_lost_pets_pet_id ON lost_pet_reports(pet_id);
CREATE INDEX IF NOT EXISTS idx_lost_pets_created ON lost_pet_reports(reported_at);
CREATE INDEX IF NOT EXISTS idx_found_pets_user_id ON found_pet_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_found_pets_created ON found_pet_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_comments_post ON post_comments(post_id, post_type);
CREATE INDEX IF NOT EXISTS idx_comments_user ON post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_rescue_posts_user_id ON rescue_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_rescue_posts_created ON rescue_posts(created_at);
CREATE INDEX IF NOT EXISTS idx_adoption_posts_pet_id ON adoption_posts(pet_id);
CREATE INDEX IF NOT EXISTS idx_adoption_posts_posted ON adoption_posts(posted_at);
CREATE INDEX IF NOT EXISTS idx_pets_is_for_adoption ON pets(is_for_adoption);
CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON activity_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_vets_user_id ON vets(user_id);
CREATE INDEX IF NOT EXISTS idx_vets_approval_status ON vets(approval_status);
CREATE INDEX IF NOT EXISTS idx_vets_is_active ON vets(is_active);
CREATE INDEX IF NOT EXISTS idx_pets_is_active ON pets(is_active);
CREATE INDEX IF NOT EXISTS idx_pets_status ON pets(status);
CREATE INDEX IF NOT EXISTS idx_lost_pet_reports_is_found ON lost_pet_reports(is_found);
CREATE INDEX IF NOT EXISTS idx_found_pet_reports_status ON found_pet_reports(status);
CREATE INDEX IF NOT EXISTS idx_found_pet_reports_is_active ON found_pet_reports(is_active);
CREATE INDEX IF NOT EXISTS idx_rescue_posts_status ON rescue_posts(status);
CREATE INDEX IF NOT EXISTS idx_rescue_posts_is_active ON rescue_posts(is_active);
CREATE INDEX IF NOT EXISTS idx_adoption_posts_status ON adoption_posts(status);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_vet_qualifications_vet_id ON vet_qualifications(vet_id);
CREATE INDEX IF NOT EXISTS idx_vet_documents_vet_id ON vet_documents(vet_id);
CREATE INDEX IF NOT EXISTS idx_clinic_contacts_vet_id ON clinic_contacts(vet_id);
CREATE INDEX IF NOT EXISTS idx_clinic_vets_clinic_id ON clinic_vets(clinic_id);

-- Migrate images columns from TEXT to JSONB (idempotent)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='pets' AND column_name='images' AND data_type='text') THEN
    ALTER TABLE pets ALTER COLUMN images TYPE JSONB USING CASE WHEN images IS NULL THEN NULL ELSE images::jsonb END;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='found_pet_reports' AND column_name='images' AND data_type='text') THEN
    ALTER TABLE found_pet_reports ALTER COLUMN images TYPE JSONB USING CASE WHEN images IS NULL THEN NULL ELSE images::jsonb END;
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rescue_posts' AND column_name='images' AND data_type='text') THEN
    ALTER TABLE rescue_posts ALTER COLUMN images TYPE JSONB USING CASE WHEN images IS NULL THEN NULL ELSE images::jsonb END;
  END IF;
END $$;

-- Trigram indexes for fast vet search (leading-wildcard ILIKE)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_vets_name_trgm ON vets USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vets_address_trgm ON vets USING GIN (address gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vets_location_name_trgm ON vets USING GIN (location_name gin_trgm_ops);
