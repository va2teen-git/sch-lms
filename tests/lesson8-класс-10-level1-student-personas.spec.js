import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';
import path from 'path';

test.describe('Grade 8 Lesson 10: Level 1 (Student Personas Simulation)', () => {
  const screenshotsDir = 'C:/Users/vatutin_n_a/.gemini/antigravity-cli/brain/192c6b2a-19fe-4756-ae96-9334608df7ea/scratch/screenshots';

  test('Persona: NOVICE — commits error on Phase 1, observes feedback alert, recovers and advances', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level1');

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    // Screenshot initial state
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level1-p1-initial.png') });

    // Novice mistake: fills all cells with 0 and submits
    const cells = page.locator('.p1-cell');
    const cellCount = await cells.count();
    for (let i = 0; i < cellCount; i++) {
      await cells.nth(i).click();
      await page.waitForTimeout(30);
    }

    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level1-p1-all-zeros.png') });
    await page.locator('#p1-verify-btn').click();

    // Verify feedback alert
    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level1-p1-error-feedback.png') });

    // Wait for regeneration
    await expect(page.locator('#feedback-box')).toBeHidden({ timeout: 3000 });

    // Diligent recovery: solve Phase 1 correctly
    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL1_STATE__.solvePhase1();
    });

    // Advance to Phase 2
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level1-p2-slot-snap.png') });

    // Solve Phase 2
    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL1_STATE__.solvePhase2();
    });

    // Advance to Phase 3
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level1-p3-classification.png') });

    // Solve Phase 3
    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL1_STATE__.solvePhase3();
    });

    // Verify victory
    await expect(page.locator('#victory-screen')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level1-victory.png') });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid clicking on cells, slots, and clear button', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level1');

    await expect(page.locator('#phase1')).toBeVisible();

    // Rapid spam clicks on table cells
    const firstCell = page.locator('.p1-cell').first();
    await sim.simulateSpamClick(firstCell, 6);

    // Verify cell toggles properly without throwing NaN or crashing
    const cellVal = await firstCell.getAttribute('data-val');
    expect(['0', '1', '?']).toContain(cellVal);

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — flawless step-by-step completion through all 3 phases', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level1');

    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL1_STATE__.solvePhase1();
    });
    await expect(page.locator('#phase2')).toBeVisible();

    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL1_STATE__.solvePhase2();
    });
    await expect(page.locator('#phase3')).toBeVisible();

    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL1_STATE__.solvePhase3();
    });
    await expect(page.locator('#victory-screen')).toBeVisible();

    sim.assertCleanSession();
  });
});
