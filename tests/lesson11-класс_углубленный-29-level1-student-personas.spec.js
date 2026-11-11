import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('11th Grade Lesson 29: Level 1 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — commits error on Phase 1, observes feedback, recovers and advances', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/29/level1');

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    // Novice mistake: clicks verify immediately without filling slots
    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
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

        const numStr = await page.locator('#p1-target-number').innerText();
        const block0 = numStr.slice(-4);
        const block1 = numStr.slice(-8, -4);
        const block2 = numStr.slice(0, -8);
        const expectedBlocks = [block0, block1, block2];

        for (let slot = 0; slot < 3; slot++) {
          const token = page.locator(`.p1-token-btn[data-val="${expectedBlocks[slot]}"]`).first();
          await token.click();
          await page.locator(`#p1-slot-${slot}`).click();
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

  test('Persona: CHAOS — rapid clicking on reset button, empty slots and palette', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/29/level1');

    // Rapid spam clicks on reset button
    await sim.simulateSpamClick(page.locator('#p1-reset-btn'), 5);

    // Click slots without selected token
    for (let i = 0; i < 3; i++) {
      await page.locator(`#p1-slot-${i}`).click();
    }

    // Verify slots remain empty
    for (let i = 0; i < 3; i++) {
      await expect(page.locator(`#p1-slot-${i}`)).toContainText(`[Слот A[${i}]]`);
    }

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — completes full 3-phase progression with 100% precision', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/29/level1');

    // --- Phase 1: Slot & Snap ---
    await expect(page.locator('#phase1')).toBeVisible();
    const numStr = await page.locator('#p1-target-number').innerText();
    const b0 = numStr.slice(-4);
    const b1 = numStr.slice(-8, -4);
    const b2 = numStr.slice(0, -8);
    const p1Exp = [b0, b1, b2];

    for (let s = 0; s < 3; s++) {
      await page.locator(`.p1-token-btn[data-val="${p1Exp[s]}"]`).first().click();
      await page.locator(`#p1-slot-${s}`).click();
      await sim.cognitivePause(40);
    }
    await page.locator('#p1-submit-btn').click();

    // --- Phase 2: Additive Accumulator ---
    await expect(page.locator('#phase2')).toBeVisible();
    const a0 = parseInt(await page.locator('#p2-val-a0').innerText(), 10);
    const b0Val = parseInt((await page.locator('#p2-val-b0').innerText()).replace(/\D+/g, ''), 10);
    const a1 = parseInt(await page.locator('#p2-val-a1').innerText(), 10);
    const b1Val = parseInt((await page.locator('#p2-val-b1').innerText()).replace(/\D+/g, ''), 10);

    const sum0 = a0 + b0Val;
    const res0 = String(sum0 % 1000);
    const carry1 = String(Math.floor(sum0 / 1000));
    const sum1 = a1 + b1Val + parseInt(carry1, 10);
    const res1 = String(sum1 % 1000);
    const carry2 = String(Math.floor(sum1 / 1000));
    const res2 = String(carry2);

    const p2Assignments = [
      { slotId: 'carry1', val: carry1 },
      { slotId: 'carry2', val: carry2 },
      { slotId: 'res0', val: res0 },
      { slotId: 'res1', val: res1 },
      { slotId: 'res2', val: res2 }
    ];

    for (const item of p2Assignments) {
      const token = page.locator(`#p2-tokens-palette .p2-token-btn[data-val="${item.val}"]:not(.d-none)`).first();
      await token.click();
      await page.locator(`#p2-slot-${item.slotId}`).click();
      await sim.cognitivePause(40);
    }
    await page.locator('#p2-submit-btn').click();

    // --- Phase 3: Buckets ---
    await expect(page.locator('#phase3')).toBeVisible();
    const poolCards = page.locator('#p3-pool .p3-card');
    while (await poolCards.count() > 0) {
      const card = poolCards.first();
      const bucket = await card.getAttribute('data-expected-bucket');
      await card.click();
      await page.locator(`#bucket-${bucket}`).click({ position: { x: 20, y: 20 } });
      await sim.cognitivePause(40);
    }
    await page.locator('#p3-submit-btn').click();

    await expect(page.locator('#victory-screen')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Level 1 - Hitbox & Touch Target Ergonomics Audit (>= 48px)', async ({ page }) => {
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/29/level1');

    // Check Phase 1 slots
    for (let i = 0; i < 3; i++) {
      const slotBox = await page.locator(`#p1-slot-${i}`).boundingBox();
      expect(slotBox).not.toBeNull();
      expect(slotBox.height).toBeGreaterThanOrEqual(48);
      expect(slotBox.width).toBeGreaterThanOrEqual(48);
    }

    // Check Phase 1 buttons
    const submitBox = await page.locator('#p1-submit-btn').boundingBox();
    expect(submitBox.height).toBeGreaterThanOrEqual(48);
  });
});
