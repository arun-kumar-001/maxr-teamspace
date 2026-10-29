import { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config/env';
import { Logger, getLogger } from '../logging/logger';
import { DependencyStatus } from './types';

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
      getLogger().error('postgres pool error', { err });
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

export async function checkDatabaseHealth(logger: Logger = getLogger()): Promise<DependencyStatus> {
  const start = Date.now();
  try {
    await getPool().query('SELECT 1 AS health_check');
    return { status: 'up', latencyMs: Date.now() - start };
  } catch (err) {
    // Details stay in the log; the health response only says "down".
    logger.warn('database health check failed', { err });
    return { status: 'down', latencyMs: Date.now() - start };
  }
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
