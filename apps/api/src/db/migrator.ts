import fs from 'fs';
import path from 'path';
import { getPool, closePool } from './client';

export interface MigrationRecord {
  id: string;
  name: string;
  applied_at: string;
}

export function getMigrationsDir(): string {
  // Check both src (for development) and dist (for compiled output)
  const srcPath = path.resolve(__dirname, 'migrations');
  if (fs.existsSync(srcPath)) {
    return srcPath;
  }
  const rootSrcPath = path.resolve(process.cwd(), 'apps/api/src/db/migrations');
  if (fs.existsSync(rootSrcPath)) {
    return rootSrcPath;
  }
  const localSrcPath = path.resolve(process.cwd(), 'src/db/migrations');
  if (fs.existsSync(localSrcPath)) {
    return localSrcPath;
  }
  return srcPath;
}

export async function runMigrations(): Promise<{ applied: string[]; total: number }> {
  const pool = getPool();
  const client = await pool.connect();
  const applied: string[] = [];

  try {
    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Fetch already applied migrations
    const res = await client.query<MigrationRecord>(
      'SELECT id, name FROM schema_migrations ORDER BY id ASC',
    );
    const appliedIds = new Set(res.rows.map((r) => r.id));

    // 3. Read migration files
    const migrationsDir = getMigrationsDir();
    if (!fs.existsSync(migrationsDir)) {
      fs.mkdirSync(migrationsDir, { recursive: true });
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .sort();

    // 4. Apply unapplied migrations in order
    for (const file of files) {
      const migrationId = file.replace(/\.sql$/, '');
      if (appliedIds.has(migrationId)) {
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');

      // eslint-disable-next-line no-console
      console.info(`[Migrator] Applying migration: ${file}...`);

      await client.query('BEGIN');
      try {
        await client.query(sqlContent);
        await client.query('INSERT INTO schema_migrations (id, name) VALUES ($1, $2)', [
          migrationId,
          file,
        ]);
        await client.query('COMMIT');
        applied.push(file);
        // eslint-disable-next-line no-console
        console.info(`[Migrator] Successfully applied: ${file}`);
      } catch (migrationErr) {
        await client.query('ROLLBACK');
        // eslint-disable-next-line no-console
        console.error(`[Migrator] FAILED migration: ${file}`);
        throw migrationErr;
      }
    }

    return { applied, total: files.length };
  } finally {
    client.release();
  }
}

// Direct CLI execution
if (require.main === module) {
  runMigrations()
    .then((result) => {
      // eslint-disable-next-line no-console
      console.info(
        `[Migrator] Done. Applied ${result.applied.length} new migrations. Total migrations: ${result.total}`,
      );
      return closePool();
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('[Migrator Fatal Error]', err);
      closePool().finally(() => process.exit(1));
    });
}
