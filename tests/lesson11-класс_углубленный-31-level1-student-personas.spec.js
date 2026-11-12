import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('11th Grade Lesson 31: Level 1 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — commits error on Phase 1, observes feedback, recovers and advances', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level1');

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    // Novice mistake: clicks verify immediately without placing any tokens
    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        await page.locator('#p1-verify-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#feedback-box')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
      },
      solveCorrectlyFn: async () => {
        // Wait for regeneration timeout (1500ms + buffer)
        await page.waitForTimeout(1700);
        await expect(page.locator('#feedback-box')).toBeHidden();

        const validTokens = await page.evaluate(() => {
          return window.__DEV_LEVEL1_STATE__ ? window.__DEV_LEVEL1_STATE__.getP1ValidTokens() : [];
        });

        for (const t of validTokens) {
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
        await page.locator('#p1-verify-btn').click();
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase1')).toBeHidden();
        await expect(page.locator('#phase2')).toBeVisible();
        await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid clicking on empty slots, invalid toggling, resilience', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level1');

    // Click empty slots without any token selected
    for (let i = 0; i < 5; i++) {
      const slot = page.locator(`#p1-slot-${i}`);
      if (await slot.isVisible()) {
        await slot.click();
      }
    }

    // Verify slots still display empty state or waiting state
    for (let i = 0; i < 5; i++) {
      const slot = page.locator(`#p1-slot-${i}`);
      if (await slot.isVisible()) {
        await expect(slot).toContainText('∅ (Список пуст)');
      }
    }

    // Spam clicks on verify button while empty
    await sim.simulateSpamClick(page.locator('#p1-verify-btn'), 3);

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — completes full 3-phase progression with 100% precision', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level1');

    // --- Phase 1: Separate Chaining ---
    await expect(page.locator('#phase1')).toBeVisible();
    const validTokens = await page.evaluate(() => {
      return window.__DEV_LEVEL1_STATE__ ? window.__DEV_LEVEL1_STATE__.getP1ValidTokens() : [];
    });

    for (const t of validTokens) {
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
    await page.locator('#p1-verify-btn').click();

    // --- Phase 2: Open Addressing ---
    await expect(page.locator('#phase2')).toBeVisible();
    const deleteTarget = await page.evaluate(() => {
      return window.__DEV_LEVEL1_STATE__ ? window.__DEV_LEVEL1_STATE__.getP2Delete() : null;
    });

    await page.locator(`#p2-cell-${deleteTarget.idx}`).click();
    await sim.cognitivePause(40);
    await page.locator(`#p2-insert-btn-${deleteTarget.idx}`).click();
    await sim.cognitivePause(40);
    await page.locator('#p2-verify-btn').click();

    // --- Phase 3: Frequency Dictionary Ranking ---
    await expect(page.locator('#phase3')).toBeVisible();
    const p3Data = await page.evaluate(() => {
      const state = window.__DEV_LEVEL1_STATE__;
      return {
        words: state.getP3Words(),
        trueFreq: state.getP3TrueFreq(),
        ranking: state.getP3ExpectedRanking()
      };
    });

    for (const word of p3Data.words) {
      const count = p3Data.trueFreq[word];
      for (let i = 0; i < count; i++) {
        await page.locator(`#p3-inc-${word}`).click();
      }
      await sim.cognitivePause(30);
    }

    for (let r = 0; r < 4; r++) {
      const word = p3Data.ranking[r];
      await page.locator(`#p3-chip-${word}`).click();
      await page.locator(`#p3-rank-slot-${r}`).click();
      await sim.cognitivePause(30);
    }

    await page.locator('#p3-verify-btn').click();

    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-attempts')).toHaveText('0');
    sim.assertCleanSession();
  });

  test('Level 1 - Hitbox & Touch Target Ergonomics Audit (>= 48px)', async ({ page }) => {
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level1');

    // Phase 1 verify button
    const p1Verify = await page.locator('#p1-verify-btn').boundingBox();
    expect(p1Verify).not.toBeNull();
    expect(p1Verify.height).toBeGreaterThanOrEqual(48);

    // Phase 1 tokens
    const tokens = page.locator('#p1-token-palette .btn');
    const tokenCount = await tokens.count();
    expect(tokenCount).toBeGreaterThan(0);
    for (let i = 0; i < tokenCount; i++) {
      const box = await tokens.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThanOrEqual(48);
    }

    // Phase 1 empty slots
    const slots = page.locator('[data-bucket-slot]');
    const slotCount = await slots.count();
    for (let i = 0; i < slotCount; i++) {
      const box = await slots.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box.height).toBeGreaterThanOrEqual(48);
    }
  });
});
