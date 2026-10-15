import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Prince of Persia Focus, Keyboard Bridge and Activation Suite', () => {
  const rootDir = process.cwd();
  const lessonUrl = '/lesson/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7';

  test('1. Static source verification: Preloader, index.html, and [id].astro have focus enhancements', () => {
    // 1. Check index.html
    const indexPath = path.join(rootDir, 'public', 'static', 'prince', 'index.html');
    const indexContent = fs.readFileSync(indexPath, 'utf-8');
    expect(indexContent).toContain('window.focus()');
    expect(indexContent).toContain("e.data.type === 'FOCUS_GAME'");

    // 2. Check Preloader.js
    const preloaderPath = path.join(rootDir, 'public', 'static', 'prince', 'src', 'Preloader.js');
    const preloaderContent = fs.readFileSync(preloaderPath, 'utf-8');
    expect(preloaderContent).toContain('Click or Press Enter to Start');
    expect(preloaderContent).toContain('this.text.inputEnabled = true');
    expect(preloaderContent).toContain('this.game.sound.context.resume()');

    // 3. Check [id].astro
    const lessonPagePath = path.join(rootDir, 'src', 'pages', 'lesson', '[class]', '[id].astro');
    const lessonContent = fs.readFileSync(lessonPagePath, 'utf-8');
    expect(lessonContent).toContain('const focusPrince');
    expect(lessonContent).toContain('princeIframe.focus()');
    expect(lessonContent).toContain("type: 'FOCUS_GAME'");
    expect(lessonContent).toContain('princeIframe.dataset.activated');
    expect(lessonContent).toContain('💡 Кликните по экрану игры или нажмите Enter для старта');
    expect(lessonContent).toContain('allow="fullscreen; gamepad; autoplay"');

    // 4. Check PrinceEmulator.astro
    const emulatorPath = path.join(rootDir, 'src', 'components', 'PrinceEmulator.astro');
    const emulatorContent = fs.readFileSync(emulatorPath, 'utf-8');
    expect(emulatorContent).toContain('const focusGame');
    expect(emulatorContent).toContain('iframe.focus()');
    expect(emulatorContent).toContain('💡 Кликните по экрану игры или нажмите Enter для старта');
  });

  test('2. Browser E2E: Launching Prince of Persia sets focus to iframe and enables keyboard bridge', async ({ page }) => {
    // Mock progress API to simulate completed hardcore mode
    await page.route('**/api/progress*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          unlockedNormal: 3,
          unlockedHardcore: 4,
          isNormalCompleted: true,
          isHardcoreCompleted: true
        })
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Тест');
      localStorage.setItem('student_lastName', 'Ученик');
      localStorage.setItem('student_class', '9-класс');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_9-класс_7', 'true');
    });

    await page.goto(lessonUrl);
    await page.waitForLoadState('domcontentloaded');

    // Completion screen and bonus card should be visible
    const openBtn = page.locator('#open-prince-btn');
    await expect(openBtn).toBeVisible();

    // Click "ЗАПУСТИТЬ УРОВЕНЬ 1"
    await openBtn.click();

    const princeOverlay = page.locator('#prince-overlay');
    await expect(princeOverlay).toBeVisible();

    const princeIframe = page.locator('#prince-game-iframe');
    await expect(princeIframe).toBeVisible();

    // Verify visual hint is displayed in the controls banner
    const bannerHint = page.locator('#prince-overlay span:has-text("💡 Кликните по экрану игры или нажмите Enter для старта")');
    await expect(bannerHint).toBeVisible();

    // Verify iframe has autoplay and tabindex
    await expect(princeIframe).toHaveAttribute('allow', /autoplay/);
    await expect(princeIframe).toHaveAttribute('tabindex', '0');

    // Send Enter key to parent window to verify event bridge does not throw error
    await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');

    // Click on overlay background to verify it refocuses without error
    await princeOverlay.click({ position: { x: 10, y: 10 } });
  });
});
