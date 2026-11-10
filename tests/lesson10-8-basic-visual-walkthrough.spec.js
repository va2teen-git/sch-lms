import { test, expect } from '@playwright/test';

test.describe('Grade 10 Basic Lesson 8: Visual UX and Walkthrough Test Suite', () => {

  test('Level 1: Visual layout, contrast, and badges check', async ({ page }) => {
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level1');
    
    await expect(page.locator('#game-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');
    await expect(page.locator('#phase1-container')).toBeVisible();

    // Verify 3 bucket containers
    const buckets = page.locator('.target-bucket');
    await expect(buckets).toHaveCount(3);
  });

  test('Level 2: Visual layout and input visibility', async ({ page }) => {
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level2');

    await expect(page.locator('#game-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#p1-input')).toBeVisible();
    await expect(page.locator('#p1-btn')).toBeVisible();
  });

  test('Level 3: Arcade visual HUD, timer bar and responsive gateways', async ({ page }) => {
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level3');

    await expect(page.locator('#start-btn')).toBeVisible();
    await page.locator('#start-btn').click();

    await expect(page.locator('#wave-counter-badge')).toBeVisible();
    await expect(page.locator('.progress-bar')).toBeVisible();
    await expect(page.locator('#gate-sufficient-btn')).toBeVisible();
    await expect(page.locator('#gate-overflow-btn')).toBeVisible();
  });
});
