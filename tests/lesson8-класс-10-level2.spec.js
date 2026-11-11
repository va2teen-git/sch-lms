import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Grade 8 Lesson 10: Level 2 Task Suite (Analytical Truth Tables)', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/8-класс/10/level2.astro');

  test('Level 2 adheres to architectural and cognitive complexity requirements', async () => {
    expect(fs.existsSync(taskPath), 'level2.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}>');

    // 5 distinct phases (Sawtooth 2-1-2)
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="phase4"');
    expect(code).toContain('id="phase5"');

    // Zero Multiple Choice
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Strict keyboard input fields
    expect(code).toContain('id="p1-input"');
    expect(code).toContain('id="p2-input"');
    expect(code).toContain('id="p3-input"');
    expect(code).toContain('id="p4-input"');
    expect(code).toContain('id="p5-input"');

    // Zero-Style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Telemetry contracts
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 10');
  });

  test('Level 2 full 5-phase algorithmic walkthrough with telemetry verification', async ({ page }) => {
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

    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level2');

    // --- PHASE 1: Table Dimensions (N = 2ⁿ) ---
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');

    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL2_STATE__.solvePhase1();
    });

    // --- PHASE 2: Analytical Weight (Ones Count) ---
    await expect(page.locator('#phase1')).toBeHidden();
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');

    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL2_STATE__.solvePhase2();
    });

    // --- PHASE 3: Mixed Columns Decoding ---
    await expect(page.locator('#phase2')).toBeHidden();
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 5');

    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL2_STATE__.solvePhase3();
    });

    // --- PHASE 4: Consolidation Valley (Invariants) ---
    await expect(page.locator('#phase3')).toBeHidden();
    await expect(page.locator('#phase4')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 4 из 5');

    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL2_STATE__.solvePhase4();
    });

    // --- PHASE 5: Culmination Peak (System Analysis) ---
    await expect(page.locator('#phase4')).toBeHidden();
    await expect(page.locator('#phase5')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 5 из 5');

    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL2_STATE__.solvePhase5();
    });

    // --- VICTORY SCREEN & TELEMETRY ---
    await expect(page.locator('#phase5')).toBeHidden();
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Успешно завершено');

    const levelCompleteEvt = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(levelCompleteEvt, 'Telemetry level_complete event must be emitted').toBeDefined();
    expect(levelCompleteEvt.success).toBe(true);
    expect(levelCompleteEvt.mission_name).toContain('Урок 10');
  });

  test('Level 2 error handling and recovery on Phase 1', async ({ page }) => {
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level2');

    await expect(page.locator('#phase1')).toBeVisible();
    await page.locator('#p1-input').fill('9999');
    await page.locator('#p1-verify-btn').click();

    // Feedback alert appears
    const feedbackBox = page.locator('#feedback-box');
    await expect(feedbackBox).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    // Wait for auto-hide
    await expect(feedbackBox).toBeHidden({ timeout: 3000 });
  });
});
