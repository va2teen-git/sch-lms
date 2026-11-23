import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';
import { DifficultyBenchmarker } from './difficulty-benchmarker.js';

const TASK_URL = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/36/level2';

function evalPostfixExpr(exprStr, xVal = null) {
  const tokens = exprStr.trim().split(/\s+/);
  const stack = [];
  for (const tok of tokens) {
    if (tok === 'X') stack.push(xVal);
    else if (tok === 'u-') stack.push(-stack.pop());
    else if (tok === '+' || tok === '-' || tok === '×' || tok === '*' || tok === '/') {
      const b = stack.pop();
      const a = stack.pop();
      if (tok === '+') stack.push(a + b);
      else if (tok === '-') stack.push(a - b);
      else if (tok === '×' || tok === '*') stack.push(a * b);
      else stack.push(b === 0 ? NaN : a / b);
    } else {
      stack.push(Number(tok));
    }
  }
  return stack[0];
}

function evalInfixWithPrecedence(exprStr) {
  const rawTokens = exprStr.trim().split(/\s+/);
  const output = [];
  const ops = [];
  const prec = { '^': 4, 'u-': 3, '×': 2, '*': 2, '/': 2, '+': 1, '-': 1 };
  const rightAssoc = new Set(['^', 'u-']);

  for (const tok of rawTokens) {
    if (/^-\d+(\.\d+)?$/.test(tok)) {
      const num = tok.slice(1);
      while (ops.length && ops[ops.length - 1] !== '(' && prec[ops[ops.length - 1]] > prec['u-']) {
        output.push(ops.pop());
      }
      ops.push('u-');
      output.push(num);
      continue;
    }
    if (/^\d+(\.\d+)?$/.test(tok)) {
      output.push(tok);
    } else {
      while (ops.length && ops[ops.length - 1] !== '(') {
        const top = ops[ops.length - 1];
        if (rightAssoc.has(tok) ? prec[top] > prec[tok] : prec[top] >= prec[tok]) {
          output.push(ops.pop());
        } else {
          break;
        }
      }
      ops.push(tok);
    }
  }
  while (ops.length) output.push(ops.pop());

  const st = [];
  for (const t of output) {
    if (t === 'u-') st.push(-st.pop());
    else if (prec[t]) {
      const b = st.pop();
      const a = st.pop();
      if (t === '+') st.push(a + b);
      else if (t === '-') st.push(a - b);
      else if (t === '×' || t === '*') st.push(a * b);
      else if (t === '/') st.push(a / b);
      else if (t === '^') st.push(Math.pow(a, b));
    } else {
      st.push(Number(t));
    }
  }
  return st[0];
}

async function solvePhaseAnswerFromDOM(page, phase) {
  if (phase === 1) {
    return evalPostfixExpr(await page.locator('#p1-expr').innerText());
  }
  if (phase === 2) {
    const expr = await page.locator('#p2-expr').innerText();
    const opBytes = Number(await page.locator('#p2-op-bytes').innerText());
    const bufBits = Number(await page.locator('#p2-buf-bits').innerText());
    const ops = new Set(['+', '-', '×', '*', '/']);
    let nOps = 0;
    let nNums = 0;
    for (const t of expr.trim().split(/\s+/)) {
      if (ops.has(t)) nOps++;
      else nNums++;
    }
    return ((nNums * opBytes + nOps) / (bufBits / 8)) * 100;
  }
  if (phase === 3) {
    const expr = await page.locator('#p3-expr').innerText();
    const target = Number(await page.locator('#p3-target').innerText());
    for (let x = -50; x <= 200; x++) {
      const val = evalPostfixExpr(expr, x);
      if (!Number.isNaN(val) && Math.abs(val - target) < 1e-6) return x;
    }
    throw new Error(`No X found for ${expr} = ${target}`);
  }
  if (phase === 4) {
    const tokens = (await page.locator('#p4-expr').innerText()).trim().split(/\s+/);
    let depth = 0;
    let maxDepth = 0;
    for (const t of tokens) {
      if (t === 'u-') continue;
      if (t === '+' || t === '-' || t === '×' || t === '*' || t === '/') depth -= 1;
      else {
        depth += 1;
        if (depth > maxDepth) maxDepth = depth;
      }
    }
    return maxDepth;
  }
  if (phase === 5) {
    return evalInfixWithPrecedence(await page.locator('#p5-expr').innerText());
  }
  throw new Error('Unknown phase ' + phase);
}

test.describe('Digital Student Personas :: Lesson 36 (11-класс_углубленный) Level 2', () => {

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

    await expect(page.locator('#phase1')).toBeVisible();
    const p1Ans = await solvePhaseAnswerFromDOM(page, 1);
    await sim.cognitivePause();
    await page.locator('#p1-input').fill(`   ${p1Ans}   `);
    await page.locator('#p1-input').press('Enter');

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
      lessonId: 36,
      levelNumber: 2
    });

    await page.goto(TASK_URL);

    const phaseSpecs = [
      { title: 'Прямая стековая трассировка ОПЗ (Пик 0)', depth: 2, memory: 2, inversion: 0 },
      { title: 'Конвертация бит/байт и доля буфера байт-кода', depth: 3, memory: 3, inversion: 0 },
      { title: 'Восстановление неизвестного операнда X (Пик инверсии)', depth: 3, memory: 3, inversion: 2 },
      { title: 'Пиковая глубина стека по арности (Долина консолидации)', depth: 2, memory: 3, inversion: 0 },
      { title: 'Краевые правила Дейкстры: u-, ^, / (Кульминация)', depth: 4, memory: 3, inversion: 2 }
    ];

    const observedNumbers = [];
    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible({ timeout: 5000 });
      await benchmarker.auditHitboxes([page.locator(`#p${p}-submit-btn`)], 48);

      const ans = await solvePhaseAnswerFromDOM(page, p);
      observedNumbers.push(ans);
      benchmarker.recordPhase(p, phaseSpecs[p - 1]);

      const formatted = String(ans).includes('.') ? String(ans).replace('.', ',') : String(ans);
      await page.locator(`#p${p}-input`).fill(formatted);
      await sim.cognitivePause(35);
      await page.locator(`#p${p}-submit-btn`).click();
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    benchmarker.auditNumberInvariants(observedNumbers, { maxMagnitude: 100000, allowPowerOfTwo: true });
    benchmarker.assertSawtoothProfile();
    benchmarker.assertGradeCorridor('11-класс_углубленный');
    benchmarker.assertNoFakeDifficulty();
    const report = benchmarker.renderReport('LESSON 36 (Level 2) :: SAWTOOTH 2-1-2 & CCS AUDIT');
    expect(report).toContain('Sawtooth 2-1-2 Profile: PASSED');

    sim.assertCleanSession();
  });
});
