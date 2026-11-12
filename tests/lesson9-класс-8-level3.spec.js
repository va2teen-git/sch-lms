import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('9th Grade Lesson 8: Level 3 Task Suite (Cyber Matrix Arcade)', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/9-класс/8/level3.astro');

  test('Level 3 adheres to architectural requirements (Vue 3, TaskLayout 3, Archetype 10 Waves)', async () => {
    expect(fs.existsSync(taskPath), 'level3.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={3}>');

    // Vue 3 inclusion
    expect(code).toContain('/static/vue.global.js');
    expect(code).toContain('createApp(');

    // 10 procedural waves
    expect(code).toContain('WAVE_CONFIGS');
    expect(code).toContain('totalWaves: 10');

    // Audio & Alarm Box
    expect(code).toContain('AudioContext');
    expect(code).toContain('id="alarm-box"');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('level_complete');
    expect(code).toContain('Урок 8 :: Табличные модели (Уровень 3 / Аркада)');

    // Dev test hook
    expect(code).toContain('__DEV_LEVEL3_STATE__');

    // Zero-Style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Zero Multiple Choice Policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);
  });

  test('Level 3 contains 10 escalating waves and completes arcade progression', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryEventMock', (evt) => {
      telemetryEvents.push(evt);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryEventMock(event.data);
        }
      });
    });

    await page.goto(encodeURI('/tasks/9-класс/8/level3'));

    // Start game
    const startBtn = page.locator('#start-btn');
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();

    // Verify 10 waves
    const wavesCount = await page.evaluate(() => {
      // @ts-ignore
      return window.__DEV_LEVEL3_STATE__ ? window.__DEV_LEVEL3_STATE__.waves.length : 0;
    });
    expect(wavesCount).toBe(10);

    // Solve all 10 waves
    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w}`);

      await page.evaluate(() => {
        // @ts-ignore
        window.__DEV_LEVEL3_STATE__.solveCurrentWave();
      });

      if (w < 10) {
        await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w + 1}`, { timeout: 4000 });
      }
    }

    // Victory screen
    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.display-5')).toHaveText('КИБЕРПРОСТРАНСТВО ЗАЩИЩЕНО!');

    // Telemetry verification
    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete' && e.success === true);
    expect(completeEvent, 'Telemetry must dispatch level_complete with success=true').toBeTruthy();
    expect(completeEvent.mission_name).toContain('Урок 8 :: Табличные модели (Уровень 3 / Аркада)');
  });

  test('Level 3 error triggers alarm box, hardcore_reset telemetry and resets progress to wave 1', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryEventMock', (evt) => {
      telemetryEvents.push(evt);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryEventMock(event.data);
        }
      });
    });

    await page.goto(encodeURI('/tasks/9-класс/8/level3'));
    const startBtn = page.locator('#start-btn');
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();

    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1');

    // Trigger failure
    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL3_STATE__.submitAction('fail', 'Принудительный тест сирены');
    });

    // Check alarm box
    await expect(page.locator('#alarm-box')).toBeVisible();
    await expect(page.locator('#alarm-box')).toContainText('КРИТИЧЕСКИЙ СБОЙ');
    await expect(page.locator('#alarm-count')).toHaveText('1');

    // Check hardcore_reset telemetry
    const resetEvent = telemetryEvents.find(e => e.action_type === 'hardcore_reset');
    expect(resetEvent, 'Must dispatch hardcore_reset telemetry').toBeTruthy();

    // After reset, alarm box hides and game returns to Wave 1
    await page.waitForTimeout(1600);
    await expect(page.locator('#alarm-box')).toBeHidden();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1');
  });
});
