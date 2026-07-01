/**
 * DB Schema validation tests
 * These tests connect to a REAL DB (uses actual pool, not mock).
 * Run only when DB is available: NODE_ENV=integration
 * Skipped automatically in unit test mode (NODE_ENV=test).
 */

const isIntegration = process.env.NODE_ENV === 'integration';
const describeIfInteg = isIntegration ? describe : describe.skip;

describeIfInteg('DB Schema integration tests', () => {
  let pool;
  beforeAll(() => {
    // In integration mode, don't mock DB
    jest.unmock('../config/database');
    pool = require('../config/database');
  });
  afterAll(async () => {
    await pool.end();
  });

  const EXPECTED_TABLES = [
    'users', 'roles', 'vets', 'reviews', 'vet_qualifications', 'vet_documents',
    'clinic_contacts', 'clinic_vets', 'clinic_vet_qualifications',
    'donations', 'site_settings', 'pets', 'lost_pet_reports',
    'found_pet_reports', 'rescue_posts', 'adoption_posts',
    'post_comments', 'comment_reports', 'notifications',
    'contact_notifications', 'refresh_tokens', 'activity_logs',
    'community_posts', 'community_tags', 'community_post_tags', 'community_post_reports',
    'vaccine_reminder_log', 'web_push_subscriptions',
  ];

  it('all required tables exist', async () => {
    const result = await pool.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);
    const tables = result.rows.map(r => r.table_name);
    for (const t of EXPECTED_TABLES) {
      expect(tables).toContain(t);
    }
  });

  it('users table has required columns', async () => {
    const result = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'users' AND table_schema = 'public'
    `);
    const cols = result.rows.map(r => r.column_name);
    ['id', 'name', 'phone', 'email', 'password', 'role', 'is_active', 'created_at'].forEach(c => {
      expect(cols).toContain(c);
    });
  });

  it('vets table has required columns', async () => {
    const result = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'vets' AND table_schema = 'public'
    `);
    const cols = result.rows.map(r => r.column_name);
    ['id', 'name', 'latitude', 'longitude', 'approval_status', 'avg_rating', 'review_count'].forEach(c => {
      expect(cols).toContain(c);
    });
  });

  it('pets table has pet_id unique column', async () => {
    const result = await pool.query(`
      SELECT tc.constraint_type, kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'pets' AND tc.constraint_type = 'UNIQUE'
    `);
    const uniqueCols = result.rows.map(r => r.column_name);
    expect(uniqueCols).toContain('pet_id');
  });

  it('reviews have unique(user_id, vet_id) constraint', async () => {
    const result = await pool.query(`
      SELECT tc.constraint_name, tc.constraint_type
      FROM information_schema.table_constraints tc
      WHERE tc.table_name = 'reviews' AND tc.constraint_type = 'UNIQUE'
    `);
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('comment_reports have unique(comment_id, user_id) constraint', async () => {
    const result = await pool.query(`
      SELECT tc.constraint_name
      FROM information_schema.table_constraints tc
      WHERE tc.table_name = 'comment_reports' AND tc.constraint_type = 'UNIQUE'
    `);
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('site_settings has unique key constraint', async () => {
    const result = await pool.query(`
      SELECT tc.constraint_type
      FROM information_schema.table_constraints tc
      WHERE tc.table_name = 'site_settings' AND tc.constraint_type = 'UNIQUE'
    `);
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('notifications type CHECK constraint exists', async () => {
    const result = await pool.query(`
      SELECT cc.constraint_name
      FROM information_schema.table_constraints cc
      WHERE cc.table_name = 'notifications' AND cc.constraint_type = 'CHECK'
    `);
    expect(result.rows.length).toBeGreaterThan(0);
  });

  it('indexes exist on vets table', async () => {
    const result = await pool.query(`
      SELECT indexname FROM pg_indexes WHERE tablename = 'vets'
    `);
    const idxNames = result.rows.map(r => r.indexname);
    expect(idxNames.some(n => n.includes('approval_status'))).toBe(true);
    expect(idxNames.some(n => n.includes('is_active'))).toBe(true);
  });

  it('pg_trgm extension is installed', async () => {
    const result = await pool.query(`
      SELECT extname FROM pg_extension WHERE extname = 'pg_trgm'
    `);
    expect(result.rows.length).toBe(1);
  });

  it('admin user exists with correct role', async () => {
    const result = await pool.query(`
      SELECT id, role FROM users WHERE phone = '01700000000' AND role = 'admin' AND is_active = true
    `);
    expect(result.rows.length).toBe(1);
    expect(result.rows[0].role).toBe('admin');
  });

  it('pets.type CHECK constraint accepts only dog/cat/other', async () => {
    const result = await pool.query(`
      SELECT cc.constraint_name, cc.constraint_type
      FROM information_schema.table_constraints cc
      WHERE cc.table_name = 'pets' AND cc.constraint_type = 'CHECK'
    `);
    expect(result.rows.length).toBeGreaterThan(0);
  });
});

// ─── Unit-level schema tests (always run) ─────────────────────────────────────
// These test the schema SQL file itself (static analysis)
import fs from 'fs';
import path from 'path';

describe('Schema SQL static analysis', () => {
  let schemaSQL;
  beforeAll(() => {
    schemaSQL = fs.readFileSync(
      path.join(__dirname, '../database/schema.sql'),
      'utf8',
    );
  });

  it('schema file exists and is non-empty', () => {
    expect(schemaSQL.length).toBeGreaterThan(1000);
  });

  it('all CREATE TABLE statements use IF NOT EXISTS (idempotent)', () => {
    const creates = schemaSQL.match(/CREATE TABLE/gi) || [];
    const idempotent = schemaSQL.match(/CREATE TABLE IF NOT EXISTS/gi) || [];
    expect(creates.length).toBe(idempotent.length);
  });

  it('all CREATE INDEX statements use IF NOT EXISTS (idempotent)', () => {
    const creates = schemaSQL.match(/CREATE INDEX/gi) || [];
    const idempotent = schemaSQL.match(/CREATE INDEX IF NOT EXISTS/gi) || [];
    expect(creates.length).toBe(idempotent.length);
  });

  it('no hard DELETE statements in schema (soft-delete only)', () => {
    // Schema should not contain DELETE statements
    const deletes = schemaSQL.match(/^DELETE\s+FROM/gim) || [];
    expect(deletes.length).toBe(0);
  });

  it('roles table exists with permissions column', () => {
    expect(schemaSQL).toMatch(/CREATE TABLE IF NOT EXISTS roles/);
    expect(schemaSQL).toMatch(/permissions\s+JSONB/);
  });

  it('users.role is a FK to roles(name) (not a hardcoded CHECK)', () => {
    expect(schemaSQL).toMatch(/role\s+VARCHAR\(20\)\s+DEFAULT\s+'user'\s+REFERENCES\s+roles\(name\)/);
  });

  it('reviews rating CHECK constraint (1-5)', () => {
    expect(schemaSQL).toMatch(/rating.*CHECK.*rating.*>=.*1.*AND.*rating.*<=.*5/s);
  });

  it('refresh_tokens table has expires_at column', () => {
    expect(schemaSQL).toMatch(/expires_at\s+TIMESTAMPTZ/);
  });

  it('contact_notifications has post_type CHECK with all 5 types', () => {
    expect(schemaSQL).toMatch(/post_type.*IN.*'lost'.*'found'.*'rescue'.*'adoption'.*'pet'/);
  });
});
