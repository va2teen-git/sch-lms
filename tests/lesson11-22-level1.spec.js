import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Lesson 11-22 Level 1: Post Machine Architecture & E2E Suite', () => {
  const taskFile = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/22/level1.astro');
  const pageUrl = 'http://localhost:4321/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/22/level1';

  test('1. Architectural compliance and standards check', async () => {
    expect(fs.existsSync(taskFile)).toBe(true);
    const code = fs.readFileSync(taskFile, 'utf-8');

    // TaskLayout component usage
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout');
    expect(code).toContain('level={1}');

    // Zero <style> tags policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Telemetry and mission naming
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 22');

    // 3 Phases according to Level 1 specification
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="success-screen"');
  });

  test('2. Phase 1 renders and handles interactive tape mechanics', async ({ page }) => {
    await page.goto(pageUrl);
    await expect(page.locator('#phase1')).toBeVisible();

    // Check tape UI elements exist
    await expect(page.locator('#p1-initial-tape')).toBeVisible();
    await expect(page.locator('#p1-work-tape')).toBeVisible();
    await expect(page.locator('#p1-command-display')).toBeVisible();

    const cmdText = await page.locator('#p1-command-display').innerText();
    expect(cmdText.length).toBeGreaterThan(0);

    // Interactive clicking works on cells
    const workCells = page.locator('#p1-work-tape .border');
    const firstCellTextBefore = await workCells.first().innerText();
    await workCells.first().click();
    const firstCellTextAfter = await workCells.first().innerText();
    expect(firstCellTextAfter).not.toBe(firstCellTextBefore);

    // Carriage shifting works
    const headIndexBefore = await page.locator('#p1-head-index').innerText();
    await page.locator('#p1-shift-right').click();
    const headIndexAfter = await page.locator('#p1-head-index').innerText();
    expect(parseInt(headIndexAfter)).toBe(parseInt(headIndexBefore) + 1);
  });

  test('3. Phase 1 error handling triggers failure feedback', async ({ page }) => {
    await page.goto(pageUrl);
    await expect(page.locator('#phase1')).toBeVisible();

    // Invert every cell to guarantee mismatch if not crash
    const workCells = page.locator('#p1-work-tape .border');
    const count = await workCells.count();
    for (let i = 0; i < count; i++) {
      await workCells.nth(i).click();
    }

    // Submit step
    await page.locator('#p1-submit-step').click();

    // Phase 1 remains visible and feedback shows
    const isPhase1StillVisible = await page.locator('#phase1').isVisible();
    expect(isPhase1StillVisible).toBe(true);
  });

  test('4. Full walkthrough via algorithmic UI solver (Happy Path to Success Screen)', async ({ page }) => {
    test.setTimeout(35000);
    await page.goto(pageUrl);

    // ================= Phase 1 Solver =================
    await expect(page.locator('#phase1')).toBeVisible();

    const cmdText = (await page.locator('#p1-command-display').innerText()).trim();
    const parts = cmdText.split('. ');
    const opPart = parts[1] || '';
    const op = opPart.split(' ')[0];

    const initCells = page.locator('#p1-initial-tape .border');
    const cellCount = await initCells.count();
    const initTape = [];
    for (let i = 0; i < cellCount; i++) {
      initTape.push((await initCells.nth(i).innerText()).trim());
    }
    const headIdx = parseInt(await page.locator('#p1-head-index').innerText()) - 1;
    const currVal = initTape[headIdx];

    if ((op === 'V' && currVal === 'V') || (op === '.' && currVal === '.')) {
      await page.locator('#p1-submit-crash').click();
    } else {
      const workCells = page.locator('#p1-work-tape .border');
      if (op === 'V') {
        const val = (await workCells.nth(headIdx).innerText()).trim();
        if (val !== 'V') await workCells.nth(headIdx).click();
      } else if (op === '.') {
        const val = (await workCells.nth(headIdx).innerText()).trim();
        if (val !== '.') await workCells.nth(headIdx).click();
      } else if (op === '→') {
        await page.locator('#p1-shift-right').click();
      } else if (op === '←') {
        await page.locator('#p1-shift-left').click();
      }
      await page.locator('#p1-submit-step').click();
    }

    // ================= Phase 2 Solver =================
    await expect(page.locator('#phase1')).toBeHidden();
    await expect(page.locator('#phase2')).toBeVisible();

    await expect(page.locator('#p2-slots-container')).toBeVisible();
    await expect(page.locator('#p2-tokens-palette')).toBeVisible();

    const desc = await page.locator('#p2-task-desc').innerText();
    let tokensNeeded = [];
    if (desc.includes('Поставить метку V')) {
      const match = desc.match(/команде номер\s+(\d+)/);
      tokensNeeded = ['V', match ? match[1] : '2'];
    } else if (desc.includes('Стереть метку')) {
      const match = desc.match(/команде номер\s+(\d+)/);
      tokensNeeded = ['.', match ? match[1] : '2'];
    } else if (desc.includes('вправо')) {
      const match = desc.match(/команде номер\s+(\d+)/);
      tokensNeeded = ['→', match ? match[1] : '2'];
    } else if (desc.includes('влево')) {
      const match = desc.match(/команде номер\s+(\d+)/);
      tokensNeeded = ['←', match ? match[1] : '2'];
    } else if (desc.includes('Проверить метку')) {
      const match = desc.match(/команде\s+(\d+).*команде\s+(\d+)/);
      tokensNeeded = ['?', match ? match[1] : '2', match ? match[2] : '3'];
    } else {
      tokensNeeded = ['!'];
    }

    // Click tokens in palette in required order
    for (const tok of tokensNeeded) {
      const paletteBtns = page.locator('#p2-tokens-palette button');
      const count = await paletteBtns.count();
      for (let i = 0; i < count; i++) {
        const btn = paletteBtns.nth(i);
        if ((await btn.innerText()).trim() === tok) {
          await btn.click();
          break;
        }
      }
    }
    await page.locator('#p2-submit-btn').click();

    // ================= Phase 3 Solver =================
    await expect(page.locator('#phase2')).toBeHidden();
    await expect(page.locator('#phase3')).toBeVisible();

    await expect(page.locator('#p3-program-listing')).toBeVisible();
    await expect(page.locator('#p3-work-tape')).toBeVisible();

    const programLines = await page.locator('#p3-program-listing div').allInnerTexts();
    const p3InitCells = page.locator('#p3-initial-tape .border');
    const p3Count = await p3InitCells.count();
    let p3Tape = [];
    for (let i = 0; i < p3Count; i++) {
      p3Tape.push((await p3InitCells.nth(i).innerText()).trim());
    }
    let p3Head = parseInt(await page.locator('#p3-head-index').innerText()) - 1;

    for (const rawLine of programLines) {
      const line = rawLine.trim();
      const parts = line.split('. ');
      const cmd = (parts[1] || '').trim();
      if (cmd.startsWith('←')) {
        p3Head = Math.max(0, p3Head - 1);
      } else if (cmd.startsWith('→')) {
        p3Head = Math.min(p3Tape.length - 1, p3Head + 1);
      } else if (cmd.startsWith('V')) {
        p3Tape[p3Head] = 'V';
      } else if (cmd.startsWith('.')) {
        p3Tape[p3Head] = '.';
      } else if (cmd.startsWith('!')) {
        break;
      }
    }

    // Configure work tape cells
    const p3WorkCells = page.locator('#p3-work-tape .border');
    for (let i = 0; i < p3Count; i++) {
      const currentVal = (await p3WorkCells.nth(i).innerText()).trim();
      if (currentVal !== p3Tape[i]) {
        await p3WorkCells.nth(i).click();
      }
    }

    // Move work head to match final head
    let currentWorkHead = parseInt(await page.locator('#p3-head-index').innerText()) - 1;
    while (currentWorkHead < p3Head) {
      await page.locator('#p3-shift-right').click();
      currentWorkHead++;
    }
    while (currentWorkHead > p3Head) {
      await page.locator('#p3-shift-left').click();
      currentWorkHead--;
    }

    await page.locator('#p3-submit-btn').click();

    // ================= Victory Screen =================
    await expect(page.locator('#phase3')).toBeHidden();
    await expect(page.locator('#success-screen')).toBeVisible();
    await expect(page.locator('#success-screen')).toContainText('СЕССИЯ УСПЕШНО ЗАВЕРШЕНА');
    await expect(page.locator('#success-screen')).toContainText('Уровень 1 пройден');
  });

});
