-- This script will DROP and RECREATE all tables
-- ⚠️ WARNING: Use this only if you want to reset the database completely (loses all data)
-- For adding columns to existing tables, use migrate_add_columns.sql instead

-- Drop all tables (preserving dependencies)
DROP TABLE IF EXISTS post_comments CASCADE;
DROP TABLE IF EXISTS found_pet_reports CASCADE;
DROP TABLE IF EXISTS lost_pet_reports CASCADE;
DROP TABLE IF EXISTS reviews CASCADE;
DROP TABLE IF EXISTS donations CASCADE;
DROP TABLE IF EXISTS site_settings CASCADE;
DROP TABLE IF EXISTS pets CASCADE;
DROP TABLE IF EXISTS vets CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Now run schema.sql to recreate tables from scratch
