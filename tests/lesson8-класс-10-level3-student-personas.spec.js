import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';
import path from 'path';

test.describe('Grade 8 Lesson 10: Level 3 (Student Personas Simulation)', () => {
  const screenshotsDir = 'C:/Users/vatutin_n_a/.gemini/antigravity-cli/brain/192c6b2a-19fe-4756-ae96-9334608df7ea/scratch/screenshots';

  test('Persona: NOVICE — mistake on wave 1, alarm feedback, screenshot capture, and full wave recovery', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level3');

    // Screenshot initial briefing
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level3-briefing.png') });

    const startBtn = page.locator('#start-btn');
    await startBtn.click();
    await expect(page.locator('#wave-indicator')).toContainText('ВОЛНА 1');

    // Novice mistake: fires pulse without configuring nodes
    await page.locator('#btn-boost').click();

    // Alarm banner
    const alarmBox = page.locator('#alarm-box');
    await expect(alarmBox).toBeVisible();
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level3-alarm-siren.png') });

    // Wait for reset
    await expect(alarmBox).toBeHidden({ timeout: 4000 });
    await expect(page.locator('#wave-indicator')).toContainText('ВОЛНА 1');

    // Screenshot Wave 1 in action
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level3-wave1-active.png') });

    // Solve Wave 1
    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL3_STATE__.solveCurrentWave();
    });

    // Wave 5 screenshot
    for (let w = 1; w < 4; w++) {
      await page.waitForTimeout(100);
      await page.evaluate(() => {
        // @ts-ignore
        window.__DEV_LEVEL3_STATE__.solveCurrentWave();
      });
    }
    await expect(page.locator('#wave-indicator')).toContainText('ВОЛНА 5');
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level3-wave5-demorgan.png') });

    // Complete remaining waves up to wave 10
    for (let w = 4; w < 10; w++) {
      await page.waitForTimeout(100);
      await page.evaluate(() => {
        // @ts-ignore
        window.__DEV_LEVEL3_STATE__.solveCurrentWave();
      });
    }

    // Victory screen
    await expect(page.locator('#success-screen')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotsDir, '8-10-level3-victory.png') });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid clicking on node toggles and spacebar spamming', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level3');

    const startBtn = page.locator('#start-btn');
    await startBtn.click();

    // Rapid toggle clicks
    const toggleR1 = page.locator('#gate-node-r1');
    await sim.simulateSpamClick(toggleR1, 8);

    // Spam spacebar
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — precision run across all 10 arcade waves', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level3');

    const startBtn = page.locator('#start-btn');
    await startBtn.click();

    for (let w = 0; w < 10; w++) {
      await page.waitForTimeout(50);
      await page.evaluate(() => {
        // @ts-ignore
        window.__DEV_LEVEL3_STATE__.solveCurrentWave();
      });
    }

    await expect(page.locator('#success-screen')).toBeVisible({ timeout: 5000 });
    sim.assertCleanSession();
  });
});
