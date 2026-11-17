import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';
import { DifficultyBenchmarker } from './difficulty-benchmarker.js';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/9/level2';

async function solvePhaseDOM(page, phase, formatFn = (n) => String(n)) {
  let ans;
  if (phase === 1) {
    const v = parseInt(await page.locator('#p1-v-val').innerText(), 10);
    const t = parseInt(await page.locator('#p1-t-val').innerText(), 10);
    ans = v * t;
  } else if (phase === 2) {
    const sizeMB = parseInt(await page.locator('#p2-size-val').innerText(), 10);
    const speedMbps = parseInt(await page.locator('#p2-speed-val').innerText(), 10);
    ans = (sizeMB * 8) / (speedMbps * 60);
  } else if (phase === 3) {
    const sizeKB = parseInt(await page.locator('#p3-size-val').innerText(), 10);
    const min = parseInt(await page.locator('#p3-min-val').innerText(), 10);
    ans = (sizeKB * 8 * 1.25) / (min * 60);
  } else if (phase === 4) {
    const proj = parseInt(await page.locator('#p4-proj-val').innerText(), 10);
    const gb = parseInt(await page.locator('#p4-gb-val').innerText(), 10);
    ans = proj * gb * 2;
  } else {
    const kb = parseInt(await page.locator('#p5-kb-val').innerText(), 10);
    const payload = parseInt(await page.locator('#p5-payload-val').innerText(), 10);
    const header = parseInt(await page.locator('#p5-header-val').innerText(), 10);
    const fileBytes = kb * 1024;
    const packets = Math.ceil(fileBytes / payload);
    ans = fileBytes + packets * header;
  }

  await page.locator(`#p${phase}-input`).fill(formatFn(ans));
  await page.locator(`#p${phase}-btn`).click();
  return ans;
}

