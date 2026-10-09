import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Login
  await page.goto('http://192.168.100.210:8080/');
  await page.fill('#firstName', 'Иван');
  await page.fill('#lastName', 'Иванов');
  await page.selectOption('#classSelect', '9-класс');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1000); // Wait for redirect and state save

  // Go to lesson 6
  await page.goto('http://192.168.100.210:8080/lesson/9-класс/6');
  await page.waitForTimeout(2000);

  // Take a screenshot of the main page
  await page.screenshot({ path: 'lesson6_main.png' });

  // Get iframes
  const frames = page.frames();
  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const url = frame.url();
    if (url.includes('tasks')) {
      console.log(`\n\n--- Frame URL: ${url} ---`);
      try {
        const bodyText = await frame.evaluate(() => document.body.innerText);
        console.log("TEXT:\n" + bodyText);
        const html = await frame.evaluate(() => document.body.innerHTML);
        console.log("HTML:\n" + html.substring(0, 500) + '...');
      } catch (e) {
        console.log("Error evaluating frame:", e);
      }
    }
  }

  await browser.close();
})();
