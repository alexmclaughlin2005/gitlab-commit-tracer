/**
 * Database connection setup using PostgreSQL and Drizzle ORM
 */

import * as dotenv from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { URL } from 'url';

// Load environment variables if not already loaded
if (!process.env.DATABASE_URL && require.main === module) {
  dotenv.config();
}

// Parse DATABASE_URL and create explicit configuration
function getDatabaseConfig() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Parse the connection string
  const dbUrl = new URL(connectionString);

  return {
    host: dbUrl.hostname,
    port: parseInt(dbUrl.port),
    database: dbUrl.pathname.slice(1), // Remove leading slash
    user: dbUrl.username,
    password: dbUrl.password,
    max: parseInt(process.env.DATABASE_POOL_MAX || '10'),
    min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: false, // Railway doesn't require SSL for TCP proxy connections
  };
}

// Lazily create connection pool (only when first accessed)
let _pool: Pool | null = null;

function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool(getDatabaseConfig());

    // Handle pool errors
    _pool.on('error', (err) => {
      console.error('Unexpected error on idle PostgreSQL client', err);
    });
  }
  return _pool;
}

// Export pool getter
export const pool = new Proxy({} as Pool, {
  get: (target, prop) => {
    const actualPool = getPool();
    const value = (actualPool as any)[prop];
    return typeof value === 'function' ? value.bind(actualPool) : value;
  },
});

// Lazy Drizzle database instance
let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    _db = drizzle(getPool());
  }
  return _db;
}

// For convenience, export a db proxy as well
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get: (target, prop) => {
    const actualDb = getDb();
    const value = (actualDb as any)[prop];
    return typeof value === 'function' ? value.bind(actualDb) : value;
  },
});

/**
 * Test database connection
 */
export async function testConnection(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT NOW()');
    client.release();
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

/**
 * Close database connection pool
 */
export async function closeConnection(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    console.log('Database connection pool closed');
  }
}
