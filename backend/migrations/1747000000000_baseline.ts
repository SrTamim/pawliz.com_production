import type { MigrationBuilder } from 'node-pg-migrate';
'use strict';

export const shorthands = undefined;

export const up = (pgm: MigrationBuilder): void => {
  pgm.sql(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      phone VARCHAR(20) UNIQUE NOT NULL,
      email VARCHAR(150) UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'vet')),
      dob DATE,
      address TEXT,
      occupation VARCHAR(100),
      avatar VARCHAR(255),
      profile_picture VARCHAR(255),
      preferred_language VARCHAR(5) DEFAULT 'en',
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS vets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(200) NOT NULL,
      vet_type VARCHAR(20) DEFAULT 'individual',
      approval_status VARCHAR(20) DEFAULT 'approved',
      location_name VARCHAR(100),
      latitude DECIMAL(10,8),
      longitude DECIMAL(11,8),
      address TEXT,
      contact VARCHAR(50),
      email VARCHAR(150),
      website VARCHAR(255),
      image VARCHAR(255),
      cover_image VARCHAR(255),
      description TEXT,
      services TEXT[],
      designation VARCHAR(200),
      doc_reg_number VARCHAR(100),
      clinic_reg_number VARCHAR(100),
      chamber_name VARCHAR(200),
      checkup_start TIME,
      checkup_end TIME,
      weekly_holidays TEXT[],
      account_owner_name VARCHAR(200),
      rejection_reason TEXT,
      social_facebook VARCHAR(300),
      social_instagram VARCHAR(300),
      social_linkedin VARCHAR(300),
      social_whatsapp VARCHAR(50),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  pgm.sql(`
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
    )
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS donations (
      id SERIAL PRIMARY KEY,
      qr_code_image VARCHAR(255),
      message TEXT,
      title VARCHAR(200),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS site_settings (
      id SERIAL PRIMARY KEY,
      key VARCHAR(100) UNIQUE NOT NULL,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  pgm.sql(`
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
      qr_code TEXT,
      is_lost BOOLEAN DEFAULT false,
      is_for_adoption BOOLEAN DEFAULT false,
      status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'safe', 'lost')),
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  pgm.sql(`
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
    )
  `);

  pgm.sql(`
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
    )
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS post_comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL,
      post_type VARCHAR(10) NOT NULL CHECK (post_type IN ('lost', 'found', 'rescue', 'adoption')),
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      comment_text TEXT NOT NULL,
      report_count INTEGER DEFAULT 0,
      is_hidden BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE NOT NULL,
      type VARCHAR(50) NOT NULL CHECK (type IN ('comment_on_post', 'post_commented', 'post_reunited', 'follow')),
      title VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      related_post_id INTEGER,
      related_post_type VARCHAR(10),
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      is_read BOOLEAN DEFAULT false,
      action_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS comment_reports (
      id SERIAL PRIMARY KEY,
      comment_id INTEGER NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reason VARCHAR(20) NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'misinformation', 'other')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(comment_id, user_id)
    )
  `);

  pgm.sql(`
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
    )
  `);

  pgm.sql(`
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
    )
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL UNIQUE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  pgm.sql(`
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
    )
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS vet_qualifications (
      id SERIAL PRIMARY KEY,
      vet_id INTEGER REFERENCES vets(id) ON DELETE CASCADE NOT NULL,
      qualification VARCHAR(300) NOT NULL,
      institute VARCHAR(300),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS vet_documents (
      id SERIAL PRIMARY KEY,
      vet_id INTEGER REFERENCES vets(id) ON DELETE CASCADE NOT NULL,
      doc_type VARCHAR(50) NOT NULL,
      file_path VARCHAR(255) NOT NULL,
      original_name VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS clinic_contacts (
      id SERIAL PRIMARY KEY,
      vet_id INTEGER REFERENCES vets(id) ON DELETE CASCADE NOT NULL,
      contact_type VARCHAR(20) DEFAULT 'phone',
      contact_value VARCHAR(150) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  pgm.sql(`
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
    )
  `);

  pgm.sql(`
    CREATE TABLE IF NOT EXISTS clinic_vet_qualifications (
      id SERIAL PRIMARY KEY,
      clinic_vet_id INTEGER REFERENCES clinic_vets(id) ON DELETE CASCADE NOT NULL,
      qualification VARCHAR(300) NOT NULL,
      institute VARCHAR(300),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Indexes
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_reviews_vet_id ON reviews(vet_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_vets_location ON vets(location_name)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_pets_user_id ON pets(user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_pets_pet_id ON pets(pet_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_lost_pets_pet_id ON lost_pet_reports(pet_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_lost_pets_created ON lost_pet_reports(reported_at)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_found_pets_user_id ON found_pet_reports(user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_found_pets_created ON found_pet_reports(created_at)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_comments_post ON post_comments(post_id, post_type)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_comments_user ON post_comments(user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_rescue_posts_user_id ON rescue_posts(user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_rescue_posts_created ON rescue_posts(created_at)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_adoption_posts_pet_id ON adoption_posts(pet_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_adoption_posts_posted ON adoption_posts(posted_at)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_pets_is_for_adoption ON pets(is_for_adoption)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_activity_logs_event_type ON activity_logs(event_type)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_vets_user_id ON vets(user_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_vets_approval_status ON vets(approval_status)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_vets_is_active ON vets(is_active)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_pets_is_active ON pets(is_active)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_pets_status ON pets(status)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_lost_pet_reports_is_found ON lost_pet_reports(is_found)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_found_pet_reports_status ON found_pet_reports(status)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_found_pet_reports_is_active ON found_pet_reports(is_active)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_rescue_posts_status ON rescue_posts(status)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_rescue_posts_is_active ON rescue_posts(is_active)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_adoption_posts_status ON adoption_posts(status)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_vet_qualifications_vet_id ON vet_qualifications(vet_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_vet_documents_vet_id ON vet_documents(vet_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_clinic_contacts_vet_id ON clinic_contacts(vet_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_clinic_vets_clinic_id ON clinic_vets(clinic_id)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_vets_name_trgm ON vets USING GIN (name gin_trgm_ops)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_vets_address_trgm ON vets USING GIN (address gin_trgm_ops)`);
  pgm.sql(`CREATE INDEX IF NOT EXISTS idx_vets_location_name_trgm ON vets USING GIN (location_name gin_trgm_ops)`);

  // Seed data
  pgm.sql(`
    INSERT INTO users (name, phone, email, password, role, address)
    VALUES (
      'Admin', '01700000000', 'pawlizbd@gmail.com',
      '$2a$10$rQZ8K5mYkl.VXZ2TnJXHZeZmEqBQ8K8Y9pM3Lz7vN2wX1uD4cF6Ky',
      'admin', 'Dhaka, Bangladesh'
    ) ON CONFLICT (phone) DO NOTHING
  `);

  pgm.sql(`
    INSERT INTO donations (title, message, qr_code_image)
    VALUES (
      'Support Pawliz',
      'Your donation helps us provide better veterinary care to animals across Bangladesh. Every taka counts!',
      NULL
    ) ON CONFLICT DO NOTHING
  `);

  pgm.sql(`INSERT INTO site_settings (key, value) VALUES ('logo_text', 'Pawliz') ON CONFLICT (key) DO NOTHING`);
  pgm.sql(`INSERT INTO site_settings (key, value) VALUES ('logo_image', NULL) ON CONFLICT (key) DO NOTHING`);
};

export const down = (pgm: MigrationBuilder): void => {
  pgm.sql(`DROP TABLE IF EXISTS clinic_vet_qualifications CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS clinic_vets CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS clinic_contacts CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS vet_documents CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS vet_qualifications CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS activity_logs CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS refresh_tokens CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS adoption_posts CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS rescue_posts CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS comment_reports CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS post_comments CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS notifications CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS found_pet_reports CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS lost_pet_reports CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS pets CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS site_settings CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS donations CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS reviews CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS vets CASCADE`);
  pgm.sql(`DROP TABLE IF EXISTS users CASCADE`);
};
