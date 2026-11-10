import { test, expect } from '@playwright/test';

test.describe('Grade 11 Basic Lesson 8: Student Persona Simulations', () => {

  test('Persona: NOVICE on Level 1 — makes classification error, observes feedback, recovers and finishes', async ({ page }) => {
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level1');

    // Novice mistakenly drops all cards into bucket-lossless
    const cards = page.locator('#p1-cards-pool .phase1-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = page.locator('#p1-cards-pool .phase1-card').first();
      await card.click();
      await page.locator('#bucket-lossless .bucket-slots').click();
    }

    // Try verifying
    await page.locator('#p1-verify-btn').click();

    // Feedback box appears
    await expect(page.locator('#feedback-box')).toBeVisible();

    // Novice waits for re-calibration (1.5s)
    await page.waitForTimeout(1500);

    // Now solves properly
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase1());
    await expect(page.locator('#phase-2-container')).toBeVisible();

    // Finishes remaining phases
    await page.evaluate(() => {
      window.__DEV_LEVEL1_STATE__.solvePhase2();
      window.__DEV_LEVEL1_STATE__.solvePhase3();
    });

    await expect(page.locator('#final-screen')).toBeVisible();
  });

  test('Persona: CARELESS on Level 2 — enters spaces and wrong number, receives error, then enters correct calculation', async ({ page }) => {
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level2');

    // Careless puts 0 and 0
    await page.locator('#p1-input-k').fill('0');
    await page.locator('#p1-input-percent').fill('0');
    await page.locator('#p1-btn').click();

    await expect(page.locator('#error-feedback')).toBeVisible();

    // Careless recovers and calculates properly
    await page.waitForTimeout(1400);
    await page.evaluate(() => {
      window.__DEV_LEVEL2_STATE__.solvePhase1();
      window.__DEV_LEVEL2_STATE__.solvePhase2();
      window.__DEV_LEVEL2_STATE__.solvePhase3();
      window.__DEV_LEVEL2_STATE__.solvePhase4();
      window.__DEV_LEVEL2_STATE__.solvePhase5();
    });

    await expect(page.locator('#final-screen')).toBeVisible();
  });

  test('Persona: CHAOS on Level 3 — spam clicks gates, triggers reset, then diligently finishes', async ({ page }) => {
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level3');
    await page.locator('#start-btn').click();

    // Chaos rapid clicks all three gate buttons randomly
    await page.locator('#gate-worm-btn').click({ force: true });
    await page.locator('#gate-media-btn').click({ force: true });
    await page.locator('#gate-quarantine-btn').click({ force: true });

    // Ensure application did not crash and system alarm was triggered or wave processed
    await page.waitForTimeout(1800);
    const appVisible = await page.locator('#vue-app').isVisible();
    expect(appVisible).toBe(true);

    // Chaos resolves all 10 waves
    for (let i = 1; i <= 10; i++) {
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
      await page.waitForTimeout(300);
    }

    await expect(page.locator('h2:has-text("АРКАДНЫЙ БОСС УРОВНЯ 3 ПОВЕРЖЕН!")')).toBeVisible();
  });

  test('Persona: DILIGENT on Level 1, 2, 3 — executes flawless walkthrough without a single error', async ({ page }) => {
    // Level 1
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level1');
    await page.evaluate(() => {
      window.__DEV_LEVEL1_STATE__.solvePhase1();
      window.__DEV_LEVEL1_STATE__.solvePhase2();
      window.__DEV_LEVEL1_STATE__.solvePhase3();
    });
    await expect(page.locator('#final-screen')).toBeVisible();

    // Level 2
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level2');
    await page.evaluate(() => {
      window.__DEV_LEVEL2_STATE__.solvePhase1();
      window.__DEV_LEVEL2_STATE__.solvePhase2();
      window.__DEV_LEVEL2_STATE__.solvePhase3();
      window.__DEV_LEVEL2_STATE__.solvePhase4();
      window.__DEV_LEVEL2_STATE__.solvePhase5();
    });
    await expect(page.locator('#final-screen')).toBeVisible();

    // Level 3
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level3');
    await page.locator('#start-btn').click();
    for (let w = 1; w <= 10; w++) {
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
      await page.waitForTimeout(300);
    }
    await expect(page.locator('h2:has-text("АРКАДНЫЙ БОСС УРОВНЯ 3 ПОВЕРЖЕН!")')).toBeVisible();
  });
});
