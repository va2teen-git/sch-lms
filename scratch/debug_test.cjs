const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err));
  
  try {
    await page.goto('http://localhost:4321/lesson/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/5');
    console.log("Page loaded");
    
    // Unhide the iframe as the test does
    await page.evaluate(() => {
      document.getElementById('iframe-1').classList.remove('block');
      document.getElementById('iframe-1').classList.add('hidden');
      const iframe3 = document.getElementById('iframe-3');
      iframe3.classList.remove('hidden');
      iframe3.classList.add('block');
      iframe3.style.height = '800px';
      iframe3.style.width = '1000px';
    });
    
    const frame = page.frameLocator('#iframe-3');
    await frame.locator('button:has-text("НАЧАТЬ ВЗЛОМ")').click();
    console.log("Button clicked");
    await page.waitForTimeout(2000);
    console.log("Wait done");
    
    const count = await frame.locator('button').count();
    console.log("Number of buttons in frame:", count);
    
    for (let i = 0; i < count; i++) {
        console.log("Button text:", await frame.locator('button').nth(i).innerText());
    }
    
  } catch (err) {
      console.error(err);
  } finally {
      await browser.close();
  }
})();
