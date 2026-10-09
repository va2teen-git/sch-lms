import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('Lesson 8-6 Level 2: Low-Level Debugger', () => {

  test('should complete the level successfully', async ({ page }) => {
    // Navigate to the lesson page
    await page.goto('http://localhost:4321/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6');
    
    // Force show iframe-2
    await page.evaluate(() => {
      document.getElementById('iframe-1').classList.remove('block');
      document.getElementById('iframe-1').classList.add('hidden');
      const iframe2 = document.getElementById('iframe-2');
      iframe2.classList.remove('hidden');
      iframe2.classList.add('block');
      iframe2.style.position = 'relative';
      iframe2.style.height = '800px';
      iframe2.style.width = '1000px';
    });
    
    // Wait for iframe 2
    const frame = page.frameLocator('#iframe-2');
    
    // Phase 1 (Bin -> Hex)
    await expect(frame.locator('#phase1')).toBeVisible();
    
    const p1Bin = await frame.locator('#p1-value').innerText();
    const p1Hex = parseInt(p1Bin, 2).toString(16).toUpperCase();
    await frame.locator('#p1-input').fill(p1Hex);
    await frame.locator('#p1-btn').click();
    
    // Phase 2 (Hex -> Bin)
    await expect(frame.locator('#phase1')).toBeHidden();
    await expect(frame.locator('#phase2')).toBeVisible();
    
    const p2Hex = await frame.locator('#p2-value').innerText();
    const p2Bin = parseInt(p2Hex, 16).toString(2).padStart(8, '0');
    await frame.locator('#p2-input').fill(p2Bin);
    await frame.locator('#p2-btn').click();
    
    // Phase 3 (Hex -> Oct)
    await expect(frame.locator('#phase2')).toBeHidden();
    await expect(frame.locator('#phase3')).toBeVisible();
    
    const p3Hex = await frame.locator('#p3-value').innerText();
    const p3Oct = parseInt(p3Hex, 16).toString(8);
    await frame.locator('#p3-input').fill(p3Oct);
    await frame.locator('#p3-btn').click();
    
    // Phase 4 (Dec - Bin)
    await expect(frame.locator('#phase3')).toBeHidden();
    await expect(frame.locator('#phase4')).toBeVisible();
    
    const p4Dec = await frame.locator('#p4-val1').innerText();
    const p4Bin = await frame.locator('#p4-val2').innerText();
    const p4Result = (parseInt(p4Dec, 10) - parseInt(p4Bin, 2)).toString();
    await frame.locator('#p4-input').fill(p4Result);
    await frame.locator('#p4-btn').click();
    
    // Phase 5 (Oct + Oct + Oct)
    await expect(frame.locator('#phase4')).toBeHidden();
    await expect(frame.locator('#phase5')).toBeVisible();
    
    const p5o1 = await frame.locator('#p5-val1').innerText();
    const p5o2 = await frame.locator('#p5-val2').innerText();
    const p5o3 = await frame.locator('#p5-val3').innerText();
    const p5Result = (parseInt(p5o1, 8) + parseInt(p5o2, 8) + parseInt(p5o3, 8)).toString();
    await frame.locator('#p5-input').fill(p5Result);
    await frame.locator('#p5-btn').click();
    
    // Success screen
    await expect(frame.locator('#phase5')).toBeHidden();
    await expect(frame.locator('#success-screen')).toBeAttached();
    
    // Take screenshot
    await page.screenshot({ path: 'scratch/scr_test_8_6_level2_end.png' });

    // Wait a bit for telemetry to be saved
    await page.waitForTimeout(1000);
    
    // Check DB
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' AND mission_name LIKE '%Уровень 2%' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.success).toBe(1);
  });

  test('should handle hardcore reset properly', async ({ page }) => {
    await page.goto('http://localhost:4321/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6');
    
    // Enable Hardcore mode
    await page.evaluate(() => {
      localStorage.setItem('hardcore_mode', 'true');
    });
    // Reload page to apply hardcore state
    await page.reload();
    
    // Force show iframe-2
    await page.evaluate(() => {
      document.getElementById('iframe-1').classList.remove('block');
      document.getElementById('iframe-1').classList.add('hidden');
      const iframe2 = document.getElementById('iframe-2');
      iframe2.classList.remove('hidden');
      iframe2.classList.add('block');
      iframe2.style.position = 'relative';
      iframe2.style.height = '800px';
      iframe2.style.width = '1000px';
    });
    
    const frame = page.frameLocator('#iframe-2');
    await expect(frame.locator('#phase1')).toBeVisible();
    
    // Fill wrong answer
    await frame.locator('#p1-input').fill('WRONG');
    
    // Listen to alert on main page
    const alertPromise = page.waitForEvent('dialog');
    await frame.locator('#p1-btn').click();
    const dialog = await alertPromise;
    expect(dialog.message()).toContain('ОШИБКА В РЕЖИМЕ ХАРДКОРА');
    await dialog.accept();
    
    // Check DB for hardcore_reset event
    await page.waitForTimeout(500); 
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'hardcore_reset' AND mission_name LIKE '%Уровень 2%' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.is_hardcore).toBe(1);
  });

});
