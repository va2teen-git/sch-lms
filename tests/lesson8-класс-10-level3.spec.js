import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Grade 8 Lesson 10: Level 3 Arcade Task Suite (Logic Core Pulse)', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/8-класс/10/level3.astro');

  test('Level 3 adheres to architectural requirements (Vue 3, TaskLayout 3, 10 Waves, Arcade Archetypes)', async () => {
    expect(fs.existsSync(taskPath), 'level3.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={3}>');

    // Vue 3 inclusion
    expect(code).toContain('/static/vue.global.js');
    expect(code).toContain('createApp(');

    // Arcade controls and direct manipulation
    expect(code).toContain('gate-node-r1');
    expect(code).toContain('gate-node-r2');
    expect(code).toContain('gate-node-f');
    expect(code).toContain('btn-boost');
    expect(code).toContain('handleKeyDown');

    // Hardcore reset & Alarm Box
    expect(code).toContain('alarm-box');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('level_complete');
    expect(code).toContain('Урок 10');

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

    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level3');

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

    // Solve all 10 waves sequentially
    for (let w = 0; w < 10; w++) {
      await expect(page.locator('#wave-indicator')).toContainText(`ВОЛНА ${w + 1}`);

      await page.evaluate(() => {
        // @ts-ignore
        window.__DEV_LEVEL3_STATE__.solveCurrentWave();
      });

      // Brief delay for wave transition
      await page.waitForTimeout(100);
    }

    // Verify victory screen
    await expect(page.locator('#success-screen')).toBeVisible({ timeout: 5000 });

    const levelCompleteEvt = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(levelCompleteEvt, 'Telemetry level_complete event must be emitted').toBeDefined();
    expect(levelCompleteEvt.success).toBe(true);
    expect(levelCompleteEvt.mission_name).toContain('Урок 10');
  });

  test('Level 3 hardcore reset: wrong pulse triggers alarm and resets back to Wave 1', async ({ page }) => {
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

    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level3');

    const startBtn = page.locator('#start-btn');
    await startBtn.click();
    await expect(page.locator('#wave-indicator')).toContainText('ВОЛНА 1');

    // Trigger wrong pulse (intentionally invert expectedF)
    await page.evaluate(() => {
      // @ts-ignore
      const state = window.__DEV_LEVEL3_STATE__;
      const expectedF = state.waveData.expectedF;
      const wrongF = expectedF === 1 ? 0 : 1;
      // Toggle F to wrong value and fire
      const toggleF = document.getElementById('gate-node-f');
      if (toggleF) {
        toggleF.click();
        const fireBtn = document.getElementById('btn-boost');
        if (fireBtn) fireBtn.click();
      }
    });

    // Check alarm banner is displayed
    const alarmBox = page.locator('#alarm-box');
    await expect(alarmBox).toBeVisible();

    // Verify hardcore_reset telemetry event
    const resetEvt = telemetryEvents.find(e => e.action_type === 'hardcore_reset');
    expect(resetEvt, 'hardcore_reset event must be dispatched on failure').toBeDefined();

    // After reset timeout (1.5s), game returns to wave 1
    await expect(alarmBox).toBeHidden({ timeout: 4000 });
    await expect(page.locator('#wave-indicator')).toContainText('ВОЛНА 1');
  });
});
