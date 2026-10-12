import { test, expect } from '@playwright/test';

test.describe('Lesson 20: Visual & Responsive UX Verification', () => {
  const lessonUrl = 'http://localhost:4321/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/20';

  test('Main lesson view renders correctly on Full HD (1920x1080) and Laptop (1366x768)', async ({ page }) => {
    // 1. Full HD Viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.goto(lessonUrl);

    // Theory tab and iframe should exist
    const iframe1 = page.locator('#iframe-1');
    await expect(iframe1).toBeAttached();

    // Verify main header is visible
    const mainHeader = page.locator('header').first();
    await expect(mainHeader).toBeVisible();

    // Capture visual snapshot for Full HD
    await page.screenshot({ path: 'scratch/scr_test_11_20_desktop_1080p.png' });

    // 2. Laptop Viewport (1366x768)
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(300);

    // Verify iframe-1 frame content loads and fits
    const frame = page.frameLocator('#iframe-1');
    await expect(frame.locator('#phase1')).toBeVisible();

    // Capture visual snapshot for Laptop
    await page.screenshot({ path: 'scratch/scr_test_11_20_laptop_768p.png' });
  });

  test('Interactive level supports keyboard submission (Enter key)', async ({ page }) => {
    await page.goto(lessonUrl);
    
    // Switch to Level 2 directly in DOM to test its keyboard handling
    await page.evaluate(() => {
      document.getElementById('iframe-1')?.classList.remove('block');
      document.getElementById('iframe-1')?.classList.add('hidden');
      const iframe2 = document.getElementById('iframe-2');
      if (iframe2) {
        iframe2.classList.remove('hidden');
        iframe2.classList.add('block');
        iframe2.style.position = 'relative';
        iframe2.style.height = '800px';
        iframe2.style.width = '1000px';
      }
    });

    const frame2 = page.frameLocator('#iframe-2');
    await expect(frame2.locator('#phase1')).toBeVisible();

    // Calculate answer for Phase 1
    const reqSym = (await frame2.locator('#p1-req-sym').innerText()).trim();
    const dirText = (await frame2.locator('#p1-req-dir-text').innerText()).trim();
    const reqNext = (await frame2.locator('#p1-req-next').innerText()).trim();
    const reqDir = dirText.includes('влево') ? 'L' : (dirText.includes('вправо') ? 'R' : 'S');
    const answer = `${reqSym} ${reqDir} ${reqNext}`;

    const input = frame2.locator('#p1-input');
    await input.fill(answer);

    // Press Enter to submit instead of clicking button
    await input.press('Enter');

    // Should transition to Phase 2 smoothly
    await expect(frame2.locator('#phase2')).toBeVisible();
  });

  test('Level 3 Arcade UI elements and HUD display properly', async ({ page }) => {
    await page.goto(lessonUrl);

    // Switch to Level 3 in DOM
    await page.evaluate(() => {
      document.getElementById('iframe-1')?.classList.remove('block');
      document.getElementById('iframe-1')?.classList.add('hidden');
      const iframe3 = document.getElementById('iframe-3');
      if (iframe3) {
        iframe3.classList.remove('hidden');
        iframe3.classList.add('block');
        iframe3.style.position = 'relative';
        iframe3.style.height = '800px';
        iframe3.style.width = '1000px';
      }
    });

    const frame3 = page.frameLocator('#iframe-3');
    await expect(frame3.locator('#app')).toBeVisible();

    // Check Start button on intro screen
    await expect(frame3.locator('#start-btn')).toBeVisible();
    await frame3.locator('#start-btn').click();

    // Check Arcade HUD elements
    await expect(frame3.locator('text=СЕКТОР БЕЗОПАСНОСТИ')).toBeVisible();
    await expect(frame3.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 8');
    await expect(frame3.locator('#timer-display')).toBeVisible();
    await expect(frame3.locator('.progress-bar')).toBeVisible();

    // Capture Arcade HUD visual screenshot
    await page.screenshot({ path: 'scratch/scr_test_11_20_arcade_hud.png' });
  });
});
