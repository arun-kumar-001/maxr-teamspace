import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        xfwd: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            if ('writeHead' in res && !res.headersSent) {
              res.writeHead(503, { 'Content-Type': 'application/json' });
              res.end(
                JSON.stringify({
                  error: {
                    code: 'BACKEND_OFFLINE',
                    message:
                      'Backend API is not running on http://localhost:4000. Run "npm run dev:api" in a separate terminal.',
                  },
                }),
              );
            }
          });
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@maxr/shared': path.resolve(import.meta.dirname, '../../packages/shared/src/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    // A published source map hands out the whole front-end source; nothing here needs it in production.
    sourcemap: false,
  },
  test: {
    globals: true,
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/__tests__/setup.ts'],
    environment: 'node',
  },
});
