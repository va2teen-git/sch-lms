import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level2';

async function computePhaseAnswerDOM(page, phaseNum) {
  await expect(page.locator(`#p${phaseNum}-condition li`).first()).toBeVisible();
  const condText = (await page.locator(`#p${phaseNum}-condition`).innerText()).replace(/\s+/g, ' ');

  if (phaseNum === 1) {
    const N = Number(condText.match(/N\s*=\s*(\d+)/)[1]);
    const pages = Number(condText.match(/Количество страниц:\s*(\d+)/)[1]);
    const lines = Number(condText.match(/Строк на каждой странице:\s*(\d+)/)[1]);
    const chars = Number(condText.match(/Символов в каждой строке:\s*(\d+)/)[1]);
    return (pages * lines * chars * Math.ceil(Math.log2(N))) / 8;
  }

  if (phaseNum === 2) {
    const mb = Number(condText.match(/Размер архива:\s*(\d+)\s*Мбайт/)[1]);
    const kbps = Number(condText.match(/Скорость передачи:\s*(\d+)\s*Кбит\/с/)[1]);
    return Number((((mb * 1024 * 8) / kbps) / 60).toFixed(6));
  }

  if (phaseNum === 3) {
    const dimMatch = condText.match(/(\d+)\s*стр\.\s*×\s*(\d+)\s*строк\s*×\s*(\d+)\s*символов/);
    const totalBytes = Number(condText.match(/не превышает\s*(\d+)\s*байт/)[1]);
    const K = Number(dimMatch[1]) * Number(dimMatch[2]) * Number(dimMatch[3]);
    return 1 << Math.floor((totalBytes * 8) / K);
  }

  if (phaseNum === 4) {
    const N = Number(condText.match(/N\s*=\s*(\d+)/)[1]);
    const B = Number(condText.match(/Размер кодируемого блока[^:]*:\s*(\d+)/)[1]);
    return Math.ceil(Math.log2(Math.pow(N, B)));
  }

  const M = Number(condText.match(/пользователей:\s*(\d+)/)[1]);
  const K = Number(condText.match(/идентификатора:\s*(\d+)/)[1]);
  const letters = Number(condText.match(/(\d+)\s*заглавных латинских букв/)[1]);
  const digits = Number(condText.match(/(\d+)\s*цифр/)[1]);
  const specMatch = condText.match(/(\d+)\s*специальных символов/);
  const extraBytes = Number(condText.match(/Дополнительные сведения[^0-9]*(\d+)\s*байт/)[1]);
  const i = Math.ceil(Math.log2(letters + digits + (specMatch ? Number(specMatch[1]) : 0)));
  const recBytes = Math.ceil((K * i) / 8) + extraBytes;
  return Number(((M * recBytes) / 1024).toFixed(6));
}

async function solvePhaseDOM(page, phaseNum, formatFn = (v) => String(v)) {
  const ans = await computePhaseAnswerDOM(page, phaseNum);
  await page.locator(`#p${phaseNum}-input`).fill(formatFn(ans));
  await page.locator(`#p${phaseNum}-submit-btn`).click();
  return ans;
}

test.describe('10th Grade Advanced Lesson 31: Level 2 Student Personas & Sawtooth Benchmark', () => {
  test('Persona: NOVICE — forgets ceil/byte rounding on Phase 1, observes feedback, recovers to victory', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        const expected = await computePhaseAnswerDOM(page, 1);
        await sim.humanType(page.locator('#p1-input'), String(expected * 8), { submitWithEnter: true });
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

  test('Persona: CARELESS — types Russian commas, spaces, trailing % and uses Enter key across all 5 phases', async ({ page }) => {
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
      lessonId: '31',
      levelNumber: 2
    });
    const bench = sim.benchmarker;

    await page.goto(TASK_URL);

    const phaseConfigs = [
      { title: 'Прямой расчет объема текстового документа', depth: 2, memory: 2, search: 0, inversion: 0, stress: 0, scaffolding: 0 },
      { title: 'Конвертация Мбайт и Кбит/с в минуты', depth: 2, memory: 3, search: 0, inversion: 1, stress: 0, scaffolding: 0 },
      { title: 'Пик 1: Обратная задача Хартли (N_max = 2^floor(I/K))', depth: 3, memory: 3, search: 0, inversion: 2, stress: 0, scaffolding: 0 },
      { title: 'Долина консолидации: Блочное кодирование N^B <= 2^m', depth: 2, memory: 2, search: 0, inversion: 1, stress: 0, scaffolding: 0 },
      { title: 'Кульминация: БД с составным алфавитом, выравниванием и Кбайт', depth: 4, memory: 4, search: 0, inversion: 1, stress: 0, scaffolding: 0 }
    ];

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible();
      await bench.auditHitboxes([page.locator(`#p${p}-input`), page.locator(`#p${p}-submit-btn`)], 48);

      const t0 = Date.now();
      const ans = await solvePhaseDOM(page, p);
      bench.auditNumberInvariants([ans]);
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
    bench.renderReport('10-класс_углубленный Lesson 31 (Level 2) :: Sawtooth 2-1-2 Benchmark');

    sim.assertCleanSession();
  });
});
