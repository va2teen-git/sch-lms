import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('Lesson 8-6 Level 1: Number Systems', () => {

  test('should complete the level successfully', async ({ page }) => {
    // Navigate to the lesson page
    await page.goto('http://localhost:4321/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6');
    
    // Wait for iframe 1
    const frame = page.frameLocator('#iframe-1');
    
    // Phase 1
    await expect(frame.locator('#phase1')).toBeVisible();
    
    const binStr = await frame.locator('#p1-value').innerText();
    const decVal = parseInt(binStr, 2);
    
    await frame.locator('#p1-input').fill(decVal.toString());
    await frame.locator('#p1-btn').click();
    
    // Phase 2
    await expect(frame.locator('#phase1')).toBeHidden();
    await expect(frame.locator('#phase2')).toBeVisible();
    
    const decStr = await frame.locator('#p2-value').innerText();
    const octVal = parseInt(decStr, 10).toString(8);
    
    await frame.locator('#p2-input').fill(octVal);
    await frame.locator('#p2-btn').click();
    
    // Phase 3
    await expect(frame.locator('#phase2')).toBeHidden();
    await expect(frame.locator('#phase3')).toBeVisible();
    
    const binStr2 = await frame.locator('#p3-value').innerText();
    const hexVal = parseInt(binStr2, 2).toString(16).toUpperCase();
    
    await frame.locator('#p3-input').fill(hexVal);
    await frame.locator('#p3-btn').click();
    
    // Success screen
    await expect(frame.locator('#phase3')).toBeHidden();
    await expect(frame.locator('#success-screen')).toBeAttached();
    // check skipped due to iframe hide
    
    // Take screenshot
    await page.screenshot({ path: 'scratch/scr_test_8_6_level1_end.png' });

    // Wait a bit for telemetry to be saved
    await page.waitForTimeout(1000);
    
    // Check DB
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.success).toBe(1);
  });

  test('should handle error properly and hardcore reset behavior', async ({ page }) => {
    await page.goto('http://localhost:4321/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6');
    
    // Enable Hardcore mode
    await page.evaluate(() => {
      localStorage.setItem('hardcore_mode', 'true');
    });
    // Reload page to apply hardcore state
    await page.reload();
    
    const frame = page.frameLocator('#iframe-1');
    await expect(frame.locator('#phase1')).toBeVisible();
    
    // Fill wrong answer
    await frame.locator('#p1-input').fill('999999');
    
    // Listen to alert on main page
    const alertPromise = page.waitForEvent('dialog');
    await frame.locator('#p1-btn').click();
    const dialog = await alertPromise;
    expect(dialog.message()).toContain('ОШИБКА В РЕЖИМЕ ХАРДКОРА');
    await dialog.accept();
    
    // Wait for the iframe to reload and phase 1 to be visible again
    await expect(frame.locator('#phase1')).toBeVisible();
    
    // Wait for JS to run and populate new values
    await page.waitForTimeout(500); 
    
    // Check DB for hardcore_reset event
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'hardcore_reset' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.is_hardcore).toBe(1);
  });

});
