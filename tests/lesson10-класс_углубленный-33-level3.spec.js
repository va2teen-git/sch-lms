import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const LESSON_TASK_FILE = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/33/level3.astro');
const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33/level3';
const LESSON_URL = '/lesson/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33';

async function attachTelemetrySpy(page) {
  await page.addInitScript(() => {
    window.__sentTelemetry = [];
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'TELEMETRY_EVENT') {
        window.__sentTelemetry.push(event.data);
      }
    });
  });
}

test.describe('10th Grade Advanced Lesson 33: Level 3 Arcade Simulator Suite', () => {
  test('Level 3 adheres to architectural requirements (Vue 3 local, TaskLayout 3, Intro, Zero-Style, AFK, __DEV_LEVEL3_STATE__)', async () => {
    expect(fs.existsSync(LESSON_TASK_FILE), 'level3.astro must exist').toBe(true);
    const code = fs.readFileSync(LESSON_TASK_FILE, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout');
    expect(code).toContain('level={3}');
    expect(code).toContain('/static/vue.global.js');
    expect(code).toContain('createApp(');

    expect(code).toContain('id="start-btn"');
    expect(code).toContain('id="alarm-box"');
    expect(code).toContain('LMSTelemetry.create');
    expect(code).toContain('onAfkStop');
    expect(code).toContain('onAfkRetry');
    expect(code).toContain('isTimeout');
    expect(code).toContain('__DEV_LEVEL3_STATE__');
    expect(code).toContain('Урок 33');

    // Zero-Style, Zero-CDN, single keydown binding, no manual prince_complete
    expect(code).not.toMatch(/<style\b/i);
    expect(code).not.toMatch(/https?:\/\/(?:cdn|unpkg|jsdelivr)/i);
    expect(code).not.toMatch(/prince_complete|prince-campaign/);
    expect((code.match(/addEventListener\('keydown'/g) || []).length).toBe(1);
  });

  test('Intro briefing gates timer and telemetry until #start-btn is clicked', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await expect(page.locator('#start-btn')).toBeVisible();
    await expect(page.locator('#phase-counter')).toBeHidden();

    // Waiting on intro screen must NOT start telemetry or timers
    await page.waitForTimeout(1200);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    const progressEvts = await page.evaluate(() => window.__sentTelemetry.filter((e) => e.action_type === 'in_progress'));
    expect(progressEvts.length).toBeGreaterThanOrEqual(1);
    expect(progressEvts[0].wave).toBe(1);
    expect(progressEvts[0].total_waves).toBe(10);
  });

  test('Waves 1-10: direct bit-bus clicks on Wave 1 + full 10-wave completion with telemetry verification', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();

    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    // Wave 1 solved directly via bit-pin UI clicks (Direct Manipulation)
    const w1Target = await page.evaluate(() => window.__DEV_LEVEL3_STATE__.currentWave.targetValue);
    const weights = [128, 64, 32, 16, 8, 4, 2, 1];
    for (const w of weights) {
      if (w1Target & w) {
        await page.locator('#arcade-app button[aria-pressed]', {
          has: page.locator('span.fs-5', { hasText: new RegExp(`^${w}$`) })
        }).click();
      }
    }
    await page.locator('#commit-frame-btn').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 10', { timeout: 3000 });

    // Solve Waves 2..10 via __DEV_LEVEL3_STATE__
    for (let w = 2; w <= 10; w++) {
      await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w} ИЗ 10`, { timeout: 3000 });
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
      if (w < 10) {
        await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w + 1} ИЗ 10`, { timeout: 3000 });
      }
    }

    await expect(page.locator('h2', { hasText: 'ТРАНСКОДИРОВАНИЕ ЗАВЕРШЕНО!' })).toBeVisible({ timeout: 5000 });

    const completeEvt = await page.evaluate(() =>
      window.__sentTelemetry.find((e) => e.action_type === 'level_complete' && e.success === true)
    );
    expect(completeEvt).toBeDefined();
    expect(completeEvt.wave).toBe(10);
    expect(completeEvt.total_waves).toBe(10);
    expect(completeEvt.stage).toBe(10);
    expect(completeEvt.total_stages).toBe(10);
    expect(completeEvt.start_time).toBeTruthy();
    expect(completeEvt.time_spent_sec).toBeGreaterThanOrEqual(1);
    expect(completeEvt.mission_name).toContain('Урок 33');
  });

  test('Hardcore reset on Wave 2 shows #alarm-box, emits hardcore_reset, resets to Wave 1, and blocks Prince bonus gate', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();

    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 10', { timeout: 3000 });

    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.submitAction('wrong'));
    await expect(page.locator('#alarm-box')).toBeVisible();

    const failEvents = await page.evaluate(() => window.__sentTelemetry.filter((e) => e.action_type === 'hardcore_reset'));
    expect(failEvents.length).toBe(1);
    expect(failEvents[0].wave).toBe(2);
    expect(failEvents[0].total_waves).toBe(10);
    expect(failEvents[0].success).toBe(false);

    // Wait for hardcore reset delay (1700ms)
    await page.waitForTimeout(1900);
    await expect(page.locator('#alarm-box')).toBeHidden();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    // Verify lesson page hardcore gate keeps Prince bonus sealed
    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Тест');
      localStorage.setItem('student_lastName', 'Технарь');
      localStorage.setItem('student_class', '10-класс_углубленный');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_10-класс_углубленный_33', 'true');
    });
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto(LESSON_URL);
    await page.evaluate(() => {
      window.postMessage({
        type: 'TELEMETRY_EVENT',
        action_type: 'hardcore_reset',
        mission_name: 'Урок 33 :: Перевод чисел из одной системы счисления в другую (Уровень 3)',
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
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    // 1st Wave-1 timeout (14s) -> reset delay (1.7s) -> 2nd Wave-1 timeout (14s) -> AFK overlay
    await page.clock.runFor(14500);
    await page.clock.runFor(1900);
    await page.clock.runFor(14500);

    await expect(page.locator('#lms-afk-overlay')).toBeVisible();
    await expect(page.locator('#lms-afk-retry-btn')).toBeVisible();

    const resetsBeforeWait = await page.evaluate(() =>
      window.__sentTelemetry.filter((e) => e.action_type === 'hardcore_reset')
    );
    expect(resetsBeforeWait.length).toBe(1);
    expect(resetsBeforeWait[0].wave).toBe(1);
    expect(resetsBeforeWait[0].total_waves).toBe(10);

    // Ensure no further reset spam while paused
    await page.clock.runFor(30000);
    const resetsAfterWait = await page.evaluate(() =>
      window.__sentTelemetry.filter((e) => e.action_type === 'hardcore_reset').length
    );
    expect(resetsAfterWait).toBe(1);

    await page.locator('#lms-afk-retry-btn').click();
    await expect(page.locator('#lms-afk-overlay')).toBeHidden();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');
  });
});
