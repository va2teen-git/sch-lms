const { chromium } = require('playwright-core');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' });
  const page = await browser.newPage();
  await page.goto('http://localhost:4321/tasks/7-класс/5/level1');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: 'scratch/screenshot_test_fix.png' });
  await browser.close();
})();
