import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TASK_URL = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/35/level3';
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

test.describe('11th Grade Advanced Lesson 35: Level 3 Arcade Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/35/level3.astro');

  test('Level 3 adheres to architectural requirements (Vue 3 local, TaskLayout 3, Intro, AFK guard, Zero-Style/CDN)', async ({ page }) => {
    expect(fs.existsSync(taskPath), 'level3.astro must exist').toBe(true);
    const code = fs.readFileSync(taskPath, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={3}');
    expect(code).toContain('/static/vue.global.js');
    expect(code).toContain('LMSTelemetry');
    expect(code).toContain('totalWaves: 10');
    expect(code).toContain('onAfkStop');
    expect(code).toContain('onAfkRetry');
    expect(code).toContain('id="start-btn"');
    expect(code).toContain('id="alarm-box"');
    expect(code).toContain('id="launch-btn"');

    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);
    expect(/https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/i.test(code)).toBe(false);

    await page.goto(TASK_URL);
    expect(await page.locator('#vue-app input[type="radio"]').count()).toBe(0);
    expect(await page.locator('#vue-app select').count()).toBe(0);
  });

  test('Intro briefing gates timer and telemetry until #start-btn is clicked', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await expect(page.locator('#start-btn')).toBeVisible();
    await expect(page.locator('#vue-app h1')).toContainText('STACK PARSER DEFUSER');
    await expect(page.locator('#wave-counter-badge')).toHaveCount(0);

    // Waiting on intro screen must NOT emit telemetry or start countdown
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    const events = await page.evaluate(() => window.__sentTelemetry);
    const startEvt = events.find(e => e.action_type === 'in_progress');
    expect(startEvt).toBeTruthy();
    expect(startEvt.wave).toBe(1);
    expect(startEvt.total_waves).toBe(10);
    expect(startEvt.start_time).toBeTruthy();
  });

  test('Waves 1-10: real click resolution on Wave 1 + 10-wave completion with telemetry verification', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    // Solve Wave 1 through real DOM clicks (by analyzing visible tokens)
    const tapeBtns = page.locator('.card.border-danger .py-2 button');
    const tokCount = await tapeBtns.count();
    const tokens = [];
    for (let i = 0; i < tokCount; i++) {
      tokens.push((await tapeBtns.nth(i).locator('span.fs-4').innerText()).trim());
    }
    const openToClose = { '(': ')', '[': ']', '{': '}', '<': '>' };
    const closeToOpen = { ')': '(', ']': '[', '}': '{', '>': '<' };
    const stack = [];
    let errIdx = -1;
    for (let i = 0; i < tokens.length; i++) {
      const ch = tokens[i];
      if (openToClose[ch]) stack.push(ch);
      else if (closeToOpen[ch]) {
        if (stack.length === 0 || stack[stack.length - 1] !== closeToOpen[ch]) {
          errIdx = i;
          break;
        }
        stack.pop();
      }
    }

    const tailBtnIdx = { ')': 0, ']': 1, '}': 2, '>': 3 };
    if (errIdx !== -1) {
      await tapeBtns.nth(errIdx).click();
    } else {
      const expectedTail = stack.slice().reverse().map((o) => openToClose[o]);
      for (const ch of expectedTail) {
        await page.locator('.card.border-secondary button:has(span.fs-4)').nth(tailBtnIdx[ch]).click();
      }
    }
    await page.locator('#launch-btn').click();

    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 2 из 10', { timeout: 5000 });

    // Complete Waves 2-10
    for (let w = 2; w <= 10; w++) {
      await expect(page.locator('#wave-counter-badge')).toContainText(`Волна ${w} из 10`);
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    }

    await expect(page.locator('text=МИССИЯ ВЫПОЛНЕНА')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    const events = await page.evaluate(() => window.__sentTelemetry);
    const wave2Evt = events.find(e => e.action_type === 'in_progress' && e.wave === 2);
    const completeEvt = events.find(e => e.action_type === 'level_complete');

    expect(wave2Evt).toBeTruthy();
    expect(wave2Evt.total_waves).toBe(10);

    expect(completeEvt).toBeTruthy();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.wave).toBe(10);
    expect(completeEvt.total_waves).toBe(10);
    expect(completeEvt.start_time).toBeTruthy();
    expect(typeof completeEvt.time_spent_sec).toBe('number');
    expect(completeEvt.time_spent_sec).toBeGreaterThanOrEqual(0);
  });

  test('Hardcore reset on Wave 2 triggers alarm, emits fail telemetry, resets to Wave 1, and blocks Prince bonus on lesson page', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();

    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 2 из 10');

    // Deliberately trigger error on Wave 2
    await page.evaluate(() => {
      window.__DEV_LEVEL3_STATE__.submitAction('fail', 'Конфликт скобок в потоке!');
    });

    await expect(page.locator('#alarm-box')).toBeVisible();
    await expect(page.locator('#alarm-box')).toContainText('STACK PANIC');

    const failEvents = await page.evaluate(() => window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset'));
    expect(failEvents.length).toBe(1);
    expect(failEvents[0].wave).toBe(2);
    expect(failEvents[0].total_waves).toBe(10);
    expect(failEvents[0].success).toBe(false);

    // After reset delay (~1.3s), waves regenerate and player returns to Wave 1
    await page.waitForTimeout(1600);
    await expect(page.locator('#alarm-box')).toBeHidden();
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    // Verify lesson page hardcore gate keeps Prince bonus sealed
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
        mission_name: 'Урок 35 :: Стеки. Анализ правильности скобочного выражения (Уровень 3)',
        level: 3,
        wave: 2,
        total_waves: 10,
        success: false,
        start_time: new Date().toISOString(),
        time_spent_sec: 8
      }, '*');
    });

    await expect(page.locator('#prince-bonus-card')).toBeHidden();
    await expect(page.locator('#completion-screen')).toBeHidden();
  });

  test('AFK Wave-1 guard pauses after 2 consecutive Wave-1 timeouts and resumes on #lms-afk-retry-btn', async ({ page }) => {
    await page.clock.install();
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);
    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    // 1st Wave-1 timeout (12.0s) -> reset delay (1.3s) -> 2nd Wave-1 timeout -> AFK pause
    await page.clock.runFor(12500);
    await page.clock.runFor(1600);
    await page.clock.runFor(12500);

    await expect(page.locator('#lms-afk-overlay')).toBeVisible();
    await expect(page.locator('#lms-afk-retry-btn')).toBeVisible();

    const resetsBeforeWait = await page.evaluate(() =>
      window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset')
    );
    expect(resetsBeforeWait.length).toBe(1);
    expect(resetsBeforeWait[0].wave).toBe(1);
    expect(resetsBeforeWait[0].total_waves).toBe(10);

    // Ensure no further reset spam occurs while paused
    await page.clock.runFor(25000);
    const resetsAfterWait = await page.evaluate(() =>
      window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset').length
    );
    expect(resetsAfterWait).toBe(1);

    // Click "Повторить" -> resumes Wave 1 cleanly
    await page.locator('#lms-afk-retry-btn').click();
    await expect(page.locator('#lms-afk-overlay')).toBeHidden();
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');
  });
});
