import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('11th Grade Lesson 29: Level 2 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — enters wrong answer on Phase 1, recovers and advances to Phase 2', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/29/level2');

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        // Novice enters an intentionally wrong naive guess
        await page.locator('#p1-input').fill('1');
        await page.locator('#p1-submit-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#feedback-box')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
      },
      solveCorrectlyFn: async () => {
        // Wait for regeneration timeout
        await page.waitForTimeout(1600);
        await expect(page.locator('#feedback-box')).toBeHidden();

        const digits = parseInt(await page.locator('#p1-digits-val').innerText(), 10);
        const k = parseInt(await page.locator('#p1-k-val').innerText(), 10);
        const p1Ans = Math.ceil(digits / k);

        await page.locator('#p1-input').fill(String(p1Ans));
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

  test('Persona: CARELESS — submits with spaces, enter key, and tests input tolerance', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/29/level2');

    await expect(page.locator('#phase1')).toBeVisible();
    const digits = parseInt(await page.locator('#p1-digits-val').innerText(), 10);
    const k = parseInt(await page.locator('#p1-k-val').innerText(), 10);
    const p1Ans = Math.ceil(digits / k);

    // Careless student habits: enters answer padded with accidental spaces and hits Enter
    await page.locator('#p1-input').fill(`   ${p1Ans}   `);
    await page.locator('#p1-input').press('Enter');

    await expect(page.locator('#phase2')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — verifies anti-paste protection across analytical inputs', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/29/level2');

    // Attempt to paste forbidden string into input
    await sim.attemptProhibitedPaste(page.locator('#p1-input'), '999999');

    // Verify input did not accept pasted text
    const val = await page.locator('#p1-input').inputValue();
    expect(val).toBe('');

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — solves full 5-phase Sawtooth progression (Phases 1 to 5)', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/29/level2');

    // --- Phase 1: Direct Capacity (CCS = 4) ---
    await expect(page.locator('#phase1')).toBeVisible();
    const d1 = parseInt(await page.locator('#p1-digits-val').innerText(), 10);
    const k1 = parseInt(await page.locator('#p1-k-val').innerText(), 10);
    await page.locator('#p1-input').fill(String(Math.ceil(d1 / k1)));
    await sim.cognitivePause(40);
    await page.locator('#p1-submit-btn').click();

    // --- Phase 2: Elementary Multiplications (CCS = 6) ---
    await expect(page.locator('#phase2')).toBeVisible();
    const lenA = parseInt(await page.locator('#p2-len-a').innerText(), 10);
    const lenB = parseInt(await page.locator('#p2-len-b').innerText(), 10);
    const p2Ans = Math.ceil(lenA / 4) * Math.ceil(lenB / 4);
    await page.locator('#p2-input').fill(String(p2Ans));
    await sim.cognitivePause(40);
    await page.locator('#p2-submit-btn').click();

    // --- Phase 3: Borrow Inversion (CCS = 7-8) ---
    await expect(page.locator('#phase3')).toBeVisible();
    const a0 = parseInt(await page.locator('#p3-val-a0').innerText(), 10);
    const c0 = parseInt(await page.locator('#p3-val-c0').innerText(), 10);
    const p3Ans = a0 + 1000 - c0;
    await page.locator('#p3-input').fill(String(p3Ans));
    await sim.cognitivePause(40);
    await page.locator('#p3-submit-btn').click();

    // --- Phase 4: Exponentiation Steps (CCS = 5) ---
    await expect(page.locator('#phase4')).toBeVisible();
    const bits = parseInt(await page.locator('#p4-bits-len').innerText(), 10);
    const ones = parseInt(await page.locator('#p4-ones-cnt').innerText(), 10);
    const p4Ans = (bits - 1) + (ones - 1);
    await page.locator('#p4-input').fill(String(p4Ans));
    await sim.cognitivePause(40);
    await page.locator('#p4-submit-btn').click();

    // --- Phase 5: Karatsuba Cross Product (CCS = 8-9) ---
    await expect(page.locator('#phase5')).toBeVisible();
    const p1 = parseInt(await page.locator('#p5-val-p1').innerText(), 10);
    const p2 = parseInt(await page.locator('#p5-val-p2').innerText(), 10);
    const p3 = parseInt(await page.locator('#p5-val-p3').innerText(), 10);
    const p5Ans = p3 - p1 - p2;
    await page.locator('#p5-input').fill(String(p5Ans));
    await sim.cognitivePause(40);
    await page.locator('#p5-submit-btn').click();

    // Victory Screen
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('h3', { hasText: 'УРОВЕНЬ 2 УСПЕШНО ПРОЙДЕН!' })).toBeVisible();
    sim.assertCleanSession();
  });
});
