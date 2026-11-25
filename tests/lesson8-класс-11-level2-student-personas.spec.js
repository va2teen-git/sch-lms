import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona, DifficultyBenchmarker } from './student-simulator.js';

const TASK_URL = '/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/11/level2';

async function solvePhaseAnswerFromDOM(page, phase) {
  return await page.evaluate((p) => {
    const gateEval = (type, a, b) => {
      if (type === 'NOT') return a ^ 1;
      if (type === 'AND') return a & b;
      if (type === 'OR') return a | b;
      if (type === 'NAND') return (a & b) ^ 1;
      if (type === 'NOR') return (a | b) ^ 1;
      return 0;
    };

    const findRect = (svg, x, y) => Array.from(svg.querySelectorAll('rect'))
      .find((r) => Math.abs(Number(r.getAttribute('x')) - x) < 2 && Math.abs(Number(r.getAttribute('y')) - y) < 2);

    const readOp = (svg, rectX, rectY, width) => {
      const rect = findRect(svg, rectX, rectY);
      if (!rect) return null;
      const cx = rectX + width / 2;
      const cy = rectY + Number(rect.getAttribute('height')) / 2;
      const texts = Array.from(svg.querySelectorAll('text'));
      const lbl = texts.find((t) => Math.abs(Number(t.getAttribute('x')) - cx) < 3 && Number(t.getAttribute('y')) >= rectY && Number(t.getAttribute('y')) <= rectY + Number(rect.getAttribute('height')));
      const sym = lbl ? lbl.textContent.trim() : '&';
      const circX = rectX + width + 5.5;
      const circles = Array.from(svg.querySelectorAll('circle'));
      const inv = circles.some((c) => Math.abs(Number(c.getAttribute('cx')) - circX) < 3 && Math.abs(Number(c.getAttribute('cy')) - cy) < 3);
      if (sym === '&') return inv ? 'NAND' : 'AND';
      return inv ? 'NOR' : 'OR';
    };

    if (p === 1) {
      const svg = document.querySelector('#p1-svg-wrap svg');
      const invA = Boolean(findRect(svg, 100, 35));
      const invB = Boolean(findRect(svg, 100, 115));
      const invOut = Boolean(findRect(svg, 368, 75));
      const op = readOp(svg, 240, 62, 66);
      let bits = '';
      for (let a = 0; a <= 1; a++) {
        for (let b = 0; b <= 1; b++) {
          let r = gateEval(op, invA ? (a ^ 1) : a, invB ? (b ^ 1) : b);
          if (invOut) r = r ^ 1;
          bits += String(r);
        }
      }
      return bits;
    }

    if (p === 2) {
      const svg = document.querySelector('#p2-svg-wrap svg');
      const invA = Boolean(findRect(svg, 88, 19));
      const invB = Boolean(findRect(svg, 88, 75));
      const invC = Boolean(findRect(svg, 145, 143));
      const g1 = readOp(svg, 195, 32, 64);
      const g2 = readOp(svg, 345, 78, 64);
      let k = 0;
      for (let a = 0; a <= 1; a++) {
        for (let b = 0; b <= 1; b++) {
          for (let c = 0; c <= 1; c++) {
            if (gateEval(g2, gateEval(g1, invA ? (a ^ 1) : a, invB ? (b ^ 1) : b), invC ? (c ^ 1) : c) === 1) k++;
          }
        }
      }
      return String((k / 8) * 100);
    }

    if (p === 3) {
      const svg = document.querySelector('#p3-svg-wrap svg');
      const invA = Boolean(findRect(svg, 84, 19));
      const invB = Boolean(findRect(svg, 84, 75));
      const invC = Boolean(findRect(svg, 140, 145));
      const invOut = Boolean(findRect(svg, 426, 91));
      const op = readOp(svg, 188, 32, 60);
      const targetF = document.getElementById('p3-target-badge').textContent.includes('1') ? 1 : 0;
      for (let a = 0; a <= 1; a++) {
        for (let b = 0; b <= 1; b++) {
          for (let c = 0; c <= 1; c++) {
            let res = gateEval(op, gateEval(op, invA ? (a ^ 1) : a, invB ? (b ^ 1) : b), invC ? (c ^ 1) : c);
            if (invOut) res = res ^ 1;
            if (res === targetF) return `${a}${b}${c}`;
          }
        }
      }
      throw new Error('No unique solution for Phase 3');
    }

    if (p === 4) {
      const text = document.getElementById('p4-condition').textContent.replace(/\s+/g, ' ').trim();
      if (text.includes('триггеров') && text.includes('байт')) {
        return String(Number(text.match(/(\d+)\s*байт/)[1]) * 8);
      }
      if (text.includes('таблице истинности')) {
        return String(Math.pow(2, Number(text.match(/ровно\s*(\d+)\s*независимых/)[1])));
      }
      if (text.includes('транзисторов')) {
        const m = text.match(/из\s*(\d+)\s*элементов\s*И-НЕ\s*и\s*(\d+)\s*инверторов/);
        return String(Number(m[1]) * 4 + Number(m[2]) * 2);
      }
      throw new Error('Unknown Phase 4 condition: ' + text);
    }

    if (p === 5) {
      const svg = document.querySelector('#p5-svg-wrap svg');
      const g1 = readOp(svg, 145, 26, 66);
      const g2 = readOp(svg, 145, 118, 66);
      const g3 = readOp(svg, 342, 72, 66);
      const boxes = Array.from(document.querySelectorAll('#p5-packets-wrap .col-6'));
      let dec = 0;
      boxes.forEach((box) => {
        const m = box.textContent.match(/A=([01]),\s*B=([01]),\s*C=([01])/);
        const bit = gateEval(g3, gateEval(g1, Number(m[1]), Number(m[2])), gateEval(g2, Number(m[2]), Number(m[3])));
        dec = (dec << 1) | bit;
      });
      return String(dec);
    }

    throw new Error('Unknown phase ' + p);
  }, phase);
}

