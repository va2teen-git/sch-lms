import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TASK_URL = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/36/level1';
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

function classifyP1CardText(text) {
  const clean = text.trim();
  if (clean.includes('(') || clean.includes(')')) return 2;
  const tokens = clean.split(/\s+/);
  const ops = new Set(['+', '-', '×', '*']);

  // Check valid Prefix notation
  if (ops.has(tokens[0])) {
    let needed = 1;
    let valid = true;
    for (const t of tokens) {
      if (needed <= 0) {
        valid = false;
        break;
      }
      if (ops.has(t)) needed += 1;
      else if (/^-?\d+$/.test(t)) needed -= 1;
      else { valid = false; break; }
    }
    return (valid && needed === 0) ? 0 : 2;
  }

  // Check valid Postfix (RPN) notation
  let depth = 0;
  for (const t of tokens) {
    if (ops.has(t)) {
      if (depth < 2) return 2;
      depth -= 1;
    } else if (/^-?\d+$/.test(t)) {
      depth += 1;
    } else {
      return 2;
    }
  }
  return depth === 1 ? 1 : 2;
}

function infixToRpnTokens(infixStr) {
  const spaced = infixStr.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').trim();
  const raw = spaced.split(/\s+/).filter(Boolean);
  const output = [];
  const ops = [];
  const prec = { '^': 4, 'u-': 3, '×': 2, '*': 2, '/': 2, '+': 1, '-': 1 };
  const rightAssoc = new Set(['^', 'u-']);

  for (const tok of raw) {
    if (/^-\d+$/.test(tok)) {
      while (ops.length && ops[ops.length - 1] !== '(' && prec[ops[ops.length - 1]] > prec['u-']) {
        output.push(ops.pop());
      }
      ops.push('u-');
      output.push(tok.slice(1));
    } else if (/^\d+$/.test(tok)) {
      output.push(tok);
    } else if (tok === '(') {
      ops.push('(');
    } else if (tok === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') {
        output.push(ops.pop());
      }
      if (ops[ops.length - 1] === '(') ops.pop();
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
  return output;
}

async function solvePhase1UI(page) {
  const paletteCards = page.locator('#p1-token-palette [data-item-id]');
  while ((await paletteCards.count()) > 0) {
    const card = paletteCards.first();
    const text = await card.innerText();
    const bucket = classifyP1CardText(text);
    await card.click();
    await page.locator(`#p1-bucket-card-${bucket}`).click();
  }
  await page.locator('#p1-check-btn').click();
}

async function solvePhase2UI(page) {
  const tape = page.locator('#p2-tape [data-tape-idx]');
  const total = await tape.count();
  const ops = new Set(['+', '-', '×', '/']);

  for (let i = 0; i < total; i++) {
    const tokenBtn = page.locator(`#p2-tape [data-tape-idx="${i}"]`);
    const tokText = (await tokenBtn.innerText()).trim();
    if (!ops.has(tokText)) {
      await tokenBtn.click();
    } else {
      await page.locator('#p2-stack-dropzone [data-stack-top="1"]').click();
      await page.locator('#p2-stack-dropzone [data-stack-top="1"]').click();
      await page.locator('#p2-exec-btn').click();
    }
  }
}

async function solvePhase3UI(page) {
  const infixText = await page.locator('#p3-infix-display').innerText();
  const expectedTokens = infixToRpnTokens(infixText);

  for (let i = 0; i < expectedTokens.length; i++) {
    const tokText = expectedTokens[i];
    const paletteToks = page.locator('#p3-palette [data-p3-tok]');
    const count = await paletteToks.count();
    let clicked = false;
    for (let j = 0; j < count; j++) {
      const candidate = paletteToks.nth(j);
      if ((await candidate.innerText()).trim() === tokText) {
        await candidate.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) {
      throw new Error(`Token "${tokText}" not found in #p3-palette for "${infixText}"`);
    }
    await page.locator(`#p3-slots [data-slot-idx="${i}"]`).click();
  }
  await page.locator('#p3-check-btn').click();
}

test.describe('11th Grade Advanced Lesson 36: Level 1 Manipulation Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/36/level1.astro');

  test('Level 1 adheres to architectural requirements (TaskLayout 1, Zero-Style/CDN, Zero Multiple Choice, >=48px hitboxes, LMSTelemetry)', async ({ page }) => {
    expect(fs.existsSync(taskPath), 'level1.astro must exist').toBe(true);
    const code = fs.readFileSync(taskPath, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}');
    expect(code).toContain('LMSTelemetry');
    expect(code).toContain('totalStages: 3');
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);
    expect(code).not.toContain('prince_complete');
    expect(/https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/i.test(code)).toBe(false);

    await page.goto(TASK_URL);
    expect(await page.locator('#game-container input[type="radio"]').count()).toBe(0);
    expect(await page.locator('#game-container select').count()).toBe(0);

    const checkBtnBox = await page.locator('#p1-check-btn').boundingBox();
    expect(checkBtnBox.height).toBeGreaterThanOrEqual(48);
  });

  test('Full 3-phase mouse walkthrough with telemetry verification', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');
    await solvePhase1UI(page);

    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
    await solvePhase2UI(page);

    await expect(page.locator('#phase3')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');
    await solvePhase3UI(page);

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    const events = await page.evaluate(() => window.__sentTelemetry);
    const stageEvents = events.filter(e => e.action_type === 'stage_advance' || e.stage !== undefined);
    expect(stageEvents.length).toBeGreaterThanOrEqual(2);

    const completeEvt = events.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.mission_name).toContain('Уровень 1');
    expect(completeEvt.total_stages).toBe(3);
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.start_time).toBeTruthy();
    expect(typeof completeEvt.time_spent_sec).toBe('number');
  });

  test('Wrong classification emits fail telemetry, regenerates Phase 1, and hardcore gate protects Prince bonus', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await expect(page.locator('#phase1')).toBeVisible();
    const paletteCards = page.locator('#p1-token-palette [data-item-id]');
    while ((await paletteCards.count()) > 0) {
      await paletteCards.first().click();
      await page.locator('#p1-bucket-card-0').click();
    }
    await page.locator('#p1-check-btn').click();

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
    expect(await page.locator('#p1-token-palette [data-item-id]').count()).toBe(6);

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
        mission_name: 'Урок 36 :: Вычисление арифметического выражения, записанного в постфиксной форме (Уровень 1)',
        level: 1,
        stage: 1,
        total_stages: 3,
        success: false,
        start_time: new Date().toISOString(),
        time_spent_sec: 4
      }, '*');
    });

    await expect(page.locator('#prince-bonus-card')).toBeHidden();
    await expect(page.locator('#completion-screen')).toBeHidden();
  });
});
