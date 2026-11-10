import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Grade 10 Basic Lesson 8: Visual UX and Walkthrough Test Suite', () => {
  const scratchDir = 'C:/Users/vatutin_n_a/.gemini/antigravity-cli/brain/5ba8d451-fd8e-48aa-8b5b-759b5045777d/scratch';

  test.beforeAll(() => {
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }
  });

  test('01. Theory Verification and Visual Documentation', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    // Navigate to theory page / course lesson
    await page.goto('/lesson/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('h1').first()).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '01_lesson8_theory_overview.png') });

    // Scroll down to additional info
    const addInfo = page.locator('h2:has-text("Дополнительная информация")').first();
    if (await addInfo.isVisible().catch(() => false)) {
      await addInfo.scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(scratchDir, '02_lesson8_theory_additional_info.png') });
    }
  });

  test('02. Level 1 - Manipulations & Pipeline Construction Walkthrough', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level1');
    await page.waitForLoadState('domcontentloaded');

    // Phase 1 start
    await expect(page.locator('#phase1-container')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '03_level1_phase1_start.png') });

    // Solve Phase 1
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase1());
    await expect(page.locator('#phase2-container')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '04_level1_phase2_slots.png') });

    // Solve Phase 2
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase2());
    await expect(page.locator('#phase3-container')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '05_level1_phase3_pipeline.png') });

    // Solve Phase 3
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase3());
    await expect(page.locator('#victory-screen')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '06_level1_victory.png') });
  });

  test('03. Level 2 - Analytical Sawtooth 2-1-2 Walkthrough', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level2');
    await page.waitForLoadState('domcontentloaded');

    // Phase 1: Direct calculation
    await expect(page.locator('#phase1')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '07_level2_phase1_direct.png') });
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase1());

    // Phase 2: Multistep calculation
    await expect(page.locator('#phase2')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '08_level2_phase2_multistep.png') });
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase2());

    // Phase 3: Peak 1 Reverse problem
    await expect(page.locator('#phase3')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '09_level2_phase3_reverse.png') });
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase3());

    // Phase 4: Valley
    await expect(page.locator('#phase4')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '10_level2_phase4_valley.png') });
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase4());

    // Phase 5: Culmination Unicode & Speed
    await expect(page.locator('#phase5')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '11_level2_phase5_culmination.png') });
    await page.evaluate(() => window.__DEV_LEVEL2_STATE__.solvePhase5());

    // Victory Screen
    await expect(page.locator('#victory-screen')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '12_level2_victory.png') });
  });

  test('04. Level 3 - Bandwidth Gatekeeper Arcade Walkthrough', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level3');
    await page.waitForLoadState('domcontentloaded');

    // Intro Screen
    await expect(page.locator('#start-btn')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '13_level3_intro_briefing.png') });
    await page.locator('#start-btn').click();

    // Wave 1 Active
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');
    await page.screenshot({ path: path.join(scratchDir, '14_level3_wave1_active.png') });

    // Solve first 4 waves
    for (let w = 1; w <= 4; w++) {
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
      await page.waitForTimeout(200);
    }
    await page.screenshot({ path: path.join(scratchDir, '15_level3_wave5_midgame.png') });

    // Trigger Hardcore Reset Alarm
    await page.evaluate(() => {
      const pkt = window.__DEV_LEVEL3_STATE__.getCurrentPacket();
      window.__DEV_LEVEL3_STATE__.submitChoice(!pkt.isSufficient);
    });
    await expect(page.locator('.alert-danger')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '16_level3_alarm_reset.png') });

    // Wait for reset back to wave 1
    await page.waitForTimeout(1800);
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    // Now clear all waves up to wave 10
    for (let w = 1; w <= 9; w++) {
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
      await page.waitForTimeout(150);
    }

    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 10 из 10');
    await page.screenshot({ path: path.join(scratchDir, '17_level3_wave10_boss.png') });

    // Solve wave 10
    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());

    // Victory Screen
    await expect(page.locator('h3:has-text("АТТЕСТАЦИЯ АРКАДЫ ЗАВЕРШЕНА")')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '18_level3_victory_screen.png') });
  });
});
