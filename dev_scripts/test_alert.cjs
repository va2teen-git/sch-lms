const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err));
  
  await page.goto('http://localhost:4321/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6');
  
  await page.evaluate(() => {
    localStorage.setItem('hardcore_mode', 'true');
  });
  await page.reload();
  
  console.log('Reloaded. isHardcore = ', await page.evaluate(() => localStorage.getItem('hardcore_mode')));
  
  page.on('dialog', async dialog => {
    console.log('DIALOG RECEIVED:', dialog.message());
    await dialog.accept();
  });
  
  await page.evaluate(() => {
    document.getElementById('iframe-1').classList.remove('block');
    document.getElementById('iframe-1').classList.add('hidden');
    const iframe2 = document.getElementById('iframe-2');
    iframe2.classList.remove('hidden');
    iframe2.classList.add('block');
  });
  
  const frame = page.frameLocator('#iframe-2');
  await frame.locator('#p1-input').fill('WRONG');
  await frame.locator('#p1-btn').click();
  
  await page.waitForTimeout(2000);
  console.log('Done.');
  await browser.close();
})();
