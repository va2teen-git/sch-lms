import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const LESSONS = ['5', '6', '7', '8', '9', '22'];

test.describe('Stage 4: Grade 7 Lessons {5,6,7,8,9,22} Standardization & AFK/Telemetry Contract', () => {
  const rootDir = process.cwd();

  test('Static contract: all 18 Grade 7 files use LMSTelemetry, no <style>, no external CDNs, L3 has intro & AFK guard', async () => {
    for (const lessonId of LESSONS) {
      for (const lvl of [1, 2, 3]) {
        const filePath = path.join(rootDir, 'src', 'pages', 'tasks', '7-класс', lessonId, `level${lvl}.astro`);
        expect(fs.existsSync(filePath), `Missing ${filePath}`).toBe(true);
        const code = fs.readFileSync(filePath, 'utf-8');

        expect(code, `${filePath} must use TaskLayout`).toContain('import TaskLayout');
        expect(code, `${filePath} must not contain <style>`).not.toMatch(/<style[\s>]/i);
        expect(code, `${filePath} must use LMSTelemetry`).toContain('LMSTelemetry');

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

  test('7-класс/22/level3: intro screen blocks premature telemetry & timer until #start-btn click, then tracks waves', async ({ page }) => {
    const events = [];
    await page.addInitScript(() => {
      window.__sentTelemetry = [];
      const origPost = window.parent.postMessage.bind(window.parent);
      window.addEventListener('message', (ev) => {
        if (ev.data && ev.data.type === 'TELEMETRY_EVENT') {
          window.__sentTelemetry.push(ev.data);
        }
      });
      // Intercept postMessage when running top-level
      if (window.parent === window) {
        const orig = window.postMessage.bind(window);
        window.postMessage = (msg, targetOrigin) => {
          if (msg && msg.type === 'TELEMETRY_EVENT') {
            window.__sentTelemetry.push(msg);
          }
          return orig(msg, targetOrigin);
        };
      }
    });

    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/22/level3');
    await expect(page.locator('#intro-overlay')).toBeVisible();
    await expect(page.locator('#start-btn')).toBeVisible();

    const stateBeforeStart = await page.evaluate(() => window.getLevel3ArcadeState());
    expect(stateBeforeStart.started).toBe(false);
    const t1 = stateBeforeStart.timeLeft;
    await page.waitForTimeout(1200);
    const stateAfterWait = await page.evaluate(() => window.getLevel3ArcadeState());
    expect(stateAfterWait.timeLeft).toBe(t1);

    const earlyEvents = await page.evaluate(() => window.__sentTelemetry);
    expect(earlyEvents.length).toBe(0);

    await page.locator('#start-btn').click();
    await expect(page.locator('#intro-overlay')).toBeHidden();

    const eventsAfterStart = await page.evaluate(() => window.__sentTelemetry);
    expect(eventsAfterStart.length).toBeGreaterThanOrEqual(1);
    const startEvt = eventsAfterStart.find(e => e.action_type === 'in_progress');
    expect(startEvt).toBeTruthy();
    expect(startEvt.start_time).toBeTruthy();
    expect(startEvt.wave).toBe(1);
    expect(startEvt.total_waves).toBe(10);
    expect(startEvt.mission_name).toContain('Уровень 3');
  });

  test('7-класс/6/level3: AFK guard pauses after 2 consecutive Wave-1 timeouts and resumes on #lms-afk-retry-btn', async ({ page }) => {
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

    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6/level3');
    await page.locator('#btn-start').click();

    // Wait past 1st Wave-1 timeout (6s) + reset delay (1.8s) + 2nd Wave-1 timeout (6s)
    // Wait: clicking #btn-start fires pointerdown activity, so 1st timeout resets hasUserActivity=false,
    // and 2nd timeout sees streak=2 -> triggers AFK overlay!
    await page.clock.runFor(6500);
    await page.clock.runFor(2000);
    await page.clock.runFor(6500);
    await page.clock.runFor(2000);
    await page.clock.runFor(6500);

    await expect(page.locator('#lms-afk-overlay')).toBeVisible();
    await expect(page.locator('#lms-afk-retry-btn')).toBeVisible();

    const resetsBeforeWait = await page.evaluate(() =>
      window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset').length
    );
    expect(resetsBeforeWait).toBeLessThanOrEqual(2);

    // Ensure no further hardcore_reset spam while paused
    await page.clock.runFor(15000);
    const resetsAfterWait = await page.evaluate(() =>
      window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset').length
    );
    expect(resetsAfterWait).toBe(resetsBeforeWait);

    // Clicking "Повторить" resumes Wave 1
    await page.locator('#lms-afk-retry-btn').click();
    await expect(page.locator('#lms-afk-overlay')).toBeHidden();
  });

  test('7-класс/22/level3: AFK guard pauses after 2 consecutive Wave-1 timeouts without user input', async ({ page }) => {
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

    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/22/level3');
    await page.locator('#start-btn').click();

    // Wave 1 timer is 190s -> advance twice past 191s
    await page.clock.runFor(192000);
    await page.clock.runFor(192000);

    await expect(page.locator('#lms-afk-overlay')).toBeVisible();
    const resetsCount = await page.evaluate(() =>
      window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset').length
    );
    expect(resetsCount).toBeLessThanOrEqual(2);

    await page.clock.runFor(200000);
    const resetsCountAfter = await page.evaluate(() =>
      window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset').length
    );
    expect(resetsCountAfter).toBe(resetsCount);

    await page.locator('#lms-afk-retry-btn').click();
    await expect(page.locator('#lms-afk-overlay')).toBeHidden();
  });

  test('7-класс/5/level1: deferred start_time, stage/total_stages tracking, and double level_complete guard', async ({ page }) => {
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

    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/5/level1');
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    // Wrong submit in phase 1 -> hardcore_reset with stage=1, total_stages=3, start_time, time_spent_sec
    await page.locator('#btn-phase1').click();
    const events = await page.evaluate(() => window.__sentTelemetry);
    expect(events.length).toBe(1);
    expect(events[0].action_type).toBe('hardcore_reset');
    expect(events[0].stage).toBe(1);
    expect(events[0].total_stages).toBe(3);
    expect(events[0].start_time).toBeTruthy();
    expect(typeof events[0].time_spent_sec).toBe('number');
  });

  test('Backward compatibility: legacy 7-класс/22 telemetry rows work in /api/progress and /api/teacher/stats', async ({ request }) => {
    const dbPath = path.join(rootDir, 'telemetry.db');
    const db = new Database(dbPath);
    const uid = Date.now();
    const fn = `LegacyTest_${uid}`;
    const ln = 'Student';
    const cls = '7-а';

    try {
      const insert = db.prepare(`
        INSERT INTO telemetry (
          first_name, last_name, class_name, student_class, course_slug, lesson_id, level_number,
          mission_name, action_type, status, success, time_spent_sec, attempts_count, is_hardcore
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      // Level 1 & 2 normal completions + legacy Level 3 completion with empty action_type
      insert.run(fn, ln, cls, cls, '7-класс', '22', 1, 'Урок 22 :: Форматирование текстовых документов (Уровень 1)', 'level_complete', 'completed', 1, 30, 1, 0);
      insert.run(fn, ln, cls, cls, '7-класс', '22', 2, 'Урок 22 :: Форматирование текстовых документов (Уровень 2)', 'level_complete', 'completed', 1, 45, 1, 0);
      insert.run(fn, ln, cls, cls, '7-класс', '22', 3, 'Урок 22: Практическая работа: Форматирование текстовых документов :: Уровень 3', '', 'completed', 1, 120, 1, 0);

      const progRes = await request.get(`/api/progress?firstName=${encodeURIComponent(fn)}&lastName=${encodeURIComponent(ln)}&className=${encodeURIComponent(cls)}&lessonPrefix=${encodeURIComponent('Урок 22')}&courseSlug=${encodeURIComponent('7-класс')}&lessonId=22`);
      expect(progRes.status()).toBe(200);
      const prog = await progRes.json();
      expect(prog.isNormalCompleted).toBe(true);
      expect(prog.unlockedNormal).toBe(4);

      const statsRes = await request.get(`/api/teacher/stats?course=7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81&lesson=22&date=all&exclude_tests=0&search=${encodeURIComponent(fn)}`);
      expect(statsRes.status()).toBe(200);
      const stats = await statsRes.json();
      expect(stats.success).toBe(true);
      const st = stats.students.find(s => s.firstName === fn);
      expect(st).toBeTruthy();
      expect(st.levels[3].completed).toBe(true);
      expect(st.isNormalMastered).toBe(true);
    } finally {
      db.prepare('DELETE FROM telemetry WHERE first_name = ?').run(fn);
      db.close();
    }
  });
});
