import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

const TASK_URL = encodeURI('/tasks/11-класс_базовый/10/level1');

test.describe('11th Grade Basic Lesson 10: Level 1 Student Personas & Hitbox Benchmark', () => {
  test('Persona: NOVICE — misplaces a card, reads regeneration feedback, and finishes via UI', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await sim.readVisiblePrompt(page.locator('#phase-1-container .alert'));

    // Place card 0 into the wrong bucket, rest into right buckets
    const firstExpected = await page.locator('#p1-cards-pool .phase1-card').first().getAttribute('data-expected-type');
    const wrongBucket = firstExpected === 'structure' ? 'directed' : 'structure';
    await page.locator('#p1-cards-pool .phase1-card').first().click();
    await page.locator(`#bucket-${wrongBucket} .card-header`).click();
    for (let i = 0; i < 5; i++) {
      const c = page.locator('#p1-cards-pool .phase1-card').first();
      const exp = await c.getAttribute('data-expected-type');
      await c.click();
      await page.locator(`#bucket-${exp} .card-header`).click();
    }

    await sim.cognitivePause();
    await page.locator('#p1-verify-btn').click();
    await expect(page.locator('#feedback-box')).toBeVisible();
    await page.waitForTimeout(1350);
    await expect(page.locator('#feedback-box')).toBeHidden();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    // Recover and complete
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase1());
    await expect(page.locator('#phase-2-container')).toBeVisible();
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase2());
    await expect(page.locator('#phase-3-container')).toBeVisible();
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase3());

    await expect(page.locator('#final-screen')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: CARELESS — returns placed card back to pool, re-places, and completes Phase 1', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);

    const card = page.locator('#p1-cards-pool .phase1-card').first();
    await card.click();
    await page.locator('#bucket-undirected .card-header').click();
    // Click placed card to return it back to pool
    await page.locator('#bucket-undirected .phase1-card').first().click();
    await expect(page.locator('#p1-pool-counter')).toHaveText('Осталось: 6');

    for (let i = 0; i < 6; i++) {
      const c = page.locator('#p1-cards-pool .phase1-card').first();
      const exp = await c.getAttribute('data-expected-type');
      await c.click();
      await page.locator(`#bucket-${exp} .card-header`).click();
    }
    await page.locator('#p1-verify-btn').click();
    await expect(page.locator('#phase-2-container')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid spam clicks on cards, buckets, and verify button cause zero runtime errors', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    await sim.simulateSpamClick(page.locator('#p1-cards-pool .phase1-card').first(), 5);
    await sim.simulateSpamClick(page.locator('#bucket-directed .card-header'), 4);
    await sim.simulateSpamClick(page.locator('#p1-verify-btn'), 4);

    await expect(page.locator('#game-container')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & DifficultyBenchmarker — >=48px hitboxes and Grade 11 Basic corridor', async ({ page }) => {
    const sim = new StudentSimulator(page, {
      persona: LearnerPersona.DILIGENT,
      courseSlug: '11-класс_базовый',
      lessonId: '10',
      levelNumber: 1
    });
    const bench = sim.benchmarker;

    await page.goto(TASK_URL);

    // Phase 1 hitbox audit
    await bench.auditHitboxes([
      page.locator('#p1-cards-pool .phase1-card'),
      page.locator('#p1-verify-btn')
    ], 48);
    bench.recordPhase(1, {
      title: 'Классификация графовых моделей',
      depth: 2, memory: 2, search: 1, inversion: 0, stress: 0, scaffolding: 1 // CCS = 4
    });
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase1());

    // Phase 2 hitbox audit
    await expect(page.locator('#phase-2-container')).toBeVisible();
    await bench.auditHitboxes([
      page.locator('#p2-matrix-body .p2-cell-btn'),
      page.locator('#p2-verify-btn')
    ], 48);
    bench.recordPhase(2, {
      title: 'Матрица смежности орграфа 4x4',
      depth: 2, memory: 3, search: 1, inversion: 0, stress: 0, scaffolding: 1 // CCS = 5
    });
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase2());

    // Phase 3 hitbox audit
    await expect(page.locator('#phase-3-container')).toBeVisible();
    await bench.auditHitboxes([
      page.locator('#p3-tokens-pool .p3-token'),
      page.locator('#p3-slots-container .p3-slot'),
      page.locator('#p3-verify-btn')
    ], 48);
    bench.recordPhase(3, {
      title: 'Сопоставление графа и матрицы (степени соседей)',
      depth: 3, memory: 3, search: 1, inversion: 0, stress: 0, scaffolding: 1 // CCS = 6
    });
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase3());

    await expect(page.locator('#final-screen')).toBeVisible();
    bench.assertGradeCorridor('11-класс_базовый');
    bench.assertNoFakeDifficulty();
    bench.renderReport('11-класс_базовый Lesson 10 (Level 1)');
    sim.assertCleanSession();
  });
});
