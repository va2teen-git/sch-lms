import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33/level2';

async function computePhaseAnswerDOM(page, phaseNum) {
  const condLoc = page.locator(`#p${phaseNum}-condition`);
  await expect(condLoc).toBeVisible();
  const condHtml = (await condLoc.innerHTML()).replace(/\s+/g, ' ');
  const condText = (await condLoc.innerText()).replace(/\s+/g, ' ');

  if (phaseNum === 1) {
    const match = condHtml.match(/([0-9A-F]+)<sub>(\d+)<\/sub>/i);
    expect(match, `Cannot parse Phase 1 HTML: ${condHtml}`).not.toBeNull();
    return parseInt(match[1], Number(match[2]));
  }

  if (phaseNum === 2) {
    const decMatch = condHtml.match(/([0-9]+(?:[.,][0-9]+)?)<sub>10<\/sub>/);
    const baseMatch = condText.match(/Целевое основание:\s*q\s*=\s*(\d+)/);
    expect(decMatch && baseMatch, `Cannot parse Phase 2 condition: ${condHtml}`).toBeTruthy();

    const decVal = Number(decMatch[1].replace(',', '.'));
    const q = Number(baseMatch[1]);
    const intPart = Math.floor(decVal);
    let fracPart = decVal - intPart;

    let fracStr = '';
    for (let step = 0; step < 8 && fracPart > 1e-9; step++) {
      fracPart *= q;
      const d = Math.floor(fracPart + 1e-12);
      fracStr += String(d);
      fracPart -= d;
    }
    const intStr = intPart.toString(q);
    return fracStr.length > 0 ? `${intStr}.${fracStr}` : intStr;
  }

  if (phaseNum === 3) {
    const match = condHtml.match(/([0-9A-F]+)<sub>x<\/sub>[\s\S]*?(\d+)<sub>10<\/sub>/i);
    expect(match, `Cannot parse Phase 3 HTML: ${condHtml}`).not.toBeNull();
    const srcStr = match[1];
    const decVal = Number(match[2]);
    const minBase = Math.max(...srcStr.split('').map((c) => parseInt(c, 36))) + 1;
    for (let x = minBase; x <= 36; x++) {
      if (parseInt(srcStr, x) === decVal) return x;
    }
    throw new Error(`No base x found for ${srcStr} = ${decVal}`);
  }

  if (phaseNum === 4) {
    const expMatch = condHtml.match(/(\d+)<sup>(\d+)<\/sup>\s*\+\s*(\d+)<sup>(\d+)<\/sup>\s*(?:−|-|&minus;)\s*(\d+)<sup>(\d+)<\/sup>/);
    expect(expMatch, `Cannot parse Phase 4 expression HTML: ${condHtml}`).not.toBeNull();
    return Number(expMatch[4]) - Number(expMatch[6]);
  }

  const match = condHtml.match(/([0-9A-F]+),([0-9A-F]+)<sub>16<\/sub>/i);
  expect(match, `Cannot parse Phase 5 HTML: ${condHtml}`).not.toBeNull();
  const intOct = parseInt(match[1], 16).toString(8);
  const octFrac = (parseInt(match[2], 16) * 8) / 16;
  return `${intOct}.${octFrac}`;
}

async function solvePhaseDOM(page, phaseNum, formatFn = (v) => String(v)) {
  const ans = await computePhaseAnswerDOM(page, phaseNum);
  await page.locator(`#p${phaseNum}-input`).fill(formatFn(ans));
  await page.locator(`#p${phaseNum}-submit-btn`).click();
  return ans;
}

test.describe('10th Grade Advanced Lesson 33: Level 2 Student Personas & Sawtooth Benchmark', () => {
  test('Persona: NOVICE — submits wrong positional calculation on Phase 1, observes feedback, recovers to victory', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        const expected = await computePhaseAnswerDOM(page, 1);
        await sim.humanType(page.locator('#p1-input'), String(expected + 15), { submitWithEnter: true });
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#feedback-box')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
        await page.waitForTimeout(1450);
        await expect(page.locator('#feedback-box')).toBeHidden();
      },
      solveCorrectlyFn: async () => {
        await solvePhaseDOM(page, 1);
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase2')).toBeVisible();
      }
    });

    for (let p = 2; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible();
      await solvePhaseDOM(page, p);
    }
    await expect(page.locator('#victory-screen')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: CARELESS — types Russian commas, spaces, and uses Enter key across all 5 phases', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible();
      const ans = await computePhaseAnswerDOM(page, p);
      await sim.humanType(page.locator(`#p${p}-input`), String(ans), {
        fuzzRussianComma: true,
        trailingSpaces: true,
        submitWithEnter: true
      });
    }

    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-attempts')).toHaveText('0');
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — verifies Anti-Paste across all 5 inputs and spam-click stability', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible();
      await sim.attemptProhibitedPaste(page.locator(`#p${p}-input`), '999999');
      expect(await page.locator(`#p${p}-input`).inputValue()).toBe('');

      if (p === 1) {
        await sim.simulateSpamClick(page.locator('#p1-submit-btn'), 5);
        await expect(page.locator('#feedback-box')).toBeVisible();
        await page.waitForTimeout(1450);
      }

      await solvePhaseDOM(page, p);
    }

    await expect(page.locator('#victory-screen')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & DifficultyBenchmarker — validates Sawtooth 2-1-2 profile, Grade 10 Advanced corridor & >=48px hitboxes', async ({ page }) => {
    const sim = new StudentSimulator(page, {
      persona: LearnerPersona.DILIGENT,
      courseSlug: '10-класс_углубленный',
      lessonId: '33',
      levelNumber: 2
    });
    const bench = sim.benchmarker;

    await page.goto(TASK_URL);

    const phaseConfigs = [
      { title: 'Прямой расчет трехзначного числа q -> 10', depth: 2, memory: 2, search: 0, inversion: 0, stress: 0, scaffolding: 0 },
      { title: 'Перевод смешанного десятичного числа с дробной частью 10 -> q', depth: 2, memory: 3, search: 0, inversion: 1, stress: 0, scaffolding: 0 },
      { title: 'Пик 1: Инверсия — поиск неизвестного основания x', depth: 3, memory: 3, search: 0, inversion: 2, stress: 0, scaffolding: 0 },
      { title: 'Долина консолидации: Степенной инвариант P^m + q^k - q^r', depth: 2, memory: 2, search: 0, inversion: 1, stress: 0, scaffolding: 0 },
      { title: 'Кульминация: Кросс-перевод смешанной дроби 16 -> 8', depth: 4, memory: 4, search: 0, inversion: 1, stress: 0, scaffolding: 0 }
    ];

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible();
      await bench.auditHitboxes([page.locator(`#p${p}-input`), page.locator(`#p${p}-submit-btn`)], 48);

      const t0 = Date.now();
      const ans = await solvePhaseDOM(page, p);
      const numericCheck = Number(String(ans).replace(',', '.'));
      bench.auditNumberInvariants([numericCheck]);
      bench.recordPhase(p, {
        ...phaseConfigs[p - 1],
        latencyMs: Date.now() - t0
      });
    }

    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-attempts')).toHaveText('0');

    bench.assertSawtoothProfile();
    bench.assertGradeCorridor('10-класс_углубленный');
    bench.assertNoFakeDifficulty();
    bench.renderReport('10-класс_углубленный Lesson 33 (Level 2) :: Sawtooth 2-1-2 Benchmark');

    sim.assertCleanSession();
  });
});
