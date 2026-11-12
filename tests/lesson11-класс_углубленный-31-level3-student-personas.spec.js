import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('11th Grade Lesson 31: Level 3 Arcade (Student Personas Simulation)', () => {

  test('Persona: NOVICE — makes mistaken gate selection on Wave 1, observes alarm feedback, resets to Wave 1, then solves correctly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level3');

    // Start mission
    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    // Novice mistake on Wave 1: Wave 1 expects 'direct'. Novice picks 'collision'
    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        const collisionBtn = page.locator('button', { hasText: '[2] COLLISION_CHAIN' });
        await collisionBtn.click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#alarm-box')).toBeVisible();
        await expect(page.locator('#alarm-box')).toContainText('КРИТИЧЕСКИЙ СБОЙ ХЭШ-ТАБЛИЦЫ!');
      },
      solveCorrectlyFn: async () => {
        // Wait for hardcore reset (1.8s + buffer)
        await page.waitForTimeout(2100);
        await expect(page.locator('#alarm-box')).not.toBeVisible();
        await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

        // Now select correct gate [1] DIRECT_INSERT
        const directBtn = page.locator('button', { hasText: '[1] DIRECT_INSERT' });
        await directBtn.click();
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 10');
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid clicking on tactical action buttons during wave, tests UI resilience and single dispatch', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level3');

    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toBeVisible();

    // Spam click action button
    const directBtn = page.locator('button', { hasText: '[1] DIRECT_INSERT' });
    await expect(directBtn).toBeVisible();
    await sim.simulateSpamClick(directBtn, 3);

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — accurately completes all 10 waves through UI action gates to victory', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level3');

    await page.locator('#start-btn').click();

    for (let wave = 1; wave <= 10; wave++) {
      await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${wave} ИЗ 10`);

      const expectedAction = await page.evaluate(() => {
        return window.__DEV_LEVEL3_STATE__ ? window.__DEV_LEVEL3_STATE__.currentWave().correctAction : null;
      });

      expect(expectedAction).not.toBeNull();

      if (expectedAction === 'direct') {
        await page.locator('button', { hasText: '[1] DIRECT_INSERT' }).click();
      } else if (expectedAction === 'collision') {
        await page.locator('button', { hasText: '[2] COLLISION_CHAIN' }).click();
      } else if (expectedAction === 'rehash') {
        await page.locator('button', { hasText: '[3] REHASH (×2)' }).click();
      } else if (expectedAction === 'inc_freq') {
        await page.locator('button', { hasText: '[4] INC_FREQ' }).click();
      }

      await sim.cognitivePause(280);
    }

    await expect(page.locator('h2', { hasText: 'ХАРДКОР-РЕЖИМ УСПЕШНО ПРЕОДОЛЕН!' })).toBeVisible();
    sim.assertCleanSession();
  });
});
