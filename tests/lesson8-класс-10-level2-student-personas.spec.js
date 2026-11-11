import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';
import path from 'path';

test.describe('Grade 8 Lesson 10: Level 2 (Student Personas Simulation)', () => {
  const screenshotsDir = 'C:/Users/vatutin_n_a/.gemini/antigravity-cli/brain/192c6b2a-19fe-4756-ae96-9334608df7ea/scratch/screenshots';

  test('Persona: NOVICE — error on Phase 1, feedback check, screenshot audit, and recovery through all 5 phases', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level2');

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level2-p1-initial.png') });

    // Novice mistake: enters wrong row count
    const p1Input = page.locator('#p1-input');
    await p1Input.fill('100');
    await page.locator('#p1-verify-btn').click();

    // Feedback alert
    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level2-p1-error-feedback.png') });

    // Wait for regeneration
    await expect(page.locator('#feedback-box')).toBeHidden({ timeout: 3000 });

    // Correct Phase 1
    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL2_STATE__.solvePhase1();
    });

    // Phase 2
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level2-p2-ones-count.png') });
    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL2_STATE__.solvePhase2();
    });

    // Phase 3
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 5');
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level2-p3-columns-decoding.png') });
    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL2_STATE__.solvePhase3();
    });

    // Phase 4
    await expect(page.locator('#phase4')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 4 из 5');
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level2-p4-invariants.png') });
    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL2_STATE__.solvePhase4();
    });

    // Phase 5
    await expect(page.locator('#phase5')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 5 из 5');
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level2-p5-system-analysis.png') });
    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL2_STATE__.solvePhase5();
    });

    // Victory screen
    await expect(page.locator('#victory-screen')).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level2-victory.png') });

    sim.assertCleanSession();
  });

  test('Persona: CARELESS — submits with surrounding whitespace and Enter key', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level2');

    await expect(page.locator('#phase1')).toBeVisible();

    const expected = await page.locator('#p1-input').getAttribute('data-expected');
    // Input with spaces
    await page.locator('#p1-input').fill(`   ${expected}   `);
    await page.locator('#p1-input').press('Enter');

    // Should advance to Phase 2
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — attempts rapid clicking on verify buttons and empty submit', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level2');

    // Rapid clicking empty input verify
    const verifyBtn = page.locator('#p1-verify-btn');
    await sim.simulateSpamClick(verifyBtn, 4);

    // Ensure page didn't throw unhandled exception
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — optimal path through all 5 phases', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level2');

    for (let p = 1; p <= 5; p++) {
      await page.evaluate((phaseNum) => {
        // @ts-ignore
        window.__DEV_LEVEL2_STATE__[`solvePhase${phaseNum}`]();
      }, p);
    }

    await expect(page.locator('#victory-screen')).toBeVisible();
    sim.assertCleanSession();
  });
});
