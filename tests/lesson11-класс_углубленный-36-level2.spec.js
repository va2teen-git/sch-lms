import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TASK_URL = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/36/level2';
const LESSON_URL = '/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/36';

async function attachTelemetrySpy(page) {
  await page.addInitScript(() => {
    window.__sentTelemetry = [];
    const orig = window.postMessage.bind(window);
    window.postMessage = (msg, targetOrigin) => {
      if (msg && msg.type === 'TELEMETRY_EVENT') {
        window.__sentTelemetry.push(msg);
      }
      return orig(msg, targetOrigin);
    };
  });
}

function evalPostfixExpr(exprStr, xVal = null) {
  const tokens = exprStr.trim().split(/\s+/);
  const stack = [];
  for (const tok of tokens) {
    if (tok === 'X') {
      stack.push(xVal);
    } else if (tok === 'u-') {
      stack.push(-stack.pop());
    } else if (tok === '+' || tok === '-' || tok === '×' || tok === '*' || tok === '/') {
      const b = stack.pop();
      const a = stack.pop();
      if (tok === '+') stack.push(a + b);
      else if (tok === '-') stack.push(a - b);
      else if (tok === '×' || tok === '*') stack.push(a * b);
      else {
        if (b === 0) return NaN;
        stack.push(a / b);
      }
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

  for (let i = 0; i < rawTokens.length; i++) {
    let tok = rawTokens[i];
    if (/^-\d+(\.\d+)?$/.test(tok)) {
      // Unary minus attached to number literal e.g. "-3"
      const num = tok.slice(1);
      // Push unary minus operator then number -> output number then u-
      while (ops.length && ops[ops.length - 1] !== '(') {
        const top = ops[ops.length - 1];
        if (!rightAssoc.has('u-') ? prec[top] >= prec['u-'] : prec[top] > prec['u-']) {
          output.push(ops.pop());
        } else {
          break;
        }
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
    const expr = await page.locator('#p1-expr').innerText();
    return evalPostfixExpr(expr);
  }
  if (phase === 2) {
    const expr = await page.locator('#p2-expr').innerText();
    const opBytes = Number(await page.locator('#p2-op-bytes').innerText());
    const bufBits = Number(await page.locator('#p2-buf-bits').innerText());
    const tokens = expr.trim().split(/\s+/);
    const ops = new Set(['+', '-', '×', '*', '/']);
    let nOps = 0;
    let nNums = 0;
    for (const t of tokens) {
      if (ops.has(t)) nOps++;
      else nNums++;
    }
    const usedBytes = nNums * opBytes + nOps;
    const bufBytes = bufBits / 8;
    return (usedBytes / bufBytes) * 100;
  }
  if (phase === 3) {
    const expr = await page.locator('#p3-expr').innerText();
    const target = Number(await page.locator('#p3-target').innerText());
    for (let x = -50; x <= 200; x++) {
      const val = evalPostfixExpr(expr, x);
      if (!Number.isNaN(val) && Math.abs(val - target) < 1e-6) {
        return x;
      }
    }
    throw new Error(`Could not solve X for expr=${expr}, target=${target}`);
  }
  if (phase === 4) {
    const expr = await page.locator('#p4-expr').innerText();
    const tokens = expr.trim().split(/\s+/);
    let depth = 0;
    let maxDepth = 0;
    for (const t of tokens) {
      if (t === 'u-') {
        // unary op keeps depth
      } else if (t === '+' || t === '-' || t === '×' || t === '*' || t === '/') {
        depth -= 1;
      } else {
        depth += 1;
        if (depth > maxDepth) maxDepth = depth;
      }
    }
    return maxDepth;
  }
  if (phase === 5) {
    const expr = await page.locator('#p5-expr').innerText();
    return evalInfixWithPrecedence(expr);
  }
  throw new Error('Unknown phase ' + phase);
}

test.describe('11th Grade Advanced Lesson 36: Level 2 Analytical Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/36/level2.astro');

  test('Level 2 adheres to architectural requirements (TaskLayout 2, Zero-Style/CDN, text decimal inputs, Anti-Paste, LMSTelemetry)', async ({ page }) => {
    expect(fs.existsSync(taskPath), 'level2.astro must exist').toBe(true);
    const code = fs.readFileSync(taskPath, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}');
    expect(code).toContain('LMSTelemetry');
    expect(code).toContain('totalStages: 5');
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
    expect(code.includes('type="number"')).toBe(false);
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);
    expect(code).not.toContain('prince_complete');
    expect(/https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/i.test(code)).toBe(false);

    await page.goto(TASK_URL);
    expect(await page.locator('#game-container input[type="number"]').count()).toBe(0);
    expect(await page.locator('#game-container input[type="radio"]').count()).toBe(0);
    expect(await page.locator('#game-container select').count()).toBe(0);
    expect(await page.locator('#game-container input[type="text"][inputmode="decimal"]').count()).toBe(5);
  });

  test('Full 5-phase analytical walkthrough with telemetry verification', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#phase-badge')).toHaveText(`Шаг ${p} из 5`);
      const ans = await solvePhaseAnswerFromDOM(page, p);
      await page.locator(`#p${p}-input`).fill(String(ans));
      await page.locator(`#p${p}-submit-btn`).click();
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    const events = await page.evaluate(() => window.__sentTelemetry);
    const stageEvents = events.filter(e => e.action_type === 'stage_advance' || e.stage !== undefined);
    expect(stageEvents.length).toBeGreaterThanOrEqual(4);

    const completeEvt = events.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.mission_name).toContain('Уровень 2');
    expect(completeEvt.total_stages).toBe(5);
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.start_time).toBeTruthy();
    expect(typeof completeEvt.time_spent_sec).toBe('number');
  });

  test('Error scenario triggers feedback, fail telemetry, regeneration, and hardcore gate protects Prince bonus', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await expect(page.locator('#phase1')).toBeVisible();
    await page.locator('#p1-input').fill('999999');
    await page.locator('#p1-submit-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    const failEvents = await page.evaluate(() =>
      window.__sentTelemetry.filter(e => e.action_type === 'level_fail' || e.action_type === 'hardcore_reset')
    );
    expect(failEvents.length).toBe(1);
    expect(failEvents[0].success).toBe(false);
    expect(failEvents[0].stage).toBe(1);

    await page.waitForTimeout(1600);
    await expect(page.locator('#feedback-box')).toBeHidden();
    await expect(page.locator('#phase1')).toBeVisible();

    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Тест');
      localStorage.setItem('student_lastName', 'Постфикс');
      localStorage.setItem('student_class', '11-класс_углубленный');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_11-класс_углубленный_36', 'true');
    });
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto(LESSON_URL);
    await page.evaluate(() => {
      window.postMessage({
        type: 'TELEMETRY_EVENT',
        action_type: 'hardcore_reset',
        mission_name: 'Урок 36 :: Вычисление арифметического выражения, записанного в постфиксной форме (Уровень 2)',
        level: 2,
        stage: 1,
        total_stages: 5,
        success: false,
        start_time: new Date().toISOString(),
        time_spent_sec: 5
      }, '*');
    });

    await expect(page.locator('#prince-bonus-card')).toBeHidden();
    await expect(page.locator('#completion-screen')).toBeHidden();
  });
});
