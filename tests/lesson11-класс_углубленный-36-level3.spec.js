import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TASK_URL = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/36/level3';
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

test.describe('11th Grade Advanced Lesson 36: Level 3 Arcade Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/36/level3.astro');

  test('Level 3 adheres to architectural requirements (Vue 3 local, TaskLayout 3, Intro, Keyboard-Only, AFK guard, Zero-Style/CDN)', async ({ page }) => {
    expect(fs.existsSync(taskPath), 'level3.astro must exist').toBe(true);
    const code = fs.readFileSync(taskPath, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={3}');
    expect(code).toContain('/static/vue.global.js');
    expect(code).toContain('LMSTelemetry.create');
    expect(code).toContain('totalWaves: 10');
    expect(code).toContain('onAfkStop');
    expect(code).toContain('onAfkRetry');
    expect(code).toContain('id="start-btn"');
    expect(code).toContain('id="alarm-box"');
    expect(code).toContain('id="alarm-count"');
    expect(code).toContain('AudioContext');
    expect(code).toContain('pointer-events: none');
    expect(code).not.toContain('prince_complete');

    for (const allowedCode of ['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'Space', 'Digit']) {
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
    expect(await page.locator('#vue-app input[type="radio"]').count()).toBe(0);
    expect(await page.locator('#vue-app select').count()).toBe(0);
  });

  test('Intro briefing gates timer and telemetry until #start-btn is clicked, and wave timings meet >=30s / >=15s rules', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await expect(page.locator('#start-btn')).toBeVisible();
    await expect(page.locator('#wave-counter-badge')).toBeHidden();

    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-counter-badge')).toBeVisible();
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    const waveSummary = await page.evaluate(() => {
      const waves = window.__DEV_LEVEL3_STATE__.waves;
      return {
        count: waves.length,
        wave1Duration: waves[0].duration,
        minDuration: Math.min(...waves.map(w => w.duration)),
        wave6Duration: waves[5].duration,
        wave7Duration: waves[6].duration
      };
    });

    expect(waveSummary.count).toBe(10);
    expect(waveSummary.wave1Duration).toBeGreaterThanOrEqual(30);
    expect(waveSummary.minDuration).toBeGreaterThanOrEqual(15);
    expect(waveSummary.wave7Duration).toBeGreaterThan(waveSummary.wave6Duration);
  });

  test('Waves 1-10: real keyboard control on Wave 1 + full 10-wave completion with telemetry verification', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    // Solve Wave 1 via real keyboard actions (e.code + no scroll)
    const scrollBefore = await page.evaluate(() => window.scrollY);
    let safety = 0;
    while (safety < 20) {
      safety++;
      const badge = await page.locator('#wave-counter-badge').innerText();
      if (badge.includes('Волна 2 из 10')) break;

      const stepInfo = await page.evaluate(() => {
        const s = window.__DEV_LEVEL3_STATE__;
        return { wave: s.currentWave, step: s.expectedStep };
      });
      if (stepInfo.wave !== 1 || !stepInfo.step || stepInfo.step.action === 'DONE') break;

      if (stepInfo.step.action === 'PUSH') {
        // Focus station 0 (PUSH) if not already
        await page.keyboard.press('KeyA');
        await page.keyboard.press('KeyA');
        await page.keyboard.press('KeyA');
        await page.keyboard.press('KeyA');
        // Better: reset station cleanly via Space after checking cursor text
        for (let k = 0; k < 4; k++) {
          const text = await page.locator('#vue-app').innerText();
          if (text.includes('Курсор: PUSH')) break;
          await page.keyboard.press('KeyD');
        }
        await page.keyboard.press('Space');
      } else if (stepInfo.step.action === 'EVAL') {
        const val = stepInfo.step.expectedAcc;
        const absStr = String(Math.abs(val)).padStart(2, '0');
        await page.keyboard.press(`Digit${absStr[0]}`);
        await page.keyboard.press(`Digit${absStr[1]}`);
        if (val < 0) {
          await page.keyboard.press('ShiftLeft');
        }
        await page.keyboard.press('Space');
      }
      await page.waitForTimeout(40);
    }
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 2 из 10', { timeout: 3000 });

    // Waves 2..10 via __DEV_LEVEL3_STATE__.solveCurrentWave()
    for (let w = 2; w <= 10; w++) {
      await expect(page.locator('#wave-counter-badge')).toContainText(`Волна ${w} из 10`, { timeout: 4000 });
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
      if (w < 10) {
        await page.waitForTimeout(350);
      }
    }

    await expect(page.locator('text=СТЕКОВЫЙ РЕАКТОР СТАБИЛИЗИРОВАН (10 / 10 ВОЛН)')).toBeVisible({ timeout: 5000 });

    const events = await page.evaluate(() => window.__sentTelemetry);
    const completeEvt = events.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
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
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 2 из 10', { timeout: 4000 });

    await page.evaluate(() => {
      window.__DEV_LEVEL3_STATE__.submitAction('fail', { reason: 'Неверная операция над стеком!' });
    });

    await expect(page.locator('#alarm-box')).toBeVisible();
    await expect(page.locator('#alarm-count')).toHaveText('1');

    const failEvents = await page.evaluate(() => window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset'));
    expect(failEvents.length).toBe(1);
    expect(failEvents[0].wave).toBe(2);
    expect(failEvents[0].total_waves).toBe(10);
    expect(failEvents[0].success).toBe(false);

    await page.waitForTimeout(1700);
    await expect(page.locator('#alarm-box')).toBeHidden();
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

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
        mission_name: 'Урок 36 :: Вычисление арифметического выражения, записанного в постфиксной форме (Уровень 3)',
        level: 3,
        wave: 2,
        total_waves: 10,
        success: false,
        start_time: new Date().toISOString(),
        time_spent_sec: 12
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
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    // Wave 1 is 35.0s -> reset delay 1.4s -> 2nd Wave 1 timeout -> AFK overlay
    await page.clock.runFor(35500);
    await page.clock.runFor(1700);
    await page.clock.runFor(35500);

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
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');
  });
});
