import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('11th Grade Lesson 31: Level 2 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — enters wrong answer on Phase 1, recovers and advances to Phase 2', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level2');

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');

    // Novice enters an intentionally incorrect calculation
    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        await page.locator('#p1-input').fill('9999');
        await page.locator('#p1-submit-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#feedback-box')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
      },
      solveCorrectlyFn: async () => {
        // Wait for regeneration timeout (1500ms + buffer)
        await page.waitForTimeout(1700);
        await expect(page.locator('#feedback-box')).toBeHidden();

        const correctAns = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.getP1Expected());
        await page.locator('#p1-input').fill(String(correctAns));
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
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level2');

    await expect(page.locator('#phase1')).toBeVisible();
    const p1Ans = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.getP1Expected());

    // Careless student: accidental leading/trailing spaces and presses Enter
    await page.locator('#p1-input').fill(`   ${p1Ans}   `);
    await page.locator('#p1-input').press('Enter');

    await expect(page.locator('#phase2')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — verifies anti-paste protection across analytical inputs', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level2');

    // Attempt to paste forbidden string into input
    await sim.attemptProhibitedPaste(page.locator('#p1-input'), '42');

    // Verify input did not accept pasted text
    const val = await page.locator('#p1-input').inputValue();
    expect(val).toBe('');

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — solves full 5-phase Sawtooth progression (Phases 1 to 5)', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level2');

    // --- Phase 1: Horner polynomial hash (CCS = 4) ---
    await expect(page.locator('#phase1')).toBeVisible();
    const p1Ans = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.getP1Expected());
    await page.locator('#p1-input').fill(String(p1Ans));
    await sim.cognitivePause(40);
    await page.locator('#p1-submit-btn').click();

    // --- Phase 2: Memory overhead (CCS = 6) ---
    await expect(page.locator('#phase2')).toBeVisible();
    const p2Ans = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.getP2Expected());
    await page.locator('#p2-input').fill(String(p2Ans));
    await sim.cognitivePause(40);
    await page.locator('#p2-submit-btn').click();

    // --- Phase 3: Open addressing inversion (CCS = 7-8) ---
    await expect(page.locator('#phase3')).toBeVisible();
    const p3Ans = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.getP3Expected());
    await page.locator('#p3-input').fill(String(p3Ans));
    await sim.cognitivePause(40);
    await page.locator('#p3-submit-btn').click();

    // --- Phase 4: Valley order invariant (CCS = 5) ---
    await expect(page.locator('#phase4')).toBeVisible();
    const p4Ans = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.getP4Expected());
    await page.locator('#p4-input').fill(p4Ans);
    await sim.cognitivePause(40);
    await page.locator('#p4-submit-btn').click();

    // --- Phase 5: Dynamic rehashing (CCS = 8-9) ---
    await expect(page.locator('#phase5')).toBeVisible();
    const p5Ans = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.getP5Expected());
    await page.locator('#p5-input').fill(String(p5Ans));
    await sim.cognitivePause(40);
    await page.locator('#p5-submit-btn').click();

    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-attempts')).toHaveText('0');
    sim.assertCleanSession();
  });
});
