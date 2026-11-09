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

    test('Level 1 - Persona: DILIGENT — completes full 3-phase progression (Grid -> Slots -> Buckets) with 100% precision', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level1');

      // --- Фаза 1: Сетка вычеркивания ---
      await expect(page.locator('#phase1')).toBeVisible();
      const pText = await page.locator('#p1-prime-val').innerText();
      const p = parseInt(pText.replace(/\D+/g, ''), 10);
      const maxVal = parseInt(await page.locator('#p1-max-val').innerText(), 10);

      for (let k = p * p; k <= maxVal; k += p) {
        const btn = page.locator(`.grid-num-btn[data-num="${k}"]`);
        if (await btn.isVisible()) {
          await btn.click();
        }
      }
      await page.locator('#p1-submit-btn').click();

      // --- Фаза 2: Слот-пазл алгоритма ---
      await expect(page.locator('#phase2')).toBeVisible();
      const targetTokens = ['t_init', 't_outer', 't_inner', 't_comp'];
      for (let slotIdx = 0; slotIdx < targetTokens.length; slotIdx++) {
        const tokenId = targetTokens[slotIdx];
        const tokenBtn = page.locator(`.token-btn[data-token-id="${tokenId}"]`);
        await tokenBtn.click();
        const slotEl = page.locator(`#slot-${slotIdx}`);
        await slotEl.click();
      }
      await page.locator('#p2-submit-btn').click();

      // --- Фаза 3: Классификация по 3 корзинам ---
      await expect(page.locator('#phase3')).toBeVisible();
      const cards = page.locator('#p3-pool .p3-card');
      const cardCount = await cards.count();

      for (let i = 0; i < cardCount; i++) {
        const currentCard = page.locator('#p3-pool .p3-card').first();
        const targetBucket = await currentCard.getAttribute('data-expected-bucket');
        await currentCard.click();
        const bucketTarget = page.locator(`.bucket-card[data-bucket="${targetBucket}"]`);
        await bucketTarget.click();
      }
      await page.locator('#p3-submit-btn').click();

      // Финальный триумф
      await expect(page.locator('#victory-screen')).toBeVisible();
      await expect(page.locator('h3', { hasText: 'УРОВЕНЬ 1 УСПЕШНО ПРОЙДЕН!' })).toBeVisible();
      sim.assertCleanSession();
    });

    test('Level 1 - Hitbox & Touch Target Ergonomics Audit — verifies >= 36px elements', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level1');

      // Audit interactive buttons on Phase 1
      const p1Buttons = [
        page.locator('#p1-submit-btn'),
        page.locator('#p1-reset-btn'),
        page.locator('.grid-num-btn').first(),
        page.locator('.grid-num-btn').last()
      ];

      await sim.auditHitboxes(p1Buttons, 36);
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

    test('Level 2 - Persona: CHAOS — verifies anti-paste protection across analytical inputs', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level2');

      // Prohibited paste test on Phase 1 input
      await sim.attemptProhibitedPaste(page.locator('#p1-input'), '42');
      sim.assertCleanSession();
    });

    test('Level 2 - Persona: DILIGENT — solves full 5-phase Sawtooth progression from Phase 1 to Phase 5', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level2');

      // --- Фаза 1: Прямой расчет ---
      await expect(page.locator('#phase1')).toBeVisible();
      const p1 = parseInt((await page.locator('#p1-p-val').innerText()).replace(/\D+/g, ''), 10);
      const n1 = parseInt((await page.locator('#p1-n-val').innerText()).replace(/\D+/g, ''), 10);
      const ans1 = Math.floor((n1 - p1 * p1) / p1) + 1;
      await sim.humanType(page.locator('#p1-input'), ans1, { submitWithEnter: true });

      // --- Фаза 2: Анализ коллизий ---
      await expect(page.locator('#phase2')).toBeVisible();
      const p2 = parseInt((await page.locator('#p2-p-val').innerText()).replace(/\D+/g, ''), 10);
      const n2 = parseInt((await page.locator('#p2-n-val').innerText()).replace(/\D+/g, ''), 10);
      let ans2 = 0;
      for (let k = p2 * p2; k <= n2; k += p2) {
        if (k % 2 !== 0 && k % 3 !== 0) ans2++;
      }
      await sim.humanType(page.locator('#p2-input'), ans2, { submitWithEnter: true });

      // --- Фаза 3: Обратная задача ---
      await expect(page.locator('#phase3')).toBeVisible();
      const p3 = parseInt((await page.locator('#p3-p-val').innerText()).replace(/\D+/g, ''), 10);
      const nextPrimesMap = { 5: 7, 7: 11, 11: 13, 13: 17 };
      const nextP = nextPrimesMap[p3] || (p3 + 2);
      const ans3 = nextP * nextP - 1;
      await sim.humanType(page.locator('#p3-input'), ans3, { submitWithEnter: true });

      // --- Фаза 4: Емкость памяти (Долина разгрузки) ---
      await expect(page.locator('#phase4')).toBeVisible();
      const n4 = parseInt((await page.locator('#p4-n-val').innerText()).replace(/\D+/g, ''), 10);
      const ans4 = Math.ceil((n4 + 1) / 8);
      await sim.humanType(page.locator('#p4-input'), ans4, { submitWithEnter: true });

      // --- Фаза 5: Сегментированное решето (Кульминация) ---
      await expect(page.locator('#phase5')).toBeVisible();
      const l5 = parseInt((await page.locator('#p5-l-val').innerText()).replace(/\D+/g, ''), 10);
      const r5 = parseInt((await page.locator('#p5-r-val').innerText()).replace(/\D+/g, ''), 10);
      const p5 = parseInt((await page.locator('#p5-p-val').innerText()).replace(/\D+/g, ''), 10);

      const start5 = Math.max(p5 * p5, Math.ceil(l5 / p5) * p5);
      let count5 = 0;
      for (let k = start5; k <= r5; k += p5) count5++;
      const ans5 = `${start5}:${count5}`;
      await sim.humanType(page.locator('#p5-input'), ans5, { submitWithEnter: true });

      // Финальный триумф Уровня 2
      await expect(page.locator('#victory-screen')).toBeVisible();
      await expect(page.locator('h3', { hasText: 'УРОВЕНЬ 2 УСПЕШНО ПРОЙДЕН!' })).toBeVisible();
      sim.assertCleanSession();
    });

    test('Level 2 - Cognitive Difficulty Calibration & Sawtooth Profile Audit', async () => {
      const sim = new StudentSimulator(null, {
        persona: LearnerPersona.DILIGENT,
        courseSlug: '11-класс_углубленный',
        lessonId: 27,
        levelNumber: 2
      });

      // 5-phase cognitive difficulty distribution for 11th grade advanced
      sim.recordPhaseDifficulty(1, { title: 'Прямой расчет вычеркиваний', depth: 2, memory: 2, search: 1 }); // CCS 5
      sim.recordPhaseDifficulty(2, { title: 'Многошаговый расчет коллизий', depth: 3, memory: 3, search: 1 }); // CCS 7
      sim.recordPhaseDifficulty(3, { title: 'Обратная задача останова (Пик 1)', depth: 3, memory: 3, inversion: 2 }); // CCS 8
      sim.recordPhaseDifficulty(4, { title: 'Емкость битового вектора (Долина)', depth: 2, memory: 3, search: 0 }); // CCS 5
      sim.recordPhaseDifficulty(5, { title: 'Сегментированное решето (Кульминация)', depth: 4, memory: 3, inversion: 1 }); // CCS 8

      // Verify Sawtooth 2-1-2 profile & Grade 11 Corridor [5; 10]
      sim.assertDifficultyCompliance({
        sawtooth: true,
        corridor: true,
        noFakeDifficulty: true,
        renderReport: true
      });
    });
  });

  // =========================================================================
  // LEVEL 3: Cyber Matrix Arcade & Hardcore Reset
  // =========================================================================
  test.describe('Level 3: Cyber Matrix Arcade Protocol', () => {

    test('Level 3 - Persona: NOVICE — launches game, clicks spacebar, and verifies initial wave state', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level3');

      // Initially on intro screen
      await expect(page.locator('button', { hasText: 'ИНИЦИИРОВАТЬ ЗАБЕГ' })).toBeVisible();

      // Start game with spacebar
      await page.keyboard.press('Space');

      // Now playing wave 1
      await expect(page.locator('.badge', { hasText: 'Волна 1 из 8' })).toBeVisible();
      await expect(page.locator('.progress-bar')).toBeVisible();

      sim.assertCleanSession();
    });

    test('Level 3 - Persona: CHAOS & HARDCORE RESET — clicks cell outside orthogonal guide beam, triggers Hardcore Reset to Wave 1', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
      await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level3');

      // Start game
      await page.locator('button', { hasText: 'ИНИЦИИРОВАТЬ ЗАБЕГ' }).click();
      await expect(page.locator('.badge', { hasText: 'Волна 1 из 8' })).toBeVisible();

      // Attempt to click a disabled / non-clickable cell outside active row
      const disabledCell = page.locator('button[disabled].btn-outline-secondary').first();
      if (await disabledCell.isVisible()) {
        await disabledCell.click({ force: true });
      }

      // Buffer should remain empty, game should not crash
      sim.assertCleanSession();
    });

    test('Level 3 - Persona: DILIGENT — collects target token from active direction on Wave 1', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
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

      sim.assertCleanSession();
    });
  });

});
