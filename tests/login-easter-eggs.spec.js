import { test, expect } from '@playwright/test';

test.describe('Login Easter Eggs & Screamer', () => {
  test('normal student login works without interference', async ({ page }) => {
    await page.goto('/');
    await page.fill('#firstName', 'Иван');
    await page.fill('#lastName', 'Иванов');
    await page.selectOption('#classSelect', '9-класс');
    await page.click('#login-submit');

    await page.waitForURL('**/courses');
    const stored = await page.evaluate(() => ({
      firstName: localStorage.getItem('student_firstName'),
      lastName: localStorage.getItem('student_lastName'),
      studentClass: localStorage.getItem('student_class'),
    }));
    expect(stored).toEqual({
      firstName: 'Иван',
      lastName: 'Иванов',
      studentClass: '9-класс',
    });
  });

  test('Nikolay Vatutin triggers full-screen screamer closable ONLY via invisible top-right cross', async ({ page }) => {
    await page.goto('/');
    await page.fill('#firstName', '  Николай  ');
    await page.fill('#lastName', 'ватутин');
    await page.selectOption('#classSelect', '10-класс_углубленный');
    await page.click('#login-submit');

    const overlay = page.locator('#screamer-overlay');
    const img = page.locator('#screamer-image');
    const closeBtn = page.locator('#screamer-close');

    await expect(overlay).toBeVisible();
    await expect(closeBtn).toBeAttached();

    // Ensure full-viewport coverage and loaded scary face image
    const viewport = page.viewportSize();
    const overlayBox = await overlay.boundingBox();
    expect(overlayBox.width).toBe(viewport.width);
    expect(overlayBox.height).toBe(viewport.height);

    const imgLoaded = await img.evaluate((el) => el.complete && el.naturalWidth > 0);
    expect(imgLoaded).toBe(true);

    // Ensure invisible close button is in the top-right corner
    const closeStyles = await closeBtn.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { opacity: cs.opacity, top: cs.top, right: cs.right };
    });
    expect(closeStyles.opacity).toBe('0');

    const closeBox = await closeBtn.boundingBox();
    expect(closeBox.x + closeBox.width).toBeGreaterThanOrEqual(viewport.width - 2);
    expect(closeBox.y).toBeLessThanOrEqual(2);

    // Clicking center of overlay does NOT close it
    await page.mouse.click(viewport.width / 2, viewport.height / 2);
    await expect(overlay).toBeVisible();

    // Pressing Escape does NOT close it
    await page.keyboard.press('Escape');
    await expect(overlay).toBeVisible();

    // Did not redirect or save credentials
    expect(page.url()).not.toContain('/courses');

    // Clicking the invisible cross in the top-right corner closes the screamer
    await page.mouse.click(closeBox.x + closeBox.width / 2, closeBox.y + closeBox.height / 2);
    await expect(overlay).toBeHidden();
  });

  test('admin prank blocks login with message, matrix egg logs in with banner, Konami & 5-click hint work', async ({ page }) => {
    await page.goto('/');

    // 5 clicks on heading reveal hint
    const title = page.locator('#login-title');
    for (let i = 0; i < 5; i++) {
      await title.click();
    }
    await expect(page.locator('#login-easter-hint')).toBeVisible();

    // Konami code flips card
    for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) {
      await page.keyboard.press(key);
    }
    await expect(page.locator('#login-card')).toHaveClass(/rotate-180/);
    await expect(page.locator('#login-easter-banner')).toContainText('Антигравитация');

    // Admin prank blocks redirect
    await page.fill('#firstName', 'Admin');
    await page.fill('#lastName', 'Admin');
    await page.selectOption('#classSelect', '9-класс');
    await page.click('#login-submit');
    await expect(page.locator('#login-easter-banner')).toContainText('Доступ root отклонён');
    expect(page.url()).not.toContain('/courses');

    // Matrix easter egg shows banner and logs in
    await page.fill('#firstName', 'Томас');
    await page.fill('#lastName', 'Андерсон');
    await page.click('#login-submit');
    await expect(page.locator('#login-easter-banner')).toContainText('Wake up, Neo');
    await page.waitForURL('**/courses');
  });
});
