import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/36/level3';
const LESSON_URL = '/lesson/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/36';

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

test.describe('10th Grade Advanced Lesson 36: Level 3 Arcade Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/36/level3.astro');

  test('Level 3 adheres to architectural requirements (Vue 3 local, TaskLayout 3, Intro, Keyboard-Only, AFK guard, Zero-Style/CDN)', async () => {
    expect(fs.existsSync(taskPath)).toBe(true);
    const code = fs.readFileSync(taskPath, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toMatch(/<TaskLayout[\s\S]*level=\{3\}/);
    expect(code).toContain('/static/vue.global.js');
    expect(code).toContain('LMSTelemetry.create');
    expect(code).toContain('totalWaves: 10');
    expect(code).toContain('showAfkOverlay: true');
    expect(code).toContain('onAfkStop');
    expect(code).toContain('onAfkRetry');
    expect(code).toContain('id="start-btn"');
    expect(code).toContain('id="alarm-box"');
    expect(code).toContain('id="alarm-count"');
    expect(code).toContain('AudioContext');
    expect(code).toContain('pointer-events: none');
    expect(code).toContain('e.code');
    expect(code).toContain('e.preventDefault()');
    expect(code).toContain('window.__DEV_LEVEL3_STATE__');
    expect(code).not.toMatch(/<style[\s>]/i);
    expect(code).not.toMatch(/https?:\/\//i);
    expect(code).not.toMatch(/prince_complete/i);
  });

  test('Intro briefing gates timer and telemetry until #start-btn is clicked, and wave timers meet >=30s / >=15s rules', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await expect(page.locator('#start-btn')).toBeVisible();
    await expect(page.locator('#playing-screen')).toBeHidden();
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await page.locator('#start-btn').click();
    await expect(page.locator('#playing-screen')).toBeVisible();
    await expect(page.locator('#wave-badge')).toContainText('Волна 1 / 10');

    const waveTimers = await page.evaluate(() => window.__DEV_LEVEL3_STATE__.waves.map(w => w.timeLimit));
    expect(waveTimers.length).toBe(10);
    expect(waveTimers[0]).toBeGreaterThanOrEqual(30);
    for (const t of waveTimers) {
      expect(t).toBeGreaterThanOrEqual(15);
    }
    expect(waveTimers[7]).toBeGreaterThan(waveTimers[6]);
  });

  test('Waves 1-10: real keyboard control on Wave 1 + full 10-wave completion with telemetry verification', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-badge')).toContainText('Волна 1 / 10');

    // Реальный клавиатурный ввод на Волне 1 по данным текущей волны
    const wave1 = await page.evaluate(() => window.__DEV_LEVEL3_STATE__.currentWave);
    for (let b = 0; b < 8; b++) {
      if ((wave1.targetValue >> b) & 1) {
        await page.keyboard.press(`Digit${b}`);
      }
    }
    if (wave1.targetMode !== 'HEX') {
      await page.keyboard.press('ShiftLeft');
    }
    await page.keyboard.press('Space');
    await expect(page.locator('#wave-badge')).toContainText('Волна 2 / 10', { timeout: 4000 });

    for (let w = 2; w <= 10; w++) {
      const ok = await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
      expect(ok).toBe(true);
      if (w < 10) {
        await expect(page.locator('#wave-badge')).toContainText(`Волна ${w + 1} / 10`, { timeout: 4000 });
      }
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });

    const events = await page.evaluate(() => window.__sentTelemetry);
    const completeEvt = events.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.wave).toBe(10);
    expect(completeEvt.total_waves).toBe(10);
    expect(completeEvt.success).toBe(true);
    expect(typeof completeEvt.start_time).toBe('string');
    expect(typeof completeEvt.time_spent_sec).toBe('number');
  });

  test('Hardcore reset on Wave 2 triggers #alarm-box & #alarm-count, emits fail telemetry, resets to Wave 1, and blocks Prince bonus', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();

    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    await expect(page.locator('#wave-badge')).toContainText('Волна 2 / 10', { timeout: 4000 });

    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.submitAction('wrong'));
    await expect(page.locator('#alarm-box')).toBeVisible();
    await expect(page.locator('#alarm-count')).toHaveText('1');

    const failEvents = await page.evaluate(() => window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset'));
    expect(failEvents.length).toBe(1);
    expect(failEvents[0].wave).toBe(2);
    expect(failEvents[0].total_waves).toBe(10);
    expect(failEvents[0].success).toBe(false);

    await page.waitForTimeout(1700);
    await expect(page.locator('#alarm-box')).toBeHidden();
    await expect(page.locator('#wave-badge')).toContainText('Волна 1 / 10');

    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Тест');
      localStorage.setItem('student_lastName', 'Шина');
      localStorage.setItem('student_class', '10-класс_углубленный');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_10-класс_углубленный_36', 'true');
    });
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto(LESSON_URL);
    await page.evaluate(() => {
      window.postMessage({
        type: 'TELEMETRY_EVENT',
        action_type: 'hardcore_reset',
        mission_name: 'Урок 36 :: Двоичная, восьмеричная и шестнадцатеричная системы счисления, связь между ними (Уровень 3)',
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
    await expect(page.locator('#wave-badge')).toContainText('Волна 1 / 10');

    await page.clock.runFor(34500);
    await page.clock.runFor(1700);
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
    await expect(page.locator('#wave-badge')).toContainText('Волна 1 / 10');
  });
});
