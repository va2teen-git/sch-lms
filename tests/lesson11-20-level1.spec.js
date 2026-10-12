import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('Lesson 11-20 Level 1: Turing Machine', () => {

  test('should complete the level successfully', async ({ page }) => {
    // Navigate to the lesson page
    await page.goto('http://localhost:4321/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/20');
    await page.evaluate(() => localStorage.removeItem('hardcore_mode'));
    
    // Wait for iframe 1
    const frame = page.frameLocator('#iframe-1');
    
    // Phase 1: Anatomy of Turing Machine Command
    await expect(frame.locator('#phase1')).toBeVisible();
    
    const cmdText = await frame.locator('#p1-command-display').innerText();
    // Format: "qi aj → al D qk"
    const [fromPart, toPart] = cmdText.split('→').map(s => s.trim());
    const [newSym, dir, nextState] = toPart.split(' ');
    const dirName = dir === 'L' ? 'влево' : (dir === 'R' ? 'вправо' : 'на месте');
    
    // Find matching button
    const p1Buttons = frame.locator('#p1-options button');
    const p1Count = await p1Buttons.count();
    let clickedP1 = false;
    
    for (let i = 0; i < p1Count; i++) {
      const btn = p1Buttons.nth(i);
      const text = await btn.innerText();
      if (text.includes(`Записать '${newSym}'`) && text.includes(dirName) && text.includes(`состояние ${nextState}`)) {
        await btn.click();
        clickedP1 = true;
        break;
      }
    }
    expect(clickedP1).toBe(true);

    // Phase 2: Functional Transition Matrix
    await expect(frame.locator('#phase1')).toBeHidden();
    await expect(frame.locator('#phase2')).toBeVisible();
    
    const targetState = await frame.locator('#p2-curr-state').innerText();
    const targetSymbol = await frame.locator('#p2-curr-symbol').innerText();
    
    // Find matching option containing [ targetState targetSymbol →
    const p2Buttons = frame.locator('#p2-options button');
    const p2Count = await p2Buttons.count();
    let clickedP2 = false;
    
    // Find the exact cell command from the table
    const rowIndex = targetState.trim() === 'q1' ? 0 : 1;
    const colIndex = targetSymbol.trim() === 'λ' ? 1 : (targetSymbol.trim() === '0' ? 2 : 3);
    const cellCmd = (await frame.locator('#p2-table-body tr').nth(rowIndex).locator('td').nth(colIndex).innerText()).trim();
    
    const expectedOptionPrefix = `[ ${targetState.trim()} ${targetSymbol.trim()} → ${cellCmd} ]`;
    
    for (let i = 0; i < p2Count; i++) {
      const btn = p2Buttons.nth(i);
      const text = await btn.innerText();
      if (text.includes(expectedOptionPrefix)) {
        await btn.click();
        clickedP2 = true;
        break;
      }
    }
    expect(clickedP2).toBe(true);

    // Phase 3: Micro-program Trace
    await expect(frame.locator('#phase2')).toBeHidden();
    await expect(frame.locator('#phase3')).toBeVisible();
    
    const word = await frame.locator('#p3-initial-word').innerText();
    const startPos = await frame.locator('#p3-start-pos').innerText();
    
    let expectedWord = '';
    if (startPos.includes('первым')) {
      // Inversion
      expectedWord = word.split('').map(b => b === '1' ? '0' : '1').join('');
    } else {
      // Binary increment
      const num = parseInt(word, 2);
      expectedWord = (num + 1).toString(2);
    }
    
    await frame.locator('#p3-input').fill(expectedWord);
    await frame.locator('#p3-btn').click();
    
    // Success screen
    await expect(frame.locator('#phase3')).toBeHidden();
    await expect(frame.locator('#success-screen')).toBeAttached();
    
    // Take screenshot
    await page.screenshot({ path: 'scratch/scr_test_11_20_level1_end.png' });

    // Wait a bit for telemetry to be saved
    await page.waitForTimeout(1000);
    
    // Check DB
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' AND mission_name LIKE '%Урок 20%' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.success).toBe(1);
  });

  test('should handle error properly and hardcore reset behavior', async ({ page }) => {
    await page.goto('http://localhost:4321/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/20');
    
    // Enable Hardcore mode
    await page.evaluate(() => {
      localStorage.setItem('hardcore_mode', 'true');
    });
    // Reload page to apply hardcore state
    await page.reload();
    
    const frame = page.frameLocator('#iframe-1');
    await expect(frame.locator('#phase1')).toBeVisible();
    
    const cmdText = await frame.locator('#p1-command-display').innerText();
    const [fromPart, toPart] = cmdText.split('→').map(s => s.trim());
    const [newSym, dir, nextState] = toPart.split(' ');
    const dirName = dir === 'L' ? 'влево' : (dir === 'R' ? 'вправо' : 'на месте');
    
    // Pick an intentionally WRONG button
    const p1Buttons = frame.locator('#p1-options button');
    const p1Count = await p1Buttons.count();
    let wrongBtn = null;
    
    for (let i = 0; i < p1Count; i++) {
      const btn = p1Buttons.nth(i);
      const text = await btn.innerText();
      if (!text.includes(`Записать '${newSym}'`) || !text.includes(dirName) || !text.includes(`состояние ${nextState}`)) {
        wrongBtn = btn;
        break;
      }
    }
    expect(wrongBtn).not.toBeNull();
    
    // Listen to alert on main page
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('ОШИБКА В РЕЖИМЕ ХАРДКОРА');
      await dialog.accept();
    });
    
    await wrongBtn.click();
    
    // Wait for the iframe to reload and phase 1 to be visible again
    await expect(frame.locator('#phase1')).toBeVisible();
    
    // Wait for JS to run and populate new values
    await page.waitForTimeout(500); 
    
    // Check DB for hardcore_reset event
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'hardcore_reset' AND mission_name LIKE '%Урок 20%' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.is_hardcore).toBe(1);
  });

});
