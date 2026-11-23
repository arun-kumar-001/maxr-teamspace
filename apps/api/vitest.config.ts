import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Run tests against shared sources so they do not require a prior build of packages/shared.
    alias: { '@maxr/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts') },
  },
  test: {
    include: ['src/**/*.test.ts'],
    // Tests that need a real PostgreSQL run in the CI Database job: `npm run test:db` (vitest.db.config.ts).
    exclude: ['src/**/*.db.test.ts', 'node_modules/**', 'dist/**'],
    environment: 'node',
    env: { NODE_ENV: 'test' },
  },
});
