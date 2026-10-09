import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    channel: 'msedge', // use system Edge
    headless: true,
  },
});
