import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona, DifficultyBenchmarker } from './student-simulator.js';

const TASK_URL = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/35/level2';

async function solvePhaseAnswerFromDOM(page, phase) {
  if (phase === 1) {
    const badges = page.locator('#p1-ops-list .badge');
    const count = await badges.count();
    const stack = [];
    for (let i = 0; i < count; i++) {
      const txt = (await badges.nth(i).innerText()).trim();
      const pushMatch = txt.match(/push\((-?\d+)\)/);
      if (pushMatch) stack.push(parseInt(pushMatch[1], 10));
      else if (txt.includes('pop()')) stack.pop();
    }
    return stack.reduce((acc, x) => acc + x, 0);
  }
  if (phase === 2) {
    const limitKb = parseInt(await page.locator('#p2-limit-kb').innerText(), 10);
    const localBytes = parseInt(await page.locator('#p2-local-bytes').innerText(), 10);
    const depth = parseInt(await page.locator('#p2-depth').innerText(), 10);
    return (depth * (16 + localBytes) / (limitKb * 1024)) * 100;
  }
  if (phase === 3) {
    const allocKb = parseInt(await page.locator('#p3-alloc-kb').innerText(), 10);
    const elemBytes = parseInt(await page.locator('#p3-elem-bytes').innerText(), 10);
    const fillPct = parseFloat((await page.locator('#p3-fill-pct').innerText()).replace('%', '').replace(',', '.').trim());
    const capSlots = (allocKb * 1024) / elemBytes;
    return capSlots - Math.round(capSlots * (fillPct / 100));
  }
  if (phase === 4) {
    const cells = page.locator('#p4-tape > div');
    const len = await cells.count();
    const openSet = new Set(['(', '[', '{', '<']);
    const closeToOpen = { ')': '(', ']': '[', '}': '{', '>': '<' };
    const stack = [];
    for (let i = 0; i < len; i++) {
      const ch = (await cells.nth(i).locator('div').first().innerText()).trim();
      if (openSet.has(ch)) stack.push({ ch, idx: i });
      else if (closeToOpen[ch]) {
        if (stack.length === 0 || stack[stack.length - 1].ch !== closeToOpen[ch]) return i;
        stack.pop();
      }
    }
    return stack.length > 0 ? stack[stack.length - 1].idx : -1;
  }
  const bufSize = parseInt(await page.locator('#p5-buf-size').innerText(), 10);
  const depth = parseInt(await page.locator('#p5-depth').innerText(), 10);
  const alignedFrame = Math.ceil((24 + bufSize + 4) / 16) * 16;
  return Math.ceil((alignedFrame * depth) / 4096);
}

test.describe('11th Grade Lesson 35: Level 2 (Student Personas & Difficulty Benchmark)', () => {

  test('Persona: NOVICE — enters wrong calculation on Phase 1, sees regeneration feedback, recovers cleanly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        await page.locator('#p1-input').fill('999999');
        await page.locator('#p1-submit-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#feedback-box')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
      },
      solveCorrectlyFn: async () => {
        await page.waitForTimeout(1600);
        await expect(page.locator('#feedback-box')).toBeHidden();
        const ans = await solvePhaseAnswerFromDOM(page, 1);
        await page.locator('#p1-input').fill(String(ans));
        await page.locator('#p1-submit-btn').click();
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CARELESS — submits with surrounding spaces, Russian comma decimal, "%" sign, and Enter key', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);

    // Phase 1: leading/trailing spaces + Enter
    await expect(page.locator('#phase1')).toBeVisible();
    const p1Ans = await solvePhaseAnswerFromDOM(page, 1);
    await page.locator('#p1-input').fill(`   ${p1Ans}   `);
    await page.locator('#p1-input').press('Enter');

    // Phase 2: Russian comma + "%" + spaces + Enter
    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
    const p2Ans = await solvePhaseAnswerFromDOM(page, 2);
    const p2Comma = String(p2Ans).includes('.') ? String(p2Ans).replace('.', ',') : `${p2Ans},0`;
    await page.locator('#p2-input').fill(`  ${p2Comma}%  `);
    await page.locator('#p2-input').press('Enter');

    await expect(page.locator('#phase3')).toBeVisible({ timeout: 5000 });
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — verifies anti-paste protection and rapid submit clicks', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    await sim.attemptProhibitedPaste(page.locator('#p1-input'), '12345');
    expect(await page.locator('#p1-input').inputValue()).toBe('');

    await sim.simulateSpamClick(page.locator('#p1-submit-btn'), 3);
    await expect(page.locator('#feedback-box')).toBeVisible();

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & Cognitive Difficulty — solves all 5 Sawtooth 2-1-2 phases and validates CCS curve', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    const benchmarker = new DifficultyBenchmarker({
      courseSlug: '11-класс_углубленный',
      lessonId: 35,
      levelNumber: 2
    });

    await page.goto(TASK_URL);

    const phaseSpecs = [
      { title: 'Прямая трассировка стека команд (Пик 0)', depth: 2, memory: 2, inversion: 0 },
      { title: 'Доля лимита стека потока при рекурсии', depth: 3, memory: 3, inversion: 0 },
      { title: 'Инверсия емкости динамического стека (Пик 1)', depth: 3, memory: 3, inversion: 2 },
      { title: 'Индекс сбоя ПСП (Долина консолидации)', depth: 2, memory: 3, inversion: 0 },
      { title: 'System V AMD64 ABI + страницы ОС (Кульминация)', depth: 4, memory: 3, inversion: 2 }
    ];

    const observedNumbers = [];
    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible({ timeout: 5000 });
      await benchmarker.auditHitboxes([page.locator(`#p${p}-submit-btn`)], 48);

      const ans = await solvePhaseAnswerFromDOM(page, p);
      observedNumbers.push(ans);
      benchmarker.recordPhase(p, phaseSpecs[p - 1]);

      await page.locator(`#p${p}-input`).fill(String(ans));
      await sim.cognitivePause(35);
      await page.locator(`#p${p}-submit-btn`).click();
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    benchmarker.auditNumberInvariants(observedNumbers, { maxMagnitude: 100000, allowPowerOfTwo: true });
    benchmarker.assertSawtoothProfile();
    benchmarker.assertGradeCorridor('11-класс_углубленный');
    benchmarker.assertNoFakeDifficulty();
    const report = benchmarker.renderReport('LESSON 35 (Level 2) :: SAWTOOTH 2-1-2 & CCS AUDIT');
    expect(report).toContain('Sawtooth 2-1-2 Profile: PASSED');

    sim.assertCleanSession();
  });
});
