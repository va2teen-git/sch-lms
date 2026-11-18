import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona, DifficultyBenchmarker } from './student-simulator.js';

const TASK_URL = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/35/level1';

function classifyP1CardText(text) {
  if (
    text.includes('пустом стеке') ||
    text.includes('полном буфере') ||
    text.includes('без базового случая')
  ) {
    return 2;
  }
  if (
    text.includes('insert(0') ||
    text.includes('pop(0)') ||
    text.includes('buf[0]') ||
    text.includes('самого старого')
  ) {
    return 1;
  }
  return 0;
}

async function solvePhase1BlackBox(page, sim) {
  const count = await page.locator('#p1-token-palette button[data-item-id]').count();
  for (let i = 0; i < count; i++) {
    const btn = page.locator('#p1-token-palette button[data-item-id]').first();
    const bucket = classifyP1CardText(await btn.innerText());
    await btn.click();
    await page.locator(`#p1-bucket-card-${bucket}`).click();
    if (sim) await sim.cognitivePause(30);
  }
  await page.locator('#p1-check-btn').click();
}

async function solvePhase2BlackBox(page, sim) {
  const openSet = new Set(['(', '[', '{', '<']);
  const closeToOpen = { ')': '(', ']': '[', '}': '{', '>': '<' };
  const tapeBtns = page.locator('#p2-tape button[data-tape-idx]');
  const total = await tapeBtns.count();

  const tokens = [];
  for (let i = 0; i < total; i++) {
    tokens.push((await tapeBtns.nth(i).locator('span').first().innerText()).trim());
  }

  const stack = [];
  for (let i = 0; i < tokens.length; i++) {
    const ch = tokens[i];
    if (openSet.has(ch)) {
      stack.push(ch);
      await page.locator('#p2-push-zone').click();
    } else if (closeToOpen[ch]) {
      if (stack.length > 0 && stack[stack.length - 1] === closeToOpen[ch]) {
        stack.pop();
        await page.locator('#p2-stack-well [data-stack-top="1"]').click();
      } else {
        await page.locator('#p2-error-btn').click();
        return;
      }
    } else {
      await page.locator('#p2-skip-btn').click();
    }
    if (sim) await sim.cognitivePause(25);
  }

  if (stack.length === 0) {
    await page.locator('#p2-finish-ok-btn').click();
  } else {
    await page.locator('#p2-error-btn').click();
  }
}

async function solvePhase3BlackBox(page, sim) {
  const slotTargets = [
    { idx: 0, match: 'Адрес возврата' },
    { idx: 1, match: 'Сохраненный RBP' },
    { idx: 2, match: 'Стековая канарейка' },
    { idx: 3, match: 'Локальный буфер' }
  ];
  for (const target of slotTargets) {
    await page.locator('#p3-palette button[data-p3-token-id]', { hasText: target.match }).first().click();
    await page.locator(`#p3-slots [data-slot-idx="${target.idx}"]`).click();
    if (sim) await sim.cognitivePause(30);
  }
  await page.locator('#p3-check-btn').click();
}

test.describe('11th Grade Lesson 35: Level 1 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — commits classification error on Phase 1, observes feedback, recovers and advances', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        const count = await page.locator('#p1-token-palette button[data-item-id]').count();
        for (let i = 0; i < count; i++) {
          await page.locator('#p1-token-palette button[data-item-id]').first().click();
          await page.locator('#p1-bucket-card-0').click();
        }
        await page.locator('#p1-check-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#feedback-box')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
      },
      solveCorrectlyFn: async () => {
        await page.waitForTimeout(1600);
        await expect(page.locator('#feedback-box')).toBeHidden();
        await solvePhase1BlackBox(page, sim);
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid clicking on empty buckets, reset/check buttons, resilience', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    // Click all 3 buckets without picking any token first
    for (let i = 0; i < 3; i++) {
      await page.locator(`#p1-bucket-card-${i}`).click();
      await expect(page.locator(`#p1-count-${i}`)).toHaveText('0');
    }

    // Spam click reset and check while queue still unplaced
    await sim.simulateSpamClick(page.locator('#p1-reset-btn'), 3);
    await sim.simulateSpamClick(page.locator('#p1-check-btn'), 3);
    await expect(page.locator('#feedback-box')).toBeVisible();

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — completes all 3 phases via visible DOM + Hitbox & CCS audit', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    const benchmarker = new DifficultyBenchmarker({
      courseSlug: '11-класс_углубленный',
      lessonId: 35,
      levelNumber: 1
    });

    await page.goto(TASK_URL);

    // Audit Phase 1 hitboxes >= 48px
    await benchmarker.auditHitboxes([
      page.locator('#p1-token-palette button[data-item-id]'),
      page.locator('#p1-check-btn'),
      page.locator('#p1-reset-btn')
    ], 48);
    benchmarker.recordPhase(1, { title: 'Классификация операций LIFO', depth: 2, memory: 2, search: 1, scaffolding: 1 });
    await solvePhase1BlackBox(page, sim);

    // Phase 2
    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
    await benchmarker.auditHitboxes([
      page.locator('#p2-push-zone'),
      page.locator('#p2-skip-btn'),
      page.locator('#p2-error-btn'),
      page.locator('#p2-finish-ok-btn')
    ], 48);
    benchmarker.recordPhase(2, { title: 'Пошаговый стек-валидатор ПСП', depth: 3, memory: 3 });
    await solvePhase2BlackBox(page, sim);

    // Phase 3
    await expect(page.locator('#phase3')).toBeVisible({ timeout: 5000 });
    await benchmarker.auditHitboxes([
      page.locator('#p3-palette button[data-p3-token-id]'),
      page.locator('#p3-check-btn'),
      page.locator('#p3-reset-btn')
    ], 48);
    benchmarker.recordPhase(3, { title: 'Сборка защищенного кадра стека x86-64', depth: 3, memory: 3, search: 2 });
    await solvePhase3BlackBox(page, sim);

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    benchmarker.assertGradeCorridor('11-класс_углубленный');
    benchmarker.assertNoFakeDifficulty();
    benchmarker.renderReport('LESSON 35 (Level 1) :: COGNITIVE & ERGONOMIC AUDIT');
    sim.assertCleanSession();
  });
});
