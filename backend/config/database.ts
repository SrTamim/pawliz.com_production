import { Pool, type PoolConfig } from 'pg';
import os from 'os';
import dotenv from 'dotenv';
import logger from '../utils/logger';
import { DB_CONNECT_TIMEOUT_MS, DB_IDLE_TIMEOUT_MS } from '../utils/constants';

dotenv.config();

const isProd = process.env.NODE_ENV === 'production';

// Scale pool with CPU cores; cap at 15 to stay under Supabase's connection
// ceiling (direct ~60, pooler lower) if DB_POOL_MAX is forgotten in prod.
// Override via DB_POOL_MAX env var (set to 10 in prod, route runtime via the
// transaction pooler on port 6543).
const cpuCount = os.cpus().length;
const poolMax = process.env.DB_POOL_MAX
  ? parseInt(process.env.DB_POOL_MAX)
  : Math.min(cpuCount * 5, 15);

const baseConfig: PoolConfig = {
  max: poolMax,
  idleTimeoutMillis: DB_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
  statement_timeout: 30000,
};

const poolConfig: PoolConfig = process.env.DATABASE_URL
  ? {
      ...baseConfig,
      connectionString: process.env.DATABASE_URL,
      ssl: isProd ? { rejectUnauthorized: false } : false,
    }
  : {
      ...baseConfig,
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'pawliz',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: isProd ? { rejectUnauthorized: false } : false,
    };

const pool = new Pool(poolConfig);

pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  // Non-fatal: pg pool removes the broken client and reconnects on the next checkout.
  // Do NOT process.exit() — one idle client error must not take down the whole server.
  logger.error('Idle DB client error (non-fatal):', err.message);
});

export = pool;
