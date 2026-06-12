import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
});

(async () => {
  const upd = await pool.query(
    "UPDATE vets SET approval_status = 'approved', is_active = true WHERE approval_status = 'pending' OR approval_status IS NULL OR is_active = false"
  );
  console.log("rows updated:", upd.rowCount);

  const chk = await pool.query(
    "SELECT count(*) AS map_visible FROM vets WHERE is_active = true AND approval_status = 'approved' AND latitude IS NOT NULL AND longitude IS NOT NULL"
  );
  console.log("map_visible now:", chk.rows[0].map_visible);

  await pool.end();
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
