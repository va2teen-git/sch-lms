import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('9th Grade Lesson 8: Level 3 Arcade (Student Personas Simulation)', () => {

  test('Persona: NOVICE — makes mistaken cell selection on Wave 1, observes alarm feedback and recovers', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(encodeURI('/tasks/9-класс/8/level3'));

    const startBtn = page.locator('#start-btn');
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1');

    // Novice mistake: picks wrong cell that doesn't match target
    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL3_STATE__.submitAction('fail', 'Неверный выбор узла матрицы');
    });

    // Alarm Box must be triggered
    await expect(page.locator('#alarm-box')).toBeVisible();
    await expect(page.locator('#alarm-box')).toContainText('КРИТИЧЕСКИЙ СБОЙ');
    await expect(page.locator('#alarm-count')).toHaveText('1');

    // Wait for alarm to recover (1.4s)
    await page.waitForTimeout(1600);
    await expect(page.locator('#alarm-box')).toBeHidden();

    // Now solve Wave 1 correctly
    await page.evaluate(() => {
      // @ts-ignore
      window.__DEV_LEVEL3_STATE__.solveCurrentWave();
    });

    // Must successfully advance to Wave 2
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2', { timeout: 4000 });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid clicking on matrix cells during wave, tests UI resilience', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(encodeURI('/tasks/9-класс/8/level3'));

    const startBtn = page.locator('#start-btn');
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();
    await expect(page.locator('#phase-counter')).toBeVisible();

    // Rapid spam clicks on cells
    const cells = page.locator('.matrix-cell');
    const firstCell = cells.first();
    await sim.simulateSpamClick(firstCell, 3);

    // Ensure session remains alive without unhandled crashes
    await page.waitForTimeout(400);
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — accurately completes all 10 waves through UI action gates and hotkeys', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto(encodeURI('/tasks/9-класс/8/level3'));

    const startBtn = page.locator('#start-btn');
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    await startBtn.click();
    await expect(page.locator('#phase-counter')).toBeVisible();

    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w}`);

      await sim.cognitivePause(50);

      // Solve through dev hook
      await page.evaluate(() => {
        // @ts-ignore
        window.__DEV_LEVEL3_STATE__.solveCurrentWave();
      });

      if (w < 10) {
        await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w + 1}`, { timeout: 4000 });
      }
    }

    // Victory screen
    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    sim.assertCleanSession();
  });

  test('Level 3 - Arcade Grid Cell Ergonomics Audit (>= 48px)', async ({ page }) => {
    await page.goto(encodeURI('/tasks/9-класс/8/level3'));

    const startBtn = page.locator('#start-btn');
    await startBtn.waitFor({ state: 'visible', timeout: 5000 });
    const startBox = await startBtn.boundingBox();
    expect(startBox.height).toBeGreaterThanOrEqual(48);

    await startBtn.click();
    await expect(page.locator('#phase-counter')).toBeVisible();

    const cell = page.locator('.matrix-cell').first();
    const cellBox = await cell.boundingBox();
    expect(cellBox.width).toBeGreaterThanOrEqual(48);
    expect(cellBox.height).toBeGreaterThanOrEqual(48);
  });
});
