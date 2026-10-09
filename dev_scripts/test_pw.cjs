const { chromium } = require('playwright');

(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // We want to test level 1 iframe inside the lesson or just the lesson URL
    const url = 'http://192.168.100.210:8080/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/6';
    console.log("Navigating to URL...", url);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 15000 });
    console.log("Page loaded!");

    // Take screenshot to see if it loaded
    await page.screenshot({ path: 'test_screenshot.png' });
    
    // Since we are looking for bugs in level 1, let's open level 1 directly or find the iframe
    // The lesson URL is an Astro page that contains iframes with the tasks.
    // The iframe src would be `/tasks/11-класс_базовый/6/level1`
    
    // Let's just find any console errors on the task page directly
    const level1Url = 'http://192.168.100.210:8080/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/6/level1';
    console.log("Opening Level 1 Task Page:", level1Url);
    
    const taskPage = await browser.newPage();
    
    taskPage.on('pageerror', err => {
        console.error('Page Error:', err.message);
    });
    taskPage.on('console', msg => {
        if(msg.type() === 'error') {
            console.error('Console Error:', msg.text());
        }
    });

    await taskPage.goto(level1Url, { waitUntil: 'networkidle', timeout: 15000 });
    console.log("Level 1 loaded!");

    await browser.close();
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
})();
