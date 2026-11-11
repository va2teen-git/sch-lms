import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 30: Level 3 Arcade Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/30/level3.astro');

  test('Level 3 adheres to architectural requirements (Vue 3, TaskLayout 3, Archetype 10 Waves)', async () => {
    expect(fs.existsSync(taskPath), 'level3.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={3}>');

    // Vue 3 inclusion
    expect(code).toContain('/static/vue.global.js');
    expect(code).toContain('createApp(');

    // Arcade controls and hotkeys
    expect(code).toContain('btn-gate-prefix');
    expect(code).toContain('btn-gate-postfix');
    expect(code).toContain('btn-gate-collision');
    expect(code).toContain('keydown');

    // Hardcore reset & Alarm Box
    expect(code).toContain('alarm-box');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('level_complete');
    expect(code).toContain('Урок 30');

    // Dev test hook
    expect(code).toContain('__DEV_LEVEL3_STATE__');

    // Zero-Style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
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

    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level3');

    // Verify 10 waves existence in hook
    const wavesCount = await page.evaluate(() => {
      // @ts-ignore
      return window.__DEV_LEVEL3_STATE__ ? window.__DEV_LEVEL3_STATE__.waves.length : 0;
    });
    expect(wavesCount).toBe(10);

    // Start game via start button
    const startBtn = page.locator('#start-btn');
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();
    await expect(page.locator('#wave-title')).toBeVisible();

    // Solve all 10 waves sequentially
    for (let w = 0; w < 10; w++) {
      await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w + 1}`);

      const correctAction = await page.evaluate(() => {
        // @ts-ignore
        const state = window.__DEV_LEVEL3_STATE__;
        return state.solveCurrentWave();
      });

      // Click corresponding button
      if (correctAction === 'prefix') {
        await page.locator('#btn-gate-prefix').click();
      } else if (correctAction === 'postfix') {
        await page.locator('#btn-gate-postfix').click();
      } else if (correctAction === 'collision') {
        await page.locator('#btn-gate-collision').click();
      }

      if (w < 9) {
        await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w + 2}`, { timeout: 3000 });
      }
    }

    // Victory screen
    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h2', { hasText: 'БОСС УРОВНЯ 3 ПОВЕРЖЕН!' })).toBeVisible();

    // Verify telemetry
    const completeEvent = telemetryEvents.find(e => (e.action_type === 'level_complete' || e.action === 'level_complete') && e.success === true);
    expect(completeEvent).toBeTruthy();
    expect(completeEvent.mission_name || completeEvent.lessonId).toContain('Урок 30');
  });
});