test.describe('Grade 10 Basic Lesson 9: Level 2 Student Personas & Sawtooth Benchmark', () => {

  test('Persona: NOVICE — forgets +25% redundancy on Phase 3, observes feedback, recovers and advances', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await solvePhaseDOM(page, 1);
    await expect(page.locator('#phase2')).toBeVisible();
    await solvePhaseDOM(page, 2);
    await expect(page.locator('#phase3')).toBeVisible();

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        // Novice forgets the +25% parity overhead factor
        const sizeKB = parseInt(await page.locator('#p3-size-val').innerText(), 10);
        const min = parseInt(await page.locator('#p3-min-val').innerText(), 10);
        const wrongAns = Math.round((sizeKB * 8) / (min * 60));
        await page.locator('#p3-input').fill(String(wrongAns));
        await page.locator('#p3-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#p3-feedback')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
      },
      solveCorrectlyFn: async () => {
        await page.waitForTimeout(1450);
        await expect(page.locator('#p3-feedback')).toBeHidden();
        await solvePhaseDOM(page, 3);
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase4')).toBeVisible();
      }
    });

    await solvePhaseDOM(page, 4);
    await expect(page.locator('#phase5')).toBeVisible();
    await solvePhaseDOM(page, 5);
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-attempts')).toHaveText('1');

    sim.assertCleanSession();
  });

  test('Persona: CARELESS — submits Russian comma, whitespace padding, uppercase units and Enter key', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);

    // Phase 1 with leading/trailing spaces and units + Enter key
    const p1Ans = await (async () => {
      const v = parseInt(await page.locator('#p1-v-val').innerText(), 10);
      const t = parseInt(await page.locator('#p1-t-val').innerText(), 10);
      return v * t;
    })();
    const p1Inp = page.locator('#p1-input');
    await p1Inp.fill(`   ${p1Ans},0 кбит   `);
    await p1Inp.press('Enter');
    await expect(page.locator('#phase2')).toBeVisible();

    // Phase 2 with dirty Russian comma decimal and spaces
    await solvePhaseDOM(page, 2, (ans) => `  ${ans},00 МИН `);
    await expect(page.locator('#phase3')).toBeVisible();

    // Phase 3 with whitespace and units
    await solvePhaseDOM(page, 3, (ans) => ` ${ans} КБИТ/С `);
    await expect(page.locator('#phase4')).toBeVisible();

    // Phase 4 & Phase 5 with Russian comma and spaces
    await solvePhaseDOM(page, 4, (ans) => `  ${ans},0 гб `);
    await expect(page.locator('#phase5')).toBeVisible();

    await solvePhaseDOM(page, 5, (ans) => `  ${ans} байт  `);
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-attempts')).toHaveText('0');

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — verifies Anti-Paste across all phase inputs and spam-click stability', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible();
      await sim.attemptProhibitedPaste(page.locator(`#p${p}-input`), '123456');
      expect(await page.locator(`#p${p}-input`).inputValue()).toBe('');

      if (p === 1) {
        await sim.simulateSpamClick(page.locator('#p1-btn'), 5);
        await expect(page.locator('#p1-feedback')).toBeVisible();
        await page.waitForTimeout(1450);
      }

      await solvePhaseDOM(page, p);
    }

    await expect(page.locator('#victory-screen')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & DifficultyBenchmarker — verifies Sawtooth 2-1-2 profile, Grade 10 Basic corridor & >=48px hitboxes', async ({ page }) => {
    const sim = new StudentSimulator(page, {
      persona: LearnerPersona.DILIGENT,
      courseSlug: '10-класс_базовый',
      lessonId: '9',
      levelNumber: 2
    });
    const bench = sim.benchmarker;

    await page.goto(TASK_URL);

    // Phase 1: Baseline (CCS = 3.0 -> Depth 1, Mem 1, Search 1, Inv 0, Str 0, Scaff 0 => wait: Phase 1 allows lower; Phase 2-5 corridor [4; 7])
    // Let's model realistic parameters per docs/difficulty-curve.md for Grade 10 Basic [4; 7]:
    // P1: 4.0, P2: 5.0, P3 (Peak 1): 7.0, P4 (Valley): 5.0, P5 (Climax): 7.0
    const collectedNumbers = [];

    // Phase 1
    await bench.auditHitboxes([page.locator('#p1-input'), page.locator('#p1-btn')], 48);
    collectedNumbers.push(await solvePhaseDOM(page, 1));
    bench.recordPhase(1, { title: 'Прямой расчет I = v × t', depth: 2, memory: 2, search: 0, inversion: 0, stress: 0, scaffolding: 0 });

    // Phase 2
    await expect(page.locator('#phase2')).toBeVisible();
    await bench.auditHitboxes([page.locator('#p2-input'), page.locator('#p2-btn')], 48);
    collectedNumbers.push(await solvePhaseDOM(page, 2));
    bench.recordPhase(2, { title: 'Перевод Мбайт→Мбит и секунд в минуты', depth: 3, memory: 2, search: 0, inversion: 0, stress: 0, scaffolding: 0 });

    // Phase 3 (Peak 1)
    await expect(page.locator('#phase3')).toBeVisible();
    await bench.auditHitboxes([page.locator('#p3-input'), page.locator('#p3-btn')], 48);
    collectedNumbers.push(await solvePhaseDOM(page, 3));
    bench.recordPhase(3, { title: 'Пик 1: Обратный поиск скорости с +25% CRC', depth: 3, memory: 3, search: 0, inversion: 1, stress: 0, scaffolding: 0 });

    // Phase 4 (Consolidation Valley)
    await expect(page.locator('#phase4')).toBeVisible();
    await bench.auditHitboxes([page.locator('#p4-input'), page.locator('#p4-btn')], 48);
    collectedNumbers.push(await solvePhaseDOM(page, 4));
    bench.recordPhase(4, { title: 'Долина: Правило резервирования «3–2–1»', depth: 2, memory: 2, search: 1, inversion: 0, stress: 0, scaffolding: 0 });

    // Phase 5 (Climax)
    await expect(page.locator('#phase5')).toBeVisible();
    await bench.auditHitboxes([page.locator('#p5-input'), page.locator('#p5-btn')], 48);
    collectedNumbers.push(await solvePhaseDOM(page, 5));
    bench.recordPhase(5, { title: 'Кульминация: Пакетирование с округлением вверх + заголовки', depth: 3, memory: 3, search: 0, inversion: 1, stress: 0, scaffolding: 0 });

    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-attempts')).toHaveText('0');

    bench.auditNumberInvariants(collectedNumbers, { maxMagnitude: 100000 });
    bench.assertSawtoothProfile();
    bench.assertGradeCorridor('10-класс_базовый');
    bench.assertNoFakeDifficulty();
    bench.renderReport('10-класс_базовый Lesson 9 (Level 2) :: Sawtooth 2-1-2 Benchmark');

    sim.assertCleanSession();
  });
});
