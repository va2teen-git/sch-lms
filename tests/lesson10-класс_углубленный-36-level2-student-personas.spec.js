import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona, DifficultyBenchmarker } from './student-simulator.js';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/36/level2';

async function solvePhaseAnswerFromDOM(page, phase) {
  return page.evaluate((p) => {
    if (p === 1) {
      const cond = document.querySelector('#p1-condition');
      const binStr = cond.querySelector('strong.text-warning span').firstChild.textContent.trim();
      const targetBase = cond.querySelector('strong.text-light').textContent.includes('16') ? 16 : 8;
      return parseInt(binStr, 2).toString(targetBase).toUpperCase();
    }
    if (p === 2) {
      const cond = document.querySelector('#p2-condition');
      const binMixed = cond.querySelector('strong.text-warning span').firstChild.textContent.trim();
      const targetBase = cond.querySelector('strong.text-light').textContent.includes('16') ? 16 : 8;
      const [intBin, fracBin] = binMixed.split(',');
      const w = targetBase === 16 ? 4 : 3;
      const intRes = parseInt(intBin, 2).toString(targetBase).toUpperCase();
      const paddedFrac = fracBin.padEnd(Math.ceil(fracBin.length / w) * w, '0');
      let fracRes = '';
      for (let i = 0; i < paddedFrac.length; i += w) {
        fracRes += parseInt(paddedFrac.slice(i, i + w), 2).toString(targetBase).toUpperCase();
      }
      fracRes = fracRes.replace(/0+$/, '');
      return fracRes ? `${intRes},${fracRes}` : intRes;
    }
    if (p === 3) {
      const cond = document.querySelector('#p3-condition');
      const html = cond.innerHTML;
      const srcBase = parseInt(cond.querySelector('strong sub').textContent.trim(), 10);
      const rText = cond.querySelector('.fs-5 strong span').firstChild.textContent.trim();
      const rVal = parseInt(rText, srcBase);
      const shiftBits = html.includes('&lt;&lt; 3') || html.includes('<< 3') ? 3 : 4;
      return (rVal >> shiftBits).toString(16).toUpperCase();
    }
    if (p === 4) {
      const cond = document.querySelector('#p4-condition');
      const strong = cond.querySelector('.fs-5 strong');
      const subs = strong.querySelectorAll('sub');
      if (subs.length === 2) {
        const m = strong.innerHTML.replace(/<\/?span>/gi, '').match(/([0-9A-F]+)<sub>16<\/sub>\s*&lt;\s*x\s*&lt;\s*([0-7]+)<sub>8<\/sub>/i);
        return String(parseInt(m[2], 8) - parseInt(m[1], 16) - 1);
      }
      const hexOctets = strong.textContent.trim().split('.');
      let ones = 0;
      for (const oct of hexOctets) {
        for (const ch of parseInt(oct, 16).toString(2)) {
          if (ch === '1') ones++;
        }
      }
      return String(ones);
    }
    if (p === 5) {
      const cond = document.querySelector('#p5-condition');
      const base = BigInt(cond.querySelector('strong.text-light').textContent.trim());
      const sups = cond.querySelectorAll('.fs-4 strong sup');
      const a = BigInt(sups[0].textContent.trim());
      const p2 = BigInt(sups[1].textContent.trim());
      const p3 = BigInt(sups[2].textContent.trim());
      const b = base === 16n ? p2 / 2n : p2 / 3n;
      const c = base === 16n ? (p3 * 3n) / 4n : (p3 * 2n) / 3n;
      const digitText = cond.querySelector('.text-secondary strong:last-of-type').textContent.trim();
      return digitText === '0' ? String((a - b) + c) : String(b - c);
    }
    throw new Error('Unknown phase ' + p);
  }, phase);
}

test.describe('10th Grade Advanced Lesson 36 (Level 2) :: Student Personas & Sawtooth Curve', () => {
  test('Persona: NOVICE — enters wrong answer on Phase 1, sees regeneration feedback, recovers and finishes all 5 phases', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await sim.cognitivePause(100);
    await page.locator('#p1-input').fill('0');
    await page.locator('#p1-submit-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');
    await page.waitForTimeout(1450);
    await expect(page.locator('#feedback-box')).toBeHidden();

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible({ timeout: 5000 });
      const ans = await solvePhaseAnswerFromDOM(page, p);
      await page.locator(`#p${p}-input`).fill(ans);
      await page.locator(`#p${p}-submit-btn`).click();
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('1');
    sim.assertCleanSession();
  });

  test('Persona: CARELESS — submits lowercase, whitespace, Russian comma, trailing zeros, and % sign via Enter', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible({ timeout: 5000 });
      const ans = await solvePhaseAnswerFromDOM(page, p);
      let messy = `  ${ans.toLowerCase()}  `;
      if (p === 2) messy = `  ${ans.toLowerCase()}0  `;
      if (p === 4 || p === 5) messy = ` ${ans}% `;
      await page.locator(`#p${p}-input`).fill(messy);
      await page.locator(`#p${p}-input`).press('Enter');
    }

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
      lessonId: 36,
      levelNumber: 2
    });

    await page.goto(TASK_URL);

    const phaseSpecs = [
      { title: 'Прямой перевод целого кода 2 -> 8/16', depth: 2, memory: 2, inversion: 0 },
      { title: 'Смешанный перевод с дробной частью 2 -> 8/16', depth: 3, memory: 3, inversion: 0 },
      { title: 'Обратная реконструкция сдвига (Пик инверсии)', depth: 3, memory: 3, inversion: 2 },
      { title: 'Оценка интервала / маски CIDR (Долина консолидации)', depth: 2, memory: 3, inversion: 0 },
      { title: 'Степенное выражение формата ЕГЭ (Кульминация)', depth: 4, memory: 3, inversion: 2 }
    ];

    const observedNumbers = [];
    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible({ timeout: 5000 });
      await benchmarker.auditHitboxes([page.locator(`#p${p}-submit-btn`)], 48);

      const ans = await solvePhaseAnswerFromDOM(page, p);
      observedNumbers.push((p === 4 || p === 5) ? Number(ans) : parseInt(ans.replace(',', ''), 16) || 0);
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
    const report = benchmarker.renderReport('LESSON 36 (Level 2) :: SAWTOOTH 2-1-2 & CCS AUDIT');
    expect(report).toContain('Sawtooth 2-1-2 Profile: PASSED');

    sim.assertCleanSession();
  });
});
