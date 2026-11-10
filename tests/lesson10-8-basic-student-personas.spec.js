import { test, expect } from '@playwright/test';

test.describe('Grade 10 Basic Lesson 8: Student Persona Simulations', () => {

  test('Persona: NOVICE on Level 1 — makes classification error, observes feedback, recovers and finishes', async ({ page }) => {
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level1');

    // Novice mistakenly drops cards into wrong bucket
    await page.evaluate(() => {
      const dist = document.querySelector('#p1-cards-pool .card[data-category="distractor"]');
      const b2 = document.getElementById('bucket-2bit').querySelector('.bucket-slot');
      if (dist && b2) b2.appendChild(dist);
      document.getElementById('p1-submit-btn').disabled = false;
      document.getElementById('p1-submit-btn').click();
    });

    // Feedback box appears
    await expect(page.locator('#feedback-box')).toBeVisible();

    // Novice pauses and waits for re-calibration
    await page.waitForTimeout(1400);

    // Solves properly using dev state
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase1());
    await expect(page.locator('#phase2-container')).toBeVisible();

    // Finishes remaining phases
    await page.evaluate(() => {
      window.__DEV_LEVEL1_STATE__.solvePhase2();
      window.__DEV_LEVEL1_STATE__.solvePhase3();
    });

    await expect(page.locator('#victory-screen')).toBeVisible();
  });

  test('Persona: CARELESS on Level 2 — enters spaces and wrong number, receives error, then enters dirty inputs with spaces and recovers', async ({ page }) => {
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level2');

    // Careless puts 0
    await page.locator('#p1-input').fill('0');
    await page.locator('#p1-btn').click();

    await expect(page.locator('#p1-feedback')).toBeVisible();

    // Careless waits and enters correct answer with extra spaces and suffix
    await page.waitForTimeout(1500);

    // Get expected answer from DOM elements
    const k = parseInt(await page.locator('#p1-k-val').textContent());
    const n = parseInt(await page.locator('#p1-n-val').textContent());
    const i = Math.round(Math.log2(n));
    const expected = k * i;

    // Fill with dirty spaces (Careless pattern)
    await page.locator('#p1-input').fill(`  ${expected} бит `);
    await page.locator('#p1-btn').click();

    // Advances to phase 2
    await expect(page.locator('#phase2')).toBeVisible();

    // Finishes remaining phases cleanly
    await page.evaluate(() => {
      window.__DEV_LEVEL2_STATE__.solvePhase2();
      window.__DEV_LEVEL2_STATE__.solvePhase3();
      window.__DEV_LEVEL2_STATE__.solvePhase4();
      window.__DEV_LEVEL2_STATE__.solvePhase5();
    });

    await expect(page.locator('#victory-screen')).toBeVisible();
  });

  test('Persona: CHAOS on Level 3 — spam clicks gates, triggers reset, then diligently finishes', async ({ page }) => {
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level3');
    await page.locator('#start-btn').click();

    // Chaos clicks wrong gate on wave 1
    await page.evaluate(() => {
      const pkt = window.__DEV_LEVEL3_STATE__.getCurrentPacket();
      window.__DEV_LEVEL3_STATE__.submitChoice(!pkt.isSufficient);
    });

    await expect(page.locator('.alert-danger')).toBeVisible();
    await page.waitForTimeout(1800);

    // Now finishes all 10 waves
    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('#wave-counter-badge')).toContainText(`Волна ${w} из 10`);
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    }

    await expect(page.locator('h3:has-text("АТТЕСТАЦИЯ АРКАДЫ ЗАВЕРШЕНА")')).toBeVisible();
  });

  test('Persona: DILIGENT on Level 1, 2, 3 — executes flawless walkthrough without a single error', async ({ page }) => {
    // Level 1
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level1');
    await page.evaluate(() => {
      window.__DEV_LEVEL1_STATE__.solvePhase1();
      window.__DEV_LEVEL1_STATE__.solvePhase2();
      window.__DEV_LEVEL1_STATE__.solvePhase3();
    });
    await expect(page.locator('#victory-screen')).toBeVisible();

    // Level 2
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level2');
    await page.evaluate(() => {
      window.__DEV_LEVEL2_STATE__.solvePhase1();
      window.__DEV_LEVEL2_STATE__.solvePhase2();
      window.__DEV_LEVEL2_STATE__.solvePhase3();
      window.__DEV_LEVEL2_STATE__.solvePhase4();
      window.__DEV_LEVEL2_STATE__.solvePhase5();
    });
    await expect(page.locator('#victory-screen')).toBeVisible();

    // Level 3
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level3');
    await page.locator('#start-btn').click();
    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('#wave-counter-badge')).toContainText(`Волна ${w} из 10`);
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    }
    await expect(page.locator('h3:has-text("АТТЕСТАЦИЯ АРКАДЫ ЗАВЕРШЕНА")')).toBeVisible();
  });
});
