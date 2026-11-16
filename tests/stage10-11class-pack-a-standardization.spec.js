import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const TARGET_LESSONS = ['20', '22', '23', '24', '25'];
const TARGET_FILES = TARGET_LESSONS.flatMap((lessonId) =>
  [1, 2, 3].map((level) => ({ lessonId, level }))
);

function attachTelemetrySpy(page) {
  return page.addInitScript(() => {
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

test.describe('Stage 10: Grade 11 Advanced Lessons {20,22,23,24,25} Standardization, AFK Guard & Telemetry Contract', () => {
  const rootDir = process.cwd();

  test('Static contract: all 15 Grade 11 advanced files use TaskLayout + LMSTelemetry, no <style>, no external CDNs, L3 has intro & AFK guard', async () => {
    for (const item of TARGET_FILES) {
      const filePath = path.join(rootDir, 'src', 'pages', 'tasks', '11-класс_углубленный', item.lessonId, `level${item.level}.astro`);
      expect(fs.existsSync(filePath), `Missing ${filePath}`).toBe(true);
      const code = fs.readFileSync(filePath, 'utf-8');

      expect(code, `${filePath} must use TaskLayout`).toContain('import TaskLayout');
      expect(code, `${filePath} must not contain <style>`).not.toMatch(/<style[\s>]/i);
      expect(code, `${filePath} must not use external CDNs`).not.toMatch(/https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/i);
      expect(code, `${filePath} must use LMSTelemetry`).toContain('LMSTelemetry');
      expect(code, `${filePath} must not use raw postMessage`).not.toContain('window.parent.postMessage');
      expect(code, `${filePath} must call .complete(`).toContain('.complete(');
      expect(code, `${filePath} must call .hardcoreReset(`).toContain('.hardcoreReset(');

      if (item.level === 3) {
        expect(code, `${filePath} must have intro/startGame`).toMatch(/intro|startGame|Начать/i);
        expect(code, `${filePath} must handle AFK timeout`).toContain('isTimeout');
        expect(code, `${filePath} must track wave/totalWaves`).toMatch(/totalWaves|advanceWave/);
      } else {
        expect(code, `${filePath} must track stage/totalStages`).toMatch(/totalStages|advanceStage/);
      }
    }
  });

  test('11-класс_углубленный/20/level1: deferred start_time, stage/total_stages & time_spent_sec on hardcore_reset', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(encodeURI('/tasks/11-класс_углубленный/20/level1'));
    await expect(page.locator('#phase1')).toBeVisible();
    await page.waitForTimeout(250);

    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    // Click wrong option in phase 1 or any option; verify event has start_time, time_spent_sec, stage=1, total_stages=3
    await page.locator('#p1-options button').first().click();
    const events = await page.evaluate(() => window.__sentTelemetry);
    expect(events.length).toBe(1);
    expect(events[0].start_time).toBeTruthy();
    expect(typeof events[0].time_spent_sec).toBe('number');
    expect(events[0].total_stages).toBe(3);
    if (events[0].action_type === 'hardcore_reset') {
      expect(events[0].stage).toBe(1);
    } else {
      expect(events[0].action_type).toBe('in_progress');
      expect(events[0].stage).toBe(2);
    }
  });

  test('11-класс_углубленный/22/level2: deferred start_time, stage/total_stages & time_spent_sec on hardcore_reset', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(encodeURI('/tasks/11-класс_углубленный/22/level2'));
    await expect(page.locator('#phase1')).toBeVisible();
    await page.waitForTimeout(250);

    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await page.locator('#p1-input').fill('WRONG_CMD');
    await page.locator('#p1-btn').click();

    const events = await page.evaluate(() => window.__sentTelemetry);
    expect(events.length).toBe(1);
    expect(events[0].action_type).toBe('hardcore_reset');
    expect(events[0].stage).toBe(1);
    expect(events[0].total_stages).toBe(5);
    expect(events[0].start_time).toBeTruthy();
    expect(typeof events[0].time_spent_sec).toBe('number');
  });

  test('11-класс_углубленный/23/level1: deferred start_time, stage/total_stages & time_spent_sec on hardcore_reset', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(encodeURI('/tasks/11-класс_углубленный/23/level1'));
    await expect(page.locator('#phase1')).toBeVisible();
    await page.waitForTimeout(250);

    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    // Unmodified initial word fails phase 1 step
    await page.locator('#p1-submit-step').click();

    const events = await page.evaluate(() => window.__sentTelemetry);
    expect(events.length).toBe(1);
    expect(events[0].action_type).toBe('hardcore_reset');
    expect(events[0].stage).toBe(1);
    expect(events[0].total_stages).toBe(3);
    expect(events[0].start_time).toBeTruthy();
    expect(typeof events[0].time_spent_sec).toBe('number');
  });

  const resetTelemetryCases = [
    { lessonId: '24', level: 1, totalStages: 3, triggerSel: '#p1-verify-btn', inputSel: null },
    { lessonId: '24', level: 2, totalStages: 5, triggerSel: '#p1-btn', inputSel: '#p1-input' },
    { lessonId: '25', level: 1, totalStages: 3, triggerSel: '#p1-verify-btn', inputSel: null },
    { lessonId: '25', level: 2, totalStages: 5, triggerSel: '#p1-btn', inputSel: '#p1-input' }
  ];

  for (const cfg of resetTelemetryCases) {
    test(`11-класс_углубленный/${cfg.lessonId}/level${cfg.level}: hardcore_reset includes start_time, time_spent_sec, stage and total_stages`, async ({ page }) => {
      await attachTelemetrySpy(page);
      await page.goto(encodeURI(`/tasks/11-класс_углубленный/${cfg.lessonId}/level${cfg.level}`));
      await expect(page.locator('#phase1')).toBeVisible();
      await page.waitForTimeout(200);

      expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

      if (cfg.inputSel) {
        await page.locator(cfg.inputSel).fill('999999');
      }
      await page.locator(cfg.triggerSel).click();

      const events = await page.evaluate(() => window.__sentTelemetry);
      expect(events.length).toBe(1);
      expect(events[0].action_type).toBe('hardcore_reset');
      expect(events[0].status).toBe('failed');
      expect(events[0].stage).toBe(1);
      expect(events[0].total_stages).toBe(cfg.totalStages);
      expect(events[0].start_time).toBeTruthy();
      expect(typeof events[0].time_spent_sec).toBe('number');
      expect(events[0].attempts_count).toBe(1);
    });
  }

  const level3AfkCases = [
    { lessonId: '20', waitMs: 10500, resetDelayMs: 2200 },
    { lessonId: '22', waitMs: 10500, resetDelayMs: 1700 },
    { lessonId: '24', waitMs: 10500, resetDelayMs: 1800 },
    { lessonId: '25', waitMs: 10500, resetDelayMs: 2400 }
  ];

  for (const cfg of level3AfkCases) {
    test(`11-класс_углубленный/${cfg.lessonId}/level3: AFK guard pauses after 2 consecutive Wave-1 timeouts and resumes on #lms-afk-retry-btn`, async ({ page }) => {
      await page.clock.install();
      await attachTelemetrySpy(page);

      await page.goto(encodeURI(`/tasks/11-класс_углубленный/${cfg.lessonId}/level3`));
      expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

      await page.locator('#start-btn').click();

      const afterStart = await page.evaluate(() => window.__sentTelemetry);
      const startEvt = afterStart.find((e) => e.action_type === 'in_progress');
      expect(startEvt).toBeTruthy();
      expect(startEvt.start_time).toBeTruthy();
      expect(startEvt.wave).toBe(1);
      expect(startEvt.total_waves).toBe(8);

      // 1st Wave-1 timeout -> hardcore_reset -> reset delay -> 2nd Wave-1 timeout -> AFK pause
      await page.clock.runFor(cfg.waitMs);
      await page.clock.runFor(cfg.resetDelayMs);
      await page.clock.runFor(cfg.waitMs);

      await expect(page.locator('#lms-afk-overlay')).toBeVisible();
      await expect(page.locator('#lms-afk-retry-btn')).toBeVisible();

      const resetsBeforeWait = await page.evaluate(() =>
        window.__sentTelemetry.filter((e) => e.action_type === 'hardcore_reset')
      );
      expect(resetsBeforeWait.length).toBe(1);
      expect(resetsBeforeWait[0].wave).toBe(1);
      expect(resetsBeforeWait[0].total_waves).toBe(8);
      expect(resetsBeforeWait[0].start_time).toBeTruthy();
      expect(typeof resetsBeforeWait[0].time_spent_sec).toBe('number');

      // No further spam while paused
      await page.clock.runFor(cfg.waitMs * 3);
      const resetsAfterWait = await page.evaluate(() =>
        window.__sentTelemetry.filter((e) => e.action_type === 'hardcore_reset').length
      );
      expect(resetsAfterWait).toBe(1);

      // Click "Повторить" -> resumes Wave 1
      await page.locator('#lms-afk-retry-btn').click();
      await expect(page.locator('#lms-afk-overlay')).toBeHidden();
    });
  }

  test('11-класс_углубленный/23/level3: Wave-1 timeout sends wave/total_waves, start_time, time_spent_sec and stops at gameover without infinite loop', async ({ page }) => {
    await page.clock.install();
    await attachTelemetrySpy(page);

    await page.goto(encodeURI('/tasks/11-класс_углубленный/23/level3'));
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await page.locator('#start-btn').click();
    const afterStart = await page.evaluate(() => window.__sentTelemetry);
    const startEvt = afterStart.find((e) => e.action_type === 'in_progress');
    expect(startEvt).toBeTruthy();
    expect(startEvt.wave).toBe(1);
    expect(startEvt.total_waves).toBe(8);
    expect(startEvt.start_time).toBeTruthy();

    await page.clock.runFor(10500);
    await expect(page.locator('#btn-restart')).toBeVisible();

    // No infinite loop spam on gameover
    await page.clock.runFor(25000);
    const resets = await page.evaluate(() =>
      window.__sentTelemetry.filter((e) => e.action_type === 'hardcore_reset')
    );
    expect(resets.length).toBe(1);
    expect(resets[0].wave).toBe(1);
    expect(resets[0].total_waves).toBe(8);
    expect(resets[0].start_time).toBeTruthy();
    expect(typeof resets[0].time_spent_sec).toBe('number');
  });

  test('Telemetry DB aggregation works accurately for 11-класс_углубленный lessons {20,22,23,24,25} in /api/teacher/stats, /api/progress, /api/matrix-progress', async ({ request }) => {
    const courseSlug = '11-класс_углубленный';
    for (const lessonId of [...TARGET_LESSONS, 'all']) {
      const res = await request.get(`/api/teacher/stats?course=${encodeURIComponent(courseSlug)}&lesson=${lessonId}&class=all&date=all&exclude_tests=1`);
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.kpi).toBeDefined();
      expect(Number.isFinite(data.kpi.totalStudents)).toBe(true);
      expect(Number.isFinite(data.kpi.avgTimeSec)).toBe(true);
    }

    const dbPath = path.join(rootDir, 'telemetry.db');
    const db = new Database(dbPath);
    const uid = Date.now();
    const fn = `Stage10Test_${uid}`;
    const ln = 'Grade11Adv';
    const cls = '11-а';

    try {
      const insert = db.prepare(`
        INSERT INTO telemetry (
          first_name, last_name, class_name, student_class, course_slug, lesson_id, level_number,
          mission_name, action_type, status, success, time_spent_sec, attempts_count, is_hardcore,
          stage_current, stage_total, wave_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(fn, ln, cls, cls, courseSlug, '20', 1, 'Урок 20 :: Машина Тьюринга (Уровень 1)', 'level_complete', 'completed', 1, 25, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, courseSlug, '22', 1, 'Урок 22 :: Машина Поста (Уровень 1)', 'level_complete', 'completed', 1, 30, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, courseSlug, '23', 1, 'Урок 23 :: Нормальные алгорифмы Маркова (Уровень 1)', 'level_complete', 'completed', 1, 35, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, courseSlug, '24', 1, 'Урок 24 :: Алгоритмически неразрешимые задачи. Задача останова (Уровень 1)', 'hardcore_reset', 'failed', 0, 12, 1, 0, 1, 3, null);
      insert.run(fn, ln, cls, cls, courseSlug, '24', 1, 'Урок 24 :: Алгоритмически неразрешимые задачи. Задача останова (Уровень 1)', 'level_complete', 'completed', 1, 40, 1, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, courseSlug, '25', 1, 'Урок 25 :: Сложность вычислений (Уровень 1)', 'level_complete', 'completed', 1, 28, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, courseSlug, '25', 2, 'Урок 25 :: Сложность вычислений (Уровень 2)', 'level_complete', 'completed', 1, 45, 1, 0, 5, 5, null);
      insert.run(fn, ln, cls, cls, courseSlug, '25', 3, 'Урок 25 :: Сложность вычислений (Уровень 3)', 'level_complete', 'completed', 1, 60, 0, 0, 8, 8, 8);

      const progRes = await request.get(`/api/progress?firstName=${encodeURIComponent(fn)}&lastName=${encodeURIComponent(ln)}&className=${encodeURIComponent(cls)}&lessonPrefix=${encodeURIComponent('Урок 25')}&courseSlug=${encodeURIComponent(courseSlug)}&lessonId=25`);
      expect(progRes.status()).toBe(200);
      const prog = await progRes.json();
      expect(prog.isNormalCompleted).toBe(true);
      expect(prog.unlockedNormal).toBe(4);

      const matrixRes = await request.get(`/api/matrix-progress?firstName=${encodeURIComponent(fn)}&lastName=${encodeURIComponent(ln)}&className=${encodeURIComponent(cls)}`);
      expect(matrixRes.status()).toBe(200);
      const matrix = await matrixRes.json();
      expect(matrix.lessons[`${courseSlug}::25`].completed).toBe(true);
      expect(matrix.lessons[`${courseSlug}::24`].stoppedLevel).toBe(2);

      const statsRes = await request.get(`/api/teacher/stats?course=${encodeURIComponent(courseSlug)}&lesson=25&date=all&exclude_tests=0&search=${encodeURIComponent(fn)}`);
      expect(statsRes.status()).toBe(200);
      const stats = await statsRes.json();
      const st = stats.students.find((s) => s.firstName === fn);
      expect(st).toBeTruthy();
      expect(st.isNormalMastered).toBe(true);
      expect(st.levels[1].completed).toBe(true);
      expect(st.levels[2].completed).toBe(true);
      expect(st.levels[3].completed).toBe(true);
    } finally {
      db.prepare('DELETE FROM telemetry WHERE first_name = ?').run(fn);
      db.close();
    }
  });
});
