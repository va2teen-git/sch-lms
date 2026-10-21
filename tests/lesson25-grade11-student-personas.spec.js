import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('11th Grade Lesson 25: Complexity Theory (Student Personas Simulation)', () => {

  // =========================================================================
  // LEVEL 1: Mouse Manipulation (Slot & Snap Asymptotics, Buckets, Karp)
  // =========================================================================
  test.describe('Level 1: Manipulations & Sorting', () => {

    test('Level 1 - Persona: NOVICE — falls into distractor trap O(1/n) or O(nⁿ), recovers and completes Phase 1', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/25/level1');

      await expect(page.locator('#phase1')).toBeVisible();
      await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

      // Novice student sees tokens in palette and mistakes a distractor (e.g. O(1/n) or O(nⁿ))
      await sim.simulateNoviceDistractorTrap({
        triggerDistractorFn: async () => {
          // Select distractor token from palette
          const distractor = page.locator('.p1-token', { hasText: 'дистрактор' }).first();
          await distractor.click();

          // Fill remaining slots with whatever is in palette to attempt verification
          for (let i = 0; i < 5; i++) {
            const availableToken = page.locator('.p1-token:not(.disabled):not(.opacity-25)').first();
            if (await availableToken.isVisible().catch(() => false)) {
              await availableToken.click();
            }
          }

          // Click verify
          await page.locator('#p1-verify-btn').click();
        },
        assertErrorStateFn: async () => {
          // System alert should trigger with distractor or order error
          await expect(page.locator('#feedback-box')).toBeVisible();
          await expect(page.locator('#attempts-display')).toHaveText('1');
        },
        solveCorrectlyFn: async () => {
          // Wait for regeneration
          await page.waitForTimeout(1400);
          await expect(page.locator('#feedback-box')).toBeHidden();

          // Canonical asymptotic rank order:
          // O(1) < O(log n) < O(n) < O(n log n) < O(n²) < O(n³) < O(2ⁿ) < O(n!)
          const asymptoticOrder = [
            'O(1)',
            'O(log n)',
            'O(n)',
            'O(n log n)',
            'O(n²)',
            'O(n³)',
            'O(2ⁿ)',
            'O(n!)'
          ];

          // Clear any leftovers just in case
          await page.locator('#p1-clear-btn').click();

          // Find only legitimate tokens in palette and sort them by canonical rank
          for (const label of asymptoticOrder) {
            const token = page.locator('#p1-tokens-palette .p1-token', { hasText: label }).first();
            const exists = await token.isVisible().catch(() => false);
            if (exists) {
              const isDistractor = await token.innerText().then(t => t.includes('дистрактор'));
              if (!isDistractor) {
                await token.click();
              }
            }
          }

          // Verify button
          await page.locator('#p1-verify-btn').click();
        },
        assertSuccessStateFn: async () => {
          // Should advance to Phase 2
          await expect(page.locator('#phase1')).toBeHidden();
          await expect(page.locator('#phase2')).toBeVisible();
          await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
        }
      });

      sim.assertCleanSession();
    });

    test('Level 1 - Persona: CHAOS — rapid clicking on clear button and empty slots', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/25/level1');

      // Rapidly spam click clear button
      await sim.simulateSpamClick(page.locator('#p1-clear-btn'), 6);

      // Click random empty slots
      const slots = page.locator('.p1-slot');
      const count = await slots.count();
      for (let i = 0; i < count; i++) {
        await slots.nth(i).click();
      }

      sim.assertCleanSession();
    });
  });

  // =========================================================================
  // LEVEL 2: Analytical Keyboard Inputs (5 Phases)
  // =========================================================================
  test.describe('Level 2: Analytical Calculations & Code Trace', () => {

    test('Level 2 - Persona: NOVICE — enters wrong format, recovers, and computes scaling', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/25/level2');

      await expect(page.locator('#phase1')).toBeVisible();
      await expect(page.locator('#level-badge')).toHaveText('Шаг 1 из 5');

      await sim.simulateNoviceDistractorTrap({
        triggerDistractorFn: async () => {
          // Novice enters invalid non-number or wrong scaling guess (e.g. 1)
          await sim.humanType(page.locator('#p1-input'), '999999');
          await page.locator('#p1-btn').click();
        },
        assertErrorStateFn: async () => {
          await expect(page.locator('#feedback-box')).toBeVisible();
          await expect(page.locator('#attempts-display')).toHaveText('1');
        },
        solveCorrectlyFn: async () => {
          // Wait for regeneration timeout (2200ms in level2)
          await page.waitForTimeout(2400);
          await expect(page.locator('#feedback-box')).toBeHidden();

          // Black-box problem reading:
          const compText = await sim.readVisiblePrompt(page.locator('#p1-complexity'));
          const descText = await sim.readVisiblePrompt(page.locator('#p1-scaling-desc'));

          let answer = 0;
          if (compText.includes('O(n²)')) {
            // "увеличился в k раз(а)" -> k*k
            const k = parseInt(descText.match(/\d+/)[0], 10);
            answer = k * k;
          } else if (compText.includes('O(n³)')) {
            // "увеличился в k раз(а)" -> k*k*k
            const k = parseInt(descText.match(/\d+/)[0], 10);
            answer = k * k * k;
          } else if (compText.includes('O(2ⁿ)')) {
            // "увеличился на d элементов (n + d)" -> 2^d
            const d = parseInt(descText.match(/\d+/)[0], 10);
            answer = Math.pow(2, d);
          }

          await sim.humanType(page.locator('#p1-input'), answer);
          await page.locator('#p1-btn').click();
        },
        assertSuccessStateFn: async () => {
          // Should smoothly transition to Phase 2
          await expect(page.locator('#phase1')).toBeHidden();
          await expect(page.locator('#phase2')).toBeVisible();
          await expect(page.locator('#level-badge')).toHaveText('Шаг 2 из 5');
        }
      });

      sim.assertCleanSession();
    });

    test('Level 2 - Persona: CARELESS — submits with spaces, enter key, and tests input tolerance', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/25/level2');

      // 1. Careless student clicks verify on empty input
      await page.locator('#p1-btn').click();
      await expect(page.locator('#feedback-box')).toBeVisible();
      await page.waitForTimeout(2400);

      // 2. Read problem and submit with trailing whitespace using Enter key
      const compText = await sim.readVisiblePrompt(page.locator('#p1-complexity'));
      const descText = await sim.readVisiblePrompt(page.locator('#p1-scaling-desc'));

      let answer = 0;
      if (compText.includes('O(n²)')) {
        const k = parseInt(descText.match(/\d+/)[0], 10);
        answer = k * k;
      } else if (compText.includes('O(n³)')) {
        const k = parseInt(descText.match(/\d+/)[0], 10);
        answer = k * k * k;
      } else if (compText.includes('O(2ⁿ)')) {
        const d = parseInt(descText.match(/\d+/)[0], 10);
        answer = Math.pow(2, d);
      }

      await sim.humanType(page.locator('#p1-input'), answer, { trailingSpaces: true, submitWithEnter: true });

      // Ensure Phase 2 is reached smoothly
      await expect(page.locator('#phase2')).toBeVisible();
      await expect(page.locator('#level-badge')).toHaveText('Шаг 2 из 5');

      // In Phase 2: Careless student enters complexity in lowercase: e.g. "o(n^2)" or "n^2"
      const snippetText = await sim.readVisiblePrompt(page.locator('#p2-code-snippet'));
      let rawAns = 'O(N^2)';
      if (snippetText.includes('while n > 1') && snippetText.includes('n // 2')) {
        rawAns = 'o(log n)';
      } else if (snippetText.includes('k = k // 2')) {
        rawAns = 'o(n log n)';
      } else if (snippetText.includes('C[i][j] += A[i][k] * B[k][j]')) {
        rawAns = 'o(n^3)';
      } else if (snippetText.includes('accumulator += array[i]')) {
        rawAns = 'o(n)';
      } else {
        rawAns = 'o(n^2)';
      }

      // Type with spaces and enter key
      await sim.humanType(page.locator('#p2-input'), `  ${rawAns}  `, { submitWithEnter: true });

      // Should transition to Phase 3
      await expect(page.locator('#phase2')).toBeHidden();
      await expect(page.locator('#phase3')).toBeVisible();
      await expect(page.locator('#level-badge')).toHaveText('Шаг 3 из 5');

      sim.assertCleanSession();
    });

    test('Level 2 - Persona: CHAOS — verifies anti-paste protection on inputs', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/25/level2');

      // Attempt forbidden clipboard paste
      await sim.attemptProhibitedPaste(page.locator('#p1-input'), '100');
      sim.assertCleanSession();
    });
  });

  // =========================================================================
  // LEVEL 3: Cyber Matrix Arcade (Archetype 1)
  // =========================================================================
  test.describe('Level 3: Cyber Matrix Arcade', () => {

    test('Level 3 - Persona: NOVICE — initializes matrix and verifies HUD and countdown timer', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/25/level3');

      // Welcome screen with protocol instructions
      await expect(page.locator('#start-btn')).toBeVisible();
      await sim.cognitivePause(200);

      // Start game
      await page.locator('#start-btn').click();

      // Matrix interface should render
      await expect(page.getByText(/ВОЛНА 1/i).first()).toBeVisible();
      await expect(page.getByText('[ЦЕЛЕВАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ ВЗЛОМА]:')).toBeVisible();
      await expect(page.getByText(/БУФЕР.*ПАМЯТИ/i)).toBeVisible();

      // Matrix table must contain 5x5 = 25 interactive cells
      const matrixButtons = page.locator('.card.border-danger button[type="button"]');
      expect(await matrixButtons.count()).toBe(25);

      sim.assertCleanSession();
    });
  });
});
