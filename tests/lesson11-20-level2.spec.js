import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('Lesson 11-20 Level 2: Advanced Turing Machine', () => {

  test('should complete Level 2 successfully with text inputs', async ({ page }) => {
    // Navigate to the lesson page
    await page.goto('http://localhost:4321/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/20');
    
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
    
    // Phase 1: Command Synthesis
    await expect(frame.locator('#phase1')).toBeVisible();
    
    const reqSym = await frame.locator('#p1-req-sym').innerText();
    const dirText = await frame.locator('#p1-req-dir-text').innerText();
    const reqNext = await frame.locator('#p1-req-next').innerText();
    
    let dirCode = 'S';
    if (dirText.includes('влево')) dirCode = 'L';
    else if (dirText.includes('вправо')) dirCode = 'R';
    
    const p1Answer = `${reqSym.trim()} ${dirCode} ${reqNext.trim()}`;
    await frame.locator('#p1-input').fill(p1Answer);
    await frame.locator('#p1-btn').click();
    
    // Phase 2: Tape Transformation
    await expect(frame.locator('#phase1')).toBeHidden();
    await expect(frame.locator('#phase2')).toBeVisible();
    
    // Read command: "q1 X → Y D qZ"
    const cmdText = await frame.locator('#p2-cmd-display').innerText();
    const parts = cmdText.split('→').map(s => s.trim());
    const newSym = parts[1].split(' ')[0].trim();
    
    // Find active cell and build 3-bit word
    const cells = frame.locator('#p2-tape-display > div');
    const cellCount = await cells.count();
    let wordBits = [];
    
    for (let i = 0; i < cellCount; i++) {
      const cell = cells.nth(i);
      const isCurrent = await cell.locator('.text-warning').count() > 0;
      if (isCurrent) {
        wordBits.push(newSym);
      } else {
        const char = await cell.locator('div').first().innerText();
        wordBits.push(char.trim());
      }
    }
    const p2Answer = wordBits.join('');
    await frame.locator('#p2-input').fill(p2Answer);
    await frame.locator('#p2-btn').click();
    
    // Phase 3: Unary Computation
    await expect(frame.locator('#phase2')).toBeHidden();
    await expect(frame.locator('#phase3')).toBeVisible();
    
    const tableText = await frame.locator('#p3-table').innerText();
    const countVal = parseInt(await frame.locator('#p3-dec').innerText(), 10);
    
    let p3Answer = '';
    if (tableText.includes('1 S q0')) {
      // n + 1
      p3Answer = (countVal + 1).toString();
    } else {
      // n - 1
      p3Answer = (countVal - 1).toString();
    }
    
    await frame.locator('#p3-input').fill(p3Answer);
    await frame.locator('#p3-btn').click();
    
    // Phase 4: Binary Increment
    await expect(frame.locator('#phase3')).toBeHidden();
    await expect(frame.locator('#phase4')).toBeVisible();
    
    const binWord = await frame.locator('#p4-bin-word').innerText();
    const decNum = parseInt(binWord.trim(), 2);
    const p4Answer = (decNum + 1).toString(2);
    
    await frame.locator('#p4-input').fill(p4Answer);
    await frame.locator('#p4-btn').click();
    
    // Phase 5: Halting Analysis
    await expect(frame.locator('#phase4')).toBeHidden();
    await expect(frame.locator('#phase5')).toBeVisible();
    
    const p5TableText = await frame.locator('#p5-table').innerText();
    let p5Answer = '';
    
    if (p5TableText.includes('q2')) {
      p5Answer = 'LOOP';
    } else {
      const tapeLine = await frame.locator('#p5-tape-word').innerText();
      const onesCount = (tapeLine.match(/1/g) || []).length;
      p5Answer = (onesCount + 1).toString();
    }
    
    await frame.locator('#p5-input').fill(p5Answer);
    await frame.locator('#p5-btn').click();
    
    // Success screen
    await expect(frame.locator('#phase5')).toBeHidden();
    await expect(frame.locator('#success-screen')).toBeAttached();
    
    // Take screenshot
    await page.screenshot({ path: 'scratch/scr_test_11_20_level2_end.png' });

    // Wait a bit for telemetry to be saved
    await page.waitForTimeout(1000);
    
    // Check DB
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' AND mission_name LIKE '%Урок 20%Уровень 2%' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.success).toBe(1);
  });

  test('should handle error properly and hardcore reset behavior on Level 2', async ({ page }) => {
    await page.goto('http://localhost:4321/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/20');
    
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
    
    // Fill intentionally wrong answer
    await frame.locator('#p1-input').fill('INVALID_COMMAND_XYZ');
    
    // Listen to alert on main page
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('ОШИБКА В РЕЖИМЕ ХАРДКОРА');
      await dialog.accept();
    });
    
    await frame.locator('#p1-btn').click();
    
    // Wait for the iframe to reload and phase 1 to be visible again
    await page.waitForTimeout(1000);
    
    // Check DB for hardcore_reset event
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'hardcore_reset' AND mission_name LIKE '%Урок 20%Уровень 2%' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.is_hardcore).toBe(1);
  });

});
