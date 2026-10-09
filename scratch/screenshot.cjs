const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:4321/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/5/level3');
  await page.screenshot({ path: 'scratch/level3-start.png' });
  await page.click('button:has-text("НАЧАТЬ ВЗЛОМ")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'scratch/level3-phase1.png' });
  await browser.close();
})();
