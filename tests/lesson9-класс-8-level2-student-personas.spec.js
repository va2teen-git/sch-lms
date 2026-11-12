import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('9th Grade Lesson 8: Level 2 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — enters wrong answer on Phase 1, observes feedback, recovers and advances', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(encodeURI('/tasks/9-класс/8/level2'));

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');

    // Novice mistake: counts all ones without dividing by 2
    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        const totalOnes = await page.evaluate(() => {
          const cells = Array.from(document.querySelectorAll('#p1-matrix-tbody td'));
          let ones = 0;
          cells.forEach(td => { if (td.textContent.trim() === '1') ones++; });
          return ones;
        });
        await sim.humanType(page.locator('#p1-input'), totalOnes);
        await page.locator('#p1-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#status-alert')).toBeVisible();
        await expect(page.locator('#status-alert')).toHaveClass(/alert-danger/);
        await expect(page.locator('#attempts-display')).toHaveText('1');
      },
      solveCorrectlyFn: async () => {
        await page.waitForTimeout(1400);
        await expect(page.locator('#status-alert')).toBeHidden();

        const p1Correct = await page.evaluate(() => {
          const cells = Array.from(document.querySelectorAll('#p1-matrix-tbody td'));
          let ones = 0;
          cells.forEach(td => { if (td.textContent.trim() === '1') ones++; });
          return ones / 2;
        });
        await sim.humanType(page.locator('#p1-input'), p1Correct);
        await page.locator('#p1-btn').click();
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase1')).toBeHidden({ timeout: 3000 });
        await expect(page.locator('#phase2')).toBeVisible();
        await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CARELESS — submits with spaces and Enter key in input', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(encodeURI('/tasks/9-класс/8/level2'));

    await expect(page.locator('#phase1')).toBeVisible();

    const p1Answer = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('#p1-matrix-tbody td'));
      let ones = 0;
      cells.forEach(td => { if (td.textContent.trim() === '1') ones++; });
      return ones / 2;
    });

    // Submits with accidental padding spaces and Enter key
    await sim.humanType(page.locator('#p1-input'), p1Answer, {
      trailingSpaces: true,
      submitWithEnter: true
    });

    await expect(page.locator('#phase2')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — verifies anti-paste protection across analytical inputs', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(encodeURI('/tasks/9-класс/8/level2'));

    // Attempt to paste forbidden string into input
    await sim.attemptProhibitedPaste(page.locator('#p1-input'), '999999');

    // Verify input did not accept pasted text
    const val = await page.locator('#p1-input').inputValue();
    expect(val).toBe('');

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — solves full 5-phase Sawtooth progression (Phases 1 to 5)', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto(encodeURI('/tasks/9-класс/8/level2'));

    // Phase 1
    await expect(page.locator('#phase1')).toBeVisible();
    const p1Ans = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('#p1-matrix-tbody td'));
      let ones = 0;
      cells.forEach(td => { if (td.textContent.trim() === '1') ones++; });
      return ones / 2;
    });
    await sim.humanType(page.locator('#p1-input'), p1Ans);
    await page.locator('#p1-btn').click();

    // Phase 2
    await expect(page.locator('#phase2')).toBeVisible({ timeout: 3000 });
    const p2Ans = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#p2-matrix-tbody tr'));
      const matrix = rows.map(tr => Array.from(tr.querySelectorAll('td')).map(td => {
        const txt = td.textContent.trim();
        return (txt === '—' || txt === '·' || txt === '') ? null : parseInt(txt, 10);
      }));
      return Math.min(
        matrix[0][3],
        matrix[0][1] + matrix[1][3],
        matrix[0][2] + matrix[2][3],
        matrix[0][1] + matrix[1][2] + matrix[2][3]
      );
    });
    await sim.humanType(page.locator('#p2-input'), p2Ans);
    await page.locator('#p2-btn').click();

    // Phase 3
    await expect(page.locator('#phase3')).toBeVisible({ timeout: 3000 });
    const p3Ans = await page.evaluate(() => {
      const condText = document.getElementById('p3-condition-text').innerText;
      const totalL = parseInt(condText.match(/(\d+)\s*км/)[1], 10);
      const rows = Array.from(document.querySelectorAll('#p3-matrix-tbody tr'));
      const wBD = parseInt(rows[1].querySelectorAll('td')[3].textContent.trim(), 10);
      return totalL - wBD;
    });
    await sim.humanType(page.locator('#p3-input'), p3Ans);
    await page.locator('#p3-btn').click();

    // Phase 4
    await expect(page.locator('#phase4')).toBeVisible({ timeout: 3000 });
    const p4Ans = await page.evaluate(() => {
      const cond = document.getElementById('p4-condition-box').innerText;
      if (cond.includes('NVMe')) return 2;
      if (cond.includes('ARM') && cond.includes('НЕ')) return 3;
      return 2;
    });
    await sim.humanType(page.locator('#p4-input'), p4Ans);
    await page.locator('#p4-btn').click();

    // Phase 5
    await expect(page.locator('#phase5')).toBeVisible({ timeout: 3000 });
    const p5Ans = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#p5-matrix-tbody tr'));
      const matrix = rows.map(tr => Array.from(tr.querySelectorAll('td')).map(td => {
        const txt = td.textContent.trim();
        return (txt === '—' || txt === '·' || txt === '') ? null : parseInt(txt, 10);
      }));
      const minAC = Math.min(matrix[0][2], matrix[0][1] + matrix[1][2]);
      const minCE = Math.min(matrix[2][4], matrix[2][3] + matrix[3][4]);
      return minAC + minCE;
    });
    await sim.humanType(page.locator('#p5-input'), p5Ans);
    await page.locator('#p5-btn').click();

    // Final
    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#attempts-display')).toHaveText('0');

    sim.assertCleanSession();
  });
});
