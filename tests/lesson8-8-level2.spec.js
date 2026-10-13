import { test, expect } from '@playwright/test';

test.describe('Grade 8 Lesson 8: Logic Operations Level 2', () => {

  test('Zero Multiple Choice check: strictly manual keyboard inputs', async ({ page }) => {
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level2');

    // Ensure zero multiple-choice or radio inputs
    const radios = await page.locator('input[type="radio"]').count();
    expect(radios).toBe(0);

    const selects = await page.locator('select').count();
    expect(selects).toBe(0);

    // Verify all 5 phase inputs exist and are text or number
    for (let i = 1; i <= 5; i++) {
      const input = page.locator(`#p${i}-input`);
      await expect(input).toBeAttached();
      const type = await input.getAttribute('type');
      expect(['text', 'number']).toContain(type);
    }
  });

  test('Full Walkthrough: Complete all 5 phases and achieve success', async ({ page }) => {
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level2');

    // === PHASE 1 ===
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 1 из 5');

    const exp1 = await page.evaluate(() => window.__testState.getP1Expected());
    await page.locator('#p1-input').fill(exp1.toString());
    await page.locator('#p1-btn').click();

    // === PHASE 2 ===
    await expect(page.locator('#phase1')).toBeHidden();
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 2 из 5');

    const exp2 = await page.evaluate(() => window.__testState.getP2Expected());
    await page.locator('#p2-input').fill(exp2.toString());
    await page.locator('#p2-btn').click();

    // === PHASE 3 ===
    await expect(page.locator('#phase2')).toBeHidden();
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 3 из 5');

    const exp3 = await page.evaluate(() => window.__testState.getP3Expected());
    await page.locator('#p3-input').fill(exp3.toString());
    await page.locator('#p3-btn').click();

    // === PHASE 4 ===
    await expect(page.locator('#phase3')).toBeHidden();
    await expect(page.locator('#phase4')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 4 из 5');

    const exp4 = await page.evaluate(() => window.__testState.getP4Expected());
    await page.locator('#p4-input').fill(exp4.toString());
    await page.locator('#p4-btn').click();

    // === PHASE 5 ===
    await expect(page.locator('#phase4')).toBeHidden();
    await expect(page.locator('#phase5')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 5 из 5');

    const exp5 = await page.evaluate(() => window.__testState.getP5Expected());
    await page.locator('#p5-input').fill(exp5.toString());
    await page.locator('#p5-btn').click();

    // === SUCCESS SCREEN ===
    await expect(page.locator('#success-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#level-badge')).toHaveText('УСПЕХ');
  });

  test('Error handling and attempts counter behavior in Phase 1', async ({ page }) => {
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level2');

    // Get expected answer and enter the wrong one (inverted)
    const exp1 = await page.evaluate(() => window.__testState.getP1Expected());
    const wrongVal = exp1 === 1 ? '0' : '1';

    await page.locator('#p1-input').fill(wrongVal);
    await page.locator('#p1-btn').click();

    // Verify feedback is shown
    await expect(page.locator('#p1-feedback')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    // Feedback should disappear after regeneration timeout
    await expect(page.locator('#p1-feedback')).toBeHidden({ timeout: 3000 });
  });

  test('Keyboard navigation: pressing Enter submits input in Phase 1', async ({ page }) => {
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level2');

    const exp1 = await page.evaluate(() => window.__testState.getP1Expected());
    await page.locator('#p1-input').fill(exp1.toString());
    await page.locator('#p1-input').press('Enter');

    // Should advance to Phase 2
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 2 из 5');
  });

});
