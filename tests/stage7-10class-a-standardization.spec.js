import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const TARGET_LESSONS = [
  { courseSlug: '10-класс_базовый', lessonId: '7', waves: 8 },
  { courseSlug: '10-класс_базовый', lessonId: '8', waves: 10 },
  { courseSlug: '10-класс_углубленный', lessonId: '19', waves: 6 },
  { courseSlug: '10-класс_углубленный', lessonId: '20', waves: 8 },
  { courseSlug: '10-класс_углубленный', lessonId: '23', waves: 8 }
];

test.describe('Stage 7: Grade 10 Package A ({7,8} basic, {19,20,23} advanced) Standardization & Telemetry', () => {
  const rootDir = process.cwd();

  test('Static contract: all 15 files use TaskLayout + LMSTelemetry, no <style>, no external CDNs, L3 has intro & AFK guard', async () => {
    for (const item of TARGET_LESSONS) {
      for (const level of [1, 2, 3]) {
        const filePath = path.join(rootDir, 'src', 'pages', 'tasks', item.courseSlug, item.lessonId, `level${level}.astro`);
        expect(fs.existsSync(filePath), `Missing ${filePath}`).toBe(true);
        const code = fs.readFileSync(filePath, 'utf-8');

        expect(code, `${filePath} must use TaskLayout`).toContain('import TaskLayout');
        expect(code, `${filePath} must not contain <style>`).not.toMatch(/<style[\s>]/i);
        expect(code, `${filePath} must not use external CDNs`).not.toMatch(/https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/i);
        expect(code, `${filePath} must use LMSTelemetry`).toContain('LMSTelemetry');

        if (item.lessonId !== '19') {
          expect(code, `${filePath} must call .complete(`).toContain('.complete(');
        } else {
          expect(code, `${filePath} must use Terminal component`).toContain('<Terminal');
        }

        if (level === 3) {
          expect(code, `${filePath} must have intro/#start-btn`).toContain('id="start-btn"');
          if (item.lessonId !== '19') {
            expect(code, `${filePath} must handle AFK timeout`).toContain('isTimeout');
            expect(code, `${filePath} must configure onAfkStop`).toContain('onAfkStop');
          } else {
            expect(code, `${filePath} must bind Terminal AFK callbacks`).toContain('onAfkStop');
          }
          expect(code, `${filePath} must track wave/totalWaves`).toMatch(/totalWaves|advanceWave/);
        } else {
          expect(code, `${filePath} must track stage/totalStages`).toMatch(/totalStages|advanceStage/);
        }
      }
    }
  });

  test('10-класс_базовый/7/level1: deferred start_time, no duplicate listeners on reset, stage/total_stages telemetry', async ({ page }) => {
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

    await page.goto(encodeURI('/tasks/10-класс_базовый/7/level1'));
    await expect(page.locator('#phase1-container')).toBeVisible();
    await page.waitForTimeout(250);

    // Zero telemetry before user interacts
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    // Trigger Phase 1 error twice (wrong bucket placement) to ensure initPhase1 re-binds cleanly without duplicates
    for (let attempt = 1; attempt <= 2; attempt++) {
      await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('#p1-cards-pool .draggable-item'));
        const wrongBucket = document.querySelector('.target-bucket[data-category="prefix"] .bucket-slot');
        const nonPrefix = cards.find(c => c.dataset.correctCategory !== 'prefix');
        cards.forEach(c => wrongBucket.appendChild(c));
        if (!nonPrefix) throw new Error('Expected non-prefix card');
        const btn = document.getElementById('p1-submit-btn');
        btn.disabled = false;
        btn.click();
      });
      await expect(page.locator('#feedback-box')).toBeVisible();
      await page.waitForTimeout(1350);
    }

    const resets = await page.evaluate(() => window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset'));
    expect(resets.length).toBe(2);
    expect(resets[0].stage).toBe(1);
    expect(resets[0].total_stages).toBe(3);
    expect(resets[0].start_time).toBeTruthy();
    expect(typeof resets[0].time_spent_sec).toBe('number');

    // Verify click-to-move moves a card cleanly once (no duplicate listener interference)
    const firstCard = page.locator('#p1-cards-pool .draggable-item').first();
    await firstCard.click();
    await page.locator('.target-bucket[data-category="prefix"]').click();
    await expect(page.locator('.target-bucket[data-category="prefix"] .count-badge')).toHaveText('1');
  });

  test('10-класс_базовый/8/level1: deferred start_time, stage/total_stages and single level_complete', async ({ page }) => {
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

    await page.goto(encodeURI('/tasks/10-класс_базовый/8/level1'));
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase1());
    await expect(page.locator('#phase2-container')).toBeVisible();
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase2());
    await expect(page.locator('#phase3-container')).toBeVisible();
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase3());
    await expect(page.locator('#victory-screen')).toBeVisible();

    const events = await page.evaluate(() => window.__sentTelemetry);
    expect(events.filter(e => e.action_type === 'in_progress').map(e => e.stage)).toEqual([2, 3]);
    const completes = events.filter(e => e.action_type === 'level_complete');
    expect(completes.length).toBe(1);
    expect(completes[0].stage).toBe(3);
    expect(completes[0].total_stages).toBe(3);
    expect(completes[0].start_time).toBeTruthy();
    expect(completes[0].time_spent_sec).toBeGreaterThanOrEqual(1);
  });

  test('10-класс_углубленный/23/level2: deferred start_time, stage/total_stages on hardcore_reset and advanceStage', async ({ page }) => {
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

    await page.goto(encodeURI('/tasks/10-класс_углубленный/23/level2'));
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await page.locator('#p1-input').fill('999');
    await page.locator('#p1-btn').click();

    const resets = await page.evaluate(() => window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset'));
    expect(resets.length).toBe(1);
    expect(resets[0].stage).toBe(1);
    expect(resets[0].total_stages).toBe(5);
    expect(resets[0].start_time).toBeTruthy();
    expect(typeof resets[0].time_spent_sec).toBe('number');
  });

  const autoRestartAfkCases = [
    { courseSlug: '10-класс_базовый', lessonId: '7', totalWaves: 8, waitMs: 12500, resetDelayMs: 1600, waveText: 'ВОЛНА 1' },
    { courseSlug: '10-класс_базовый', lessonId: '8', totalWaves: 10, waitMs: 8500, resetDelayMs: 1700, waveText: 'Волна 1' }
  ];

  for (const cfg of autoRestartAfkCases) {
    test(`${cfg.courseSlug}/${cfg.lessonId}/level3: AFK guard pauses after 2 consecutive Wave-1 timeouts and resumes on #lms-afk-retry-btn`, async ({ page }) => {
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

      await page.goto(encodeURI(`/tasks/${cfg.courseSlug}/${cfg.lessonId}/level3`));
      expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

      await page.locator('#start-btn').click();

      const afterStart = await page.evaluate(() => window.__sentTelemetry);
      const startEvt = afterStart.find(e => e.action_type === 'in_progress');
      expect(startEvt).toBeTruthy();
      expect(startEvt.start_time).toBeTruthy();
      expect(startEvt.wave).toBe(1);
      expect(startEvt.total_waves).toBe(cfg.totalWaves);

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

      // No further spam while paused
      await page.clock.runFor(cfg.waitMs * 3);
      const resetsAfterWait = await page.evaluate(() =>
        window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset').length
      );
      expect(resetsAfterWait).toBe(1);

      await page.locator('#lms-afk-retry-btn').click();
      await expect(page.locator('#lms-afk-overlay')).toBeHidden();
      await expect(page.locator('#app, #vue-app')).toContainText(cfg.waveText);
    });
  }

  for (const lessonId of ['20', '23']) {
    test(`10-класс_углубленный/${lessonId}/level3: intro screen + Wave 1 timeout stops cleanly without infinite loop`, async ({ page }) => {
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

      await page.goto(encodeURI(`/tasks/10-класс_углубленный/${lessonId}/level3`));
      await expect(page.locator('#start-btn')).toBeVisible();
      expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

      await page.locator('#start-btn').click();
      const startEvents = await page.evaluate(() => window.__sentTelemetry);
      expect(startEvents[0].wave).toBe(1);
      expect(startEvents[0].total_waves).toBe(8);

      await page.clock.runFor(15000);
      await expect(page.locator('#fail-title')).toBeVisible();

      // Wait another 30s — no additional timeout resets occur
      await page.clock.runFor(30000);
      const resets = await page.evaluate(() =>
        window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset')
      );
      expect(resets.length).toBe(1);
      expect(resets[0].wave).toBe(1);
      expect(resets[0].total_waves).toBe(8);
    });
  }

  test('Telemetry DB aggregation works accurately for Grade 10 Package A in /api/teacher/stats, /api/progress, /api/matrix-progress', async ({ request }) => {
    const basicLessons = ['7', '8', 'all'];
    for (const lessonId of basicLessons) {
      const res = await request.get(`/api/teacher/stats?course=${encodeURIComponent('10-класс_базовый')}&lesson=${lessonId}&class=all&date=all&exclude_tests=1`);
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Number.isFinite(data.kpi.totalStudents)).toBe(true);
      if (lessonId !== 'all') {
        expect(data.students.length).toBeGreaterThan(0);
      }
    }

    const advLessons = ['19', '20', '23', 'all'];
    for (const lessonId of advLessons) {
      const res = await request.get(`/api/teacher/stats?course=${encodeURIComponent('10-класс_углубленный')}&lesson=${lessonId}&class=all&date=all&exclude_tests=1`);
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(Number.isFinite(data.kpi.totalStudents)).toBe(true);
      if (lessonId === '19' || lessonId === '23') {
        expect(data.students.length).toBeGreaterThan(0);
      }
    }

    const dbPath = path.join(rootDir, 'telemetry.db');
    const db = new Database(dbPath);
    const uid = Date.now();
    const fn = `Stage7Test_${uid}`;
    const ln = 'Grade10';
    const cls = '10-а';

    try {
      const insert = db.prepare(`
        INSERT INTO telemetry (
          first_name, last_name, class_name, student_class, course_slug, lesson_id, level_number,
          mission_name, action_type, status, success, time_spent_sec, attempts_count, is_hardcore,
          stage_current, stage_total, wave_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(fn, ln, cls, cls, '10-класс_базовый', '7', 1, 'Урок 7 :: Двоичное кодирование (Уровень 1)', 'level_complete', 'completed', 1, 35, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, '10-класс_углубленный', '23', 1, 'Урок 23 :: Шифрование данных (Уровень 1)', 'level_complete', 'completed', 1, 40, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, '10-класс_углубленный', '23', 2, 'Урок 23 :: Шифрование данных (Уровень 2)', 'level_complete', 'completed', 1, 55, 1, 0, 5, 5, null);
      insert.run(fn, ln, cls, cls, '10-класс_углубленный', '23', 3, 'Урок 23 :: Шифрование данных (Уровень 3)', 'level_complete', 'completed', 1, 70, 0, 0, 8, 8, 8);

      const progRes = await request.get(`/api/progress?firstName=${encodeURIComponent(fn)}&lastName=${encodeURIComponent(ln)}&className=${encodeURIComponent(cls)}&lessonPrefix=${encodeURIComponent('Урок 23')}&courseSlug=${encodeURIComponent('10-класс_углубленный')}&lessonId=23`);
      expect(progRes.status()).toBe(200);
      const prog = await progRes.json();
      expect(prog.isNormalCompleted).toBe(true);
      expect(prog.unlockedNormal).toBe(4);

      const matrixRes = await request.get(`/api/matrix-progress?firstName=${encodeURIComponent(fn)}&lastName=${encodeURIComponent(ln)}&className=${encodeURIComponent(cls)}`);
      expect(matrixRes.status()).toBe(200);
      const matrix = await matrixRes.json();
      expect(matrix.lessons['10-класс_углубленный::23'].completed).toBe(true);
      expect(matrix.lessons['10-класс_базовый::7'].stoppedLevel).toBe(2);

      const statsRes = await request.get(`/api/teacher/stats?course=${encodeURIComponent('10-класс_углубленный')}&lesson=23&date=all&exclude_tests=0&search=${encodeURIComponent(fn)}`);
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
