import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('11th Grade Basic Lesson 9: Level 2 (Student Personas & Visual Analysis)', () => {
  const scratchDir = 'C:/Users/vatutin_n_a/.gemini/antigravity-cli/brain/91337d6b-39e2-43c5-a092-1b93b72c6781/scratch';

  test('Persona: NOVICE — commits calculation error on Phase 1, recovers and finishes', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level2'));
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#phase1')).toBeVisible();

    // Novice enters zeros
    await page.locator('#p1-input-abs').fill('0');
    await page.locator('#p1-input-rel').fill('0');
    await page.screenshot({ path: path.join(scratchDir, '08_level2_novice_error_attempt.png') });
    await page.locator('#p1-submit-btn').click();

    // Error feedback
    await expect(page.locator('#error-feedback')).toBeVisible();
    await page.waitForTimeout(1600);
    await expect(page.locator('#error-feedback')).toBeHidden();

    // Solves Phase 1 via Dev State
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase1());

    // Advances to Phase 2
    await expect(page.locator('#phase2')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '09_level2_novice_phase2.png') });

    // Finishes remaining phases
    await page.evaluate(() => {
      window.__DEV_LEVEL2_STATE__.solvePhase2();
      window.__DEV_LEVEL2_STATE__.solvePhase3();
      window.__DEV_LEVEL2_STATE__.solvePhase4();
      window.__DEV_LEVEL2_STATE__.solvePhase5();
    });

    await expect(page.locator('#final-screen')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '10_level2_novice_victory.png') });
  });

  test('Persona: CARELESS — enters values with spaces and recovers', async ({ page }) => {
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level2'));
    await page.waitForLoadState('domcontentloaded');

    // Careless inputs with extra whitespace
    const p1Fact = parseInt(await page.locator('#p1-fact-val').innerText(), 10);
    const p1Calc = parseInt(await page.locator('#p1-mod-val').innerText(), 10);
    const p1Abs = Math.abs(p1Calc - p1Fact);
    const p1Rel = Math.round((p1Abs / p1Fact) * 100);

    await page.locator('#p1-input-abs').fill(`  ${p1Abs}  `);
    await page.locator('#p1-input-rel').fill(`  ${p1Rel}  `);
    await page.locator('#p1-submit-btn').click();

    await expect(page.locator('#phase2')).toBeVisible();
  });

  test('Persona: CHAOS — rapid clicking submit buttons with empty fields and spam input', async ({ page }) => {
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level2'));
    await page.waitForLoadState('domcontentloaded');

    // Rapid spam clicks on submit with empty fields
    for (let i = 0; i < 5; i++) {
      await page.locator('#p1-submit-btn').click({ force: true });
      await page.waitForTimeout(20);
    }

    // App remains responsive
    await expect(page.locator('#phase1')).toBeVisible();
  });

  test('Persona: DILIGENT — step-by-step visual walkthrough and screenshot capture of 5 phases', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level2'));
    await page.waitForLoadState('domcontentloaded');

    // Screenshot Step 1: Direct Error Calculation
    await expect(page.locator('#phase1')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '11_level2_diligent_phase1.png'), fullPage: false });
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase1());

    // Screenshot Step 2: Multi-step Conversion
    await expect(page.locator('#phase2')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '12_level2_diligent_phase2.png'), fullPage: false });
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase2());

    // Screenshot Step 3: Tolerance Interval
    await expect(page.locator('#phase3')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '13_level2_diligent_phase3.png'), fullPage: false });
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase3());

    // Screenshot Step 4: Linear Interpolation
    await expect(page.locator('#phase4')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '14_level2_diligent_phase4.png'), fullPage: false });
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase4());

    // Screenshot Step 5: Extrapolation & Quantization
    await expect(page.locator('#phase5')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '15_level2_diligent_phase5.png'), fullPage: false });
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase5());

    // Screenshot Step 6: Victory Screen
    await expect(page.locator('#final-screen')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '16_level2_diligent_victory.png'), fullPage: false });
    await expect(page.locator('#stat-attempts')).toHaveText('0');
  });
});
