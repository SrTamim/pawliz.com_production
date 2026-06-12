#!/usr/bin/env node
'use strict';

import dotenv from 'dotenv';
dotenv.config();

if (!process.env.DATABASE_URL) {
  const { DB_USER, DB_PASSWORD, DB_HOST = 'localhost', DB_PORT = 5432, DB_NAME } = process.env;
  process.env.DATABASE_URL = `postgresql://${DB_USER}:${encodeURIComponent(DB_PASSWORD as string)}@${DB_HOST}:${DB_PORT}/${DB_NAME}`;
}

// Managed Postgres (Supabase/Render) requires SSL. The app pool sets ssl in code,
// but node-pg-migrate runs as a subprocess and only reads the connection string,
// so force sslmode in production unless the URL already specifies it.
// Use no-verify: Supabase serves a self-signed cert chain, so verify-full (the new
// default alias for 'require') fails with SELF_SIGNED_CERT_IN_CHAIN. no-verify still
// encrypts the connection but skips chain validation — matches the app pool's
// ssl.rejectUnauthorized:false behavior.
if (process.env.NODE_ENV === 'production' && !/sslmode=/.test(process.env.DATABASE_URL)) {
  const sep = process.env.DATABASE_URL.includes('?') ? '&' : '?';
  process.env.DATABASE_URL += `${sep}sslmode=no-verify`;
}

import { execSync } from 'child_process';
const args = process.argv.slice(2).join(' ') || 'up';

// Source migrations are TypeScript. When running from source (tsx), inject the
// tsx loader into the subprocess so node-pg-migrate can import .ts migrations.
// The compiled build (dist/migrate.js) points at dist/migrations (plain JS) —
// no loader, no tsx dependency at runtime.
const isCompiled = __filename.endsWith('.js');
const migrationsDir = isCompiled ? 'dist/migrations' : 'migrations';
const env = { ...process.env };
if (!isCompiled) {
  env.NODE_OPTIONS = [env.NODE_OPTIONS, '--import tsx'].filter(Boolean).join(' ');
}
execSync(`npx node-pg-migrate ${args} -m ${migrationsDir}`, { stdio: 'inherit', env });
