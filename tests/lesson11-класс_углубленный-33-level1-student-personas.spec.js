import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('11th Grade Lesson 33: Level 1 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — commits error on Phase 1, observes feedback, recovers and advances', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33/level1');

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    // Novice mistake: clicks submit immediately without placing tokens
    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        await page.locator('#p1-submit-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#feedback-box')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
      },
      solveCorrectlyFn: async () => {
        // Wait for reset timeout (1500ms + buffer)
        await page.waitForTimeout(1700);
        await expect(page.locator('#feedback-box')).toBeHidden();

        const p1Tokens = await page.evaluate(() => {
          return window.__DEV_LEVEL1_STATE__ ? window.__DEV_LEVEL1_STATE__.getP1Tokens() : [];
        });

        for (const t of p1Tokens) {
          const tokenBtn = page.locator(`.btn[data-token-id="${t.id}"]`);
          await tokenBtn.click();

          const bucketIndex = t.expectedBucket;
          const emptySlot = page.locator(`#p1-slot-${bucketIndex}`);
          const appendBtn = page.locator(`#p1-append-${bucketIndex}`);

          if (await emptySlot.isVisible()) {
            await emptySlot.click();
          } else {
            await appendBtn.click();
          }
        }

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

  test('Persona: CHAOS — rapid clicking on empty buckets, invalid toggling, resilience', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33/level1');

    // Rapid clicking on buckets without selecting a token
    for (let i = 0; i < 3; i++) {
      const bucketCard = page.locator(`#p1-bucket-card-${i}`);
      if (await bucketCard.isVisible()) {
        await bucketCard.click();
      }
    }

    // Verify buckets still show 0 tokens
    for (let i = 0; i < 3; i++) {
      const countEl = page.locator(`#p1-count-${i}`);
      await expect(countEl).toHaveText('0');
    }

    // Spam clicks on submit button while empty
    await sim.simulateSpamClick(page.locator('#p1-submit-btn'), 3);

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — completes full 3-phase progression with 100% precision', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33/level1');

    // --- Phase 1: Preprocessing Gateway ---
    await expect(page.locator('#phase1')).toBeVisible();
    const p1Tokens = await page.evaluate(() => {
      return window.__DEV_LEVEL1_STATE__ ? window.__DEV_LEVEL1_STATE__.getP1Tokens() : [];
    });

    for (const t of p1Tokens) {
      await page.locator(`.btn[data-token-id="${t.id}"]`).click();

      const bucketIndex = t.expectedBucket;
      const emptySlot = page.locator(`#p1-slot-${bucketIndex}`);
      const appendBtn = page.locator(`#p1-append-${bucketIndex}`);

      if (await emptySlot.isVisible()) {
        await emptySlot.click();
      } else {
        await appendBtn.click();
      }
      await sim.cognitivePause(40);
    }
    await page.locator('#p1-submit-btn').click();

    // --- Phase 2: RegEx Builder ---
    await expect(page.locator('#phase2')).toBeVisible();
    const expectedTokens = await page.evaluate(() => {
      return window.__DEV_LEVEL1_STATE__ ? window.__DEV_LEVEL1_STATE__.getP2ExpectedTokens() : [];
    });

    for (let i = 0; i < expectedTokens.length; i++) {
      const tok = expectedTokens[i];
      await page.locator(`.btn[data-token-id="${tok.id}"]`).click();
      await page.locator(`[data-slot-index="${i}"]`).click();
      await sim.cognitivePause(40);
    }
    await page.locator('#p2-submit-btn').click();

    // --- Phase 3: DFA Transitions ---
    await expect(page.locator('#phase3')).toBeVisible();
    const p3Data = await page.evaluate(() => {
      const state = window.__DEV_LEVEL1_STATE__;
      return {
        alphabet: state.getP3Alphabet(),
        states: state.getP3States()
      };
    });

    for (const trans of p3Data.alphabet) {
      const matchingState = p3Data.states.find(s => s.label.startsWith(trans.expected) && s.id !== 'state_loop_dist');
      await page.locator(`.btn[data-state-id="${matchingState.id}"]`).click();
      await page.locator(`[data-transition-id="${trans.id}"]`).click();
      await sim.cognitivePause(30);
    }
    await page.locator('#p3-submit-btn').click();

    // --- Victory Screen ---
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-attempts')).toHaveText('0');
    sim.assertCleanSession();
  });

  test('Level 1 - Hitbox & Touch Target Ergonomics Audit (>= 48px)', async ({ page }) => {
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33/level1');

    // Phase 1 verify button
    const p1Submit = await page.locator('#p1-submit-btn').boundingBox();
    expect(p1Submit).not.toBeNull();
    expect(p1Submit.height).toBeGreaterThanOrEqual(48);

    // Phase 1 tokens
    const tokens = page.locator('#p1-token-palette .btn');
    const tokenCount = await tokens.count();
    expect(tokenCount).toBeGreaterThan(0);
    for (let i = 0; i < tokenCount; i++) {
      const box = await tokens.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThanOrEqual(48);
    }

    // Phase 1 bucket cards
    for (let i = 0; i < 3; i++) {
      const box = await page.locator(`#p1-bucket-card-${i}`).boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThanOrEqual(48);
    }
  });
});
