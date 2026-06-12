// Mechanical CJS->TS import/export codemod for backend route files.
// Only touches top-level `const ... = require(...)` lines and the final
// `module.exports = ...` — handler bodies are left byte-identical.
// Usage: node scripts/route-codemod.cjs <file.ts> [...more]
const fs = require('fs');

// Internal modules compiled with `export =` (default-style import works), plus
// npm CJS deps — `import X from 'y'` under esModuleInterop.
const DEFAULT_IMPORT_OK = new Set([
  'express', 'multer', 'sharp', 'jsonwebtoken', 'bcryptjs', 'qrcode',
  'cookie-parser', 'compression', 'cors', 'helmet', 'morgan', 'dotenv',
  'node-cron', 'pg', 'http', 'https', 'path', 'crypto', 'fs', 'os', 'stream',
]);
// Internal TS modules using `export =` single-export.
const EXPORT_EQ_INTERNAL = [
  /config\/database$/, /utils\/logger$/, /middleware\/validate$/, /middleware\/upload$/,
];

function isDefaultImportable(spec) {
  if (DEFAULT_IMPORT_OK.has(spec)) return true;
  return EXPORT_EQ_INTERNAL.some((re) => re.test(spec));
}

function convert(src) {
  const lines = src.split('\n');
  const out = lines.map((line) => {
    // const { a, b: c } = require("x");
    let m = line.match(/^const\s*\{([^}]+)\}\s*=\s*require\((['"])([^'"]+)\2\);?\s*$/);
    if (m) {
      const names = m[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => {
          const kv = s.split(':').map((x) => x.trim());
          return kv.length === 2 ? `${kv[0]} as ${kv[1]}` : kv[0];
        })
        .join(', ');
      return `import { ${names} } from '${m[3]}';`;
    }
    // const X = require("x");
    m = line.match(/^const\s+(\w+)\s*=\s*require\((['"])([^'"]+)\2\);?\s*$/);
    if (m) {
      const [, name, , spec] = m;
      if (isDefaultImportable(spec)) return `import ${name} from '${spec}';`;
      return `import * as ${name} from '${spec}';`;
    }
    // module.exports = X;
    m = line.match(/^module\.exports\s*=\s*(\w+);?\s*$/);
    if (m) return `export = ${m[1]};`;
    // module.exports = { a, b };
    m = line.match(/^module\.exports\s*=\s*(\{[^}]*\});?\s*$/);
    if (m) return `export = ${m[1]};`;
    return line;
  });
  return out.join('\n');
}

for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, 'utf8');
  const converted = convert(src);
  fs.writeFileSync(file, converted);
  console.log(`converted: ${file}`);
}
