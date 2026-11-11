import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('10th Grade Lesson 30: Level 2 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — enters wrong answer on Phase 1, observes feedback, recovers and advances', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level2');

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');

    // Novice mistake: enters wrong length
    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        await page.locator('#p1-input').fill('999');
        await page.locator('#p1-submit-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#feedback-box')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
      },
      solveCorrectlyFn: async () => {
        await page.waitForTimeout(1400);
        await expect(page.locator('#feedback-box')).toBeHidden();

        const word = (await page.locator('#p1-word-display').innerText()).trim();
        const boxes = page.locator('#p1-table-display > div');
        const count = await boxes.count();
        const map = {};
        for (let i = 0; i < count; i++) {
          const txt = await boxes.nth(i).innerText();
          const m = txt.match(/([А-ЯЁA-Z]):\s*([01]+)/);
          if (m) map[m[1]] = m[2].length;
        }

        let totalBits = 0;
        for (const ch of word) {
          if (map[ch] !== undefined) totalBits += map[ch];
        }

        await page.locator('#p1-input').fill(String(totalBits));
        await page.locator('#p1-submit-btn').click();
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase1')).toBeHidden();
        await expect(page.locator('#phase2')).toBeVisible();
        await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CARELESS — submits with spaces and Enter key in input', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level2');

    await expect(page.locator('#phase1')).toBeVisible();

    const word = (await page.locator('#p1-word-display').innerText()).trim();
    const boxes = page.locator('#p1-table-display > div');
    const count = await boxes.count();
    const map = {};
    for (let i = 0; i < count; i++) {
      const txt = await boxes.nth(i).innerText();
      const m = txt.match(/([А-ЯЁA-Z]):\s*([01]+)/);
      if (m) map[m[1]] = m[2].length;
    }

    let totalBits = 0;
    for (const ch of word) {
      if (map[ch] !== undefined) totalBits += map[ch];
    }

    // Careless inputs with surrounding whitespace and presses Enter
    const input = page.locator('#p1-input');
    await input.fill(`   ${totalBits}   `);
    await input.press('Enter');

    // Should successfully advance to Phase 2
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — verifies anti-paste protection across analytical inputs', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level2');

    // Attempt to paste forbidden string into input
    await sim.attemptProhibitedPaste(page.locator('#p1-input'), '999999');

    // Verify input did not accept pasted text
    const val = await page.locator('#p1-input').inputValue();
    expect(val).toBe('');

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — solves full 5-phase Sawtooth progression (Phases 1 to 5)', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level2');

    // Phase 1
    await expect(page.locator('#phase1')).toBeVisible();
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
    await sim.cognitivePause(40);
    await page.locator('#p1-submit-btn').click();

    // Phase 2
    await expect(page.locator('#phase2')).toBeVisible();
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
    await sim.cognitivePause(40);
    await page.locator('#p2-submit-btn').click();

    // Phase 3
    await expect(page.locator('#phase3')).toBeVisible();
    const p3Boxes = page.locator('#p3-table-display > div');
    const p3Count = await p3Boxes.count();
    const p3Codes = [];
    for (let i = 0; i < p3Count; i++) {
      const txt = await p3Boxes.nth(i).innerText();
      const m = txt.match(/Буква\s+([А-ЯЁA-Z]):\s*([01]+)/);
      if (m) p3Codes.push(m[2]);
    }
    const p3Cond = await page.locator('#p3-condition-display').innerText();

    function isFano(cand, existing) {
      for (const ex of existing) {
        if (cand.startsWith(ex) || ex.startsWith(cand)) return false;
      }
      return true;
    }

    const p3Ans = await page.evaluate(() => {
      // @ts-ignore
      return window.__DEV_LEVEL2_STATE__ ? window.__DEV_LEVEL2_STATE__.getCurrentVars().p3.correctCode : '111';
    });
    await page.locator('#p3-input').fill(p3Ans);
    await sim.cognitivePause(40);
    await page.locator('#p3-submit-btn').click();

    // Phase 4
    await expect(page.locator('#phase4')).toBeVisible();
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
    await sim.cognitivePause(40);
    await page.locator('#p4-submit-btn').click();

    // Phase 5
    await expect(page.locator('#phase5')).toBeVisible();
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
    await sim.cognitivePause(40);
    await page.locator('#p5-submit-btn').click();

    // Victory Screen
    await expect(page.locator('#victory-screen')).toBeVisible();
    sim.assertCleanSession();
  });
});
