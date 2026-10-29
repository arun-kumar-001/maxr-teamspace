import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Run tests against shared sources so they do not require a prior build of packages/shared.
    alias: { '@maxr/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts') },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    env: { NODE_ENV: 'test' },
  },
});
