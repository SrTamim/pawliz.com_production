#!/usr/bin/env node
// Cross-platform launcher for the Next.js CLI that first applies the exFAT
// readlink shim (see ../../scripts/readlink-fix.cjs). On exFAT volumes + Node >=24,
// fs.readlink throws EISDIR where webpack/Next expect EINVAL, crashing `next build`
// (and `next start` page-data collection). Requiring the shim here patches `fs`
// in-process before the Next CLI loads, so no NODE_OPTIONS/cross-env needed.
// On Linux (Vercel/Render) the shim is a harmless no-op — readlink never errors.
require('../../scripts/readlink-fix.cjs');

// Forward the subcommand + remaining args (e.g. "dev", "build", "start -p 3000").
process.argv.splice(1, 1, require.resolve('next/dist/bin/next'));
require('next/dist/bin/next');
