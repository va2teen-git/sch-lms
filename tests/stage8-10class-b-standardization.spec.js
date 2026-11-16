import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const LESSONS = ['24', '26', '27', '28', '30'];
const TARGET_FILES = LESSONS.flatMap(lessonId =>
  [1, 2, 3].map(level => ({ lessonId, level }))
);

test.describe('Stage 8: Grade 10 Advanced Lessons {24,26,27,28,30} Standardization, AFK Guard & Telemetry Contract', () => {
  const rootDir = process.cwd();

  test('Static contract: all 15 Grade 10 package B files use TaskLayout + LMSTelemetry, no <style>, no CDNs, L3 has intro & AFK guard', async () => {
    for (const item of TARGET_FILES) {
      const filePath = path.join(rootDir, 'src', 'pages', 'tasks', '10-класс_углубленный', item.lessonId, `level${item.level}.astro`);
      expect(fs.existsSync(filePath), `Missing ${filePath}`).toBe(true);
      const code = fs.readFileSync(filePath, 'utf-8');

      expect(code, `${filePath} must use TaskLayout`).toContain('import TaskLayout');
      expect(code, `${filePath} must not contain <style>`).not.toMatch(/<style[\s>]/i);
      expect(code, `${filePath} must not use external CDNs`).not.toMatch(/https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/i);
      expect(code, `${filePath} must use LMSTelemetry`).toContain('LMSTelemetry');
      expect(code, `${filePath} must call .complete(`).toContain('.complete(');
      expect(code, `${filePath} must call .hardcoreReset(`).toContain('.hardcoreReset(');

      if (item.level === 3) {
        expect(code, `${filePath} must have intro/startGame`).toMatch(/intro|startGame|Начать/i);
        expect(code, `${filePath} must handle AFK timeout`).toContain('isTimeout');
        expect(code, `${filePath} must track wave/totalWaves`).toMatch(/totalWaves|TOTAL_WAVES|advanceWave/);
      } else {
        expect(code, `${filePath} must track stage/totalStages`).toMatch(/totalStages|advanceStage/);
      }
    }
  });

  test('10-класс_углубленный/24/level1: deferred start_time, stage/total_stages, and single-binding listeners across Phase 1 reset', async ({ page }) => {
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

    await page.goto(encodeURI('/tasks/10-класс_углубленный/24/level1'));
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    // Trigger Phase 1 error twice (incomplete pipeline) -> regenerates Phase 1 twice
    await page.locator('#p1-verify-btn').click();
    await page.waitForTimeout(1450);
    await page.locator('#p1-verify-btn').click();
    await page.waitForTimeout(1450);

    const resets = await page.evaluate(() => window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset'));
    expect(resets.length).toBe(2);
    expect(resets[0].stage).toBe(1);
    expect(resets[0].total_stages).toBe(3);
    expect(resets[0].start_time).toBeTruthy();
    expect(typeof resets[0].time_spent_sec).toBe('number');

    // Click first block, then click slot 1 -> block moves cleanly once (no duplicate listeners)
    const firstBlock = page.locator('#p1-blocks-pool .p1-draggable-block').first();
    const blockId = await firstBlock.getAttribute('id');
    await firstBlock.click();
    await page.locator('#phase1 .pipeline-slot[data-slot="1"]').click();

    await expect(page.locator(`#phase1 .pipeline-slot[data-slot="1"] #${blockId}`)).toHaveCount(1);
  });

  test('10-класс_углубленный/24/level2: deferred start_time and stage/total_stages on hardcore_reset', async ({ page }) => {
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

    await page.goto(encodeURI('/tasks/10-класс_углубленный/24/level2'));
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await page.locator('#p1-input-n').fill('9999');
    await page.locator('#p1-input-phi').fill('9999');
    await page.locator('#p1-btn').click();

    const resets = await page.evaluate(() => window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset'));
    expect(resets.length).toBe(1);
    expect(resets[0].stage).toBe(1);
    expect(resets[0].total_stages).toBe(5);
    expect(resets[0].start_time).toBeTruthy();
    expect(typeof resets[0].time_spent_sec).toBe('number');
  });

  const level3AutoAfkCases = [
    { lessonId: '24', totalWaves: 8, waitMs: 10500, resetDelayMs: 1700 },
    { lessonId: '26', totalWaves: 10, waitMs: 10500, resetDelayMs: 1500 },
    { lessonId: '27', totalWaves: 10, waitMs: 9000, resetDelayMs: 2200 },
    { lessonId: '30', totalWaves: 10, waitMs: 12500, resetDelayMs: 1600 }
  ];

  for (const cfg of level3AutoAfkCases) {
    test(`10-класс_углубленный/${cfg.lessonId}/level3: AFK guard pauses after 2 consecutive Wave-1 timeouts, sends wave/time_spent_sec, resumes on #lms-afk-retry-btn`, async ({ page }) => {
      test.setTimeout(60000);
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

      await page.goto(encodeURI(`/tasks/10-класс_углубленный/${cfg.lessonId}/level3`));
      expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

      await page.locator('#start-btn').click();

      const afterStart = await page.evaluate(() => window.__sentTelemetry);
      const startEvt = afterStart.find(e => e.action_type === 'in_progress');
      expect(startEvt).toBeTruthy();
      expect(startEvt.start_time).toBeTruthy();
      expect(startEvt.wave).toBe(1);
      expect(startEvt.total_waves).toBe(cfg.totalWaves);

      // 1st Wave-1 timeout -> hardcore_reset (wave=1) -> reset delay -> 2nd Wave-1 timeout (no input) -> AFK pause
      await page.clock.runFor(cfg.waitMs);
      await page.clock.runFor(cfg.resetDelayMs);
      await page.clock.runFor(cfg.waitMs);

      await expect(page.locator('#lms-afk-overlay')).toBeVisible();
      await expect(page.locator('#lms-afk-retry-btn')).toBeVisible();

      const resetsBeforeWait = await page.evaluate(() =>
        window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset')
      );
      expect(resetsBeforeWait.length).toBe(1);
      expect(resetsBeforeWait[0].wave).toBe(1);
      expect(resetsBeforeWait[0].total_waves).toBe(cfg.totalWaves);
      expect(resetsBeforeWait[0].start_time).toBeTruthy();
      expect(typeof resetsBeforeWait[0].time_spent_sec).toBe('number');

      // No further spam while paused (advance past one full wave + reset window)
      await page.clock.runFor(cfg.waitMs + cfg.resetDelayMs);
      const resetsAfterWait = await page.evaluate(() =>
        window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset').length
      );
      expect(resetsAfterWait).toBe(1);

      // Click "Повторить" -> resumes Wave 1
      await page.locator('#lms-afk-retry-btn').click();
      await expect(page.locator('#lms-afk-overlay')).toBeHidden();
      await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1');
    });
  }

  test('10-класс_углубленный/28/level3: sends wave/total_waves and stops on fail screen without AFK auto-restart loop', async ({ page }) => {
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

    await page.goto(encodeURI('/tasks/10-класс_углубленный/28/level3'));
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await page.locator('#start-btn').click();
    await page.clock.runFor(14500);

    await expect(page.locator('#fail-title')).toBeVisible();
    const resets = await page.evaluate(() => window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset'));
    expect(resets.length).toBe(1);
    expect(resets[0].wave).toBe(1);
    expect(resets[0].total_waves).toBe(10);
    expect(resets[0].start_time).toBeTruthy();
    expect(typeof resets[0].time_spent_sec).toBe('number');

    // No auto-restart spam while sitting on the failed screen
    await page.clock.runFor(16000);
    const resetsAfterWait = await page.evaluate(() => window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset').length);
    expect(resetsAfterWait).toBe(1);
    await expect(page.locator('#fail-title')).toBeVisible();
  });

  test('Telemetry DB aggregation works accurately for 10-класс_углубленный lessons {24,26,27,28,30}, including real stats for 27 and 30', async ({ request }) => {
    const courseEncoded = encodeURIComponent('10-класс_углубленный');
    for (const lessonId of [...LESSONS, 'all']) {
      const res = await request.get(`/api/teacher/stats?course=${courseEncoded}&lesson=${lessonId}&class=all&date=all&exclude_tests=1`);
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.kpi).toBeDefined();
      expect(Number.isFinite(data.kpi.totalStudents)).toBe(true);
      expect(Number.isFinite(data.kpi.avgTimeSec)).toBe(true);
      expect(Number.isFinite(data.kpi.totalErrors)).toBe(true);

      if (lessonId === '27' || lessonId === '30') {
        expect(data.students.length).toBeGreaterThan(0);
        for (const st of data.students) {
          expect(Number.isFinite(st.totalActiveTimeSec)).toBe(true);
          expect(st.totalActiveTimeSec).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(st.totalErrors)).toBe(true);
          expect(st.totalErrors).toBeGreaterThanOrEqual(0);
        }
      }
    }

    const dbPath = path.join(rootDir, 'telemetry.db');
    const db = new Database(dbPath);
    const uid = Date.now();
    const fn = `Stage8Test_${uid}`;
    const ln = 'Grade10B';
    const cls = '10-а';

    try {
      const insert = db.prepare(`
        INSERT INTO telemetry (
          first_name, last_name, class_name, student_class, course_slug, lesson_id, level_number,
          mission_name, action_type, status, success, time_spent_sec, attempts_count, is_hardcore,
          stage_current, stage_total, wave_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(fn, ln, cls, cls, '10-класс_углубленный', '24', 1, 'Урок 24 :: Алгоритм шифрования RSA. Стеганография (Уровень 1)', 'level_complete', 'completed', 1, 35, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, '10-класс_углубленный', '27', 1, 'Урок 27 :: Непрерывные и дискретные величины и сигналы (Уровень 1)', 'level_complete', 'completed', 1, 40, 1, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, '10-класс_углубленный', '30', 1, 'Урок 30 :: Условие Фано (Уровень 1)', 'level_complete', 'completed', 1, 25, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, '10-класс_углубленный', '30', 2, 'Урок 30 :: Условие Фано (Уровень 2)', 'level_complete', 'completed', 1, 45, 1, 0, 5, 5, null);
      insert.run(fn, ln, cls, cls, '10-класс_углубленный', '30', 3, 'Урок 30 :: Условие Фано (Уровень 3)', 'level_complete', 'completed', 1, 60, 0, 0, 10, 10, 10);

      const progRes = await request.get(`/api/progress?firstName=${encodeURIComponent(fn)}&lastName=${encodeURIComponent(ln)}&className=${encodeURIComponent(cls)}&lessonPrefix=${encodeURIComponent('Урок 30')}&courseSlug=${courseEncoded}&lessonId=30`);
      expect(progRes.status()).toBe(200);
      const prog = await progRes.json();
      expect(prog.isNormalCompleted).toBe(true);
      expect(prog.unlockedNormal).toBe(4);

      const matrixRes = await request.get(`/api/matrix-progress?firstName=${encodeURIComponent(fn)}&lastName=${encodeURIComponent(ln)}&className=${encodeURIComponent(cls)}`);
      expect(matrixRes.status()).toBe(200);
      const matrix = await matrixRes.json();
      expect(matrix.lessons['10-класс_углубленный::30'].completed).toBe(true);
      expect(matrix.lessons['10-класс_углубленный::27'].stoppedLevel).toBe(2);

      const statsRes = await request.get(`/api/teacher/stats?course=${courseEncoded}&lesson=30&date=all&exclude_tests=0&search=${encodeURIComponent(fn)}`);
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
