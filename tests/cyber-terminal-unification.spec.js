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

    // Help button and man command open framework-agnostic Linux manual without breaking `help`
    await expect(page.locator('#terminal-help-btn')).toBeVisible();
    await input.fill('man chmod');
    await input.press('Enter');
    const helpOverlay = page.locator('#terminal-help-overlay');
    await expect(helpOverlay).toBeVisible();
    await expect(helpOverlay.locator('[data-ct-help-section="perms"]')).toHaveClass(/ct-help-section--highlight/);
    await page.keyboard.press('Escape');
    await expect(helpOverlay).toBeHidden();

    await input.fill('help');
    await input.press('Enter');
    await expect(page.locator('#terminal-output')).toContainText('Доступные команды симуляции:');
  });

  test('3. Cyber-Boy terminal uses CyberTerminal shell (lg scale), Linux manual without game hints, pipes/history/Tab and Esc close', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${BASE_URL}/games/hotline-kumir?seed=42&fastAnim=1&mute=1`);
    await page.locator('#hk-btn-start-mission').click();
    await expect(page.locator('#hk-briefing-overlay')).toBeHidden();

    await page.locator('#hk-btn-open-term').click();
    await expect(page.locator('#hk-terminal-overlay')).toBeVisible();
    await expect(page.locator('#hk-term-hint')).toHaveCount(0);
    await expect(page.locator('#hk-term-help')).toBeVisible();

    const win = page.locator('#hk-term-window');
    await expect(win).toBeVisible();
    await expect(win).toHaveClass(/ct-window/);
    await expect(win).toHaveClass(/ct-window--lg/);
    await expect(win.locator('.ct-titlebar')).toBeVisible();
    await expect(win.locator('.ct-dot')).toHaveCount(3);
    await expect(page.locator('#hk-term-title')).toContainText('— bash');

    const metrics = await page.evaluate(() => {
      const el = document.getElementById('hk-term-window');
      const out = document.getElementById('hk-term-output');
      const inp = document.getElementById('hk-term-input');
      const rect = el.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        outFontPx: parseFloat(getComputedStyle(out).fontSize),
        inFontPx: parseFloat(getComputedStyle(inp).fontSize),
      };
    });
    expect(metrics.width).toBeGreaterThanOrEqual(896);
    expect(metrics.height).toBeGreaterThanOrEqual(560);
    expect(metrics.left).toBeGreaterThanOrEqual(0);
    expect(metrics.right).toBeLessThanOrEqual(1366);
    expect(metrics.top).toBeGreaterThanOrEqual(0);
    expect(metrics.bottom).toBeLessThanOrEqual(768);
    expect(metrics.outFontPx).toBeGreaterThanOrEqual(16);
    expect(metrics.inFontPx).toBeGreaterThanOrEqual(16);

    const input = page.locator('#hk-term-input');
    await input.fill('man grep');
    await input.press('Enter');
    const helpModal = page.locator('#hk-term-help-overlay');
    await expect(helpModal).toBeVisible();
    await expect(helpModal).toContainText('РУКОВОДСТВО ПО ТЕРМИНАЛУ LINUX');
    await expect(helpModal.locator('[data-ct-help-section="text"]')).toHaveClass(/ct-help-section--highlight/);
    const helpText = await helpModal.innerText();
    expect(helpText).not.toMatch(/Кибер-Boy|КуМир|ГБР|IDS/i);

    // First Esc closes only the manual, keeping the terminal modal open
    await page.keyboard.press('Escape');
    await expect(helpModal).toBeHidden();
    await expect(page.locator('#hk-terminal-overlay')).toBeVisible();

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
