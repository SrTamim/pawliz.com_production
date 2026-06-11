/**
 * Seed real vet data scraped from Google Maps into the vets table.
 * Reads: backend/database/real-vets-data.json
 *
 * Usage (dev):  node backend/database/seed-real-vets.js
 * Usage (prod): DATABASE_URL=postgres://... node backend/database/seed-real-vets.js
 *
 * Safe to re-run — uses ON CONFLICT DO NOTHING based on (name, address).
 * Does NOT touch existing seed.js data.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { Pool } = require("pg");
const path = require("path");
const fs = require("fs");

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
    })
  : require("../config/database");

async function seedRealVets() {
  // Prefer filtered (closed/stale removed) over raw scraped data
  const filteredPath = path.join(__dirname, "real-vets-data.json");
  const dataPath = filteredPath;

  if (!fs.existsSync(dataPath)) {
    console.error("❌ real-vets-data.json not found at", dataPath);
    console.error("   Workflow: scrape → filter → copy filtered-vets.json here as real-vets-data.json");
    process.exit(1);
  }

  const vets = JSON.parse(fs.readFileSync(dataPath, "utf8"));
  console.log(`🌱 Seeding ${vets.length} real vets from Google Maps data...`);

  const client = await pool.connect();
  let inserted = 0;
  let skipped = 0;

  try {
    await client.query("BEGIN");

    for (const vet of vets) {
      // Skip entries with no name or coordinates
      if (!vet.name || vet.latitude === null || vet.longitude === null) {
        skipped++;
        continue;
      }

      const result = await client.query(
        `INSERT INTO vets (
          name, vet_type, approval_status,
          location_name, latitude, longitude,
          address, contact, email, website,
          image, description, services,
          checkup_start, checkup_end,
          is_active
        ) VALUES (
          $1, $2, $3,
          $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13,
          $14, $15,
          $16
        )
        ON CONFLICT ON CONSTRAINT vets_name_address_unique DO NOTHING
        RETURNING id`,
        [
          vet.name,
          vet.vet_type || "clinic",
          "pending",
          vet.location_name || null,
          vet.latitude,
          vet.longitude,
          vet.address || null,
          vet.contact || null,
          vet.email || null,
          vet.website || null,
          vet.image || null,
          vet.description || null,
          vet.services && vet.services.length > 0 ? vet.services : null,
          vet.checkup_start || null,
          vet.checkup_end || null,
          true,
        ]
      );

      if (result.rowCount > 0) {
        inserted++;
      } else {
        skipped++;
      }
    }

    await client.query("COMMIT");

    // Reset sequence
    await client.query(
      `SELECT setval('vets_id_seq', (SELECT COALESCE(MAX(id), 0) FROM vets))`
    );

    console.log(`✅ Inserted: ${inserted} vets`);
    console.log(`⏭️  Skipped (duplicate/incomplete): ${skipped}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Seed failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedRealVets();
