import { test, expect } from '@playwright/test';

test.describe('Grade 10 Basic Lesson 8: Approaches to Information Measurement Level 1', () => {
  const taskUrl = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level1';

  test('Zero Multiple Choice check: no radio buttons or select dropdowns', async ({ page }) => {
    await page.goto(taskUrl);
    
    // Ensure no multiple-choice input elements
    const radios = await page.locator('input[type="radio"]').count();
    expect(radios).toBe(0);

    const selects = await page.locator('select').count();
    expect(selects).toBe(0);
  });

  test('Phase 1: Bucket sorting of event systems by Hartley information capacity', async ({ page }) => {
    await page.goto(taskUrl);

    await expect(page.locator('#phase1-container')).toBeVisible();
    await expect(page.locator('#p1-cards-pool')).toBeVisible();

    // Check cards in pool
    const cards = page.locator('#p1-cards-pool .card');
    await expect(cards).toHaveCount(7);

    // Place non-distractor cards into matching buckets
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase1());

    // Successfully transitioned to Phase 2
    await expect(page.locator('#phase2-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
  });

  test('Phase 2: Slot-puzzle covering degree and minimal bitness', async ({ page }) => {
    await page.goto(taskUrl);

    // Solve Phase 1 first
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase1());
    await expect(page.locator('#phase2-container')).toBeVisible();

    // Solve Phase 2
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase2());

    // Successfully transitioned to Phase 3
    await expect(page.locator('#phase3-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');
  });

  test('Phase 3: Pipeline construction for message volume I = K × i', async ({ page }) => {
    await page.goto(taskUrl);

    // Solve Phases 1 and 2
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase1());
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase2());
    await expect(page.locator('#phase3-container')).toBeVisible();

    // Solve Phase 3
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase3());

    // Victory screen displayed with 100% mastery
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Пройдено');
  });

  test('Error handling and procedural recalibration on mistake', async ({ page }) => {
    await page.goto(taskUrl);

    // Place distractor into bucket to trigger error
    await page.evaluate(() => {
      const dist = document.querySelector('#p1-cards-pool .card[data-category="distractor"]');
      const b2 = document.getElementById('bucket-2bit').querySelector('.bucket-slot');
      if (dist && b2) b2.appendChild(dist);
      document.getElementById('p1-submit-btn').disabled = false;
      document.getElementById('p1-submit-btn').click();
    });

    // Feedback box appears
    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    // Wait for recalibration
    await page.waitForTimeout(1400);
    await expect(page.locator('#feedback-box')).toBeHidden();
  });
});
