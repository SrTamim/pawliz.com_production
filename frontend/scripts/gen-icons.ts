// One-shot icon generator from public/logo.svg → raster PWA/favicon assets.
// Run: npx tsx scripts/gen-icons.ts
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const pub = join(process.cwd(), "public");
const svg = readFileSync(join(pub, "logo.svg"));

// Plain (edge-to-edge) raster sizes: favicons, apple-touch, og.
const plain = [
  ["favicon-16.png", 16],
  ["favicon-32.png", 32],
  ["favicon-48.png", 48],
  ["apple-touch-icon.png", 180],
];

// Maskable PWA icons: shrink logo into ~80% safe zone, transparent padding,
// so Android circle/squircle masks never clip the rounded-rect corners.
const maskable = [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
];

for (const [name, size] of plain as [string, number][]) {
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(join(pub, name));
  console.log("wrote", name, `${size}x${size}`);
}

for (const [name, size] of maskable as [string, number][]) {
  const inner = Math.round(size * 0.8);
  const pad = Math.round((size - inner) / 2);
  const logo = await sharp(svg, { density: 384 }).resize(inner, inner).png().toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4 as const, background: { r: 16, g: 185, b: 129, alpha: 1 } },
  })
    .composite([{ input: logo, top: pad, left: pad }])
    .png()
    .toFile(join(pub, name));
  console.log("wrote", name, `${size}x${size} (maskable, ${inner}px safe zone)`);
}

// favicon.ico bundling 16/32/48 — sharp can't write .ico, so emit 32 as .ico
// fallback is unnecessary because we ship favicon.svg + png; skip ico.
console.log("done");
