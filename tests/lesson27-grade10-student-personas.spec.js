import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('10th Grade Lesson 27: Discretization & Signals (Student Personas Simulation)', () => {

  // =========================================================================
  // LEVEL 1: Manipulations, S&H Pipeline & Parameter Calibration
  // =========================================================================
  test.describe('Level 1: Manipulations & S&H Trakt Assembly', () => {

    test('Level 1 - Persona: NOVICE — falls into distractor trap in Phase 2 pipeline assembly, recovers and passes', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
      await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level1');

      await expect(page.locator('#phase1')).toBeVisible();
      await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

      // Novice passes Phase 1 by sorting 8 cards into 4 buckets
      await sim.cognitivePause();
      const count = await page.locator('#p1-cards-pool .draggable-item').count();
      for (let i = 0; i < count; i++) {
        const card = page.locator('#p1-cards-pool .draggable-item').first();
        const cat = await card.getAttribute('data-category');
        await card.click();
        const targetHeader = page.locator(`.target-bucket-p1[data-category="${cat}"] .card-header`);
        await targetHeader.click();
      }

      await page.locator('#p1-verify-btn').click();
      await expect(page.locator('#phase1')).toBeHidden();
      await expect(page.locator('#phase2')).toBeVisible();

      // In Phase 2: Novice encounters a distractor trap (e.g. distractor module)
      await sim.simulateNoviceDistractorTrap({
        triggerDistractorFn: async () => {
          // Select distractor block from pool
          const distractor = page.locator('#p2-blocks-pool .pipeline-block[data-step="none"]').first();
          await distractor.click();
          await page.locator('.pipeline-slot[data-slot="1"]').click();

          // Fill remaining slots
          for (let s = 2; s <= 6; s++) {
            const avail = page.locator('#p2-blocks-pool .pipeline-block').first();
            if (await avail.isVisible().catch(() => false)) {
              await avail.click();
              await page.locator(`.pipeline-slot[data-slot="${s}"]`).click();
            }
          }

          // Click verification
          await page.locator('#p2-verify-btn').click();
        },
        assertErrorStateFn: async () => {
          await expect(page.locator('#feedback-box')).toBeVisible();
          await expect(page.locator('#attempts-display')).toHaveText('1');
        },
        solveCorrectlyFn: async () => {
          await page.waitForTimeout(1400);
          await expect(page.locator('#feedback-box')).toBeHidden();

          // Place legitimate blocks in order 1 to 6
          for (let step = 1; step <= 6; step++) {
            const block = page.locator(`#p2-blocks-pool .pipeline-block[data-step="${step}"]`);
            await block.click();
            await page.locator(`.pipeline-slot[data-slot="${step}"]`).click();
          }

          await page.locator('#p2-verify-btn').click();
        },
        assertSuccessStateFn: async () => {
          await expect(page.locator('#phase2')).toBeHidden();
          await expect(page.locator('#phase3')).toBeVisible();
        }
      });

      sim.assertCleanSession();
    });

    test('Level 1 - Persona: CHAOS — rapid clicking on reset buttons and empty slots', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
      await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level1');

      await expect(page.locator('#phase1')).toBeVisible();

      // Spam click empty bucket slots
      for (let i = 0; i < 5; i++) {
        await page.locator('.target-bucket-p1 .bucket-slot').first().click({ force: true });
      }

      // Spam reset button
      await sim.simulateSpamClick(page.locator('#p1-reset-btn'), 4);

      // Verify page is still responsive and without fatal errors
      await expect(page.locator('#p1-cards-pool')).toBeVisible();
      sim.assertCleanSession();
    });

  });

  // =========================================================================
  // LEVEL 2: Analytical Calculations & Input Tolerance
  // =========================================================================
  test.describe('Level 2: Analytical Calculations & Input Tolerance', () => {

    test('Level 2 - Persona: CARELESS — submits values with spaces, Russian comma, and Enter key', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
      await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level2');

      await expect(page.locator('#phase1')).toBeVisible();

      // Extract generated fmax (e.g. "250 Гц")
      const fmaxText = await page.locator('#p1-fmax').innerText();
      const fmax = parseFloat(fmaxText.replace(/[^0-9.]/g, ''));
      const fd = fmax * 2;
      const dt = +(1000 / fd).toFixed(4);

      // Careless learner enters with Russian comma or trailing spaces: e.g. " 500 " and " 2,0 " or " 2 "
      const fdInput = page.locator('#p1-input-fd');
      const dtInput = page.locator('#p1-input-dt');

      await fdInput.fill(`  ${fd}  `);
      // Use comma for decimal: e.g. 2 -> "2,0" or 0.5 -> "0,5"
      const dtStr = dt.toString().replace('.', ',');
      await dtInput.fill(` ${dtStr} `);

      // Careless presses Enter inside dtInput instead of clicking the button
      await dtInput.press('Enter');

      // Phase 1 should successfully advance to Phase 2
      await expect(page.locator('#phase1')).toBeHidden();
      await expect(page.locator('#phase2')).toBeVisible();

      sim.assertCleanSession();
    });

    test('Level 2 - Persona: NOVICE — enters incomplete field, sees feedback alert, recovers and passes', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
      await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level2');

      await expect(page.locator('#phase1')).toBeVisible();

      // Novice clicks button with empty inputs
      await page.locator('#p1-btn').click();
      await expect(page.locator('#feedback-box')).toBeVisible();
      await expect(page.locator('#attempts-display')).toHaveText('1');

      // Novice waits for feedback
      await page.waitForTimeout(1300);

      // Now reads fmax and calculates
      const fmaxText = await page.locator('#p1-fmax').innerText();
      const fmax = parseFloat(fmaxText.replace(/[^0-9.]/g, ''));
      const fd = fmax * 2;
      const dt = +(1000 / fd).toFixed(4);

      await page.locator('#p1-input-fd').fill(fd.toString());
      await page.locator('#p1-input-dt').fill(dt.toString());
      await page.locator('#p1-btn').click();

      await expect(page.locator('#phase1')).toBeHidden();
      await expect(page.locator('#phase2')).toBeVisible();

      sim.assertCleanSession();
    });

    test('Level 2 - Persona: CHAOS — verifies Anti-Paste protection on calculation inputs', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
      await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level2');

      // Attempt forbidden clipboard paste
            // Attempt forbidden clipboard paste
      await sim.attemptProhibitedPaste(page.locator('#p1-input-fd'), '500');
      sim.assertCleanSession();
    });

    test('Level 2 - Cognitive Difficulty Calibration & Sawtooth Profile Audit', async () => {
      const sim = new StudentSimulator(null, {
        persona: LearnerPersona.DILIGENT,
        courseSlug: '10-класс_углубленный',
        lessonId: 27,
        levelNumber: 2
      });

      // Benchmark the 5 analytical phases of Lesson 27 Level 2
      sim.recordPhaseDifficulty(1, { title: 'Теорема Котельникова (f_d min, Δt max)', depth: 2, memory: 2 });
      sim.recordPhaseDifficulty(2, { title: 'Уровни квантования N=2^b и шаг ΔU', depth: 3, memory: 3 });
      sim.recordPhaseDifficulty(3, { title: 'Погрешность |e_max| и SQNR (Пик 1)', depth: 3, memory: 3, inversion: 2 });
      sim.recordPhaseDifficulty(4, { title: 'Битрейт и объем звуковых данных (Долина)', depth: 2, memory: 3 });
      sim.recordPhaseDifficulty(5, { title: 'Паразитный алиасинг и частота Найквиста (Кульминация)', depth: 4, memory: 3, inversion: 2 });

      sim.assertDifficultyCompliance({
        sawtooth: true,
        corridor: true,
        noFakeDifficulty: true,
        renderReport: true
      });
    });

  });

  // =========================================================================
  // LEVEL 3: Clock-Tick Rhythm Arcade (Archetype 6)
  // =========================================================================
  test.describe('Level 3: Master Clock Strobe Arcade', () => {

    test('Level 3 - Persona: NOVICE — fires strobe prematurely outside aperture window (phase jitter), triggers Hardcore Reset', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
      await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level3');

      // Start game from intro
      await expect(page.locator('#start-btn')).toBeVisible();
      await page.locator('#start-btn').click();

      await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');
      await expect(page.locator('#osc-canvas')).toBeVisible();

      // Configure Unit 1, 2, 3
      await page.locator('button[data-unit="1"][data-opt="0"]').click();
      await page.locator('button[data-unit="2"][data-opt="0"]').click();
      await page.locator('button[data-unit="3"][data-opt="0"]').click();

      // Novice gets impatient and triggers strobe when aperture is closed (data-aperture-open="false")
      await page.waitForFunction(() => {
        const btn = document.getElementById('strobe-btn');
        return btn && btn.getAttribute('data-aperture-open') === 'false';
      });

      // Strobe click during jitter phase
      await page.locator('#strobe-btn').click();

      // Hardcore fail screen must trigger
      await expect(page.locator('#fail-title')).toBeVisible();
      await expect(page.locator('#fail-title')).toContainText('СРЫВ СИНХРОНИЗАЦИИ');

      // Wait for auto reset back to Wave 1
      await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10', { timeout: 6000 });

      sim.assertCleanSession();
    });

    test('Level 3 - Persona: DILIGENT — synchronizes with aperture window and hotkeys to pass waves', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
      await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level3');

      await page.locator('#start-btn').click();
      await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

      // Wave 1: Clean voice 0..+3.3V -> Unit 1: 0, Unit 2: 0 (8-bit), Unit 3: 0 (PCM)
      // Diligent uses hotkeys 1, Q, A
      await page.keyboard.press('1');
      await page.keyboard.press('q');
      await page.keyboard.press('a');

      // Diligent waits for green aperture window
      await page.waitForFunction(() => {
        const btn = document.getElementById('strobe-btn');
        return btn && btn.getAttribute('data-aperture-open') === 'true';
      });

      // Press Space bar to fire strobe
      await page.keyboard.press('Space');

      // Should advance to Wave 2!
      await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 10');

      sim.assertCleanSession();
    });

  });

});
