import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('Lesson 8-6 Level 3: RAID Defragmentation (Vue)', () => {

  test('should complete the level successfully', async ({ page }) => {
    // Navigate to the lesson page
    await page.goto('http://localhost:4321/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6');
    
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
    
    // Check intro screen
    await expect(frame.locator('#start-btn')).toBeVisible();
    await frame.locator('#start-btn').click();
    
    // We need to complete 10 phases
    for (let i = 0; i < 10; i++) {
      await expect(frame.locator('#target-value')).toBeVisible();
      const targetStr = await frame.locator('#target-value').innerText();
      const targetDec = parseInt(targetStr, 10);
      
      // Find the correct cell
      const cells = await frame.locator('.cell-btn').all();
      expect(cells.length).toBe(9);
      
      let clicked = false;
      for (const cell of cells) {
        const isCorrect = await cell.getAttribute('data-is-correct');
        if (isCorrect === 'true') {
          // Verify math
          const cellValue = parseInt(await cell.getAttribute('data-value'), 10);
          expect(cellValue).toBe(targetDec);
          
          await cell.click();
          clicked = true;
          break;
        }
      }
      expect(clicked).toBe(true);
      
      // small delay to let Vue reactive state update
      await page.waitForTimeout(100);
    }
    
    // Check success screen
    await expect(frame.locator('#success-title')).toBeVisible();
    
    // Check DB
    await page.waitForTimeout(500);
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' AND mission_name LIKE '%Уровень 3%' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.success).toBe(1);
  });

  test('should handle hardcore reset on wrong click', async ({ page }) => {
    await page.goto('http://localhost:4321/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6');
    
    // Enable Hardcore mode
    await page.evaluate(() => {
      localStorage.setItem('hardcore_mode', 'true');
    });
    await page.reload();
    
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
    await frame.locator('#start-btn').click();
    
    // Find WRONG cell
    const cells = await frame.locator('.cell-btn').all();
    let wrongCell = null;
    for (const cell of cells) {
      if (await cell.getAttribute('data-is-correct') === 'false') {
        wrongCell = cell;
        break;
      }
    }
    expect(wrongCell).not.toBeNull();
    
    // Listen to alert on main page
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('ОШИБКА В РЕЖИМЕ ХАРДКОРА');
      await dialog.accept();
    });
    
    await wrongCell.click();
    
    // Check DB for hardcore_reset event
    await page.waitForTimeout(1000); 
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'hardcore_reset' AND mission_name LIKE '%Уровень 3%' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.is_hardcore).toBe(1);
  });
});
