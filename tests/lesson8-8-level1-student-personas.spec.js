import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('Grade 8 Lesson 8: Logic Operations Level 1 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — places wrong token, verifies error feedback and resets, then solves correctly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level1');

    await expect(page.locator('#phase-1-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    // 1. Novice mistake: Put wrong token into slot
    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        // Find token with text containing 'Параллельное' (belongs to OR)
        const orCircuitToken = page.locator('#p1-tokens-pool .token-item', { hasText: 'Параллельное' }).first();
        await orCircuitToken.click();

        // Mistakenly put it into NOT module's circuit slot
        const notCircuitSlot = page.locator('.op-module[data-op="not"] .slot-target[data-slot="circuit"]');
        await notCircuitSlot.click();

        // Click reset button as a student who realized their early mistake
        await page.locator('#p1-reset-btn').click();
      },
      assertErrorStateFn: async () => {
        // All 11 tokens (9 target + 2 distractors) should return to pool
        await expect(page.locator('#p1-tokens-pool .token-item')).toHaveCount(11);
      },
      solveCorrectlyFn: async () => {
        // Now solve by visible Russian labels (Semantic Student Matching)
        const targetMappings = [
          // NOT module
          { op: 'not', slot: 'symbol', matchText: '¬A' },
          { op: 'not', slot: 'circuit', matchText: 'Инвертор' },
          { op: 'not', slot: 'math', matchText: '1 − A' },
          // AND module
          { op: 'and', slot: 'symbol', matchText: 'A ∧ B' },
          { op: 'and', slot: 'circuit', matchText: 'Последовательное' },
          { op: 'and', slot: 'math', matchText: 'min(A, B)' },
          // OR module
          { op: 'or', slot: 'symbol', matchText: 'A ∨ B' },
          { op: 'or', slot: 'circuit', matchText: 'Параллельное' },
          { op: 'or', slot: 'math', matchText: 'max(A, B)' },
        ];

        for (const mapping of targetMappings) {
          const token = page.locator('#p1-tokens-pool .token-item', { hasText: mapping.matchText }).first();
          await token.click();

          const slot = page.locator(`.op-module[data-op="${mapping.op}"] .slot-target[data-slot="${mapping.slot}"]`);
          await slot.click();
        }

        const verifyBtn = page.locator('#p1-verify-btn');
        await expect(verifyBtn).toBeEnabled();
        await verifyBtn.click();
      },
      assertSuccessStateFn: async () => {
        // Phase 1 should complete and move to Phase 2
        await expect(page.locator('#phase-1-container')).toBeHidden();
        await expect(page.locator('#phase-2-container')).toBeVisible();
        await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — spam-clicks reset and pool slots, tests error resilience', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level1');

    // Spam click the reset button 5 times
    await sim.simulateSpamClick(page.locator('#p1-reset-btn'), 5);

    // Click random empty slot targets without token selected
    const slots = page.locator('.slot-target');
    const slotCount = await slots.count();
    for (let i = 0; i < Math.min(3, slotCount); i++) {
      await slots.nth(i).click();
    }

    // Verify session remained healthy and clean
    sim.assertCleanSession();
    // 9 valid tokens + 2 distractors = 11 tokens in pool
    expect(await page.locator('#p1-tokens-pool .token-item').count()).toBe(11);
  });
});
