import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TASK_URL = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/35/level2';
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

async function computePhaseAnswerFromDOM(page, phase) {
  if (phase === 1) {
    const badges = page.locator('#p1-ops-list .badge');
    const count = await badges.count();
    const stack = [];
    for (let i = 0; i < count; i++) {
      const txt = (await badges.nth(i).innerText()).trim();
      const pushMatch = txt.match(/push\((-?\d+)\)/);
      if (pushMatch) {
        stack.push(parseInt(pushMatch[1], 10));
      } else if (txt.includes('pop()')) {
        stack.pop();
      }
    }
    return stack.reduce((acc, x) => acc + x, 0);
  }
  if (phase === 2) {
    const limitKb = parseInt(await page.locator('#p2-limit-kb').innerText(), 10);
    const localBytes = parseInt(await page.locator('#p2-local-bytes').innerText(), 10);
    const depth = parseInt(await page.locator('#p2-depth').innerText(), 10);
    const used = depth * (16 + localBytes);
    return (used / (limitKb * 1024)) * 100;
  }
  if (phase === 3) {
    const allocKb = parseInt(await page.locator('#p3-alloc-kb').innerText(), 10);
    const elemBytes = parseInt(await page.locator('#p3-elem-bytes').innerText(), 10);
    const fillTxt = (await page.locator('#p3-fill-pct').innerText()).replace('%', '').replace(',', '.').trim();
    const fillPct = parseFloat(fillTxt);
    const capSlots = (allocKb * 1024) / elemBytes;
    const occupied = Math.round(capSlots * (fillPct / 100));
    return capSlots - occupied;
  }
  if (phase === 4) {
    const cells = page.locator('#p4-tape > div');
    const len = await cells.count();
    const openSet = new Set(['(', '[', '{', '<']);
    const closeToOpen = { ')': '(', ']': '[', '}': '{', '>': '<' };
    const stack = [];
    for (let i = 0; i < len; i++) {
      const ch = (await cells.nth(i).locator('div').first().innerText()).trim();
      if (openSet.has(ch)) {
        stack.push({ ch, idx: i });
      } else if (closeToOpen[ch]) {
        if (stack.length === 0 || stack[stack.length - 1].ch !== closeToOpen[ch]) {
          return i;
        }
        stack.pop();
      }
    }
    return stack.length > 0 ? stack[stack.length - 1].idx : -1;
  }
  const bufSize = parseInt(await page.locator('#p5-buf-size').innerText(), 10);
  const depth = parseInt(await page.locator('#p5-depth').innerText(), 10);
  const rawFrame = 24 + bufSize + 4;
  const alignedFrame = Math.ceil(rawFrame / 16) * 16;
  return Math.ceil((alignedFrame * depth) / 4096);
}

test.describe('11th Grade Advanced Lesson 35: Level 2 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/35/level2.astro');

  test('Level 2 adheres to architectural requirements (5 phases, Sawtooth 2-1-2, Anti-Paste, decimal input, LMSTelemetry)', async ({ page }) => {
    expect(fs.existsSync(taskPath), 'level2.astro must exist').toBe(true);
    const code = fs.readFileSync(taskPath, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}');
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="phase4"');
    expect(code).toContain('id="phase5"');
    expect(code).toContain('inputmode="decimal"');
    expect(code).toContain('LMSTelemetry');
    expect(code).toContain('totalStages: 5');
    expect(code).toContain("addEventListener('paste'");

    expect(code.includes('type="number"')).toBe(false);
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);
    expect(/https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/i.test(code)).toBe(false);

    await page.goto(TASK_URL);
    expect(await page.locator('#game-container input[type="radio"]').count()).toBe(0);
    expect(await page.locator('#game-container select').count()).toBe(0);
    expect(await page.locator('#game-container input[type="text"][inputmode="decimal"]').count()).toBe(5);
  });

  test('Full 5-phase analytical walkthrough with telemetry verification', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    // Deferred start_time: zero telemetry before interaction
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#phase-badge')).toHaveText(`Шаг ${p} из 5`);

      const domAns = await computePhaseAnswerFromDOM(page, p);
      await page.locator(`#p${p}-input`).fill(String(domAns));
      if (p % 2 === 0) {
        await page.locator(`#p${p}-input`).press('Enter');
      } else {
        await page.locator(`#p${p}-submit-btn`).click();
      }
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');
    await expect(page.locator('#phase-badge')).toHaveText('Пройдено');

    const events = await page.evaluate(() => window.__sentTelemetry);
    for (let s = 2; s <= 5; s++) {
      const evt = events.find(e => e.action_type === 'in_progress' && e.stage === s);
      expect(evt).toBeTruthy();
      expect(evt.total_stages).toBe(5);
      expect(evt.start_time).toBeTruthy();
    }

    const completeEvt = events.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.stage).toBe(5);
    expect(completeEvt.total_stages).toBe(5);
    expect(completeEvt.start_time).toBeTruthy();
    expect(typeof completeEvt.time_spent_sec).toBe('number');
    expect(completeEvt.time_spent_sec).toBeGreaterThanOrEqual(0);
  });

  test('Wrong calculation shows feedback, emits fail telemetry, regenerates parameters, and hardcore gate blocks Prince bonus', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await page.locator('#p1-input').fill('9999999');
    await page.locator('#p1-submit-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    const failEvents = await page.evaluate(() => window.__sentTelemetry.filter(e => !e.success));
    expect(failEvents.length).toBe(1);
    expect(failEvents[0].action_type).toBe('hardcore_reset');
    expect(failEvents[0].stage).toBe(1);
    expect(failEvents[0].total_stages).toBe(5);
    expect(failEvents[0].start_time).toBeTruthy();

    await page.waitForTimeout(1600);
    await expect(page.locator('#feedback-box')).toBeHidden();
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#p1-input')).toHaveValue('');

    // Verify lesson page hardcore gate keeps Prince bonus sealed after level_fail / hardcore_reset
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
        action_type: 'level_fail',
        mission_name: 'Урок 35 :: Стеки. Анализ правильности скобочного выражения (Уровень 2)',
        level: 2,
        stage: 3,
        total_stages: 5,
        success: false,
        start_time: new Date().toISOString(),
        time_spent_sec: 12
      }, '*');
    });

    await expect(page.locator('#prince-bonus-card')).toBeHidden();
    await expect(page.locator('#completion-screen')).toBeHidden();
  });
});
