/**
 * One-shot fixer for double-encoded (cp1252 mojibake) Bengali text in
 * real-vets-data.json. The scraped data was UTF-8 bytes decoded as Windows-1252,
 * so Bengali renders as garbage like "à¦¢à¦¾à¦•à¦¾". This reverses it.
 *
 * Usage:  node backend/database/fix-bengali-encoding.js [--write]
 * Without --write it only reports; with --write it rewrites the JSON in place
 * (after backing up to real-vets-data.json.bak).
 */
const fs = require("fs");
const path = require("path");

// Reverse map for cp1252's 0x80-0x9F printable codepoints -> original byte.
const CP1252 = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85,
  0x2020: 0x86, 0x2021: 0x87, 0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a,
  0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91, 0x2019: 0x92,
  0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97,
  0x02dc: 0x98, 0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c,
  0x017e: 0x9e, 0x0178: 0x9f,
};

function fix(s) {
  if (typeof s !== "string") return s;
  const bytes = [...s].map((c) => {
    const cp = c.codePointAt(0);
    return CP1252[cp] !== undefined ? CP1252[cp] : cp;
  });
  // If any "byte" is outside 0-255 it wasn't latin1/cp1252 mojibake — leave as-is.
  if (bytes.some((b) => b > 0xff)) return s;
  try {
    const decoded = Buffer.from(bytes).toString("utf8");
    // Reject if decode introduced replacement chars but original had none.
    if (decoded.includes("�") && !s.includes("�")) return s;
    return decoded;
  } catch {
    return s;
  }
}

function fixDeep(v) {
  if (typeof v === "string") return fix(v);
  if (Array.isArray(v)) return v.map(fixDeep);
  if (v && typeof v === "object") {
    const out = {};
    for (const k of Object.keys(v)) out[k] = fixDeep(v[k]);
    return out;
  }
  return v;
}

const file = path.join(__dirname, "real-vets-data.json");
const raw = fs.readFileSync(file, "utf8");
const data = JSON.parse(raw.replace(/^﻿/, ""));
const fixed = fixDeep(data);

const before = JSON.stringify(data);
const after = JSON.stringify(fixed, null, 2);
const changed = before !== JSON.stringify(fixed);

// Sample report: rows whose name/address changed.
let changedCount = 0;
for (let i = 0; i < data.length; i++) {
  if (JSON.stringify(data[i]) !== JSON.stringify(fixed[i])) changedCount++;
}
console.log(`Rows: ${data.length}, changed: ${changedCount}`);
const residual = after.match(/[à-ÿ]{2,}/g);
console.log(`Residual mojibake-looking sequences: ${residual ? residual.length : 0}`);
console.log("Samples:");
[0, 2, 5, 50, 100].forEach((i) => {
  if (fixed[i]) console.log(`  [${i}] ${fixed[i].name} | ${fixed[i].address}`);
});

if (process.argv.includes("--write")) {
  if (changed) {
    fs.writeFileSync(file + ".bak", raw);
    fs.writeFileSync(file, after);
    console.log(`\nWrote fixed JSON. Backup: ${path.basename(file)}.bak`);
  } else {
    console.log("\nNo changes needed.");
  }
} else {
  console.log("\n(dry run — pass --write to apply)");
}
