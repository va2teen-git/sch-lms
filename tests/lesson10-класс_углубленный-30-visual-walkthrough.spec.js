import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 30: Visual & Ergonomics Walkthrough with Screenshots', () => {
  const screenshotsDir = path.join(process.cwd(), 'tests/screenshots/lesson30');

  test.beforeAll(async () => {
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }
  });

  test('01. Lesson Split-Screen & Comprehensive Theory UI Walkthrough', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/lesson/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30');

    await expect(page.locator('h1, h2, .lead').first()).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '01_lesson30_theory_overview.png'), fullPage: false });
  });

  test('02. Level 1 - Complete 3-Phase Interactive Manipulation Walkthrough with Screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level1');

    // --- Phase 1: Slot & Snap ---
    await expect(page.locator('#phase1')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '02_level1_phase1_start.png') });

    const slotTargets = page.locator('.p1-slot-target');
    const slotCount = await slotTargets.count();
    const targetLettersText = await page.locator('#p1-target-letters').innerText();
    const targets = targetLettersText.split(',').map(s => s.trim());

    for (let i = 0; i < slotCount; i++) {
      await page.locator(`.p1-token-item[data-token="${targets[i]}"]`).click();
      await slotTargets.nth(i).click();
    }
    await page.screenshot({ path: path.join(screenshotsDir, '03_level1_phase1_solved.png') });
    await page.locator('#p1-submit-btn').click();

    // --- Phase 2: Markov Wiring ---
    await expect(page.locator('#phase2')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '04_level1_phase2_start.png') });

    const slotMappings = await page.evaluate(() => {
      // @ts-ignore
      return window.__DEV_P2_CONFIG__ ? window.__DEV_P2_CONFIG__.slots : [{ slotId: 's1', targetId: 'e1' }, { slotId: 's2', targetId: 'e2' }];
    });

    for (const sm of slotMappings) {
      await page.locator(`.p2-edge-item[data-edge-id="${sm.targetId}"]`).click();
      await page.locator(`.p2-slot-target[data-slot-id="${sm.slotId}"]`).click();
    }

    await page.screenshot({ path: path.join(screenshotsDir, '05_level1_phase2_wired.png') });
    await page.locator('#p2-trace-btn').click();
    await page.locator('#p2-submit-btn').waitFor({ state: 'visible', timeout: 4000 });
    await page.screenshot({ path: path.join(screenshotsDir, '06_level1_phase2_traced.png') });
    await page.locator('#p2-submit-btn').click();

    // --- Phase 3: Stream Carver ---
    await expect(page.locator('#phase3')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '07_level1_phase3_start.png') });

    const dictBadges = page.locator('#p3-dict-display > div');
    const dictCount = await dictBadges.count();
    const dictionary = [];
    for (let d = 0; d < dictCount; d++) {
      const text = await dictBadges.nth(d).innerText();
      const match = text.match(/Буква\s+([А-ЯЁ]):\s*([01]+)/);
      if (match) dictionary.push({ letter: match[1], code: match[2] });
    }
    dictionary.sort((a, b) => b.code.length - a.code.length);

    const bitCells = page.locator('#p3-tape-container > div.d-flex.align-items-center');
    const bitCount = await bitCells.count();
    let bitStream = '';
    for (let b = 0; b < bitCount; b++) {
      bitStream += (await bitCells.nth(b).innerText()).trim();
    }

    const cutButtons = page.locator('.p3-cut-btn');
    let pos = 0;
    while (pos < bitStream.length) {
      let matched = false;
      for (const item of dictionary) {
        if (bitStream.startsWith(item.code, pos)) {
          pos += item.code.length;
          matched = true;
          if (pos < bitStream.length) {
            await cutButtons.nth(pos - 1).click();
          }
          break;
        }
      }
      if (!matched) pos++;
    }

    await page.screenshot({ path: path.join(screenshotsDir, '08_level1_phase3_carved.png') });
    await page.locator('#p3-submit-btn').click();

    // Victory Screen
    await expect(page.locator('#victory-screen')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '09_level1_victory.png') });
  });

  test('03. Level 2 - Complete 5-Phase Sawtooth Walkthrough with Screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level2');

    // Phase 1
    await expect(page.locator('#phase1')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '10_level2_phase1.png') });
    const p1Word = (await page.locator('#p1-word-display').innerText()).trim();
    const p1Boxes = page.locator('#p1-table-display > div');
    const p1Count = await p1Boxes.count();
    const p1Map = {};
    for (let i = 0; i < p1Count; i++) {
      const txt = await p1Boxes.nth(i).innerText();
      const m = txt.match(/([А-ЯЁA-Z]):\s*([01]+)/);
      if (m) p1Map[m[1]] = m[2].length;
    }
    let p1Total = 0;
    for (const ch of p1Word) {
      if (p1Map[ch] !== undefined) p1Total += p1Map[ch];
    }
    await page.locator('#p1-input').fill(String(p1Total));
    await page.locator('#p1-submit-btn').click();

    // Phase 2
    await expect(page.locator('#phase2')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '11_level2_phase2.png') });
    const p2N = parseInt((await page.locator('#p2-length-display').innerText()).replace(/\D+/g, ''), 10);
    const p2Boxes = page.locator('#p2-table-display > div');
    const p2Count = await p2Boxes.count();
    let p2Avg = 0;
    for (let i = 0; i < p2Count; i++) {
      const txt = await p2Boxes.nth(i).innerText();
      const pMatch = txt.match(/\((\d+(?:\.\d+)?)%\)/);
      const lMatch = txt.match(/\((\d+)\s+бит\)/);
      if (pMatch && lMatch) {
        p2Avg += (parseFloat(pMatch[1]) / 100) * parseInt(lMatch[1], 10);
      }
    }
    const p2Bytes = Math.round((p2N * p2Avg) / 8);
    await page.locator('#p2-input').fill(String(p2Bytes));
    await page.locator('#p2-submit-btn').click();

    // Phase 3
    await expect(page.locator('#phase3')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '12_level2_phase3.png') });
    const p3Boxes = page.locator('#p3-table-display > div');
    const p3Count = await p3Boxes.count();
    const p3Codes = [];
    for (let i = 0; i < p3Count; i++) {
      const txt = await p3Boxes.nth(i).innerText();
      const m = txt.match(/Буква\s+([А-ЯЁA-Z]):\s*([01]+)/);
      if (m) p3Codes.push(m[2]);
    }
    const p3Cond = await page.locator('#p3-condition-display').innerText();

    const p3Ans = await page.evaluate(() => {
      // @ts-ignore
      return window.__DEV_LEVEL2_STATE__ ? window.__DEV_LEVEL2_STATE__.getCurrentVars().p3.correctCode : '111';
    });
    await page.locator('#p3-input').fill(p3Ans);
    await page.locator('#p3-submit-btn').click();

    // Phase 4
    await expect(page.locator('#phase4')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '13_level2_phase4.png') });
    const p4Target = parseInt((await page.locator('#p4-target-len').innerText()).replace(/\D+/g, ''), 10);
    const p4Boxes = page.locator('#p4-table-display > div');
    const p4Count = await p4Boxes.count();
    const p4Lens = [];
    for (let i = 0; i < p4Count; i++) {
      const txt = await p4Boxes.nth(i).innerText();
      const m = txt.match(/Буква\s+([А-ЯЁA-Z]):\s*([01]+)/);
      if (m) p4Lens.push(m[2].length);
    }
    let p4Ans = Math.pow(2, p4Target);
    for (const li of p4Lens) {
      if (p4Target >= li) p4Ans -= Math.pow(2, p4Target - li);
    }
    await page.locator('#p4-input').fill(String(p4Ans));
    await page.locator('#p4-submit-btn').click();

    // Phase 5
    await expect(page.locator('#phase5')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '14_level2_phase5.png') });
    const p5Stream = (await page.locator('#p5-stream-display').innerText()).trim();
    const p5Word1 = (await page.locator('#p5-word1-display').innerText()).trim();
    const p5FirstLetter = p5Word1[0];

    const p5Boxes = page.locator('#p5-table-display > div');
    const p5Count = await p5Boxes.count();
    const p5Dict = [];
    for (let i = 0; i < p5Count; i++) {
      const txt = await p5Boxes.nth(i).innerText();
      const m = txt.match(/Буква\s+([А-ЯЁA-Z]):\s*([01]+)/);
      if (m) p5Dict.push({ letter: m[1], code: m[2] });
    }

    function dfs(pos, curWord, isFirst) {
      if (pos === p5Stream.length) return curWord;
      for (const entry of p5Dict) {
        if (isFirst && entry.letter === p5FirstLetter) continue;
        if (p5Stream.startsWith(entry.code, pos)) {
          const res = dfs(pos + entry.code.length, curWord + entry.letter, false);
          if (res) return res;
        }
      }
      return null;
    }

    const p5Ans = dfs(0, '', true);
    await page.locator('#p5-input').fill(p5Ans);
    await page.locator('#p5-submit-btn').click();

    // Victory Screen
    await expect(page.locator('#victory-screen')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '15_level2_victory.png') });
  });

  test('04. Level 3 - Arcade Conveyor & Alarm Box Walkthrough with Screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level3');

    const startBtn = page.locator('#start-btn');
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1');
    await page.screenshot({ path: path.join(screenshotsDir, '16_level3_wave1_start.png') });

    // Trigger deliberate mistake to capture alarm screen
    const correctAction = await page.evaluate(() => {
      // @ts-ignore
      return window.__DEV_LEVEL3_STATE__ ? window.__DEV_LEVEL3_STATE__.solveCurrentWave() : 'prefix';
    });
    const wrongBtn = (correctAction === 'prefix') ? '#btn-gate-collision' : '#btn-gate-prefix';
    await page.locator(wrongBtn).click();

    await expect(page.locator('#alarm-box')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '17_level3_alarm_siren.png') });

    await page.waitForTimeout(1800);
    await expect(page.locator('#alarm-box')).toBeHidden();

    // Now solve all waves
    for (let w = 0; w < 10; w++) {
      if (w === 4) {
        await page.screenshot({ path: path.join(screenshotsDir, '18_level3_wave5_progress.png') });
      }

      const act = await page.evaluate(() => {
        // @ts-ignore
        return window.__DEV_LEVEL3_STATE__.solveCurrentWave();
      });

      if (act === 'prefix') await page.locator('#btn-gate-prefix').click();
      else if (act === 'postfix') await page.locator('#btn-gate-postfix').click();
      else await page.locator('#btn-gate-collision').click();

      if (w < 9) {
        await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w + 2}`, { timeout: 3000 });
      }
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotsDir, '19_level3_victory.png') });
  });
});
