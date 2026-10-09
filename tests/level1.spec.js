import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('Level 1: AI Evolution', () => {

  test('should complete the level successfully', async ({ page }) => {
    await page.goto('http://localhost:4321/lesson/11-класс_углубленный/18');
    
    // Wait for iframe 1
    const frame = page.frameLocator('#iframe-1');
    
    // Phase 1
    await expect(frame.locator('#phase1')).toBeVisible();
    
    const x1 = await frame.locator('#p1-x1').innerText();
    const x2 = await frame.locator('#p1-x2').innerText();
    const w1 = await frame.locator('#p1-w1').innerText();
    const w2 = await frame.locator('#p1-w2').innerText();
    
    const s = parseInt(x1) * parseInt(w1) + parseInt(x2) * parseInt(w2);
    
    await frame.locator('#p1-input').fill(s.toString());
    await frame.locator('#p1-btn').click();
    
    // Phase 2
    await expect(frame.locator('#phase1')).toBeHidden();
    await expect(frame.locator('#phase2')).toBeVisible();
    
    const T = await frame.locator('#p2-t').innerText();
    const P = await frame.locator('#p2-p').innerText();
    const L = await frame.locator('#p2-l').innerText();
    
    const delta = (parseInt(T) - parseInt(P)) * parseFloat(L);
    
    await frame.locator('#p2-input').fill(delta.toString());
    await frame.locator('#p2-btn').click();
    
    // Phase 3
    await expect(frame.locator('#phase2')).toBeHidden();
    await expect(frame.locator('#phase3')).toBeVisible();
    
    const N = await frame.locator('#p3-n').innerText();
    const K = await frame.locator('#p3-k').innerText();
    const T_gpu = await frame.locator('#p3-t').innerText();
    
    const time = (parseInt(N) / parseInt(K)) * parseInt(T_gpu);
    
    await frame.locator('#p3-input').fill(time.toString());
    await frame.locator('#p3-btn').click();
    
    // Success screen
    await expect(frame.locator('#phase3')).toBeHidden();
    await expect(frame.locator('#success-screen')).toBeVisible();
    await expect(frame.locator('#success-screen')).toContainText('СИСТЕМА ОБУЧЕНА');
    
    // Wait a bit for telemetry to be saved
    await page.waitForTimeout(1000);
    
    // Check DB
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.success).toBe(1);
  });

  test('should handle error properly and hardcore reset behavior', async ({ page }) => {
    await page.goto('http://localhost:4321/lesson/11-класс_углубленный/18');
    
    // Enable Hardcore mode
    await page.evaluate(() => {
      localStorage.setItem('hardcore_mode', 'true');
    });
    // Reload page to apply hardcore state
    await page.reload();
    
    const frame = page.frameLocator('#iframe-1');
    await expect(frame.locator('#phase1')).toBeVisible();
    
    // Remember initial values
    const initial_x1 = await frame.locator('#p1-x1').innerText();
    
    // Fill wrong answer
    await frame.locator('#p1-input').fill('999999');
    
    // Listen to alert on main page
    const alertPromise = page.waitForEvent('dialog');
    await frame.locator('#p1-btn').click();
    const dialog = await alertPromise;
    expect(dialog.message()).toContain('ОШИБКА В РЕЖИМЕ ХАРДКОРА');
    await dialog.accept();
    
    // After hardcore reset, iframe is reloaded.
    // Wait for the iframe to reload and phase 1 to be visible again
    await expect(frame.locator('#phase1')).toBeVisible();
    
    // Wait for JS to run and populate new values (since iframe reloaded, it will have new values)
    await page.waitForTimeout(500); 
    const new_x1 = await frame.locator('#p1-x1').innerText();
    
    // Check DB for hardcore_reset event
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'hardcore_reset' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.is_hardcore).toBe(1);
  });

});
