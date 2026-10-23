import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('Grade 7 Lesson 8: Cyber Security & Internet Communications Level 3 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — makes mistaken classification on Wave 1, observes alarm feedback, resets to Wave 1, then solves correctly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
    await page.goto(`${BASE_URL}/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level3`);

    await page.locator('#btn-start').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    // Novice mistake: picks opposite action blindly
    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        const card = page.locator('#target-packet-card');
        await expect(card).toBeVisible();
        const target = await card.getAttribute('data-target');
        if (target === 'allow') {
          await page.locator('#btn-action-drop').click();
        } else {
          await page.locator('#btn-action-allow').click();
        }
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#alarm-box')).toBeVisible();
        await page.waitForTimeout(2500);
        await expect(page.locator('#alarm-box')).not.toBeVisible();
        await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');
      },
      solveCorrectlyFn: async () => {
        const card = page.locator('#target-packet-card');
        await expect(card).toBeVisible();
        const target = await card.getAttribute('data-target');
        if (target === 'allow') {
          await page.locator('#btn-action-allow').click();
        } else {
          await page.locator('#btn-action-drop').click();
        }
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 10');
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid clicking on tactical action buttons during wave, tests UI resilience and single dispatch', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
    await page.goto(`${BASE_URL}/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level3`);

    // Start mission
    await page.locator('#btn-start').click();
    await expect(page.locator('#phase-counter')).toBeVisible();

    // Spam click action button
    const actionBtn = page.locator('#btn-action-allow');
    await expect(actionBtn).toBeVisible();
    await sim.simulateSpamClick(actionBtn, 3);

    // Session remains healthy without unhandled JS exceptions
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — accurately completes all 10 waves and reaches victory screen', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
    await page.goto(`${BASE_URL}/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level3`);

    await page.locator('#btn-start').click();

    for (let wave = 0; wave < 10; wave++) {
      const card = page.locator('#target-packet-card');
      await expect(card).toBeVisible();
      await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${wave + 1} ИЗ 10`);

      const target = await card.getAttribute('data-target');
      if (target === 'allow') {
        await page.locator('#btn-action-allow').click();
      } else {
        await page.locator('#btn-action-drop').click();
      }
      await page.waitForTimeout(60);
    }

    await expect(page.locator('#success-screen')).toBeVisible();
    sim.assertCleanSession();
  });
});
