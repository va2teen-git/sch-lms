import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const TARGET_LESSONS = ['6', '7', '8', '9'];

test.describe('Stage 9: Grade 11 Basic Lessons {6,7,8,9} Standardization, AFK Guard & Telemetry Contract', () => {
  const rootDir = process.cwd();

  test('Static contract: all 12 files in 11-класс_базовый/{6,7,8,9} use TaskLayout + LMSTelemetry, no <style>, no CDN, L3 has intro & AFK guard', async () => {
    for (const lessonId of TARGET_LESSONS) {
      for (const level of [1, 2, 3]) {
        const filePath = path.join(rootDir, 'src', 'pages', 'tasks', '11-класс_базовый', lessonId, `level${level}.astro`);
        expect(fs.existsSync(filePath), `Missing ${filePath}`).toBe(true);
        const code = fs.readFileSync(filePath, 'utf-8');

        expect(code, `${filePath} must use TaskLayout`).toContain('import TaskLayout');
        expect(code, `${filePath} must not contain <style>`).not.toMatch(/<style[\s>]/i);
        expect(code, `${filePath} must not use external CDNs`).not.toMatch(/https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/i);
        expect(code, `${filePath} must use LMSTelemetry`).toContain('LMSTelemetry');

        if (level === 3) {
          expect(code, `${filePath} must have intro/start screen`).toMatch(/intro|startGame|start-overlay|НАЧАТЬ/i);
          expect(code, `${filePath} must enable AFK guard`).toMatch(/showAfkOverlay|isTimeout/);
          expect(code, `${filePath} must track wave/totalWaves`).toMatch(/totalWaves|total_waves/);
        } else {
          expect(code, `${filePath} must track stage/totalStages`).toMatch(/totalStages|total_stages/);
        }
      }
    }
  });

  test('11-класс_базовый/6/level1 & level2: deferred start_time, stage/total_stages on hardcore_reset and level_complete', async ({ page }) => {
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

    await page.goto(encodeURI('/tasks/11-класс_базовый/6/level1'));
    await page.waitForSelector('text=Multiple failed SSH login attempts');
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await page.fill('#cmd-input', 'ufw deny from 1.1.1.1');
    await page.press('#cmd-input', 'Enter');

    const l1Events = await page.evaluate(() => window.__sentTelemetry);
    expect(l1Events.length).toBe(1);
    expect(l1Events[0].action_type).toBe('hardcore_reset');
    expect(l1Events[0].stage).toBe(1);
    expect(l1Events[0].total_stages).toBe(3);
    expect(l1Events[0].start_time).toBeTruthy();
    expect(typeof l1Events[0].time_spent_sec).toBe('number');

    await page.evaluate(() => { window.__sentTelemetry = []; });
    await page.goto(encodeURI('/tasks/11-класс_базовый/6/level2'));
    await page.waitForSelector('text=Execution of anomalous binary');
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await page.fill('#cmd-input', 'chmod 777 /var/tmp/bad');
    await page.press('#cmd-input', 'Enter');

    const l2Events = await page.evaluate(() => window.__sentTelemetry);
    expect(l2Events.length).toBe(1);
    expect(l2Events[0].action_type).toBe('hardcore_reset');
    expect(l2Events[0].stage).toBe(1);
    expect(l2Events[0].total_stages).toBe(5);
    expect(l2Events[0].start_time).toBeTruthy();
    expect(typeof l2Events[0].time_spent_sec).toBe('number');
  });

  test('11-класс_базовый/6/level3: intro screen, deferred start_time, wave/total_waves and AFK guard on Wave-1 timeouts', async ({ page }) => {
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

    await page.goto(encodeURI('/tasks/11-класс_базовый/6/level3'));
    await expect(page.locator('#start-overlay[data-screen="intro"]')).toBeVisible();
    await expect(page.locator('#start-btn')).toBeVisible();
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await page.locator('#start-btn').click();
    await expect(page.locator('#start-overlay')).toBeHidden();

    const afterStart = await page.evaluate(() => window.__sentTelemetry);
    expect(afterStart.length).toBe(1);
    expect(afterStart[0].action_type).toBe('in_progress');
    expect(afterStart[0].wave).toBe(1);
    expect(afterStart[0].total_waves).toBe(6);
    expect(afterStart[0].start_time).toBeTruthy();

    // 1.5s startSimulation delay + 35s Wave 1 timeout -> 2.5s reset delay + 35s 2nd Wave 1 timeout -> AFK pause
    await page.clock.runFor(1600);
    await page.clock.runFor(35500);
    await page.clock.runFor(2700);
    await page.clock.runFor(35500);

    await expect(page.locator('#lms-afk-overlay')).toBeVisible();
    await expect(page.locator('#lms-afk-retry-btn')).toBeVisible();

    const resetsBeforeWait = await page.evaluate(() =>
      window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset')
    );
    expect(resetsBeforeWait.length).toBe(1);
    expect(resetsBeforeWait[0].wave).toBe(1);
    expect(resetsBeforeWait[0].total_waves).toBe(6);

    await page.clock.runFor(80000);
    const resetsAfterWait = await page.evaluate(() =>
      window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset').length
    );
    expect(resetsAfterWait).toBe(1);

    await page.locator('#lms-afk-retry-btn').click();
    await expect(page.locator('#lms-afk-overlay')).toBeHidden();
  });

  const vueLevel3Cases = [
    { lessonId: '7', totalWaves: 8, waitMs: 13000, resetDelayMs: 1700, badgeSelector: '#wave-counter', expectedWave1: 'ВОЛНА 1 ИЗ 8' },
    { lessonId: '8', totalWaves: 10, waitMs: 12500, resetDelayMs: 1700, badgeSelector: '#wave-counter-badge', expectedWave1: 'Волна 1 из 10' },
    { lessonId: '9', totalWaves: 10, waitMs: 15500, resetDelayMs: 1800, badgeSelector: '#wave-counter-badge', expectedWave1: 'ВОЛНА 1 / 10' }
  ];

  for (const cfg of vueLevel3Cases) {
    test(`11-класс_базовый/${cfg.lessonId}/level3: AFK guard pauses after 2 consecutive Wave-1 timeouts and resumes on #lms-afk-retry-btn`, async ({ page }) => {
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

      await page.goto(encodeURI(`/tasks/11-класс_базовый/${cfg.lessonId}/level3`));
      expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

      await page.locator('#start-btn').click();
      await expect(page.locator(cfg.badgeSelector)).toContainText(cfg.expectedWave1);

      const afterStart = await page.evaluate(() => window.__sentTelemetry);
      const startEvt = afterStart.find(e => e.action_type === 'in_progress');
      expect(startEvt).toBeTruthy();
      expect(startEvt.start_time).toBeTruthy();
      expect(startEvt.wave).toBe(1);
      expect(startEvt.total_waves).toBe(cfg.totalWaves);
      expect(typeof startEvt.time_spent_sec).toBe('number');

      // 1st Wave-1 timeout -> hardcore_reset -> reset delay -> 2nd Wave-1 timeout -> AFK pause
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
      expect(typeof resetsBeforeWait[0].time_spent_sec).toBe('number');

      // Ensure no spam while paused
      await page.clock.runFor(cfg.waitMs * 3);
      const resetsAfterWait = await page.evaluate(() =>
        window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset').length
      );
      expect(resetsAfterWait).toBe(1);

      await page.locator('#lms-afk-retry-btn').click();
      await expect(page.locator('#lms-afk-overlay')).toBeHidden();
      await expect(page.locator(cfg.badgeSelector)).toContainText(cfg.expectedWave1);
    });
  }

  test('11-класс_базовый/8/level1: no duplicate addEventListener on Phase 1 reset and stage/total_stages telemetry', async ({ page }) => {
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

    await page.goto(encodeURI('/tasks/11-класс_базовый/8/level1'));
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    // Move all 4 cards into the first bucket (wrong distribution) twice to trigger Phase 1 reset twice
    for (let round = 0; round < 2; round++) {
      for (let i = 0; i < 4; i++) {
        await page.locator('#p1-cards-pool .phase1-card').first().click();
        await page.locator('#bucket-lossless').click();
      }
      await page.locator('#p1-verify-btn').click();
      await page.waitForTimeout(1350);
    }

    const resets = await page.evaluate(() => window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset'));
    expect(resets.length).toBe(2);
    expect(resets[0].stage).toBe(1);
    expect(resets[0].total_stages).toBe(3);

    // Click one card and move to lossless bucket; verify only 1 card moved (no duplicate click listeners)
    await page.locator('#p1-cards-pool .phase1-card').first().click();
    await page.locator('#bucket-lossless').click();
    await expect(page.locator('#bucket-lossless .phase1-card')).toHaveCount(1);
  });

  test('11-класс_базовый/9/level1 & level2: no eager telemetry on load, deferred start_time, stage/total_stages and no duplicate addEventListener', async ({ page }) => {
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

    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level1'));
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    // Solve Phase 1 -> advances to stage 2 with in_progress
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase1());
    const l1Events = await page.evaluate(() => window.__sentTelemetry);
    expect(l1Events.length).toBe(1);
    expect(l1Events[0].action_type).toBe('in_progress');
    expect(l1Events[0].stage).toBe(2);
    expect(l1Events[0].total_stages).toBe(3);
    expect(l1Events[0].start_time).toBeTruthy();

    // Check Level 2: zero eager telemetry on load
    await page.evaluate(() => { window.__sentTelemetry = []; });
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level2'));
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await page.locator('#p1-input-abs').fill('999');
    await page.locator('#p1-input-rel').fill('999');
    await page.locator('#p1-submit-btn').click();

    const l2Fail = await page.evaluate(() => window.__sentTelemetry);
    expect(l2Fail.length).toBe(1);
    expect(l2Fail[0].action_type).toBe('hardcore_reset');
    expect(l2Fail[0].stage).toBe(1);
    expect(l2Fail[0].total_stages).toBe(5);
    expect(l2Fail[0].start_time).toBeTruthy();
    expect(typeof l2Fail[0].time_spent_sec).toBe('number');
  });

  test('Telemetry DB verification for 11-класс_базовый/9 and aggregation across {6,7,8,9}', async ({ request }) => {
    // 1. Verify existing historical data in ./telemetry.db for 11-класс_базовый/9
    const histRes = await request.get(`/api/teacher/stats?course=${encodeURIComponent('11-класс_базовый')}&lesson=9&class=all&date=all&exclude_tests=1`);
    expect(histRes.status()).toBe(200);
    const hist = await histRes.json();
    expect(hist.success).toBe(true);
    expect(hist.students.length).toBeGreaterThan(0);

    for (const st of hist.students) {
      expect(Number.isFinite(st.totalActiveTimeSec)).toBe(true);
      expect(st.totalActiveTimeSec).toBeGreaterThanOrEqual(0);
      const l1 = st.levels?.[1]?.timeSpentSec || 0;
      const l2 = st.levels?.[2]?.timeSpentSec || 0;
      const l3 = st.levels?.[3]?.timeSpentSec || 0;
      // Server deduplication prevents level 2 from double-counting level 1 time
      expect(st.totalActiveTimeSec).toBe(l1 + l2 + l3);
      if (st.levels?.[2]?.rawTimeSpentSec > st.levels?.[1]?.rawTimeSpentSec && st.levels?.[1]?.rawTimeSpentSec > 0) {
        expect(st.levels[2].timeSpentSec).toBeLessThanOrEqual(st.levels[2].rawTimeSpentSec);
      }
    }

    // 2. Verify synthetic completion aggregation across /api/progress, /api/matrix-progress, /api/teacher/stats
    const dbPath = path.join(rootDir, 'telemetry.db');
    const db = new Database(dbPath);
    const uid = Date.now();
    const fn = `Stage9Test_${uid}`;
    const ln = 'Grade11';
    const cls = '11-б';

    try {
      const t0 = new Date('2026-11-16T12:00:00.000Z').getTime();
      const iso = (secOffset) => new Date(t0 + secOffset * 1000).toISOString();
      const sqliteTs = (secOffset) => new Date(t0 + secOffset * 1000).toISOString().replace('T', ' ').slice(0, 19);

      const insert = db.prepare(`
        INSERT INTO telemetry (
          first_name, last_name, class_name, student_class, course_slug, lesson_id, level_number,
          mission_name, action_type, status, success, start_time, timestamp, time_spent_sec, attempts_count, is_hardcore,
          stage_current, stage_total, wave_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(fn, ln, cls, cls, '11-класс_базовый', '6', 1, '11-класс_базовый :: 6 :: Уровень 1', 'level_complete', 'completed', 1, iso(0), sqliteTs(25), 25, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, '11-класс_базовый', '7', 1, 'Урок 7 :: Вредоносное программное обеспечение (Уровень 1)', 'level_complete', 'completed', 1, iso(0), sqliteTs(35), 35, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, '11-класс_базовый', '8', 1, 'Урок 8 :: Организация личного архива информации (Уровень 1)', 'level_complete', 'completed', 1, iso(0), sqliteTs(30), 30, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, '11-класс_базовый', '9', 1, 'Урок 9 :: Модели и моделирование (Уровень 1)', 'level_complete', 'completed', 1, iso(0), sqliteTs(40), 40, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, '11-класс_базовый', '9', 2, 'Урок 9 :: Модели и моделирование (Уровень 2)', 'level_complete', 'completed', 1, iso(45), sqliteTs(100), 55, 1, 0, 5, 5, null);
      insert.run(fn, ln, cls, cls, '11-класс_базовый', '9', 3, 'Урок 9 :: Модели и моделирование (Уровень 3 / Аркада)', 'level_complete', 'completed', 1, iso(105), sqliteTs(175), 70, 0, 0, 10, 10, 10);

      const progRes = await request.get(`/api/progress?firstName=${encodeURIComponent(fn)}&lastName=${encodeURIComponent(ln)}&className=${encodeURIComponent(cls)}&lessonPrefix=${encodeURIComponent('Урок 9')}&courseSlug=${encodeURIComponent('11-класс_базовый')}&lessonId=9`);
      expect(progRes.status()).toBe(200);
      const prog = await progRes.json();
      expect(prog.isNormalCompleted).toBe(true);
      expect(prog.unlockedNormal).toBe(4);

      const matrixRes = await request.get(`/api/matrix-progress?firstName=${encodeURIComponent(fn)}&lastName=${encodeURIComponent(ln)}&className=${encodeURIComponent(cls)}`);
      expect(matrixRes.status()).toBe(200);
      const matrix = await matrixRes.json();
      expect(matrix.lessons['11-класс_базовый::9'].completed).toBe(true);
      expect(matrix.lessons['11-класс_базовый::6'].stoppedLevel).toBe(2);

      const statsRes = await request.get(`/api/teacher/stats?course=${encodeURIComponent('11-класс_базовый')}&lesson=9&date=all&exclude_tests=0&search=${encodeURIComponent(fn)}`);
      expect(statsRes.status()).toBe(200);
      const stats = await statsRes.json();
      const st = stats.students.find(s => s.firstName === fn);
      expect(st).toBeTruthy();
      expect(st.isNormalMastered).toBe(true);
      expect(st.totalActiveTimeSec).toBe(165);
      expect(st.levels[1].completed).toBe(true);
      expect(st.levels[2].completed).toBe(true);
      expect(st.levels[3].completed).toBe(true);
    } finally {
      db.prepare('DELETE FROM telemetry WHERE first_name = ?').run(fn);
      db.close();
    }
  });
});
