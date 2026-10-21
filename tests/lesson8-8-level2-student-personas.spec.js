import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('Grade 8 Lesson 8: Logic Operations Level 2 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — handles distractor trap, verifies error state and recovery', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level2');

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 1 из 5');

    // Novice attempts wrong answer first (e.g. entering invalid format '2' or intentionally wrong value)
    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        // Novice enters an invalid digit or wrong guess
        await sim.humanType(page.locator('#p1-input'), '2');
        await page.locator('#p1-btn').click();
      },
      assertErrorStateFn: async () => {
        // Feedback alert should become visible
        await expect(page.locator('#p1-feedback')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
      },
      solveCorrectlyFn: async () => {
        // Wait for regeneration
        await page.waitForTimeout(1400);
        await expect(page.locator('#p1-feedback')).toBeHidden();

        // Now solve correctly using clean independent black-box extraction
        const varsText = await sim.readVisiblePrompt(page.locator('#p1-vars-display'));
        const exprText = await sim.readVisiblePrompt(page.locator('#p1-expr-display'));

        // Parse variables: "A = 1, B = 0, C = 1"
        const a = varsText.includes('A = 1') ? 1 : 0;
        const b = varsText.includes('B = 1') ? 1 : 0;
        const c = varsText.includes('C = 1') ? 1 : 0;

        // Independent boolean calculation
        let ans = 0;
        if (exprText.includes('(¬A ∧ B) ∨ (A ∧ ¬C)')) {
          ans = ((!a && b) || (a && !c)) ? 1 : 0;
        } else if (exprText.includes('¬(A ∨ ¬B) ∧ (B ∨ C)')) {
          ans = (!(a || !b) && (b || c)) ? 1 : 0;
        } else if (exprText.includes('(A ∧ ¬B) ∨ ¬(¬A ∧ C)')) {
          ans = ((a && !b) || !(!a && c)) ? 1 : 0;
        } else if (exprText.includes('¬A ∧ ¬B ∨ (A ∧ C)')) {
          ans = ((!a && !b) || (a && c)) ? 1 : 0;
        } else if (exprText.includes('¬(A ∧ B) ∧ (¬B ∨ ¬C)')) {
          ans = (!(a && b) && (!b || !c)) ? 1 : 0;
        }

        await sim.humanType(page.locator('#p1-input'), ans);
        await page.locator('#p1-btn').click();
      },
      assertSuccessStateFn: async () => {
        // Should successfully transition to Phase 2
        await expect(page.locator('#phase1')).toBeHidden();
        await expect(page.locator('#phase2')).toBeVisible();
        await expect(page.locator('#level-badge')).toHaveText('Шаг 2 из 5');
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CARELESS — submits with spaces, enter key, and tests input tolerance', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level2');

    await expect(page.locator('#phase1')).toBeVisible();

    // 1. Careless student presses button with empty input
    await page.locator('#p1-btn').click();
    // System should trigger error and not crash
    await expect(page.locator('#p1-feedback')).toBeVisible();
    await page.waitForTimeout(1400);

    // 2. Careless student types answer with accidental whitespace and submits via Enter key
    const varsText = await sim.readVisiblePrompt(page.locator('#p1-vars-display'));
    const exprText = await sim.readVisiblePrompt(page.locator('#p1-expr-display'));

    const a = varsText.includes('A = 1') ? 1 : 0;
    const b = varsText.includes('B = 1') ? 1 : 0;
    const c = varsText.includes('C = 1') ? 1 : 0;

    let ans = 0;
    if (exprText.includes('(¬A ∧ B) ∨ (A ∧ ¬C)')) ans = ((!a && b) || (a && !c)) ? 1 : 0;
    else if (exprText.includes('¬(A ∨ ¬B) ∧ (B ∨ C)')) ans = (!(a || !b) && (b || c)) ? 1 : 0;
    else if (exprText.includes('(A ∧ ¬B) ∨ ¬(¬A ∧ C)')) ans = ((a && !b) || !(!a && c)) ? 1 : 0;
    else if (exprText.includes('¬A ∧ ¬B ∨ (A ∧ C)')) ans = ((!a && !b) || (a && c)) ? 1 : 0;
    else if (exprText.includes('¬(A ∧ B) ∧ (¬B ∨ ¬C)')) ans = (!(a && b) && (!b || !c)) ? 1 : 0;

    // Type with leading/trailing spaces and press Enter
    await sim.humanType(page.locator('#p1-input'), ans, { trailingSpaces: true, submitWithEnter: true });

    // Ensure Phase 2 is reached smoothly
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 2 из 5');

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — tests spam-clicking, race conditions, and anti-paste protection', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level2');

    // 1. Spam clicking the submit button on Phase 1
    await sim.simulateSpamClick(page.locator('#p1-btn'), 6);

    // Verify session remains clean without unhandled exceptions
    sim.assertCleanSession();

    // 2. Verify Anti-Paste policy works
    await sim.attemptProhibitedPaste(page.locator('#p1-input'), '1');
  });

  test('Persona: DILIGENT — Independent Black-Box walkthrough without using __testState backdoor', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level2');

    // Asserts that we completely ignore window.__testState
    // === PHASE 1 ===
    await expect(page.locator('#phase1')).toBeVisible();
    const p1Vars = await sim.readVisiblePrompt(page.locator('#p1-vars-display'));
    const p1Expr = await sim.readVisiblePrompt(page.locator('#p1-expr-display'));

    const a = p1Vars.includes('A = 1') ? 1 : 0;
    const b = p1Vars.includes('B = 1') ? 1 : 0;
    const c = p1Vars.includes('C = 1') ? 1 : 0;

    let p1Ans = 0;
    if (p1Expr.includes('(¬A ∧ B) ∨ (A ∧ ¬C)')) p1Ans = ((!a && b) || (a && !c)) ? 1 : 0;
    else if (p1Expr.includes('¬(A ∨ ¬B) ∧ (B ∨ C)')) p1Ans = (!(a || !b) && (b || c)) ? 1 : 0;
    else if (p1Expr.includes('(A ∧ ¬B) ∨ ¬(¬A ∧ C)')) p1Ans = ((a && !b) || !(!a && c)) ? 1 : 0;
    else if (p1Expr.includes('¬A ∧ ¬B ∨ (A ∧ C)')) p1Ans = ((!a && !b) || (a && c)) ? 1 : 0;
    else if (p1Expr.includes('¬(A ∧ B) ∧ (¬B ∨ ¬C)')) p1Ans = (!(a && b) && (!b || !c)) ? 1 : 0;

    await sim.humanType(page.locator('#p1-input'), p1Ans, { submitWithEnter: true });

    // === PHASE 2 ===
    await expect(page.locator('#phase2')).toBeVisible();
    const p2XText = await sim.readVisiblePrompt(page.locator('#p2-x-display'));
    const p2ExprText = await sim.readVisiblePrompt(page.locator('#p2-statement-display'));

    const xMatch = p2XText.match(/x\s*=\s*(\d+)/);
    const xVal = xMatch ? parseInt(xMatch[1], 10) : 0;

    // Independent evaluation of phase 2
    let p2Ans = 0;
    const nums = p2ExprText.match(/\d+/g).map(Number);
    const na = nums[0];
    const nb = nums[1];

    if (p2ExprText.includes('¬(x <') && p2ExprText.includes('(x ≤')) {
      p2Ans = (!(xVal < na) && (xVal <= nb)) ? 1 : 0;
    } else if (p2ExprText.includes('(x >') && p2ExprText.includes('¬(x >')) {
      p2Ans = ((xVal > na) && !(xVal > nb)) ? 1 : 0;
    } else if (p2ExprText.includes('¬(x ≥') && p2ExprText.includes('(x >')) {
      p2Ans = (!(xVal >= na) || (xVal > nb)) ? 1 : 0;
    } else if (p2ExprText.includes('(x <') && p2ExprText.includes('¬(x ≤')) {
      p2Ans = ((xVal < na) || !(xVal <= nb)) ? 1 : 0;
    }

    await sim.humanType(page.locator('#p2-input'), p2Ans, { submitWithEnter: true });

    // === PHASE 3 ===
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 3 из 5');

    sim.assertCleanSession();
  });
});
