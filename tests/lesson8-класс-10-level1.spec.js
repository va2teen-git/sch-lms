import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Grade 8 Lesson 10: Level 1 Task Suite (Truth Tables)', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/8-класс/10/level1.astro');

  test('Level 1 adheres to architectural requirements', async () => {
    expect(fs.existsSync(taskPath), 'level1.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}>');

    // 3 distinct phases
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 10');

    // Zero-Style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Zero Multiple Choice Policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Interactive manipulation components
    expect(code).toContain('p1-table-body');
    expect(code).toContain('p1-verify-btn');
    expect(code).toContain('p2-tokens-pool');
    expect(code).toContain('p2-verify-btn');
    expect(code).toContain('p3-source-pool');
    expect(code).toContain('p3-verify-btn');
  });

  test('Level 1 full walkthrough: complete all 3 phases and achieve level_complete telemetry', async ({ page }) => {
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

    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level1');

    // --- PHASE 1: Matrix Truth Synthesis ---
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');
    await expect(page.locator('#p1-verify-btn')).toBeDisabled();

    // Solve Phase 1 via DEV helper
    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL1_STATE__.solvePhase1();
    });

    // --- PHASE 2: Variable Slot & Snap ---
    await expect(page.locator('#phase1')).toBeHidden();
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');

    // Solve Phase 2 via DEV helper
    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL1_STATE__.solvePhase2();
    });

    // --- PHASE 3: Classification Drag to Buckets ---
    await expect(page.locator('#phase2')).toBeHidden();
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');

    // Solve Phase 3 via DEV helper
    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL1_STATE__.solvePhase3();
    });

    // --- VICTORY SCREEN & TELEMETRY ---
    await expect(page.locator('#phase3')).toBeHidden();
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Успешно завершено');

    const levelCompleteEvt = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(levelCompleteEvt, 'Telemetry level_complete event must be emitted').toBeDefined();
    expect(levelCompleteEvt.success).toBe(true);
    expect(levelCompleteEvt.mission_name).toContain('Урок 10');
  });

  test('Level 1 error handling and regeneration on Phase 1', async ({ page }) => {
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level1');

    await expect(page.locator('#phase1')).toBeVisible();

    // Fill all cells with wrong value (e.g. all 0)
    const cells = page.locator('.p1-cell');
    const count = await cells.count();
    for (let i = 0; i < count; i++) {
      await cells.nth(i).click(); // ? -> 0
    }

    const verifyBtn = page.locator('#p1-verify-btn');
    await expect(verifyBtn).toBeEnabled();
    await verifyBtn.click();

    // Feedback box should be triggered if there is an error
    const feedbackBox = page.locator('#feedback-box');
    await expect(feedbackBox).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    // After timeout, feedback box hides and regenerates
    await expect(feedbackBox).toBeHidden({ timeout: 3000 });
  });
});
