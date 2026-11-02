import fs from 'fs';
import path from 'path';
import { getPool, closePool } from './client';
import { config } from '../config/env';

export async function runDevSeed(): Promise<void> {
  // Safety guard: Never seed production!
  if (config.NODE_ENV === 'production') {
    throw new Error(
      '[Seeder Security Violation] Cannot execute development seed in production environment!',
    );
  }

  const pool = getPool();
  const client = await pool.connect();

  try {
    // Locate dev_seed.sql
    let seedFilePath = path.resolve(__dirname, 'seeds/dev_seed.sql');
    if (!fs.existsSync(seedFilePath)) {
      seedFilePath = path.resolve(__dirname, '../../src/db/seeds/dev_seed.sql');
    }
    if (!fs.existsSync(seedFilePath)) {
      seedFilePath = path.resolve(process.cwd(), 'apps/api/src/db/seeds/dev_seed.sql');
    }
    if (!fs.existsSync(seedFilePath)) {
      seedFilePath = path.resolve(process.cwd(), 'src/db/seeds/dev_seed.sql');
    }

    if (!fs.existsSync(seedFilePath)) {
      throw new Error(`[Seeder Error] Seed file not found at: ${seedFilePath}`);
    }

    const sqlContent = fs.readFileSync(seedFilePath, 'utf-8');

    // eslint-disable-next-line no-console
    console.info('[Seeder] Executing development database seed...');

    await client.query('BEGIN');
    await client.query(sqlContent);
    await client.query('COMMIT');

    // eslint-disable-next-line no-console
    console.info('[Seeder] Development seed successfully executed.');
  } catch (err) {
    await client.query('ROLLBACK');
    // eslint-disable-next-line no-console
    console.error('[Seeder Failed]', err);
    throw err;
  } finally {
    client.release();
  }
}

// Direct CLI execution
if (require.main === module) {
  runDevSeed()
    .then(() => {
      // eslint-disable-next-line no-console
      console.info('[Seeder] Completed.');
      return closePool();
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[Seeder Fatal Error]', err);
      closePool().finally(() => process.exit(1));
    });
}
