import { test, expect } from '@playwright/test';

test.describe('Grade 10 Basic Lesson 8: Bandwidth Gatekeeper Arcade Level 3', () => {
  const taskUrl = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level3';

  test('Arcade Intro screen and initial state', async ({ page }) => {
    await page.goto(taskUrl);
    
    await expect(page.locator('#start-btn')).toBeVisible();
    await expect(page.locator('h1')).toContainText('BANDWIDTH GATEKEEPER');
  });

  test('Zero Multiple Choice check: arcade direct manipulation gateways', async ({ page }) => {
    await page.goto(taskUrl);
    await page.locator('#start-btn').click();

    // Verify no radio/select elements
    const radios = await page.locator('input[type="radio"]').count();
    expect(radios).toBe(0);

    const selects = await page.locator('select').count();
    expect(selects).toBe(0);

    // Verify direct gateway action buttons
    await expect(page.locator('#gate-sufficient-btn')).toBeVisible();
    await expect(page.locator('#gate-overflow-btn')).toBeVisible();
  });

  test('Waves 1-10: Flawless arcade run to victory screen', async ({ page }) => {
    await page.goto(taskUrl);
    await page.locator('#start-btn').click();

    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('#wave-counter-badge')).toContainText(`Волна ${w} из 10`);
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    }

    // Victory screen displayed
    await expect(page.locator('h3:has-text("АТТЕСТАЦИЯ АРКАДЫ ЗАВЕРШЕНА")')).toBeVisible();
    await expect(page.locator('#restart-arcade-btn')).toBeVisible();
  });

  test('Hardcore wipeout: error on wave triggers reset to Wave 1', async ({ page }) => {
    await page.goto(taskUrl);
    await page.locator('#start-btn').click();

    // Advance to wave 2
    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 2 из 10');

    // Make an intentional error on wave 2
    await page.evaluate(() => {
      const pkt = window.__DEV_LEVEL3_STATE__.getCurrentPacket();
      // Click opposite of correct choice
      window.__DEV_LEVEL3_STATE__.submitChoice(!pkt.isSufficient);
    });

    // Alert shown
    await expect(page.locator('.alert-danger')).toBeVisible();

    // Progress reset to wave 1
    await page.waitForTimeout(1800);
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');
  });
});
