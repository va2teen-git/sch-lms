import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona, DifficultyBenchmarker } from './student-simulator.js';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/34/level2';

async function solvePhaseAnswerFromDOM(page, phase) {
  return page.evaluate((p) => {
    if (p === 1) {
      const cond = document.querySelector('#p1-condition');
      const binStr = cond.querySelector('strong.text-warning').firstChild.textContent.trim();
      const targetBase = cond.querySelector('strong.text-info').textContent.includes('16') ? 16 : 8;
      return parseInt(binStr, 2).toString(targetBase).toUpperCase();
    }
    if (p === 2) {
      const cond = document.querySelector('#p2-condition');
      const subs = cond.querySelectorAll('sub');
      const srcBase = parseInt(subs[0].textContent.trim(), 10);
      const targetBase = parseInt(subs[1].textContent.trim(), 10);
      const srcStr = cond.querySelector('strong.text-warning').firstChild.textContent.trim();
      return parseInt(srcStr, srcBase).toString(targetBase).toUpperCase();
    }
    if (p === 3) {
      const html = document.querySelector('#p3-condition strong.text-warning').innerHTML;
      const m = html.match(/([0-7]+)<sub>8<\/sub>\s*\+\s*X<sub>16<\/sub>\s*=\s*([01]+)<sub>2<\/sub>/);
      return (parseInt(m[2], 2) - parseInt(m[1], 8)).toString(16).toUpperCase();
    }
    if (p === 4) {
      const cond = document.querySelector('#p4-condition');
      const sups = cond.querySelectorAll('strong.text-warning sup');
      const a = BigInt(sups[0].textContent.trim());
      const b = BigInt(sups[1].textContent.trim());
      const c = BigInt(sups[2].textContent.trim());
      const targetDigit = cond.querySelector('strong.text-info').textContent.includes('0') ? '0' : '1';
      const bin = ((1n << (4n * a)) + (1n << (3n * b)) - (1n << c)).toString(2);
      let cnt = 0;
      for (const ch of bin) if (ch === targetDigit) cnt++;
      return String(cnt);
    }
    if (p === 5) {
      const cond = document.querySelector('#p5-condition');
      const subs = cond.querySelectorAll('sub');
      const srcBase = parseInt(subs[0].textContent.trim(), 10);
      const targetBase = parseInt(subs[1].textContent.trim(), 10);
      const [intPart, fracPart] = cond.querySelector('strong.text-warning').firstChild.textContent.trim().split(',');
      const srcW = srcBase === 16 ? 4 : 3;
      const dstW = targetBase === 16 ? 4 : 3;

      const intBin = parseInt(intPart, srcBase).toString(2);
      let fracBin = '';
      for (const ch of fracPart) fracBin += parseInt(ch, srcBase).toString(2).padStart(srcW, '0');
      fracBin = fracBin.replace(/0+$/, '');

      const paddedInt = intBin.padStart(Math.ceil(intBin.length / dstW) * dstW, '0');
      let intRes = '';
      for (let i = 0; i < paddedInt.length; i += dstW) {
        intRes += parseInt(paddedInt.slice(i, i + dstW), 2).toString(targetBase).toUpperCase();
      }
      intRes = intRes.replace(/^0+([0-9A-F])/, '$1') || '0';

      if (!fracBin) return intRes;
      const paddedFrac = fracBin.padEnd(Math.ceil(fracBin.length / dstW) * dstW, '0');
      let fracRes = '';
      for (let i = 0; i < paddedFrac.length; i += dstW) {
        fracRes += parseInt(paddedFrac.slice(i, i + dstW), 2).toString(targetBase).toUpperCase();
      }
      fracRes = fracRes.replace(/0+$/, '');
      return fracRes ? `${intRes},${fracRes}` : intRes;
    }
    return '';
  }, phase);
}

