import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Basic Lesson 9: Level 3 Arcade Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_базовый/9/level3.astro');

  test('Level 3 adheres to architectural and arcade requirements (Vue 3, TaskLayout 3, Telemetry)', async () => {
    expect(fs.existsSync(taskPath), 'level3.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={3}>');

    // Vue 3 Integration
    expect(code).toContain('createApp');
    expect(code).toContain('/static/vue.global.js');

    // Arcade mechanics
    expect(code).toContain('totalWaves: 10');
    expect(code).toContain('triggerHardcoreReset');
    expect(code).toContain('alarm-box');
    expect(code).toContain('commit-btn');
    expect(code).toContain('reject-sanity-btn');
    expect(code).toContain('format-timeseries-btn');
    expect(code).toContain('format-gis-btn');
    expect(code).toContain('format-graph-btn');
    expect(code).toContain('format-bi-btn');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 9');

    // Zero multiple choice policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Zero style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 3 full 10-wave arcade walkthrough and boss defeat', async ({ page }) => {
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level3'));
    await page.waitForLoadState('domcontentloaded');

    // Intro screen
    const startBtn = page.locator('#start-btn');
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // Play all 10 waves
    for (let w = 1; w <= 10; w++) {
      // Ensure current wave is active
      await expect(page.locator('#wave-counter-badge')).toContainText(`ВОЛНА ${w} / 10`);

      // Solve current wave via dev hook
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
      await page.waitForTimeout(350);
    }

    // Victory screen
    await expect(page.locator('h2:has-text("АРКАДНЫЙ БОСС УРОВНЯ 3 ПОВЕРЖЕН!")')).toBeVisible();
    await expect(page.locator('span:has-text("ВСЕ 10 ВОЛН МОДЕЛИРОВАНИЯ УСПЕШНО КАЛИБРОВАНЫ")')).toBeVisible();
  });

  test('Level 3 hardcore reset triggered upon invalid commit', async ({ page }) => {
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level3'));
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-counter-badge')).toContainText('ВОЛНА 1 / 10');

    // Commit immediately without calibration or selecting format
    await page.locator('#commit-btn').click();

    // Alarm box appears
    await expect(page.locator('#alarm-box')).toBeVisible();

    // Progress resets to wave 1 after siren timeout
    await page.waitForTimeout(1800);
    await expect(page.locator('#wave-counter-badge')).toContainText('ВОЛНА 1 / 10');
  });

  test('Level 3 keyboard shortcuts integration', async ({ page }) => {
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level3'));
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-counter-badge')).toContainText('ВОЛНА 1 / 10');

    // Press key '1' to select timeseries format
    await page.keyboard.press('Digit1');
    await expect(page.locator('#format-timeseries-btn')).toHaveClass(/active/);

    // Press key '3' to select graph format
    await page.keyboard.press('Digit3');
    await expect(page.locator('#format-graph-btn')).toHaveClass(/active/);

    // Adjust calibration with ArrowRight
    const initialK = await page.evaluate(() => window.__DEV_LEVEL3_STATE__.getCurrentWaveData() ? window.__DEV_LEVEL3_STATE__.getCurrentWave : null);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(100);
  });
});
