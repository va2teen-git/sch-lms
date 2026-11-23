import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/34/level3';
const LESSON_URL = '/lesson/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/34';

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

test.describe('10th Grade Advanced Lesson 34: Level 3 Arcade Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/34/level3.astro');

  test('Level 3 adheres to architectural requirements (Vue 3 local, TaskLayout 3, Intro, Keyboard-Only, AFK guard, Zero-Style/CDN)', async ({ page }) => {
    expect(fs.existsSync(taskPath)).toBe(true);
    const code = fs.readFileSync(taskPath, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toMatch(/<TaskLayout[\s\S]*level=\{3\}/);
    expect(code).toContain('/static/vue.global.js');
    expect(code).toContain('LMSTelemetry.create');
    expect(code).toContain('TOTAL_WAVES = 10');
    expect(code).toContain('showAfkOverlay: true');
    expect(code).toContain('onAfkStop');
    expect(code).toContain('onAfkRetry');
    expect(code).toContain('id="start-btn"');
    expect(code).toContain('id="alarm-box"');
    expect(code).toContain('id="alarm-count"');
    expect(code).toContain('AudioContext');
    expect(code).toContain('pointer-events: none');
    expect(code).toContain('unmounted()');
    expect(code).not.toContain('prince_complete');

    for (const allowedCode of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'Digit', 'Numpad']) {
      expect(code).toContain(allowedCode);
    }
    for (const forbiddenKey of ['KeyQ', 'KeyE', 'KeyR', 'KeyX', 'KeyC', 'Enter', 'Backspace', 'Delete']) {
      expect(code.includes(forbiddenKey)).toBe(false);
    }

    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);
    expect(/https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/i.test(code)).toBe(false);

    await page.goto(TASK_URL);
    expect(await page.locator('#arcade-app input[type="radio"]').count()).toBe(0);
    expect(await page.locator('#arcade-app select').count()).toBe(0);
  });

  test('Intro briefing gates timer and telemetry until #start-btn is clicked, and wave timings meet >=30s / >=15s rules', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await expect(page.locator('#start-btn')).toBeVisible();
    await expect(page.locator('#phase-counter')).toBeHidden();

    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toBeVisible();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    const waveSummary = await page.evaluate(() => {
      const waves = window.__DEV_LEVEL3_STATE__.waves;
      return {
        count: waves.length,
        wave1Time: waves[0].maxTime,
        minTime: Math.min(...waves.map(w => w.maxTime)),
        wave7Time: waves[6].maxTime,
        wave8Time: waves[7].maxTime
      };
    });

    expect(waveSummary.count).toBe(10);
    expect(waveSummary.wave1Time).toBeGreaterThanOrEqual(30);
    expect(waveSummary.minTime).toBeGreaterThanOrEqual(15);
    expect(waveSummary.wave8Time).toBeGreaterThan(waveSummary.wave7Time);
  });

  test('Waves 1-10: real keyboard control on Wave 1 + full 10-wave completion with telemetry verification', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    const scrollBefore = await page.evaluate(() => window.scrollY);
    const wave1Steps = await page.evaluate(() => window.__DEV_LEVEL3_STATE__.waves[0].steps);

    // Toggle Shift analyzer at least once on Wave 1
    await page.keyboard.press('ShiftLeft');

    // Navigate step 0 (Row 0 -> target col) using Digit shortcut or KeyD
    const st0 = wave1Steps[0];
    await page.keyboard.press(`Digit${st0.col + 1}`);
    await page.keyboard.press('Space');

    // Navigate step 1 (Col c0 -> target row) using ArrowDown
    const st1 = wave1Steps[1];
    for (let r = 0; r < st1.row; r++) {
      await page.keyboard.press('ArrowDown');
    }
    await page.keyboard.press('Space');

    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 10', { timeout: 3000 });

    for (let w = 2; w <= 10; w++) {
      await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w} ИЗ 10`, { timeout: 4000 });
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
      if (w < 10) {
        await page.waitForTimeout(300);
      }
    }

    await expect(page.locator('text=ПРОТОКОЛ 2 ↔ 8 ↔ 16 ВЗЛОМАН!')).toBeVisible({ timeout: 5000 });

    const events = await page.evaluate(() => window.__sentTelemetry);
    const completeEvt = events.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.mission_name).toContain('Урок 34');
    expect(completeEvt.mission_name).toContain('Уровень 3');
    expect(completeEvt.total_waves).toBe(10);
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.start_time).toBeTruthy();
    expect(typeof completeEvt.time_spent_sec).toBe('number');
  });

  test('Hardcore reset on Wave 2 triggers #alarm-box & #alarm-count, emits fail telemetry, resets to Wave 1, and blocks Prince bonus', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();

    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 10', { timeout: 4000 });

    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.submitAction('wrong'));
    await expect(page.locator('#alarm-box')).toBeVisible();
    await expect(page.locator('#alarm-count')).toHaveText('1');

    const failEvents = await page.evaluate(() => window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset'));
    expect(failEvents.length).toBe(1);
    expect(failEvents[0].wave).toBe(2);
    expect(failEvents[0].total_waves).toBe(10);
    expect(failEvents[0].success).toBe(false);

    await page.waitForTimeout(1800);
    await expect(page.locator('#alarm-box')).toBeHidden();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Тест');
      localStorage.setItem('student_lastName', 'Матрица');
      localStorage.setItem('student_class', '10-класс_углубленный');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_10-класс_углубленный_34', 'true');
    });
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto(LESSON_URL);
    await page.evaluate(() => {
      window.postMessage({
        type: 'TELEMETRY_EVENT',
        action_type: 'hardcore_reset',
        mission_name: 'Урок 34 :: Двоичная, восьмеричная и шестнадцатеричная системы счисления, связь между ними (Уровень 3)',
        level: 3,
        wave: 2,
        total_waves: 10,
        success: false,
        start_time: new Date().toISOString(),
        time_spent_sec: 10
      }, '*');
    });

    await expect(page.locator('#prince-bonus-card')).toBeHidden();
    await expect(page.locator('#completion-screen')).toBeHidden();
  });

  test('AFK Wave-1 guard pauses after 2 consecutive Wave-1 timeouts and resumes on #lms-afk-retry-btn', async ({ page }) => {
    test.setTimeout(60000);
    await page.clock.install();
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);
    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    await page.clock.runFor(34500);
    await page.clock.runFor(1800);
    await page.clock.runFor(34500);

    await expect(page.locator('#lms-afk-overlay')).toBeVisible();
    await expect(page.locator('#lms-afk-retry-btn')).toBeVisible();

    const resetsBeforeWait = await page.evaluate(() =>
      window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset')
    );
    expect(resetsBeforeWait.length).toBe(1);
    expect(resetsBeforeWait[0].wave).toBe(1);
    expect(resetsBeforeWait[0].total_waves).toBe(10);

    await page.clock.runFor(25000);
    const resetsAfterWait = await page.evaluate(() =>
      window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset').length
    );
    expect(resetsAfterWait).toBe(1);

    await page.locator('#lms-afk-retry-btn').click();
    await expect(page.locator('#lms-afk-overlay')).toBeHidden();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');
  });
});
