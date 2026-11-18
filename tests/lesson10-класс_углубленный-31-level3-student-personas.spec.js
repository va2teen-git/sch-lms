import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level3';

test.describe('10th Grade Advanced Lesson 31: Level 3 Student Personas & Escalation Benchmark', () => {
  test('Persona: NOVICE — commits wrong bit-bus frame on Wave 1, observes #alarm-box, recovers using hotkeys', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    // Submit wrong value (255 cannot be Wave 1 Hartley bit-width 4..7)
    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.submitAction('wrong'));
    await expect(page.locator('#alarm-box')).toBeVisible();

    await page.waitForTimeout(1900);
    await expect(page.locator('#alarm-box')).toBeHidden();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    // Test keyboard bit toggle ('8' toggles LSB=1) and reset ('0'), then solve Wave 1 via hotkeys/hook
    await page.keyboard.press('8');
    await page.keyboard.press('0');
    await sim.cognitivePause();

    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 10', { timeout: 3000 });
    sim.assertCleanSession();
  });

  test('Persona: CARELESS — toggles bit switches with accidental double toggles and clears before committing cleanly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();

    await page.keyboard.press('1');
    await page.keyboard.press('2');
    await page.locator('#clear-bus-btn').click();
    await expect(page.locator('#commit-frame-btn')).toBeDisabled();

    // Now set exact target via bit keys 1..8 and commit via Space
    const target = await page.evaluate(() => window.__DEV_LEVEL3_STATE__.currentWave.targetValue);
    const weights = [128, 64, 32, 16, 8, 4, 2, 1];
    for (let idx = 0; idx < weights.length; idx++) {
      if (target & weights[idx]) {
        await page.keyboard.press(String(idx + 1));
      }
    }
    await page.keyboard.press('Space');
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 10', { timeout: 3000 });
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid spam clicking bit switches and reset/commit buttons triggers zero runtime errors', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();

    const firstBit = page.locator('#arcade-app button[aria-pressed]').first();
    await sim.simulateSpamClick(firstBit, 6);
    await sim.simulateSpamClick(page.locator('#clear-bus-btn'), 4);
    await sim.simulateSpamClick(page.locator('#commit-frame-btn'), 4);

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & DifficultyBenchmarker — completes 10 escalating waves, checks >=48px hitboxes & Grade 10 Advanced corridor', async ({ page }) => {
    const sim = new StudentSimulator(page, {
      persona: LearnerPersona.DILIGENT,
      courseSlug: '10-класс_углубленный',
      lessonId: '31',
      levelNumber: 3
    });
    const bench = sim.benchmarker;

    await page.goto(TASK_URL);
    await bench.auditHitboxes([page.locator('#start-btn')], 48);
    await page.locator('#start-btn').click();

    await bench.auditHitboxes([
      page.locator('#arcade-app button[aria-pressed]'),
      page.locator('#clear-bus-btn'),
      page.locator('#commit-frame-btn')
    ], 48);

    const waveConfigs = await page.evaluate(() =>
      window.__DEV_LEVEL3_STATE__.waves.map((w) => ({
        wave: w.waveNumber,
        maxTime: w.maxTime,
        isBreather: Boolean(w.isBreather),
        targetValue: w.targetValue
      }))
    );

    expect(waveConfigs.length).toBe(10);
    expect(waveConfigs[0].maxTime).toBeGreaterThan(waveConfigs[9].maxTime);
    expect(waveConfigs[7].isBreather).toBe(true);
    expect(waveConfigs[7].maxTime).toBeGreaterThan(waveConfigs[6].maxTime);

    const profiles = [
      { depth: 1, memory: 2, search: 0, inversion: 1, stress: 1, scaffolding: 0 }, // W1: 5
      { depth: 2, memory: 2, search: 0, inversion: 0, stress: 1, scaffolding: 0 }, // W2: 5
      { depth: 2, memory: 3, search: 0, inversion: 0, stress: 1, scaffolding: 0 }, // W3: 6
      { depth: 3, memory: 3, search: 0, inversion: 1, stress: 1, scaffolding: 0 }, // W4: 8
      { depth: 3, memory: 3, search: 0, inversion: 1, stress: 1, scaffolding: 0 }, // W5: 8
      { depth: 3, memory: 3, search: 0, inversion: 1, stress: 2, scaffolding: 0 }, // W6: 9
      { depth: 3, memory: 3, search: 0, inversion: 1, stress: 2, scaffolding: 0 }, // W7: 9
      { depth: 2, memory: 2, search: 0, inversion: 1, stress: 1, scaffolding: 0 }, // W8 Breather: 6
      { depth: 4, memory: 3, search: 0, inversion: 1, stress: 1, scaffolding: 0 }, // W9: 9
      { depth: 4, memory: 4, search: 0, inversion: 1, stress: 1, scaffolding: 0 }  // W10 Boss: 10
    ];

    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w} ИЗ 10`, { timeout: 3000 });
      const cfg = waveConfigs[w - 1];
      bench.auditNumberInvariants([cfg.targetValue]);
      bench.recordPhase(w, {
        title: `Волна ${w} (${cfg.maxTime}s${cfg.isBreather ? ', Передышка' : ''})`,
        ...profiles[w - 1]
      });
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    }

    await expect(page.locator('h2', { hasText: 'СИНХРОНИЗАЦИЯ ШИНЫ ЗАВЕРШЕНА!' })).toBeVisible({ timeout: 5000 });

    bench.assertGradeCorridor('10-класс_углубленный');
    bench.assertNoFakeDifficulty();
    bench.renderReport('10-класс_углубленный Lesson 31 (Level 3 Arcade) :: Wave Escalation Benchmark');
    sim.assertCleanSession();
  });
});
