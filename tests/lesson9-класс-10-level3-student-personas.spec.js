import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

const TASK_URL = '/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level3';

test.describe('9th Grade Lesson 10: Level 3 Student Personas & Escalation Benchmark', () => {
  test('Persona: NOVICE — triggers reset on Wave 1, observes #alarm-box, recovers via __DEV_LEVEL3_STATE__ to Wave 2', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.submitAction('fail'));
    await expect(page.locator('#alarm-box')).toBeVisible();

    await page.waitForTimeout(1650);
    await expect(page.locator('#alarm-box')).toBeHidden();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    await sim.cognitivePause();
    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 10', { timeout: 3000 });
    sim.assertCleanSession();
  });

  test('Persona: CARELESS — clicks adjacent node, backtracks with Backspace, then solves Wave 1 via keyboard hotkeys', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    const w1Path = await page.evaluate(() => window.__DEV_LEVEL3_STATE__.currentWave.solutionPath);
    await page.keyboard.press(String(w1Path[1] + 1));
    await page.keyboard.press('Backspace');

    for (let i = 1; i < w1Path.length; i++) {
      await page.keyboard.press(String(w1Path[i] + 1));
    }

    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 10', { timeout: 3000 });
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid spam clicking SVG nodes and control buttons triggers zero runtime errors', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();

    const firstNode = page.locator('#graph-svg g[data-node-id="1"]');
    await sim.simulateSpamClick(firstNode, 5);
    await sim.simulateSpamClick(page.locator('#commit-pulse-btn'), 4);

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & DifficultyBenchmarker — completes 10 escalating waves, checks >=48px hitboxes & Grade 9 OGE corridor', async ({ page }) => {
    const sim = new StudentSimulator(page, {
      persona: LearnerPersona.DILIGENT,
      courseSlug: '9-класс',
      lessonId: '10',
      levelNumber: 3
    });
    const bench = sim.benchmarker;

    await page.goto(TASK_URL);
    await bench.auditHitboxes([page.locator('#start-btn')], 48);
    await page.locator('#start-btn').click();

    await bench.auditHitboxes([
      page.locator('#graph-svg g[data-node-id]'),
      page.locator('#commit-pulse-btn')
    ], 48);

    const waveConfigs = await page.evaluate(() =>
      window.__DEV_LEVEL3_STATE__.waves.map((w) => ({
        wave: w.wave,
        timeLimit: w.timeLimit,
        mode: w.mode
      }))
    );

    expect(waveConfigs.length).toBe(10);
    expect(waveConfigs[0].timeLimit).toBeGreaterThanOrEqual(30);
    expect(waveConfigs.every((w) => w.timeLimit >= 15)).toBe(true);
    expect(waveConfigs[7].timeLimit).toBeGreaterThan(waveConfigs[6].timeLimit);

    const profiles = [
      { depth: 2, memory: 1, search: 0, inversion: 0, stress: 1, scaffolding: 0 }, // W1: 4
      { depth: 2, memory: 2, search: 0, inversion: 0, stress: 1, scaffolding: 0 }, // W2: 5
      { depth: 2, memory: 2, search: 1, inversion: 0, stress: 1, scaffolding: 0 }, // W3: 6
      { depth: 2, memory: 3, search: 0, inversion: 0, stress: 1, scaffolding: 0 }, // W4: 6
      { depth: 2, memory: 3, search: 0, inversion: 0, stress: 1, scaffolding: 0 }, // W5: 6
      { depth: 3, memory: 2, search: 1, inversion: 0, stress: 1, scaffolding: 0 }, // W6: 7
      { depth: 3, memory: 2, search: 0, inversion: 1, stress: 1, scaffolding: 0 }, // W7: 7
      { depth: 2, memory: 2, search: 0, inversion: 1, stress: 0, scaffolding: 0 }, // W8 Breather: 5
      { depth: 3, memory: 2, search: 0, inversion: 1, stress: 1, scaffolding: 0 }, // W9: 7
      { depth: 3, memory: 2, search: 0, inversion: 1, stress: 1, scaffolding: 0 }  // W10 Boss: 7
    ];

    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w} ИЗ 10`, { timeout: 3000 });
      const cfg = waveConfigs[w - 1];
      bench.recordPhase(w, {
        title: `Волна ${w} (${cfg.timeLimit}s, ${cfg.mode})`,
        ...profiles[w - 1]
      });
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });

    bench.assertGradeCorridor('9-класс');
    bench.assertNoFakeDifficulty();
    bench.renderReport('9-класс Lesson 10 (Level 3 Arcade) :: Wave Escalation Benchmark');
    sim.assertCleanSession();
  });
});
