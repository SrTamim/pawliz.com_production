require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
import { Pool } from 'pg';

const DRY_RUN = process.argv.includes("--dry-run");

const BENGALI_COLUMNS = [
  "name", "location_name", "address", "description",
  "designation", "chamber_name", "account_owner_name",
];

const sourcePool = new Pool({
  host: "localhost",
  port: 5432,
  database: "pawcare_bd",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
});

const targetPool = new Pool({
  host: "localhost",
  port: 5432,
  database: "pawliz",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD,
});

async function run() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no changes committed)" : "LIVE"}`);
  const src = await sourcePool.connect();
  const tgt = await targetPool.connect();
  try {
    const srcRows = (
      await src.query(`SELECT id, ${BENGALI_COLUMNS.join(", ")} FROM vets ORDER BY id`)
    ).rows;
    const tgtMap = new Map(
      (await tgt.query(`SELECT id, ${BENGALI_COLUMNS.join(", ")} FROM vets ORDER BY id`)).rows.map(
        (r) => [r.id, r]
      )
    );

    const toUpdate = srcRows.filter((s) =>
      BENGALI_COLUMNS.some((c) => s[c] !== tgtMap.get(s.id)?.[c])
    );

    console.log(`Source rows: ${srcRows.length} | Rows needing update: ${toUpdate.length}`);

    if (toUpdate.length === 0) {
      console.log("Nothing to update. Exiting.");
      return;
    }

    await tgt.query("BEGIN");
    for (const row of toUpdate) {
      const sets = BENGALI_COLUMNS.map((c, i) => `${c} = $${i + 1}`).join(", ");
      await tgt.query(
        `UPDATE vets SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = $${BENGALI_COLUMNS.length + 1}`,
        [...BENGALI_COLUMNS.map((c) => row[c]), row.id]
      );
    }

    if (DRY_RUN) {
      await tgt.query("ROLLBACK");
      console.log(`DRY RUN: would update ${toUpdate.length} rows. Rolled back.`);
    } else {
      await tgt.query("COMMIT");
      console.log(`SUCCESS: updated ${toUpdate.length} rows in pawliz.vets`);
    }
  } catch (e) {
    await tgt.query("ROLLBACK").catch(() => {});
    console.error("FAILED — rolled back:", (e as Error).message);
    process.exit(1);
  } finally {
    src.release();
    tgt.release();
    await sourcePool.end();
    await targetPool.end();
  }
}

run();
