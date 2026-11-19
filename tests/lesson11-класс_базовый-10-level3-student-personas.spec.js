import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

const TASK_URL = encodeURI('/tasks/11-класс_базовый/10/level3');

test.describe('11th Grade Basic Lesson 10: Level 3 Student Personas & Escalation Benchmark', () => {
  test('Persona: NOVICE — triggers reset on Wave 1, observes #alarm-box, recovers via __DEV_LEVEL3_STATE__ to Wave 2', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 / 10');

    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.submitAction('fail'));
    await expect(page.locator('#alarm-box')).toBeVisible();

    await page.waitForTimeout(1650);
    await expect(page.locator('#alarm-box')).toBeHidden();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 / 10');

    await sim.cognitivePause();
    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 / 10', { timeout: 3000 });
    sim.assertCleanSession();
  });

  test('Persona: CARELESS — navigates with number hotkeys, backtracks with Backspace, then finishes Wave 1', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 / 10');

    const w1Path = await page.evaluate(() => window.__DEV_LEVEL3_STATE__.currentWaveData.solutionPath);
    await page.keyboard.press(String(w1Path[1] + 1));
    await page.keyboard.press('Backspace');

    for (let i = 1; i < w1Path.length; i++) {
      await page.keyboard.press(String(w1Path[i] + 1));
    }

    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 / 10', { timeout: 3000 });
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid spam clicking SVG nodes and controls triggers zero runtime errors', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();

    await sim.simulateSpamClick(page.locator('#graph-svg g[data-node-id="1"]'), 5);
    await sim.simulateSpamClick(page.locator('#step-back-btn'), 4);

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & DifficultyBenchmarker — completes 10 escalating waves, checks >=48px hitboxes & Grade 11 Basic corridor', async ({ page }) => {
    const sim = new StudentSimulator(page, {
      persona: LearnerPersona.DILIGENT,
      courseSlug: '11-класс_базовый',
      lessonId: '10',
      levelNumber: 3
    });
    const bench = sim.benchmarker;

    await page.goto(TASK_URL);
    await bench.auditHitboxes([page.locator('#start-btn')], 48);
    await page.locator('#start-btn').click();

    await bench.auditHitboxes([
      page.locator('#graph-svg g[data-node-id]'),
      page.locator('#step-back-btn'),
      page.locator('#fast-forward-btn')
    ], 48);

    const waveConfigs = await page.evaluate(() =>
      window.__DEV_LEVEL3_STATE__.waves.map((w) => ({
        waveNum: w.waveNum,
        timeLimit: w.timeLimit,
        mode: w.mode
      }))
    );

    expect(waveConfigs.length).toBe(10);
    expect(waveConfigs[0].timeLimit).toBeGreaterThanOrEqual(30);
    expect(waveConfigs.every((w) => w.timeLimit >= 15)).toBe(true);
    // Wave 7 tactical breather has higher time limit than Wave 6
    expect(waveConfigs[6].timeLimit).toBeGreaterThan(waveConfigs[5].timeLimit);

    const profiles = [
      { depth: 2, memory: 1, search: 0, inversion: 0, stress: 1, scaffolding: 0 }, // W1: 4
      { depth: 2, memory: 2, search: 0, inversion: 0, stress: 1, scaffolding: 0 }, // W2: 5
      { depth: 2, memory: 2, search: 1, inversion: 0, stress: 1, scaffolding: 0 }, // W3 (DAG): 6
      { depth: 2, memory: 2, search: 1, inversion: 0, stress: 1, scaffolding: 0 }, // W4 (Matrix): 6
      { depth: 2, memory: 3, search: 0, inversion: 0, stress: 1, scaffolding: 0 }, // W5 (Honeypot): 6
      { depth: 3, memory: 2, search: 0, inversion: 1, stress: 1, scaffolding: 0 }, // W6 (DAG Banned): 7
      { depth: 2, memory: 2, search: 1, inversion: 0, stress: 0, scaffolding: 0 }, // W7 Breather (Matrix+Relay): 5
      { depth: 3, memory: 2, search: 1, inversion: 0, stress: 1, scaffolding: 0 }, // W8 (Digraph): 7
      { depth: 3, memory: 2, search: 0, inversion: 1, stress: 1, scaffolding: 0 }, // W9 (DAG Banned+Relay): 7
      { depth: 3, memory: 2, search: 0, inversion: 1, stress: 1, scaffolding: 0 }  // W10 Final Boss: 7
    ];

    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w} / 10`, { timeout: 3000 });
      const cfg = waveConfigs[w - 1];
      bench.recordPhase(w, {
        title: `Волна ${w} (${cfg.timeLimit}s, ${cfg.mode})`,
        ...profiles[w - 1]
      });
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });

    bench.assertGradeCorridor('11-класс_базовый');
    bench.assertNoFakeDifficulty();
    bench.renderReport('11-класс_базовый Lesson 10 (Level 3 Arcade) :: Wave Escalation Benchmark');
    sim.assertCleanSession();
  });
});
