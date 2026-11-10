import { test, expect } from '@playwright/test';

test.describe('Grade 11 Basic Lesson 8: Personal Archive Management Level 2', () => {
  const taskUrl = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level2';

  test('Zero Multiple Choice check: only text/number inputs exist', async ({ page }) => {
    await page.goto(taskUrl);
    
    const radios = await page.locator('input[type="radio"]').count();
    expect(radios).toBe(0);

    const selects = await page.locator('select').count();
    expect(selects).toBe(0);

    const textInputs = await page.locator('input[type="number"]').count();
    expect(textInputs).toBeGreaterThanOrEqual(2);
  });

  test('Phases 1-5: Full analytical calculation flow with Sawtooth progression', async ({ page }) => {
    await page.goto(taskUrl);

    // Phase 1: Compression ratio and space saving
    await expect(page.locator('#phase1')).toBeVisible();
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase1());

    // Phase 2: Differential vs Incremental
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 2 из 5');
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase2());

    // Phase 3: RTO & Bandwidth
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 3 из 5');
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase3());

    // Phase 4: Integrity check & SHA-256 bits
    await expect(page.locator('#phase4')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 4 из 5');
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase4());

    // Phase 5: Culmination 3-2-1 Storage Budget
    await expect(page.locator('#phase5')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 5 из 5');

    // Telemetry capture
    const telemetryPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        window.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'TELEMETRY_EVENT' && e.data.action_type === 'level_complete') {
            resolve(e.data);
          }
        });
      });
    });

    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase5());

    const telemetry = await telemetryPromise;
    expect(telemetry.success).toBe(true);
    expect(telemetry.action_type).toBe('level_complete');

    await expect(page.locator('#final-screen')).toBeVisible();
  });

  test('Error handling and hardcore_reset telemetry', async ({ page }) => {
    await page.goto(taskUrl);

    // Enter wrong values into Phase 1
    await page.locator('#p1-input-k').fill('999');
    await page.locator('#p1-input-percent').fill('999');

    const resetPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        window.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'TELEMETRY_EVENT' && e.data.action_type === 'hardcore_reset') {
            resolve(e.data);
          }
        });
      });
    });

    await page.locator('#p1-btn').click();

    const resetEvent = await resetPromise;
    expect(resetEvent.success).toBe(false);
    expect(resetEvent.action_type).toBe('hardcore_reset');

    await expect(page.locator('#error-feedback')).toBeVisible();
  });
});
