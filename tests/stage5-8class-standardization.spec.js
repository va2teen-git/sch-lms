import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const LESSONS = ['6', '7', '8', '9', '10'];

test.describe('Stage 5: Grade 8 Lessons {6,7,8,9,10} Standardization, AFK Guard & Telemetry Contract', () => {
  const rootDir = process.cwd();

  test('Static contract: all 15 Grade 8 files use LMSTelemetry, no <style>, no external CDNs, L3 has intro & AFK guard', async () => {
    for (const lessonId of LESSONS) {
      for (const lvl of [1, 2, 3]) {
        const filePath = path.join(rootDir, 'src', 'pages', 'tasks', '8-класс', lessonId, `level${lvl}.astro`);
        expect(fs.existsSync(filePath), `Missing ${filePath}`).toBe(true);
        const code = fs.readFileSync(filePath, 'utf-8');

        expect(code, `${filePath} must use TaskLayout`).toContain('import TaskLayout');
        expect(code, `${filePath} must not contain <style>`).not.toMatch(/<style[\s>]/i);
        expect(code, `${filePath} must not use external CDNs`).not.toMatch(/https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/i);
        expect(code, `${filePath} must use LMSTelemetry`).toContain('LMSTelemetry');
        expect(code, `${filePath} must call .complete(`).toContain('.complete(');

        if (lvl === 3) {
          expect(code, `${filePath} must have intro/startGame`).toMatch(/intro|startGame|Начать/i);
          expect(code, `${filePath} must handle AFK timeout`).toContain('isTimeout');
          expect(code, `${filePath} must track wave/totalWaves`).toMatch(/totalWaves|advanceWave/);
        } else {
          expect(code, `${filePath} must track stage/totalStages`).toMatch(/totalStages|advanceStage/);
        }
      }
    }
  });

  const level3AfkCases = [
    { lessonId: '6', startBtn: '#start-btn', waitMs: 65000, resetDelayMs: 3500, eventType: 'level_fail' },
    { lessonId: '7', startBtn: '#start-btn', waitMs: 8000, resetDelayMs: 2200, eventType: 'hardcore_reset' },
    { lessonId: '8', startBtn: '#btn-start', waitMs: 15000, resetDelayMs: 2500, eventType: 'hardcore_reset' },
    { lessonId: '9', startBtn: '#start-btn', waitMs: 8000, resetDelayMs: 1500, eventType: 'hardcore_reset' },
    { lessonId: '10', startBtn: '#start-btn', waitMs: 8000, resetDelayMs: 1500, eventType: 'hardcore_reset' }
  ];

  for (const cfg of level3AfkCases) {
    test(`8-класс/${cfg.lessonId}/level3: AFK guard pauses after 2 consecutive Wave-1 timeouts and resumes on #lms-afk-retry-btn`, async ({ page }) => {
      await page.clock.install();
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

      await page.goto(`/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/${cfg.lessonId}/level3`);

      // Verify zero telemetry before clicking Start
      const preStart = await page.evaluate(() => window.__sentTelemetry.length);
      expect(preStart).toBe(0);

      await page.locator(cfg.startBtn).click();

      const afterStart = await page.evaluate(() => window.__sentTelemetry);
      const startEvt = afterStart.find(e => e.action_type === 'in_progress');
      expect(startEvt).toBeTruthy();
      expect(startEvt.start_time).toBeTruthy();
      expect(startEvt.wave).toBe(1);
      expect(startEvt.total_waves).toBeGreaterThanOrEqual(8);

      // 1st Wave-1 timeout (after user clicked start) -> reset -> 2nd Wave-1 timeout (no user input) -> AFK overlay
      await page.clock.runFor(cfg.waitMs);
      await page.clock.runFor(cfg.resetDelayMs);
      await page.clock.runFor(cfg.waitMs);

      await expect(page.locator('#lms-afk-overlay')).toBeVisible();
      await expect(page.locator('#lms-afk-retry-btn')).toBeVisible();

      const resetsBeforeWait = await page.evaluate((evType) =>
        window.__sentTelemetry.filter(e => e.action_type === evType).length,
      cfg.eventType);
      expect(resetsBeforeWait).toBe(1);

      // Ensure no further timeout spam while paused
      await page.clock.runFor(cfg.waitMs * 2);
      const resetsAfterWait = await page.evaluate((evType) =>
        window.__sentTelemetry.filter(e => e.action_type === evType).length,
      cfg.eventType);
      expect(resetsAfterWait).toBe(resetsBeforeWait);

      // Clicking "Повторить" resumes Wave 1
      await page.locator('#lms-afk-retry-btn').click();
      await expect(page.locator('#lms-afk-overlay')).toBeHidden();
    });
  }

  test('8-класс/6/level1: deferred start_time, stage/total_stages tracking, and double complete guard', async ({ page }) => {
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

    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6/level1');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    // Wrong answer in phase 1 -> hardcore_reset with stage=1, total_stages=3, start_time, time_spent_sec
    await page.locator('#p1-input').fill('9999');
    await page.locator('#p1-btn').click();

    const evts = await page.evaluate(() => window.__sentTelemetry);
    expect(evts.length).toBe(1);
    expect(evts[0].action_type).toBe('hardcore_reset');
    expect(evts[0].stage).toBe(1);
    expect(evts[0].total_stages).toBe(3);
    expect(evts[0].start_time).toBeTruthy();
    expect(typeof evts[0].time_spent_sec).toBe('number');
  });

  test('8-класс/10/level1: double finish/complete guard sends level_complete strictly once', async ({ page }) => {
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

    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level1');
    await page.evaluate(() => {
      window.__DEV_LEVEL1_STATE__.solvePhase1();
      window.__DEV_LEVEL1_STATE__.solvePhase2();
      window.__DEV_LEVEL1_STATE__.solvePhase3();
      // Attempt duplicate click on verify button
      document.getElementById('p3-verify-btn').click();
    });

    const evts = await page.evaluate(() => window.__sentTelemetry);
    const completes = evts.filter(e => e.action_type === 'level_complete');
    expect(completes.length).toBe(1);
    expect(completes[0].stage).toBe(3);
    expect(completes[0].total_stages).toBe(3);
    expect(completes[0].start_time).toBeTruthy();
    expect(completes[0].time_spent_sec).toBeGreaterThanOrEqual(1);
  });

  test('Telemetry DB aggregation works accurately for 8-класс across lessons 6..10 in /api/teacher/stats, /api/progress, /api/matrix-progress', async ({ request }) => {
    // 1. Check real production aggregation on ./telemetry.db for 8-класс
    for (const lessonId of ['6', '7', '8', 'all']) {
      const res = await request.get(`/api/teacher/stats?course=8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81&lesson=${lessonId}&class=all&date=all&exclude_tests=1`);
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.kpi).toBeDefined();
      expect(Number.isFinite(data.kpi.totalStudents)).toBe(true);
      expect(Number.isFinite(data.kpi.avgTimeSec)).toBe(true);
      if (lessonId === '6' || lessonId === '7' || lessonId === '8') {
        expect(data.students.length).toBeGreaterThan(0);
      }
    }

    // 2. Insert synthetic Grade 8 student covering lessons 6..10 and verify /api/progress, /api/matrix-progress, /api/teacher/stats
    const dbPath = path.join(rootDir, 'telemetry.db');
    const db = new Database(dbPath);
    const uid = Date.now();
    const fn = `Stage5Test_${uid}`;
    const ln = 'Grade8';
    const cls = '8-а';

    try {
      const insert = db.prepare(`
        INSERT INTO telemetry (
          first_name, last_name, class_name, student_class, course_slug, lesson_id, level_number,
          mission_name, action_type, status, success, time_spent_sec, attempts_count, is_hardcore,
          stage_current, stage_total, wave_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(fn, ln, cls, cls, '8-класс', '6', 1, 'Урок 6 :: Уровень 1 (Системы счисления)', 'level_complete', 'completed', 1, 25, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, '8-класс', '6', 2, 'Урок 6 :: Уровень 2 (Системы счисления)', 'level_complete', 'completed', 1, 35, 0, 0, 5, 5, null);
      insert.run(fn, ln, cls, cls, '8-класс', '6', 3, 'Урок 6 :: Уровень 3 (Системы счисления)', 'level_complete', 'completed', 1, 55, 0, 0, 10, 10, 10);
      insert.run(fn, ln, cls, cls, '8-класс', '9', 1, 'Урок 9 :: Определение истинности составного высказывания (Уровень 1)', 'level_complete', 'completed', 1, 40, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, '8-класс', '10', 2, 'Урок 10 :: Таблицы истинности (Уровень 2)', 'in_progress', 'in_progress', 0, 20, 0, 0, 2, 5, null);

      const progRes = await request.get(`/api/progress?firstName=${encodeURIComponent(fn)}&lastName=${encodeURIComponent(ln)}&className=${encodeURIComponent(cls)}&lessonPrefix=${encodeURIComponent('Урок 6')}&courseSlug=${encodeURIComponent('8-класс')}&lessonId=6`);
      expect(progRes.status()).toBe(200);
      const prog = await progRes.json();
      expect(prog.isNormalCompleted).toBe(true);
      expect(prog.unlockedNormal).toBe(4);

      const matrixRes = await request.get(`/api/matrix-progress?firstName=${encodeURIComponent(fn)}&lastName=${encodeURIComponent(ln)}&className=${encodeURIComponent(cls)}`);
      expect(matrixRes.status()).toBe(200);
      const matrix = await matrixRes.json();
      expect(matrix.lessons['8-класс::6'].completed).toBe(true);
      expect(matrix.lessons['8-класс::9'].completed).toBe(false);
      expect(matrix.lessons['8-класс::9'].stoppedLevel).toBe(2);
      expect(matrix.lessons['8-класс::10'].stoppedLevel).toBe(1);

      const statsRes = await request.get(`/api/teacher/stats?course=8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81&lesson=6&date=all&exclude_tests=0&search=${encodeURIComponent(fn)}`);
      expect(statsRes.status()).toBe(200);
      const stats = await statsRes.json();
      const st = stats.students.find(s => s.firstName === fn);
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
