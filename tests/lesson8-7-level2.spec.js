import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('Lesson 8-7 Level 2: Boolean Evaluator', () => {

  test('should complete the level successfully by solving 5 procedural phases', async ({ page }) => {
    await page.goto('http://localhost:4321/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7');

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

    // Phase 1: Number comparison
    await expect(frame.locator('#phase1')).toBeVisible();
    const p1Param = await frame.locator('#p1-param').innerText();
    const p1Stmt = await frame.locator('#p1-statement').innerText();
    const val1 = parseInt(p1Param.replace('x =', '').trim(), 10);
    const m1 = p1Stmt.match(/x\s*(>|<|≥|≤|==|≠)\s*(\d+)/);
    const op1 = m1[1];
    const threshold1 = parseInt(m1[2], 10);
    let ans1 = false;
    if (op1 === '>') ans1 = val1 > threshold1;
    else if (op1 === '<') ans1 = val1 < threshold1;
    else if (op1 === '≥') ans1 = val1 >= threshold1;
    else if (op1 === '≤') ans1 = val1 <= threshold1;
    else if (op1 === '==') ans1 = val1 === threshold1;
    else if (op1 === '≠') ans1 = val1 !== threshold1;
    await frame.locator('#p1-input').fill(ans1 ? '1' : '0');
    await frame.locator('#p1-btn').click();

    // Phase 2: Divisibility
    await expect(frame.locator('#phase1')).toBeHidden();
    await expect(frame.locator('#phase2')).toBeVisible();
    const p2Stmt = await frame.locator('#p2-statement').innerText();
    let ans2 = false;
    if (p2Stmt.includes('делится нацело на')) {
      const m = p2Stmt.match(/Число\s*(\d+)\s*делится нацело на\s*(\d+)/);
      ans2 = (parseInt(m[1], 10) % parseInt(m[2], 10) === 0);
    } else if (p2Stmt.includes('нечётным') || p2Stmt.includes('нечетным')) {
      const m = p2Stmt.match(/Число\s*(\d+)/);
      ans2 = (parseInt(m[1], 10) % 2 !== 0);
    } else if (p2Stmt.includes('чётным') || p2Stmt.includes('четным')) {
      const m = p2Stmt.match(/Число\s*(\d+)/);
      ans2 = (parseInt(m[1], 10) % 2 === 0);
    }
    await frame.locator('#p2-input').fill(ans2 ? '1' : '0');
    await frame.locator('#p2-btn').click();

    // Phase 3: Number systems equivalence
    await expect(frame.locator('#phase2')).toBeHidden();
    await expect(frame.locator('#phase3')).toBeVisible();
    const p3Stmt = await frame.locator('#p3-statement').innerText();
    let ans3 = false;
    if (p3Stmt.includes('₂ == ') && p3Stmt.includes('₁₀')) {
      const m = p3Stmt.match(/([01]+)₂\s*==\s*(\d+)₁₀/);
      ans3 = (parseInt(m[1], 2) === parseInt(m[2], 10));
    } else if (p3Stmt.includes('₁₆ == ') && p3Stmt.includes('₁₀')) {
      const m = p3Stmt.match(/([0-9A-F]+)₁₆\s*==\s*(\d+)₁₀/);
      ans3 = (parseInt(m[1], 16) === parseInt(m[2], 10));
    } else if (p3Stmt.includes('₂ == ') && p3Stmt.includes('₁₆')) {
      const m = p3Stmt.match(/([01]+)₂\s*==\s*([0-9A-F]+)₁₆/);
      ans3 = (parseInt(m[1], 2) === parseInt(m[2], 16));
    }
    await frame.locator('#p3-input').fill(ans3 ? '1' : '0');
    await frame.locator('#p3-btn').click();

    // Phase 4: Compound logical rules (AND / OR)
    await expect(frame.locator('#phase3')).toBeHidden();
    await expect(frame.locator('#phase4')).toBeVisible();
    const p4Params = await frame.locator('#p4-params').innerText();
    const p4Stmt = await frame.locator('#p4-statement').innerText();
    const m4Params = p4Params.match(/порт\s*=\s*(\d+),\s*размер\s*=\s*(\d+)/);
    const port = parseInt(m4Params[1], 10);
    const size = parseInt(m4Params[2], 10);
    const c1 = port > 1024;
    const c2 = size < 1500;
    const ans4 = p4Stmt.includes(' ИЛИ ') ? (c1 || c2) : (c1 && c2);
    await frame.locator('#p4-input').fill(ans4 ? '1' : '0');
    await frame.locator('#p4-btn').click();

    // Phase 5: Boundary value calculation
    await expect(frame.locator('#phase4')).toBeHidden();
    await expect(frame.locator('#phase5')).toBeVisible();
    const p5Stmt = await frame.locator('#p5-statement').innerText();
    const p5Instr = await frame.locator('#p5-target-instruction').innerText();
    const isMax = p5Instr.includes('НАИБОЛЬШЕЕ');
    let ans5 = 0;
    if (isMax) {
      const m = p5Stmt.match(/\(x\s*>\s*(\d+)\)\s*И\s*\(x\s*(<|≤)\s*(\d+)\)/);
      const isStrictB = (m[2] === '<');
      const b = parseInt(m[3], 10);
      ans5 = isStrictB ? (b - 1) : b;
    } else {
      const m = p5Stmt.match(/\(x\s*(>|≥)\s*(\d+)\)\s*И\s*\(x\s*<\s*(\d+)\)/);
      const isStrictA = (m[1] === '>');
      const a = parseInt(m[2], 10);
      ans5 = isStrictA ? (a + 1) : a;
    }
    await frame.locator('#p5-input').fill(ans5.toString());
    await frame.locator('#p5-btn').click();

    // Success screen
    await expect(frame.locator('#phase5')).toBeHidden();
    await expect(frame.locator('#success-screen')).toBeVisible();

    // Check DB
    const db = new sqlite3('telemetry.db');
    await expect.poll(() => {
      return db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' AND mission_name LIKE '%Урок 7%Уровень 2%' ORDER BY id DESC LIMIT 1`).get();
    }, { timeout: 10000 }).toBeDefined();

    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' AND mission_name LIKE '%Урок 7%Уровень 2%' ORDER BY id DESC LIMIT 1`).get();
    expect(row.success).toBe(1);
  });

  test('should handle incorrect input and trigger hardcore reset in level 2', async ({ page }) => {
    await page.goto('http://localhost:4321/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7');

    await page.evaluate(() => {
      localStorage.setItem('hardcore_mode', 'true');
    });
    await page.reload();

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

    const db = new sqlite3('telemetry.db');
    const prevRow = db.prepare(`SELECT max(id) as maxId FROM telemetry`).get();
    const prevId = prevRow?.maxId || 0;

    // Fill obviously wrong input
    await frame.locator('#p1-input').fill('WRONG');

    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('ОШИБКА В РЕЖИМЕ ХАРДКОРА');
      await dialog.accept();
    });

    await frame.locator('#p1-btn').click();

    await expect.poll(() => {
      return db.prepare(`SELECT * FROM telemetry WHERE id > ? AND action_type = 'hardcore_reset' AND mission_name LIKE '%Урок 7%Уровень 2%' ORDER BY id DESC LIMIT 1`).get(prevId);
    }, { timeout: 10000 }).toBeDefined();

    const row = db.prepare(`SELECT * FROM telemetry WHERE id > ? AND action_type = 'hardcore_reset' AND mission_name LIKE '%Урок 7%Уровень 2%' ORDER BY id DESC LIMIT 1`).get(prevId);
    expect(row.is_hardcore).toBe(1);
  });

});
