import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:4321';

test.describe('Unified CyberTerminal Visual & UX Verification', () => {
  test('1. Logo-Storm uses unified CyberTerminal shell (.ct-window, titlebar, 3 dots, badge)', async ({ page }) => {
    await page.goto(`${BASE_URL}/lesson/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27`);
    await page.locator('#sprint-toggle').click();
    await expect(page.locator('#sprint-overlay')).toBeVisible();

    const win = page.locator('#sprint-terminal-history');
    await expect(win).toBeVisible();
    await expect(win).toHaveClass(/ct-window/);
    await expect(win.locator('.ct-titlebar')).toBeVisible();
    await expect(win.locator('.ct-dot')).toHaveCount(3);
    await expect(win.locator('#sprint-def-step.ct-badge')).toBeVisible();
  });

  test('2. Educational Terminal.astro uses Logo-Storm CyberTerminal shell, title sync, history & clear', async ({ page }) => {
    await page.goto(`${BASE_URL}/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/19/level1`);

    const hasCyberCss = await page.evaluate(() =>
      Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some((l) =>
        (l.getAttribute('href') || '').includes('/static/cyber-terminal.css')
      )
    );
    expect(hasCyberCss).toBe(true);

    const win = page.locator('#linux-terminal-window');
    await expect(win).toBeVisible();
    await expect(win).toHaveClass(/ct-window/);
    await expect(win.locator('.ct-titlebar')).toBeVisible();
    await expect(win.locator('.ct-dot')).toHaveCount(3);
    await expect(win.locator('#terminal-phase-badge')).toContainText('ФАЗА 1 / 3');

    const input = page.locator('#cmd-input');
    await input.fill('cd /var/log');
    await input.press('Enter');
    await expect(page.locator('#terminal-title')).toHaveText('root@sys-server:/var/log — bash');

    await input.press('ArrowUp');
    await expect(input).toHaveValue('cd /var/log');

    await input.fill('clear');
    await input.press('Enter');
    const outText = await page.locator('#terminal-output').innerText();
    expect(outText.trim()).toBe('');
  });

  test('3. Cyber-Boy terminal uses CyberTerminal shell, pipes/history/Tab and Esc close', async ({ page }) => {
    await page.goto(`${BASE_URL}/games/hotline-kumir?seed=42&fastAnim=1&mute=1`);
    await page.locator('#hk-btn-start-mission').click();
    await expect(page.locator('#hk-briefing-overlay')).toBeHidden();

    await page.locator('#hk-btn-open-term').click();
    await expect(page.locator('#hk-terminal-overlay')).toBeVisible();

    const win = page.locator('#hk-term-window');
    await expect(win).toBeVisible();
    await expect(win).toHaveClass(/ct-window/);
    await expect(win.locator('.ct-titlebar')).toBeVisible();
    await expect(win.locator('.ct-dot')).toHaveCount(3);
    await expect(page.locator('#hk-term-title')).toContainText('— bash');

    const input = page.locator('#hk-term-input');
    await input.fill('id && pwd');
    await input.press('Enter');
    await expect(page.locator('#hk-term-output')).toContainText('uid=');

    await input.press('ArrowUp');
    await expect(input).toHaveValue('id && pwd');

    await input.fill('trunc');
    await input.press('Tab');
    await expect(input).toHaveValue('truncate ');

    await input.press('Escape');
    await expect(page.locator('#hk-terminal-overlay')).toBeHidden();
  });
});
