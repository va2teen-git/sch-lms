import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('Lesson 8-7 Level 1: Logical Statements Classifier', () => {

  test('should complete the level successfully by sorting cards into buckets', async ({ page }) => {
    // Navigate to lesson 7 page
    await page.goto('http://localhost:4321/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7');
    
    // Wait for iframe 1
    const frame = page.frameLocator('#iframe-1');
    
    // Complete 3 phases
    for (let phase = 1; phase <= 3; phase++) {
      await expect(frame.locator('#phase-badge')).toContainText(`Шаг ${phase} из 3`);

      // Find all cards in pool
      const pool = frame.locator('#cards-pool');
      await expect(pool).toBeVisible();

      // Solve all cards in this phase
      let cardsCount = await pool.locator('.card-token').count();
      while (cardsCount > 0) {
        const card = pool.locator('.card-token').first();
        const category = await card.getAttribute('data-category');
        
        // Select card by click
        await card.click();

        // Click target bucket header (guaranteed no card inside header, clean bubbling)
        let targetHeader = '#bucket-true .card-header';
        if (category === 'false') {
          targetHeader = '#bucket-false .card-header';
        } else if (category === 'not_statement') {
          targetHeader = '#bucket-not-statement .card-header';
        }

        await frame.locator(targetHeader).click();
        await page.waitForTimeout(100);

        cardsCount = await pool.locator('.card-token').count();
      }

      // Verify button should now be enabled
      const verifyBtn = frame.locator('#verify-btn');
      await expect(verifyBtn).toBeEnabled();
      await verifyBtn.click();
      await page.waitForTimeout(300);
    }

    // Check DB for telemetry level_complete
    const db = new sqlite3('telemetry.db');
    await expect.poll(() => {
      return db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' AND mission_name LIKE '%Урок 7%Уровень 1%' ORDER BY id DESC LIMIT 1`).get();
    }, { timeout: 10000 }).toBeDefined();

    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' AND mission_name LIKE '%Урок 7%Уровень 1%' ORDER BY id DESC LIMIT 1`).get();
    expect(row.success).toBe(1);

    // Verify platform unlocked level 2 tab
    await expect(page.locator('button[data-target="iframe-2"]')).toBeVisible();
    await expect(page.locator('button[data-target="iframe-2"]')).not.toHaveClass(/cursor-not-allowed/);
  });

  test('should handle incorrect classification and trigger hardcore reset', async ({ page }) => {
    await page.goto('http://localhost:4321/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7');

    // Enable Hardcore mode
    await page.evaluate(() => {
      localStorage.setItem('hardcore_mode', 'true');
    });
    await page.reload();

    const frame = page.frameLocator('#iframe-1');
    await expect(frame.locator('#phase-badge')).toContainText('Шаг 1 из 3');

    const pool = frame.locator('#cards-pool');
    await expect(pool).toBeVisible();

    // Deliberately move cards to the incorrect bucket
    let cardsCount = await pool.locator('.card-token').count();
    while (cardsCount > 0) {
      const card = pool.locator('.card-token').first();
      await card.click();
      // Click header of #bucket-false
      await frame.locator('#bucket-false .card-header').click();
      await page.waitForTimeout(100);
      cardsCount = await pool.locator('.card-token').count();
    }

    // Handle hardcore dialog
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('ОШИБКА В РЕЖИМЕ ХАРДКОРА');
      await dialog.accept();
    });

    const verifyBtn = frame.locator('#verify-btn');
    await expect(verifyBtn).toBeEnabled();
    await verifyBtn.click();

    // Check DB for hardcore_reset event
    const db = new sqlite3('telemetry.db');
    await expect.poll(() => {
      return db.prepare(`SELECT * FROM telemetry WHERE action_type = 'hardcore_reset' AND mission_name LIKE '%Урок 7%Уровень 1%' ORDER BY id DESC LIMIT 1`).get();
    }, { timeout: 10000 }).toBeDefined();

    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'hardcore_reset' AND mission_name LIKE '%Урок 7%Уровень 1%' ORDER BY id DESC LIMIT 1`).get();
    expect(row.is_hardcore).toBe(1);
  });

});
