import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('11th Grade Basic Lesson 9: Level 1 (Student Personas & Visual Analysis)', () => {
  const scratchDir = 'C:/Users/vatutin_n_a/.gemini/antigravity-cli/brain/91337d6b-39e2-43c5-a092-1b93b72c6781/scratch';

  test('Persona: NOVICE — commits classification error, observes feedback, recovers and finishes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level1'));
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#phase-1-container')).toBeVisible();

    // Novice mistake: puts all cards into bucket-material indiscriminately
    const cards = page.locator('#p1-cards-pool .phase1-card');
    const total = await cards.count();
    for (let i = 0; i < total; i++) {
      const c = page.locator('#p1-cards-pool .phase1-card').first();
      await c.click();
      await page.locator('#bucket-material .bucket-slots').click();
      await page.waitForTimeout(50);
    }

    // Capture screenshot of novice error attempt
    await page.screenshot({ path: path.join(scratchDir, '01_level1_novice_error_attempt.png') });
    await page.locator('#p1-verify-btn').click();

    // Feedback appears with warning
    await expect(page.locator('#feedback-box')).toBeVisible();

    // Novice waits for regeneration timeout (1.5s)
    await page.waitForTimeout(1600);
    await expect(page.locator('#feedback-box')).toBeHidden();

    // Novice recovers and solves Phase 1 properly via UI
    const regenCards = page.locator('#p1-cards-pool .phase1-card');
    const regenTotal = await regenCards.count();
    for (let i = 0; i < regenTotal; i++) {
      const card = page.locator('#p1-cards-pool .phase1-card').first();
      const expectedType = await card.getAttribute('data-expected-type');
      await card.click();
      await page.locator(`#bucket-${expectedType} .bucket-slots`).click();
      await page.waitForTimeout(50);
    }
    await page.locator('#p1-verify-btn').click();

    // Advances to Phase 2
    await expect(page.locator('#phase-2-container')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '02_level1_novice_phase2.png') });

    // Finishes remaining phases
    await page.evaluate(() => {
      window.__DEV_LEVEL1_STATE__.solvePhase2();
      window.__DEV_LEVEL1_STATE__.solvePhase3();
    });

    await expect(page.locator('#final-screen')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '03_level1_novice_victory.png') });
  });

  test('Persona: CHAOS — rapid clicking across empty containers, slots and buttons', async ({ page }) => {
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level1'));
    await page.waitForLoadState('domcontentloaded');

    // Chaos clicks buckets without selecting cards
    for (let i = 0; i < 5; i++) {
      await page.locator('#bucket-material').click({ force: true });
      await page.locator('#bucket-static').click({ force: true });
      await page.locator('#bucket-dynamic').click({ force: true });
      await page.locator('#p1-verify-btn').click({ force: true });
      await page.waitForTimeout(20);
    }

    // Verify application did not crash
    await expect(page.locator('#phase-1-container')).toBeVisible();
  });

  test('Persona: DILIGENT — step-by-step visual audit and flawless completion with screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level1'));
    await page.waitForLoadState('domcontentloaded');

    // Screenshot Step 1: Initial State
    await expect(page.locator('#phase-1-container')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '04_level1_diligent_phase1.png'), fullPage: false });

    // Solve Phase 1
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase1());

    // Screenshot Step 2: Phase 2 Pipeline
    await expect(page.locator('#phase-2-container')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '05_level1_diligent_phase2.png'), fullPage: false });

    // Solve Phase 2
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase2());

    // Screenshot Step 3: Phase 3 Analytical Dashboard
    await expect(page.locator('#phase-3-container')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '06_level1_diligent_phase3.png'), fullPage: false });

    // Solve Phase 3
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase3());

    // Screenshot Step 4: Victory Screen
    await expect(page.locator('#final-screen')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '07_level1_diligent_victory.png'), fullPage: false });

    // Assert final stats
    await expect(page.locator('#stat-attempts')).toHaveText('0');
  });
});
