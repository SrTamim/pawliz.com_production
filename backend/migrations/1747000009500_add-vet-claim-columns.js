// Adds the vet-claim workflow columns that the baseline migration never created
// but that the app (routes/vet-auth.js, routes/admin-vets.js) and schema.sql
// both depend on. Must run before 1747000010000_add-perf-indexes, which indexes
// vets.status and vets.claimed_by.
exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE vets ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'unverified';
    ALTER TABLE vets ADD COLUMN IF NOT EXISTS claimed_by INTEGER REFERENCES users(id);
    ALTER TABLE vets ADD COLUMN IF NOT EXISTS claim_requested_at TIMESTAMP;
    ALTER TABLE vets ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP;

    ALTER TABLE vets DROP CONSTRAINT IF EXISTS vets_status_check;
    ALTER TABLE vets ADD CONSTRAINT vets_status_check
      CHECK (status IN ('unverified', 'pending_claim', 'claimed'));

    -- seed-real-vets.js relies on ON CONFLICT ON CONSTRAINT vets_name_address_unique
    ALTER TABLE vets DROP CONSTRAINT IF EXISTS vets_name_address_unique;
    ALTER TABLE vets ADD CONSTRAINT vets_name_address_unique UNIQUE (name, address);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    ALTER TABLE vets DROP CONSTRAINT IF EXISTS vets_name_address_unique;
    ALTER TABLE vets DROP CONSTRAINT IF EXISTS vets_status_check;
    ALTER TABLE vets DROP COLUMN IF EXISTS claimed_at;
    ALTER TABLE vets DROP COLUMN IF EXISTS claim_requested_at;
    ALTER TABLE vets DROP COLUMN IF EXISTS claimed_by;
    ALTER TABLE vets DROP COLUMN IF EXISTS status;
  `);
};
