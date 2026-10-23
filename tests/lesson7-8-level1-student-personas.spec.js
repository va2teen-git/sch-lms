import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('Grade 7 Lesson 8: Cyber Security & Internet Communications Level 1 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — makes mistaken classification in Phase 1, observes error feedback, regenerates, then solves correctly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level1');

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    // Novice mistake: Put all cards into spam bucket blindly
    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        const cards = page.locator('#p1-cards-pool .p1-card');
        const count = await cards.count();
        for (let i = 0; i < count; i++) {
          const card = page.locator('#p1-cards-pool .p1-card').first();
          await card.click();
          await page.locator('.p1-dropzone[data-bucket="spam"]').click();
        }
        await page.locator('#btn-phase1').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#error-box')).toBeVisible();
        // After 1.5s regeneration, cards reappear in the pool
        await page.waitForTimeout(1600);
        await expect(page.locator('#p1-cards-pool .p1-card')).toHaveCount(6);
      },
      solveCorrectlyFn: async () => {
        // Now carefully inspect and solve correctly
        for (let i = 0; i < 6; i++) {
          const card = page.locator('#p1-cards-pool .p1-card').first();
          const type = await card.getAttribute('data-type');
          await card.click();
          await page.locator(`.p1-dropzone[data-bucket="${type}"]`).click();
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
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level1');

    // Click dropzones with no card selected
    const dropzones = page.locator('.p1-dropzone');
    const dzCount = await dropzones.count();
    for (let i = 0; i < dzCount; i++) {
      await sim.simulateSpamClick(dropzones.nth(i), 3);
    }

    // Verify pool is still intact with 6 cards
    await expect(page.locator('#p1-cards-pool .p1-card')).toHaveCount(6);
    await expect(page.locator('#btn-phase1')).toBeDisabled();
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — completes full level with careful verification', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level1');

    // Diligent student solving Phase 1
    for (let i = 0; i < 6; i++) {
      const card = page.locator('#p1-cards-pool .p1-card').first();
      const type = await card.getAttribute('data-type');
      await card.click();
      await page.locator(`.p1-dropzone[data-bucket="${type}"]`).click();
    }
    await page.locator('#btn-phase1').click();
    await expect(page.locator('#phase2')).toBeVisible();

    // Diligent student solving Phase 2
    const slotKeys = ['recipient', 'subject', 'greeting', 'body', 'signature'];
    for (const key of slotKeys) {
      const token = page.locator(`.p2-token[data-id="p2c_${key}"]`);
      await token.click();
      await page.locator(`.p2-slot-card[data-slot-key="${key}"]`).click();
    }
    await page.locator('#btn-phase2').click();
    await expect(page.locator('#phase3')).toBeVisible();

    // Diligent student solving Phase 3
    const conns = [
      { src: 'src_smtps', tgt: 'tgt_465' },
      { src: 'src_pop3s', tgt: 'tgt_995' },
      { src: 'src_imaps', tgt: 'tgt_993' },
      { src: 'src_wifi', tgt: 'tgt_vpn' }
    ];
    for (const conn of conns) {
      await page.locator(`.p3-source-node[data-source-id="${conn.src}"]`).click();
      await page.locator(`.p3-target-node[data-target-id="${conn.tgt}"]`).click();
    }
    await page.locator('#btn-phase3').click();

    await expect(page.locator('#success-screen')).toBeVisible();
    sim.assertCleanSession();
  });

});