test.describe('Digital Student Personas :: Lesson 34 Level 2', () => {
  test('Persona: NOVICE — enters wrong calculation on Phase 1, sees regeneration feedback, recovers cleanly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

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
        await page.waitForTimeout(1450);
        await expect(page.locator('#feedback-box')).toBeHidden();
        const ans = await solvePhaseAnswerFromDOM(page, 1);
        await page.locator('#p1-input').fill(ans);
        await page.locator('#p1-submit-btn').click();
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CARELESS — submits with surrounding spaces, lowercase, Russian comma, "%" and Enter key', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);

    const p1Ans = await solvePhaseAnswerFromDOM(page, 1);
    await sim.cognitivePause();
    await page.locator('#p1-input').fill(`  ${p1Ans.toLowerCase()}%  `);
    await page.locator('#p1-input').press('Enter');

    for (let p = 2; p <= 4; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible({ timeout: 5000 });
      const ans = await solvePhaseAnswerFromDOM(page, p);
      await page.locator(`#p${p}-input`).fill(` ${ans.toLowerCase()} `);
      await page.locator(`#p${p}-input`).press('Enter');
    }

    await expect(page.locator('#phase5')).toBeVisible({ timeout: 5000 });
    const p5Ans = await solvePhaseAnswerFromDOM(page, 5);
    await page.locator('#p5-input').fill(`  ${p5Ans.toLowerCase()}0  `);
    await page.locator('#p5-input').press('Enter');

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — verifies anti-paste protection and rapid submit clicks', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    await sim.attemptProhibitedPaste(page.locator('#p1-input'), 'ABCD');
    expect(await page.locator('#p1-input').inputValue()).toBe('');

    await sim.simulateSpamClick(page.locator('#p1-submit-btn'), 4);
    await expect(page.locator('#feedback-box')).toBeVisible();

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & Cognitive Difficulty — solves all 5 Sawtooth 2-1-2 phases and validates CCS curve', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    const benchmarker = new DifficultyBenchmarker({
      courseSlug: '10-класс_углубленный',
      lessonId: 34,
      levelNumber: 2
    });

    await page.goto(TASK_URL);

    const phaseSpecs = [
      { title: 'Прямой перевод 2 -> 8/16', depth: 2, memory: 2, inversion: 0 },
      { title: '12-битный двоичный мост 8 <-> 16', depth: 3, memory: 3, inversion: 0 },
      { title: 'Обратное уравнение A8 + X16 = B2 (Пик инверсии)', depth: 3, memory: 3, inversion: 2 },
      { title: 'Степенной инвариант 16^a + 8^b - 2^c (Долина консолидации)', depth: 2, memory: 3, inversion: 0 },
      { title: 'Смешанный дробный мост 8 <-> 16 (Кульминация)', depth: 4, memory: 3, inversion: 2 }
    ];

    const observedNumbers = [];
    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible({ timeout: 5000 });
      await benchmarker.auditHitboxes([page.locator(`#p${p}-submit-btn`)], 48);

      const ans = await solvePhaseAnswerFromDOM(page, p);
      observedNumbers.push(p === 4 ? Number(ans) : parseInt(ans.replace(',', ''), 16) || 0);
      benchmarker.recordPhase(p, phaseSpecs[p - 1]);

      await page.locator(`#p${p}-input`).fill(ans);
      await sim.cognitivePause(35);
      await page.locator(`#p${p}-submit-btn`).click();
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    benchmarker.auditNumberInvariants(observedNumbers, { maxMagnitude: 100000, allowPowerOfTwo: true });
    benchmarker.assertSawtoothProfile();
    benchmarker.assertGradeCorridor('10-класс_углубленный');
    benchmarker.assertNoFakeDifficulty();
    const report = benchmarker.renderReport('LESSON 34 (Level 2) :: SAWTOOTH 2-1-2 & CCS AUDIT');
    expect(report).toContain('Sawtooth 2-1-2 Profile: PASSED');

    sim.assertCleanSession();
  });
});
