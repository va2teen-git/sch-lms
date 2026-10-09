const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const level1Url = 'http://192.168.100.210:8080/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/6/level1';
  console.log("Navigating to Level 1:", level1Url);
  
  await page.goto(level1Url, { waitUntil: 'networkidle' });

  await page.waitForFunction(() => {
    return document.getElementById('terminal-output').innerText.includes('OSSEC HIDS Alert');
  }, { timeout: 10000 });
  
  await page.fill('#cmd-input', 'cat /var/log/auth.log');
  await page.press('#cmd-input', 'Enter');
  
  await page.waitForTimeout(500);
  
  const terminalHtml = await page.$eval('#terminal-output', el => el.innerHTML);
  
  const match = terminalHtml.match(/Failed password for root from (\d+\.\d+\.\d+\.\d+)/);
  if (match) {
    const ip = match[1];
    console.log("Found IP:", ip);
    
    await page.fill('#cmd-input', `ufw deny from ${ip}`);
    await page.press('#cmd-input', 'Enter');
    
    await page.waitForTimeout(3000); // Wait for Phase 2
    
    const out2 = await page.$eval('#terminal-output', el => el.innerText);
    console.log("Output after 3s:", out2.slice(-500));
  }
  await browser.close();
})();
