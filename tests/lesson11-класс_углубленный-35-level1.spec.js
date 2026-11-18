import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TASK_URL = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/35/level1';
const LESSON_URL = '/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/35';

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
  if (
    text.includes('пустом стеке') ||
    text.includes('полном буфере') ||
    text.includes('без базового случая')
  ) {
    return 2;
  }
  if (
    text.includes('insert(0') ||
    text.includes('pop(0)') ||
    text.includes('buf[0]') ||
    text.includes('самого старого')
  ) {
    return 1;
  }
  return 0;
}

async function solvePhase1UI(page) {
  const paletteBtns = page.locator('#p1-token-palette button[data-item-id]');
  const count = await paletteBtns.count();
  expect(count).toBeGreaterThanOrEqual(6);

  for (let i = 0; i < count; i++) {
    const btn = page.locator('#p1-token-palette button[data-item-id]').first();
    const txt = await btn.innerText();
    const bucket = classifyP1CardText(txt);
    await btn.click();
    await page.locator(`#p1-bucket-card-${bucket}`).click();
  }

  await expect(page.locator('#p1-queue-count')).toHaveText('0 шт.');
  await page.locator('#p1-check-btn').click();
}

async function solvePhase2UI(page) {
  const openSet = new Set(['(', '[', '{', '<']);
  const closeToOpen = { ')': '(', ']': '[', '}': '{', '>': '<' };

  const tapeBtns = page.locator('#p2-tape button[data-tape-idx]');
  const total = await tapeBtns.count();
  expect(total).toBeGreaterThanOrEqual(5);

  const tokens = [];
  for (let i = 0; i < total; i++) {
    tokens.push((await tapeBtns.nth(i).locator('span').first().innerText()).trim());
  }

  const stack = [];
  for (let i = 0; i < tokens.length; i++) {
    const ch = tokens[i];
    if (openSet.has(ch)) {
      stack.push(ch);
      await page.locator('#p2-push-zone').click();
    } else if (closeToOpen[ch]) {
      if (stack.length > 0 && stack[stack.length - 1] === closeToOpen[ch]) {
        stack.pop();
        await page.locator('#p2-stack-well [data-stack-top="1"]').click();
      } else {
        await page.locator('#p2-error-btn').click();
        return;
      }
    } else {
      await page.locator('#p2-skip-btn').click();
    }
  }

  if (stack.length === 0) {
    await page.locator('#p2-finish-ok-btn').click();
  } else {
    await page.locator('#p2-error-btn').click();
  }
}

async function solvePhase3UI(page) {
  const slotTargets = [
    { idx: 0, match: 'Адрес возврата' },
    { idx: 1, match: 'Сохраненный RBP' },
    { idx: 2, match: 'Стековая канарейка' },
    { idx: 3, match: 'Локальный буфер' }
  ];

  for (const target of slotTargets) {
    await page.locator('#p3-palette button[data-p3-token-id]', { hasText: target.match }).first().click();
    await page.locator(`#p3-slots [data-slot-idx="${target.idx}"]`).click();
  }

  await page.locator('#p3-check-btn').click();
}

test.describe('11th Grade Advanced Lesson 35: Level 1 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/35/level1.astro');

  test('Level 1 adheres to architectural requirements (Zero-Style, Zero-CDN, Zero Multiple Choice, LMSTelemetry)', async ({ page }) => {
    expect(fs.existsSync(taskPath), 'level1.astro must exist').toBe(true);
    const code = fs.readFileSync(taskPath, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}');
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('LMSTelemetry');
    expect(code).toContain('totalStages: 3');
    expect(code).toContain('.advanceStage(');
    expect(code).toContain('.fail(');
    expect(code).toContain('.complete(');

    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
    expect(/https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/i.test(code)).toBe(false);
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    await page.goto(TASK_URL);
    expect(await page.locator('#game-container input[type="radio"]').count()).toBe(0);
    expect(await page.locator('#game-container select').count()).toBe(0);
  });

  test('Full 3-phase mouse walkthrough with telemetry verification', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    // Deferred start_time: zero telemetry before interaction
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    // Phase 1
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');
    await solvePhase1UI(page);

    // Phase 2
    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
    await solvePhase2UI(page);

    // Phase 3
    await expect(page.locator('#phase3')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');
    await solvePhase3UI(page);

    // Victory screen
    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');
    await expect(page.locator('#phase-badge')).toHaveText('Пройдено');

    const events = await page.evaluate(() => window.__sentTelemetry);
    const stage2Evt = events.find(e => e.action_type === 'in_progress' && e.stage === 2);
    const stage3Evt = events.find(e => e.action_type === 'in_progress' && e.stage === 3);
    const completeEvt = events.find(e => e.action_type === 'level_complete');

    expect(stage2Evt).toBeTruthy();
    expect(stage2Evt.total_stages).toBe(3);
    expect(stage2Evt.start_time).toBeTruthy();

    expect(stage3Evt).toBeTruthy();
    expect(stage3Evt.total_stages).toBe(3);

    expect(completeEvt).toBeTruthy();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.stage).toBe(3);
    expect(completeEvt.total_stages).toBe(3);
    expect(completeEvt.start_time).toBeTruthy();
    expect(typeof completeEvt.time_spent_sec).toBe('number');
    expect(completeEvt.time_spent_sec).toBeGreaterThanOrEqual(0);
  });

  test('Wrong classification emits fail telemetry, regenerates Phase 1, and hardcore gate blocks Prince bonus on reset', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);
    await expect(page.locator('#phase1')).toBeVisible();

    // Place every card into bucket 0 so at least 4 cards are misclassified
    const count = await page.locator('#p1-token-palette button[data-item-id]').count();
    for (let i = 0; i < count; i++) {
      await page.locator('#p1-token-palette button[data-item-id]').first().click();
      await page.locator('#p1-bucket-card-0').click();
    }
    await page.locator('#p1-check-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    const failEvents = await page.evaluate(() => window.__sentTelemetry.filter(e => !e.success));
    expect(failEvents.length).toBe(1);
    expect(failEvents[0].action_type).toBe('hardcore_reset');
    expect(failEvents[0].stage).toBe(1);
    expect(failEvents[0].total_stages).toBe(3);
    expect(failEvents[0].start_time).toBeTruthy();

    // Wait for regeneration timeout (~1400ms)
    await page.waitForTimeout(1600);
    await expect(page.locator('#feedback-box')).toBeHidden();
    await expect(page.locator('#p1-token-palette button[data-item-id]')).toHaveCount(count);

    // Hardcore gate verification on lesson page
    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Тест');
      localStorage.setItem('student_lastName', 'Стеков');
      localStorage.setItem('student_class', '11-класс_углубленный');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_11-класс_углубленный_35', 'true');
    });
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto(LESSON_URL);
    await page.evaluate(() => {
      window.postMessage({
        type: 'TELEMETRY_EVENT',
        action_type: 'hardcore_reset',
        mission_name: 'Урок 35 :: Стеки. Анализ правильности скобочного выражения (Уровень 1)',
        level: 1,
        stage: 1,
        total_stages: 3,
        success: false,
        start_time: new Date().toISOString(),
        time_spent_sec: 5
      }, '*');
    });

    await expect(page.locator('#prince-bonus-card')).toBeHidden();
    await expect(page.locator('#completion-screen')).toBeHidden();
  });
});
