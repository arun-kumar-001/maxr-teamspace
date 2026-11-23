import path from 'path';
import { defineConfig } from 'vitest/config';

// Integration tests against a real, migrated and seeded PostgreSQL (DATABASE_URL).
// Run locally after `npm run docker:up && npm run db:migrate && npm run db:seed`.
export default defineConfig({
  resolve: {
    alias: { '@maxr/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts') },
  },
  test: {
    include: ['src/**/*.db.test.ts'],
    environment: 'node',
    env: { NODE_ENV: 'test' },
    // One database is shared by all files, so files run one after another.
    fileParallelism: false,
  },
});
