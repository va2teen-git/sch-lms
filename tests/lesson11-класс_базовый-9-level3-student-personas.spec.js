import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('11th Grade Basic Lesson 9: Level 3 (Student Personas & Visual Analysis)', () => {
  const scratchDir = 'C:/Users/vatutin_n_a/.gemini/antigravity-cli/brain/91337d6b-39e2-43c5-a092-1b93b72c6781/scratch';

  test('Persona: NOVICE — commits error without calibration, observes alarm siren, recovers and proceeds', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level3'));
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-counter-badge')).toContainText('ВОЛНА 1 / 10');

    // Novice immediately tries to commit without setting format or k
    await page.screenshot({ path: path.join(scratchDir, '17_level3_novice_before_error.png') });
    await page.locator('#commit-btn').click();

    // Alarm triggers
    await expect(page.locator('#alarm-box')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '18_level3_novice_alarm_siren.png') });

    // Wait for reset timeout
    await page.waitForTimeout(1800);
    await expect(page.locator('#alarm-box')).toBeHidden();

    // Now solves Wave 1 properly
    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    await page.waitForTimeout(400);

    // Advances to wave 2
    await expect(page.locator('#wave-counter-badge')).toContainText('ВОЛНА 2 / 10');
  });

  test('Persona: CHAOS — rapid clicking across all buttons and keyboard triggers', async ({ page }) => {
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level3'));
    await page.waitForLoadState('domcontentloaded');

    await page.locator('#start-btn').click();

    // Rapid spam clicks on all formats, commit, and reject
    for (let i = 0; i < 4; i++) {
      await page.locator('#format-timeseries-btn').click({ force: true });
      await page.locator('#format-gis-btn').click({ force: true });
      await page.locator('#format-graph-btn').click({ force: true });
      await page.locator('#format-bi-btn').click({ force: true });
      await page.locator('#commit-btn').click({ force: true });
      await page.locator('#reject-sanity-btn').click({ force: true });
      await page.waitForTimeout(20);
    }

    // App survives and remains responsive
    await expect(page.locator('#vue-app')).toBeVisible();
  });

  test('Persona: DILIGENT — step-by-step visual audit across 10 waves with key screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level3'));
    await page.waitForLoadState('domcontentloaded');

    // Screenshot 1: Intro Briefing
    await expect(page.locator('#start-btn')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '19_level3_diligent_intro.png'), fullPage: false });

    await page.locator('#start-btn').click();

    // Wave 1: Screenshot Calibration Monitor
    await expect(page.locator('#wave-counter-badge')).toContainText('ВОЛНА 1 / 10');
    await page.screenshot({ path: path.join(scratchDir, '20_level3_diligent_wave1_monitor.png'), fullPage: false });
    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    await page.waitForTimeout(350);

    // Waves 2 and 3
    for (let w = 2; w <= 3; w++) {
      await expect(page.locator('#wave-counter-badge')).toContainText(`ВОЛНА ${w} / 10`);
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
      await page.waitForTimeout(350);
    }

    // Wave 4: Screenshot Sanity Anomaly (P > 100%)
    await expect(page.locator('#wave-counter-badge')).toContainText('ВОЛНА 4 / 10');
    await page.screenshot({ path: path.join(scratchDir, '21_level3_diligent_wave4_sanity_anomaly.png'), fullPage: false });
    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    await page.waitForTimeout(350);

    // Waves 5 and 6
    for (let w = 5; w <= 6; w++) {
      await expect(page.locator('#wave-counter-badge')).toContainText(`ВОЛНА ${w} / 10`);
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
      await page.waitForTimeout(350);
    }

    // Wave 7: Screenshot Sanity Anomaly (N < 0)
    await expect(page.locator('#wave-counter-badge')).toContainText('ВОЛНА 7 / 10');
    await page.screenshot({ path: path.join(scratchDir, '22_level3_diligent_wave7_sanity_anomaly.png'), fullPage: false });
    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    await page.waitForTimeout(350);

    // Waves 8 and 9
    for (let w = 8; w <= 9; w++) {
      await expect(page.locator('#wave-counter-badge')).toContainText(`ВОЛНА ${w} / 10`);
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
      await page.waitForTimeout(350);
    }

    // Wave 10: Screenshot Final Super-Boss
    await expect(page.locator('#wave-counter-badge')).toContainText('ВОЛНА 10 / 10');
    await page.screenshot({ path: path.join(scratchDir, '23_level3_diligent_wave10_final_boss.png'), fullPage: false });
    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    await page.waitForTimeout(350);

    // Screenshot Victory Screen
    await expect(page.locator('h2:has-text("АРКАДНЫЙ БОСС УРОВНЯ 3 ПОВЕРЖЕН!")')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '24_level3_diligent_victory.png'), fullPage: false });
  });
});
