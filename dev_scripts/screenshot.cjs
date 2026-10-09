const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:4321/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/19/level3');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot.png' });
  
  await page.click('#start-btn');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot2.png' });

  const consoleLogs = [];
  page.on('console', msg => consoleLogs.push(msg.text()));
  await page.waitForTimeout(1000);
  console.log('Console logs:', consoleLogs);
  
  await browser.close();
})();
