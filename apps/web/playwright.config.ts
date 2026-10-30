import { defineConfig } from '@playwright/test';

const PORT = 4173;

// Phone, tablet and desktop cover the critical-flow viewports from AGENTS.md section 8.
// The nine reference viewports are exercised by e2e/viewports.spec.ts inside the desktop project.
export default defineConfig({
  testDir: './e2e',
  outputDir: '../../e2e-output/results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'phone',
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
      testIgnore: /viewports\.spec\.ts/,
    },
    {
      name: 'tablet',
      use: { browserName: 'chromium', viewport: { width: 768, height: 1024 }, hasTouch: true },
      testIgnore: /viewports\.spec\.ts/,
    },
    {
      name: 'desktop',
      use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } },
    },
  ],
  // The component gallery is only mounted by the dev server (import.meta.env.DEV).
  webServer: {
    command: `npm run dev -- --port ${PORT} --host 127.0.0.1 --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      VITE_DEV_MOCK_AUTH: 'true',
    },
  },
});
