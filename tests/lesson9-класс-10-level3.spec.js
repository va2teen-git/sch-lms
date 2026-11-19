import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const LESSON_TASK_FILE = path.join(process.cwd(), 'src/pages/tasks/9-класс/10/level3.astro');
const TASK_URL = '/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level3';
const LESSON_URL = '/lesson/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10';

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

test.describe('9th Grade Lesson 10: Level 3 ICE Node Race & DAG Arcade Suite', () => {
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
    expect(code).toContain('Урок 10');

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

    await page.waitForTimeout(1100);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    const progressEvts = await page.evaluate(() => window.__sentTelemetry.filter((e) => e.action_type === 'in_progress'));
    expect(progressEvts.length).toBeGreaterThanOrEqual(1);
    expect(progressEvts[0].wave).toBe(1);
    expect(progressEvts[0].total_waves).toBe(10);
  });

  test('Waves 1-10: direct SVG node clicks on Wave 1 + full 10-wave completion with telemetry verification', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();

    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    // Solve Wave 1 directly via SVG node clicks
    const w1Path = await page.evaluate(() => window.__DEV_LEVEL3_STATE__.currentWave.solutionPath);
    expect(Array.isArray(w1Path) && w1Path.length >= 2).toBe(true);
    for (let i = 1; i < w1Path.length; i++) {
      await page.locator(`#graph-svg g[data-node-id="${w1Path[i]}"]`).click();
    }
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 10', { timeout: 3000 });

    // Solve Waves 2..10 via __DEV_LEVEL3_STATE__
    for (let w = 2; w <= 10; w++) {
      await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w} ИЗ 10`, { timeout: 3000 });
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
      if (w < 10) {
        await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w + 1} ИЗ 10`, { timeout: 3000 });
      }
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });

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
    expect(completeEvt.mission_name).toContain('Урок 10');
  });

  test('Hardcore reset on Wave 2 shows #alarm-box, emits hardcore_reset, resets to Wave 1, and blocks Prince bonus gate', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();

    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 10', { timeout: 3000 });

    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.submitAction('fail'));
    await expect(page.locator('#alarm-box')).toBeVisible();

    const failEvents = await page.evaluate(() => window.__sentTelemetry.filter((e) => e.action_type === 'hardcore_reset'));
    expect(failEvents.length).toBe(1);
    expect(failEvents[0].wave).toBe(2);
    expect(failEvents[0].total_waves).toBe(10);
    expect(failEvents[0].success).toBe(false);

    await page.waitForTimeout(1650);
    await expect(page.locator('#alarm-box')).toBeHidden();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    // Verify lesson page hardcore gate keeps Prince bonus sealed
    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Тест');
      localStorage.setItem('student_lastName', 'Графов');
      localStorage.setItem('student_class', '9-класс');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_9-класс_10', 'true');
    });
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto(LESSON_URL);
    await page.evaluate(() => {
      window.postMessage({
        type: 'TELEMETRY_EVENT',
        action_type: 'hardcore_reset',
        mission_name: 'Урок 10 :: Граф. Весовая матрица графа. Длина пути между вершинами графа. Вычисление количества путей в направленном ациклическом графе (Уровень 3)',
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

    // 1st Wave-1 timeout (32s) -> reset delay (1.4s) -> 2nd Wave-1 timeout (32s) -> AFK overlay
    await page.clock.runFor(32500);
    await page.clock.runFor(1600);
    await page.clock.runFor(32500);

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
