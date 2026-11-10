import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('Grade 7 Lesson 9: Information & Data Level 1 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — makes mistaken classification in Phase 1, observes error feedback, regenerates, then solves correctly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level1');

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    // Novice mistake: Put all cards into auditory bucket blindly
    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        const cards = page.locator('#p1-cards-pool .p1-card');
        const count = await cards.count();
        for (let i = 0; i < count; i++) {
          const card = page.locator('#p1-cards-pool .p1-card').first();
          await card.click();
          await page.locator('.p1-dropzone[data-bucket="auditory"] .p1-dropzone-header').click();
        }
        await page.locator('#btn-phase1').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#error-box')).toBeVisible();
        await page.waitForTimeout(1600);
        await expect(page.locator('#p1-cards-pool .p1-card')).toHaveCount(6);
      },
      solveCorrectlyFn: async () => {
        for (let i = 0; i < 6; i++) {
          const card = page.locator('#p1-cards-pool .p1-card').first();
          const type = await card.getAttribute('data-type');
          await card.click();
          await page.locator(`.p1-dropzone[data-bucket="${type}"] .p1-dropzone-header`).click();
        }
        const verifyBtn = page.locator('#btn-phase1');
        await expect(verifyBtn).toBeEnabled();
        await verifyBtn.click();
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase1')).toBeHidden();
        await expect(page.locator('#phase2')).toBeVisible();
        await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid clicking without selection, tests UI resilience', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level1');

    await sim.simulateSpamClick(page.locator('#btn-phase1'), 5);
    await sim.simulateSpamClick(page.locator('.p1-dropzone').first(), 3);

    // Ensure system is stable and pool still intact
    await expect(page.locator('#p1-cards-pool .p1-card')).toHaveCount(6);
    await expect(page.locator('#btn-phase1')).toBeDisabled();
    sim.assertCleanSession();
  });

  test('Persona: CARELESS — toggles cards, cancels placement, removes from bucket, and recovers', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level1');

    // Select first card, then deselect it
    const firstCard = page.locator('#p1-cards-pool .p1-card').first();
    await firstCard.click();
    await expect(firstCard).toHaveClass(/border-warning/);
    await firstCard.click();
    await expect(firstCard).not.toHaveClass(/border-warning/);

    // Put card into bucket
    await firstCard.click();
    await page.locator('.p1-dropzone[data-bucket="visual"] .p1-dropzone-header').click();
    await expect(page.locator('#p1-cards-pool .p1-card')).toHaveCount(5);

    // Click card inside bucket to return it back to pool
    const placedCard = page.locator('.p1-dropzone[data-bucket="visual"] .p1-card').first();
    await placedCard.click();
    await expect(page.locator('#p1-cards-pool .p1-card')).toHaveCount(6);

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — completes full level with careful verification', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level1');

    // Phase 1
    for (let i = 0; i < 6; i++) {
      const card = page.locator('#p1-cards-pool .p1-card').first();
      const type = await card.getAttribute('data-type');
      await card.click();
      await page.locator(`.p1-dropzone[data-bucket="${type}"] .p1-dropzone-header`).click();
    }
    await page.locator('#btn-phase1').click();
    await expect(page.locator('#phase2')).toBeVisible();

    // Phase 2
    const taskCards = page.locator('.p2-task-card');
    for (let i = 0; i < 3; i++) {
      const taskCard = taskCards.nth(i);
      const taskId = await taskCard.getAttribute('data-task-id');
      let cId = taskId === 'task_volt' ? 'c_volt' : (taskId === 'task_temp' ? 'c_temp' : 'c_net');
      let mId = taskId === 'task_volt' ? 'm_volt' : (taskId === 'task_temp' ? 'm_temp' : 'm_net');

      await page.locator(`.p2-token[data-token-id="${cId}"]`).click();
      await taskCard.locator('.p2-slot[data-slot="context"]').click();

      await page.locator(`.p2-token[data-token-id="${mId}"]`).click();
      await taskCard.locator('.p2-slot[data-slot="meaning"]').click();
    }
    await page.locator('#btn-phase2').click();
    await expect(page.locator('#phase3')).toBeVisible();

    // Phase 3
    const conns = [
      { incId: 'inc_act', targetProp: 'prop_act' },
      { incId: 'inc_und', targetProp: 'prop_und' },
      { incId: 'inc_rel', targetProp: 'prop_rel' },
      { incId: 'inc_com', targetProp: 'prop_com' }
    ];
    for (const c of conns) {
      await page.locator(`.p3-incident-card[data-id="${c.incId}"]`).click();
      await page.locator(`.p3-prop-card[data-id="${c.targetProp}"]`).click();
    }
    await page.locator('#btn-phase3').click();

    await expect(page.locator('#success-screen')).toBeVisible();
    sim.assertCleanSession();
  });
});
