import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config/env';

let pool: Pool | null = null;

export function getPoolConfig(): PoolConfig {
  return {
    connectionString: config.DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(getPoolConfig());

    pool.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[PostgreSQL Pool Error]', err);
    });
  }
  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const currentPool = getPool();
  return currentPool.query<T>(text, params);
}

export async function checkDatabaseHealth(): Promise<{
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const currentPool = getPool();
    await currentPool.query('SELECT 1 AS health_check');
    const latencyMs = Date.now() - start;
    return { status: 'up', latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return {
      status: 'down',
      latencyMs,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
