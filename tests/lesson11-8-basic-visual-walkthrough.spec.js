import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Grade 11 Basic Lesson 8: Visual Walkthrough, Stage Verification & Screenshot Capture', () => {
  const scratchDir = 'C:/Users/vatutin_n_a/.gemini/antigravity-cli/brain/56d312f7-8c9f-4924-a2a6-f7eb0ce96e72/scratch';

  test('01. Lesson Split-Screen & Comprehensive Theory UI Verification', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('header h1')).toContainText('Организация личного архива информации');
    await page.screenshot({ path: path.join(scratchDir, '01_lesson8_split_screen.png'), fullPage: false });

    // Scroll through theory content
    const theoryPane = page.locator('section.prose').first();
    await expect(theoryPane).toBeVisible();

    await theoryPane.evaluate(el => el.scrollBy(0, 800));
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(scratchDir, '02_lesson8_theory_strategies_and_321.png'), fullPage: false });

    await theoryPane.evaluate(el => el.scrollBy(0, 1600));
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(scratchDir, '03_lesson8_theory_additional_guidelines.png'), fullPage: false });
  });

  test('02. Level 1 - 3-Phase Interactive Manipulation Walkthrough', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level1');
    await page.waitForLoadState('domcontentloaded');

    // Phase 1: Lossless vs Lossy Sorting
    await expect(page.locator('#phase-1-container')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '04_level1_phase1_start.png') });

    // Move cards into buckets
    const cards = page.locator('#p1-cards-pool .phase1-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = page.locator('#p1-cards-pool .phase1-card').first();
      const expectedType = await card.getAttribute('data-expected-type');
      await card.click();
      await page.locator(`#bucket-${expectedType} .bucket-slots`).click();
    }
    await page.screenshot({ path: path.join(scratchDir, '05_level1_phase1_sorted.png') });
    await page.locator('#p1-verify-btn').click();

    // Phase 2: Topology 3-2-1-1-0
    await expect(page.locator('#phase-2-container')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '06_level1_phase2_topology.png') });

    const slots = ['original', 'local_backup', 'offsite', 'airgap'];
    for (const slotName of slots) {
      const matchToken = page.locator(`.device-token[data-expected-slot="${slotName}"]`);
      await matchToken.click();
      await page.locator(`.slot-target[data-slot="${slotName}"]`).click();
    }
    await page.screenshot({ path: path.join(scratchDir, '07_level1_phase2_completed.png') });
    await page.locator('#p2-verify-btn').click();

    // Phase 3: Calibrator
    await expect(page.locator('#phase-3-container')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '08_level1_phase3_calibrator_start.png') });

    await page.locator('#slider-rpo').fill('1');
    await page.locator('#slider-rpo').dispatchEvent('input');
    await page.locator('#slider-retention').fill('35');
    await page.locator('#slider-retention').dispatchEvent('input');

    const formatBtn = page.locator('#toggle-format-btn');
    await formatBtn.click(); // to pdfa

    const sigBtn = page.locator('#toggle-sig-btn');
    await sigBtn.click(); // to nep
    await sigBtn.click(); // to kep

    const hashBtn = page.locator('#toggle-hash-btn');
    await hashBtn.click(); // to sha256

    await page.screenshot({ path: path.join(scratchDir, '09_level1_phase3_calibrated.png') });
    await page.locator('#p3-verify-btn').click();

    // Final Screen
    await expect(page.locator('#final-screen')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '10_level1_final_success.png') });
  });

  test('03. Level 2 - Golden Sawtooth 5-Phase Walkthrough', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level2');
    await page.waitForLoadState('domcontentloaded');

    // Phase 1: Compression
    await expect(page.locator('#phase1')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '11_level2_phase1_compression.png') });
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase1());

    // Phase 2: Diff vs Incr
    await expect(page.locator('#phase2')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '12_level2_phase2_strategies.png') });
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase2());

    // Phase 3: RTO & Bandwidth
    await expect(page.locator('#phase3')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '13_level2_phase3_rto.png') });
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase3());

    // Phase 4: Hash integrity
    await expect(page.locator('#phase4')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '14_level2_phase4_integrity.png') });
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase4());

    // Phase 5: Culmination 3-2-1
    await expect(page.locator('#phase5')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '15_level2_phase5_budget.png') });
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase5());

    // Final Screen
    await expect(page.locator('#final-screen')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '16_level2_final_success.png') });
  });

  test('04. Level 3 - Storage Pipeline Dispatcher Arcade Walkthrough', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level3');
    await page.waitForLoadState('domcontentloaded');

    // Intro Screen
    await expect(page.locator('#start-btn')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '17_level3_intro_screen.png') });
    await page.locator('#start-btn').click();

    // Wave 1 Active
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');
    await page.screenshot({ path: path.join(scratchDir, '18_level3_wave1_active.png') });

    // Solve 5 waves
    for (let w = 1; w <= 5; w++) {
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
      await page.waitForTimeout(350);
    }
    await page.screenshot({ path: path.join(scratchDir, '19_level3_wave6_midgame.png') });

    // Trigger Hardcore Reset Alarm
    await page.evaluate(() => {
      const cur = window.__DEV_LEVEL3_STATE__.getCurrentWave();
      const wrong = cur.correctAction === 'worm' ? 'media' : 'worm';
      window.__DEV_LEVEL3_STATE__.submitAction(wrong);
    });
    await expect(page.locator('#alarm-box')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '20_level3_alarm_siren_reset.png') });

    // Wait for reset back to wave 1
    await page.waitForTimeout(1900);
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    // Now clear all 10 waves to victory
    for (let w = 1; w <= 10; w++) {
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
      await page.waitForTimeout(350);
    }

    // Victory Screen
    await expect(page.locator('h2:has-text("АРКАДНЫЙ БОСС УРОВНЯ 3 ПОВЕРЖЕН!")')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '21_level3_victory_screen.png') });
  });
});
