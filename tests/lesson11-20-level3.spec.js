import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('Lesson 11-20 Level 3: Arcade Turing Kernel Defense', () => {

  test('should complete all 8 waves of Level 3 successfully', async ({ page }) => {
    // Navigate to the lesson page
    await page.goto('http://localhost:4321/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/20');
    
    // Force show iframe-3
    await page.evaluate(() => {
      document.getElementById('iframe-1').classList.remove('block');
      document.getElementById('iframe-1').classList.add('hidden');
      const iframe3 = document.getElementById('iframe-3');
      iframe3.classList.remove('hidden');
      iframe3.classList.add('block');
      iframe3.style.position = 'relative';
      iframe3.style.height = '800px';
      iframe3.style.width = '1000px';
    });
    
    const frame = page.frameLocator('#iframe-3');
    
    // Start game from briefing screen
    await expect(frame.locator('#start-btn')).toBeVisible();
    await frame.locator('#start-btn').click();
    
    // Complete all 8 waves
    for (let wave = 1; wave <= 8; wave++) {
      await expect(frame.locator('#phase-counter')).toContainText(`ВОЛНА ${wave} ИЗ 8`);
      
      // Wait for options to render and click the correct one
      const correctBtn = frame.locator('button[data-is-correct="true"]');
      await expect(correctBtn).toBeVisible();
      await correctBtn.click();
    }
    
    // Success screen
    await expect(frame.locator('#success-title')).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'scratch/scr_test_11_20_level3_end.png' });

    // Wait a bit for telemetry to be saved
    await page.waitForTimeout(1000);
    
    // Check DB
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' AND mission_name LIKE '%Урок 20%Уровень 3%' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.success).toBe(1);
  });

  test('should handle mistake with fatal error and reset to wave 1', async ({ page }) => {
    await page.goto('http://localhost:4321/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/20');
    
    // Force show iframe-3
    await page.evaluate(() => {
      document.getElementById('iframe-1').classList.remove('block');
      document.getElementById('iframe-1').classList.add('hidden');
      const iframe3 = document.getElementById('iframe-3');
      iframe3.classList.remove('hidden');
      iframe3.classList.add('block');
      iframe3.style.position = 'relative';
      iframe3.style.height = '800px';
      iframe3.style.width = '1000px';
    });
    
    const frame = page.frameLocator('#iframe-3');
    await expect(frame.locator('#start-btn')).toBeVisible();
    await frame.locator('#start-btn').click();
    
    await expect(frame.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 8');
    
    // Pass wave 1
    await frame.locator('button[data-is-correct="true"]').click();
    
    // In wave 2, make an intentional mistake
    await expect(frame.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 8');
    const wrongBtn = frame.locator('button[data-is-correct="false"]').first();
    await expect(wrongBtn).toBeVisible();
    await wrongBtn.click();
    
    // Verify fail screen
    await expect(frame.locator('#fail-title')).toBeVisible();
    
    // Wait for auto reset back to wave 1
    await expect(frame.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 8', { timeout: 5000 });
    
    // Check DB for hardcore_reset event
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'hardcore_reset' AND mission_name LIKE '%Урок 20%Уровень 3%' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
  });

});
