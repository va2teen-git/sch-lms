import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }]
  ],
  use: {
    baseURL: 'http://localhost:4321',
    // In CI (GitHub Actions), use default Chromium. Locally on Windows, use system Edge.
    channel: process.env.CI ? undefined : 'msedge',
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  // In CI, spin up dev server automatically; locally, rely on existing dev server
  webServer: process.env.CI ? {
    command: 'npm run dev',
    url: 'http://localhost:4321',
    reuseExistingServer: false,
    timeout: 60000,
  } : undefined,
});
