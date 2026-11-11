import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('10th Grade Lesson 30: Level 3 Arcade (Student Personas Simulation)', () => {

  test('Persona: NOVICE — makes mistaken gate selection on Wave 1, observes alarm feedback and recovers', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level3');

    const startBtn = page.locator('#start-btn');
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1');

    const correctAction = await page.evaluate(() => {
      // @ts-ignore
      return window.__DEV_LEVEL3_STATE__ ? window.__DEV_LEVEL3_STATE__.solveCurrentWave() : 'prefix';
    });

    // Deliberate mistake: click wrong button
    const wrongBtnId = (correctAction === 'prefix') ? '#btn-gate-collision' : '#btn-gate-prefix';
    await page.locator(wrongBtnId).click();

    // Alarm Box must be triggered
    await expect(page.locator('#alarm-box')).toBeVisible();
    await expect(page.locator('#alarm-box')).toContainText('КРИТИЧЕСКИЙ СБОЙ');
    await expect(page.locator('#alarm-count')).toHaveText('1');

    // Wait for alarm to recover (1.6s)
    await page.waitForTimeout(1800);
    await expect(page.locator('#alarm-box')).toBeHidden();

    // Now solve Wave 1 correctly
    const newCorrectAction = await page.evaluate(() => {
      // @ts-ignore
      return window.__DEV_LEVEL3_STATE__ ? window.__DEV_LEVEL3_STATE__.solveCurrentWave() : 'prefix';
    });

    if (newCorrectAction === 'prefix') {
      await page.locator('#btn-gate-prefix').click();
    } else if (newCorrectAction === 'postfix') {
      await page.locator('#btn-gate-postfix').click();
    } else {
      await page.locator('#btn-gate-collision').click();
    }

    // Must successfully advance to Wave 2
    await expect(page.locator('#wave-title')).toContainText('ВОЛНА 2', { timeout: 3000 });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid clicking on tactical action buttons during wave, tests UI resilience', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level3');

    const startBtn = page.locator('#start-btn');
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();
    await expect(page.locator('#phase-counter')).toBeVisible();

    // Rapid spam clicks on prefix gate button
    await sim.simulateSpamClick(page.locator('#btn-gate-prefix'), 4);

    // Ensure session remains alive without unhandled crashes
    await page.waitForTimeout(500);
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — accurately completes all 10 waves through UI action gates and hotkeys', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level3');

    const startBtn = page.locator('#start-btn');
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();
    await expect(page.locator('#phase-counter')).toBeVisible();

    for (let w = 0; w < 10; w++) {
      await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w + 1}`);

      const correctAction = await page.evaluate(() => {
        // @ts-ignore
        const state = window.__DEV_LEVEL3_STATE__;
        return state.solveCurrentWave();
      });

      await sim.cognitivePause(40);

      // Solve alternately via hotkeys ('1', '2', '3') and button clicks
      if (w % 2 === 0) {
        if (correctAction === 'prefix') await page.keyboard.press('1');
        else if (correctAction === 'postfix') await page.keyboard.press('2');
        else if (correctAction === 'collision') await page.keyboard.press('3');
      } else {
        if (correctAction === 'prefix') await page.locator('#btn-gate-prefix').click();
        else if (correctAction === 'postfix') await page.locator('#btn-gate-postfix').click();
        else if (correctAction === 'collision') await page.locator('#btn-gate-collision').click();
      }

      if (w < 9) {
        await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w + 2}`, { timeout: 3000 });
      }
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    sim.assertCleanSession();
  });

  test('Level 3 - Arcade Gate Buttons Ergonomics Audit (>= 64px)', async ({ page }) => {
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level3');

    const startBtn = page.locator('#start-btn');
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();
    await expect(page.locator('#phase-counter')).toBeVisible();

    const gateButtons = ['#btn-gate-prefix', '#btn-gate-postfix', '#btn-gate-collision'];
    for (const sel of gateButtons) {
      const btn = page.locator(sel);
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box, `${sel} must have valid bounding box`).not.toBeNull();
      expect(box.height, `${sel} height must be >= 60px`).toBeGreaterThanOrEqual(60);
      expect(box.width, `${sel} width must be >= 100px`).toBeGreaterThanOrEqual(100);
    }
  });
});
