import { test, expect } from '@playwright/test';

test.describe('Grade 10 Basic Lesson 8: Information Measurement Level 2', () => {
  const taskUrl = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level2';

  test('Zero Multiple Choice check: only text/number inputs exist', async ({ page }) => {
    await page.goto(taskUrl);
    
    const radios = await page.locator('input[type="radio"]').count();
    expect(radios).toBe(0);

    const selects = await page.locator('select').count();
    expect(selects).toBe(0);

    const textInputs = await page.locator('input[type="text"]').count();
    expect(textInputs).toBeGreaterThanOrEqual(1);
  });

  test('Phases 1-5: Full analytical calculation flow with Sawtooth progression', async ({ page }) => {
    await page.goto(taskUrl);

    // Phase 1: Direct calculation I = K × i
    await expect(page.locator('#phase1')).toBeVisible();
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase1());

    // Phase 2: Multistep calculation in KB
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase2());

    // Phase 3: Peak 1 - Reverse problem for alphabet power N
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 5 [Пик 1]');
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase3());

    // Phase 4: Valley - Minimal bitness for N objects (2^k >= N)
    await expect(page.locator('#phase4')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 4 из 5 [Долина]');
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase4());

    // Phase 5: Culmination - Unicode UTF-16 transmission time
    await expect(page.locator('#phase5')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 5 из 5 [Кульминация]');
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase5());

    // Victory screen displayed
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Пройдено');
  });

  test('Error handling on Phase 1 recalculates and clears inputs', async ({ page }) => {
    await page.goto(taskUrl);

    await page.locator('#p1-input').fill('999999');
    await page.locator('#p1-btn').click();

    await expect(page.locator('#p1-feedback')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    await page.waitForTimeout(1500);
    await expect(page.locator('#p1-feedback')).toBeHidden();
  });
});
