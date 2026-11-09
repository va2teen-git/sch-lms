import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('11th Grade Lesson 27: Sieve of Eratosthenes (Student Personas Simulation)', () => {

  // =========================================================================
  // LEVEL 1: Mouse Manipulation (Interactive Sieve Grid, Slot & Snap, Buckets)
  // =========================================================================
  test.describe('Level 1: Sieve Grid, Slot Pipeline & Bucket Classification', () => {

    test('Level 1 - Persona: NOVICE — commits error on Phase 1, recovers and advances to Phase 2', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level1');

      await expect(page.locator('#phase1')).toBeVisible();
      await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

      await sim.simulateNoviceDistractorTrap({
        triggerDistractorFn: async () => {
          // Novice clicks verify immediately without selecting required multiples
          await page.locator('#p1-submit-btn').click();
        },
        assertErrorStateFn: async () => {
          await expect(page.locator('#feedback-box')).toBeVisible();
          await expect(page.locator('#attempts-display')).toHaveText('1');
        },
        solveCorrectlyFn: async () => {
          // Wait for regeneration timeout
          await page.waitForTimeout(2000);
          await expect(page.locator('#feedback-box')).toBeHidden();

          // Read current prime from DOM
          const primeText = await page.locator('#p1-prime-val').innerText();
          const p = parseInt(primeText.replace(/\D+/g, ''), 10);
          const maxNum = parseInt(await page.locator('#p1-max-val').innerText(), 10);

          // Select exactly the composite numbers starting from p² with step p
          const start = p * p;
          for (let k = start; k <= maxNum; k += p) {
            const btn = page.locator(`.grid-num-btn[data-num="${k}"]`);
            if (await btn.isVisible()) {
              await btn.click();
            }
          }

          // Submit
          await page.locator('#p1-submit-btn').click();
        },
        assertSuccessStateFn: async () => {
          await expect(page.locator('#phase1')).toBeHidden();
          await expect(page.locator('#phase2')).toBeVisible();
          await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
        }
      });

      sim.assertCleanSession();
    });

    test('Level 1 - Persona: CHAOS — rapid clicking on reset button and grid cells', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level1');

      // Rapidly spam click reset button
      await sim.simulateSpamClick(page.locator('#p1-reset-btn'), 5);

      // Rapidly click random grid cells
      const cells = page.locator('.grid-num-btn');
      const count = Math.min(await cells.count(), 6);
      for (let i = 0; i < count; i++) {
        await cells.nth(i).click();
      }

      await sim.simulateSpamClick(page.locator('#p1-reset-btn'), 2);
      await expect(page.locator('#p1-selected-count')).toHaveText('0');

      sim.assertCleanSession();
    });
  });

  // =========================================================================
  // LEVEL 2: Analytical Calculations (Sawtooth 2-1-2 Curve)
  // =========================================================================
  test.describe('Level 2: Analytical Calculation & Bounds', () => {

    test('Level 2 - Persona: NOVICE — enters wrong answer, recovers and computes Phase 1 count', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level2');

      await expect(page.locator('#phase1')).toBeVisible();
      await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');

      await sim.simulateNoviceDistractorTrap({
        triggerDistractorFn: async () => {
          // Enters absurd answer
          await sim.humanType(page.locator('#p1-input'), '999999');
          await page.locator('#p1-submit-btn').click();
        },
        assertErrorStateFn: async () => {
          await expect(page.locator('#feedback-box')).toBeVisible();
          await expect(page.locator('#attempts-display')).toHaveText('1');
        },
        solveCorrectlyFn: async () => {
          await page.waitForTimeout(2200);
          await expect(page.locator('#feedback-box')).toBeHidden();

          // Read p and n from prompt
          const pText = await page.locator('#p1-p-val').innerText();
          const nText = await page.locator('#p1-n-val').innerText();
          const p = parseInt(pText.replace(/\D+/g, ''), 10);
          const n = parseInt(nText.replace(/\D+/g, ''), 10);

          // Correct answer: floor((n - p*p) / p) + 1
          const expected = Math.floor((n - p * p) / p) + 1;

          await sim.humanType(page.locator('#p1-input'), expected);
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

    test('Level 2 - Persona: CARELESS — submits with spaces, enter key, and tests input tolerance', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level2');

      // 1. Careless student clicks submit on empty input
      await page.locator('#p1-submit-btn').click();
      await expect(page.locator('#feedback-box')).toBeVisible();
      await page.waitForTimeout(2200);

      // 2. Read parameters and submit with trailing whitespace using Enter key
      const pText = await page.locator('#p1-p-val').innerText();
      const nText = await page.locator('#p1-n-val').innerText();
      const p = parseInt(pText.replace(/\D+/g, ''), 10);
      const n = parseInt(nText.replace(/\D+/g, ''), 10);
      const expected = Math.floor((n - p * p) / p) + 1;

      await sim.humanType(page.locator('#p1-input'), expected, { trailingSpaces: true, submitWithEnter: true });

      // Ensure Phase 2 is reached smoothly
      await expect(page.locator('#phase2')).toBeVisible();
      await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');

      sim.assertCleanSession();
    });
  });

  // =========================================================================
  // LEVEL 3: Cyber Matrix Arcade & Hardcore Reset
  // =========================================================================
  test.describe('Level 3: Cyber Matrix Arcade Protocol', () => {

    test('Level 3 - Persona: NOVICE — launches game, clicks spacebar, and verifies initial wave state', async ({ page }) => {
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level3');

      // Initially on intro screen
      await expect(page.locator('button', { hasText: 'ИНИЦИИРОВАТЬ ЗАБЕГ' })).toBeVisible();

      // Start game with spacebar
      await page.keyboard.press('Space');

      // Now playing wave 1
      await expect(page.locator('.badge', { hasText: 'Волна 1 из 8' })).toBeVisible();
      await expect(page.locator('.progress-bar')).toBeVisible();
    });

    test('Level 3 - Persona: DILIGENT — collects target token from active direction on Wave 1', async ({ page }) => {
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level3');

      // Start game
      await page.locator('button', { hasText: 'ИНИЦИИРОВАТЬ ЗАБЕГ' }).click();
      await expect(page.locator('.badge', { hasText: 'Волна 1 из 8' })).toBeVisible();

      // Find any clickable button in the matrix
      const clickableCell = page.locator('button.btn-outline-warning').first();
      await expect(clickableCell).toBeVisible();
      const cellText = (await clickableCell.innerText()).split('\n')[0].trim();

      // Click cell
      await clickableCell.click();

      // Verify token appears in memory buffer
      const buffer = page.locator('.card', { hasText: 'БУФЕР ПАМЯТИ' }).last();
      await expect(buffer).toContainText(cellText);
    });
  });

});
