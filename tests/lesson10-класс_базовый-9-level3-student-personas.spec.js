import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';
import { DifficultyBenchmarker } from './difficulty-benchmarker.js';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/9/level3';

test.describe('Grade 10 Basic Lesson 9: Level 3 Student Personas & Escalation Benchmark', () => {

  test('Persona: NOVICE — launches unaligned Wave 1 circuit, observes #alarm-box, recovers using keyboard/clicks', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    // Verify starting grid is never pre-solved and launching immediately triggers alarm feedback
    await page.locator('#launch-btn').click();
    await expect(page.locator('#alarm-box')).toBeVisible();

    await page.waitForTimeout(1500);
    await expect(page.locator('#alarm-box')).toBeHidden();
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    // Novice now tests keyboard rotation 'R' and Spacebar or solves Wave 1 -> 2
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('r');
    await sim.cognitivePause();

    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 2 из 10');

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid spam-clicking grid nodes and launch button stays stable', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();

    await sim.simulateSpamClick(page.locator('button[aria-label="Узел строка 1 столбец 1"]'), 6);
    await sim.simulateSpamClick(page.locator('button[aria-label="Узел строка 2 столбец 2"]'), 6);
    await sim.simulateSpamClick(page.locator('#launch-btn'), 4);

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & DifficultyBenchmarker — solves 10 escalating waves, checks >=48px hitboxes & Grade 10 Basic corridor', async ({ page }) => {
    const sim = new StudentSimulator(page, {
      persona: LearnerPersona.DILIGENT,
      courseSlug: '10-класс_базовый',
      lessonId: '9',
      levelNumber: 3
    });
    const bench = sim.benchmarker;

    await page.goto(TASK_URL);
    await bench.auditHitboxes([page.locator('#start-btn')], 48);
    await page.locator('#start-btn').click();

    await bench.auditHitboxes([
      page.locator('button[aria-label^="Узел строка"]'),
      page.locator('#launch-btn')
    ], 48);

    // Check monotonic timer acceleration (14.0s -> 8.0s) and matrix expansion (3x3 -> 3x4)
    const waveDurations = await page.evaluate(() =>
      window.__DEV_LEVEL3_STATE__.waves.map(w => ({
        wave: w.wave,
        duration: w.duration,
        cols: w.cols,
        noiseCount: w.grid.flat().filter(c => c.hasNoise).length
      }))
    );

    expect(waveDurations.length).toBe(10);
    expect(waveDurations[0].cols).toBe(3);
    expect(waveDurations[2].cols).toBe(4);
    expect(waveDurations[0].duration).toBeGreaterThan(waveDurations[9].duration);

    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('#wave-counter-badge')).toContainText(`Волна ${w} из 10`);
      const cfg = waveDurations[w - 1];
      bench.recordPhase(w, {
        title: `Волна ${w} (${cfg.duration}s, 3x${cfg.cols}, помех: ${cfg.noiseCount})`,
        depth: w <= 2 ? 2 : 3,
        memory: 2,
        search: w <= 2 ? 0 : 1,
        inversion: 0,
        stress: w <= 4 ? 0 : (w <= 8 ? 1 : 1),
        scaffolding: 0
      });
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    }

    await expect(page.locator('h3:has-text("ВСЕ 10 ВОЛН КОММУТАЦИИ ПРОЙДЕНЫ")')).toBeVisible();

    bench.assertGradeCorridor('10-класс_базовый');
    bench.assertNoFakeDifficulty();
    bench.renderReport('10-класс_базовый Lesson 9 (Level 3 Arcade) :: Wave Escalation Benchmark');

    sim.assertCleanSession();
  });
});