test.describe('8th Grade Lesson 11 (Level 2) :: Student Personas & Sawtooth 2-1-2 Curve', () => {
  test('Persona: NOVICE — enters wrong value on Phase 1, reads feedback, recovers and finishes all 5 phases', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await sim.cognitivePause(100);
    await page.locator('#p1-input').fill('00');
    await page.locator('#p1-submit-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');
    await page.waitForTimeout(1400);
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

  test('Persona: CARELESS — submits spaces, Russian comma, % sign, and submits with Enter key', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible({ timeout: 5000 });
      const ans = await solvePhaseAnswerFromDOM(page, p);
      let messy = `  ${ans}  `;
      if (p === 1) messy = ` ${ans[0]}${ans[1]} ${ans[2]}${ans[3]} `;
      if (p === 2) messy = `  ${ans.replace('.', ',')}%  `;
      if (p === 3) messy = ` ${ans.slice(0, 2)} ${ans[2]} `;
      await page.locator(`#p${p}-input`).fill(messy);
      await page.locator(`#p${p}-input`).press('Enter');
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — verifies anti-paste protection and rapid submit clicks', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    await sim.attemptProhibitedPaste(page.locator('#p1-input'), '0110');
    expect(await page.locator('#p1-input').inputValue()).toBe('');

    await sim.simulateSpamClick(page.locator('#p1-submit-btn'), 4);
    await expect(page.locator('#feedback-box')).toBeVisible();

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & Cognitive Difficulty — solves all 5 Sawtooth 2-1-2 phases and validates 8th-grade CCS corridor', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    const benchmarker = new DifficultyBenchmarker({
      courseSlug: '8-класс',
      lessonId: 11,
      levelNumber: 2
    });

    await page.goto(TASK_URL);

    const phaseSpecs = [
      { title: '4-битный вектор выходов схемы с инверсией (База)', depth: 2, memory: 1, inversion: 0, scaffolding: 0 },
      { title: 'Доля истинных наборов в % для 3-входовой схемы', depth: 3, memory: 2, inversion: 0, scaffolding: 1 },
      { title: 'Обратная реконструкция единственного набора ABC (Пик инверсии)', depth: 2, memory: 2, inversion: 2, scaffolding: 0 },
      { title: 'Концептуальный расчёт: триггеры / строки / КМОП (Долина консолидации)', depth: 2, memory: 2, inversion: 0, scaffolding: 0 },
      { title: 'Трассировка 4 пакетов с разветвлением ● и двоичный перевод (Кульминация)', depth: 3, memory: 3, inversion: 0, scaffolding: 0 }
    ];

    const observedNumbers = [];
    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible({ timeout: 5000 });
      await benchmarker.auditHitboxes([page.locator(`#p${p}-submit-btn`)], 48);

      const ans = await solvePhaseAnswerFromDOM(page, p);
      observedNumbers.push(Number(ans));
      benchmarker.recordPhase(p, phaseSpecs[p - 1]);

      await page.locator(`#p${p}-input`).fill(ans);
      await sim.cognitivePause(35);
      await page.locator(`#p${p}-submit-btn`).click();
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    benchmarker.auditNumberInvariants(observedNumbers, { maxMagnitude: 1000, allowPowerOfTwo: true });
    benchmarker.assertSawtoothProfile();
    benchmarker.assertGradeCorridor('8-класс');
    benchmarker.assertNoFakeDifficulty();
    const report = benchmarker.renderReport('8th GRADE LESSON 11 (Level 2) :: SAWTOOTH 2-1-2 & CCS AUDIT');
    expect(report).toContain('Sawtooth 2-1-2 Profile: PASSED');

    sim.assertCleanSession();
  });
});
