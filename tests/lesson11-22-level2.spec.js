import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Lesson 11-22 Level 2: Post Machine Advanced Manual Input Suite', () => {
  const taskFile = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/22/level2.astro');
  const pageUrl = 'http://localhost:4321/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/22/level2';

  test('1. Architectural compliance and 5-phase structure', async () => {
    expect(fs.existsSync(taskFile)).toBe(true);
    const code = fs.readFileSync(taskFile, 'utf-8');

    // TaskLayout level 2
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout');
    expect(code).toContain('level={2}');

    // Zero <style> policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 22');

    // 5 Procedural phases
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="phase4"');
    expect(code).toContain('id="phase5"');
    expect(code).toContain('id="success-screen"');
  });

  test('2. Error handling and input validation in Phase 1', async ({ page }) => {
    await page.goto(pageUrl);
    await expect(page.locator('#phase1')).toBeVisible();

    await page.locator('#p1-input').fill('WRONG_COMMAND_123');
    await page.locator('#p1-btn').click();

    // Verify error feedback appears
    await expect(page.locator('#p1-feedback')).toBeVisible();
    await expect(page.locator('#phase1')).toBeVisible();
  });

  test('3. Full walkthrough via algorithmic solver (All 5 phases to Success Screen)', async ({ page }) => {
    test.setTimeout(40000);
    await page.goto(pageUrl);

    // ================= Phase 1 Solver =================
    await expect(page.locator('#phase1')).toBeVisible();
    const p1Desc = await page.locator('#p1-task-desc').innerText();

    let p1Cmd = '';
    if (p1Desc.includes('Поставить метку V')) {
      const match = p1Desc.match(/команде номер\s+(\d+)/);
      p1Cmd = `V ${match ? match[1] : '2'}`;
    } else if (p1Desc.includes('Стереть метку')) {
      const match = p1Desc.match(/команде номер\s+(\d+)/);
      p1Cmd = `. ${match ? match[1] : '2'}`;
    } else if (p1Desc.includes('вправо')) {
      const match = p1Desc.match(/команде номер\s+(\d+)/);
      p1Cmd = `→ ${match ? match[1] : '2'}`;
    } else if (p1Desc.includes('влево')) {
      const match = p1Desc.match(/команде номер\s+(\d+)/);
      p1Cmd = `← ${match ? match[1] : '2'}`;
    } else if (p1Desc.includes('Проверить метку')) {
      const match = p1Desc.match(/команде\s+(\d+).*команде\s+(\d+)/);
      p1Cmd = `? ${match ? match[1] : '2'}, ${match ? match[2] : '3'}`;
    }

    await page.locator('#p1-input').fill(p1Cmd);
    await page.locator('#p1-btn').click();

    // ================= Phase 2 Solver =================
    await expect(page.locator('#phase1')).toBeHidden();
    await expect(page.locator('#phase2')).toBeVisible();

    const p2Lines = await page.locator('#p2-prog-lines div').allInnerTexts();
    const p2InitCells = page.locator('#p2-tape-display .border');
    const p2Count = await p2InitCells.count();
    let p2Tape = [];
    for (let i = 0; i < p2Count; i++) {
      p2Tape.push((await p2InitCells.nth(i).innerText()).trim());
    }

    // Determine initial head
    let p2Head = 0;
    const p2Pointers = page.locator('#p2-tape-display .font-monospace.small');
    for (let i = 0; i < await p2Pointers.count(); i++) {
      if ((await p2Pointers.nth(i).innerText()).includes('▲')) {
        p2Head = i;
        break;
      }
    }

    // Simulate lines
    for (const rawLine of p2Lines) {
      const line = rawLine.trim();
      const parts = line.split('. ');
      const cmd = (parts[1] || '').trim();
      if (cmd.startsWith('←')) {
        p2Head = Math.max(0, p2Head - 1);
      } else if (cmd.startsWith('→')) {
        p2Head = Math.min(p2Tape.length - 1, p2Head + 1);
      } else if (cmd.startsWith('V')) {
        p2Tape[p2Head] = 'V';
      } else if (cmd.startsWith('.')) {
        p2Tape[p2Head] = '.';
      } else if (cmd.startsWith('!')) {
        break;
      }
    }

    const p2TapeString = p2Tape.join('');
    await page.locator('#p2-input').fill(p2TapeString);
    await page.locator('#p2-btn').click();

    // ================= Phase 3 Solver =================
    await expect(page.locator('#phase2')).toBeHidden();
    await expect(page.locator('#phase3')).toBeVisible();

    const countText = await page.locator('#p3-count-display').innerText();
    const countVal = parseInt(countText.trim(), 10);
    const expectedTicks = 2 * countVal + 3;

    await page.locator('#p3-input').fill(expectedTicks.toString());
    await page.locator('#p3-btn').click();

    // ================= Phase 4 Solver =================
    await expect(page.locator('#phase3')).toBeHidden();
    await expect(page.locator('#phase4')).toBeVisible();

    const aVal = parseInt((await page.locator('#p4-val-a').innerText()).trim(), 10);
    const bVal = parseInt((await page.locator('#p4-val-b').innerText()).trim(), 10);
    const sumVal = aVal + bVal;

    await page.locator('#p4-input').fill(sumVal.toString());
    await page.locator('#p4-btn').click();

    // ================= Phase 5 Solver =================
    await expect(page.locator('#phase4')).toBeHidden();
    await expect(page.locator('#phase5')).toBeVisible();

    const p5ProgText = await page.locator('#p5-prog-listing').innerText();
    const p5TapeCells = page.locator('#p5-tape-view .border');
    let p5CenterVal = (await p5TapeCells.nth(1).innerText()).trim();

    let expectedVerdict = 'OK';
    if (p5ProgText.includes('← 1') || p5ProgText.includes('? 1, 1')) {
      expectedVerdict = 'LOOP';
    } else if ((p5ProgText.includes('V 2') && p5CenterVal === 'V') || (p5ProgText.includes('. 2') && p5CenterVal === '.')) {
      expectedVerdict = 'CRASH';
    } else {
      expectedVerdict = 'OK';
    }

    await page.locator('#p5-input').fill(expectedVerdict);
    await page.locator('#p5-btn').click();

    // ================= Victory Screen =================
    await expect(page.locator('#phase5')).toBeHidden();
    await expect(page.locator('#success-screen')).toBeVisible();
    await expect(page.locator('#success-screen')).toContainText('УРОВЕНЬ 2 УСПЕШНО ПРОЙДЕН');
  });
});
