import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const TARGET_FILES = [
  { lessonId: '5', level: 1 },
  { lessonId: '7', level: 1 },
  { lessonId: '7', level: 2 },
  { lessonId: '7', level: 3 },
  { lessonId: '8', level: 1 },
  { lessonId: '8', level: 2 },
  { lessonId: '8', level: 3 }
];

test.describe('Stage 6: Grade 9 Lessons {5,7,8} Standardization, AFK Guard & Telemetry Contract', () => {
  const rootDir = process.cwd();

  test('Static contract: all 7 Grade 9 files use TaskLayout + LMSTelemetry, no <style>, no external CDNs, L3 has intro & AFK guard', async () => {
    for (const item of TARGET_FILES) {
      const filePath = path.join(rootDir, 'src', 'pages', 'tasks', '9-класс', item.lessonId, `level${item.level}.astro`);
      expect(fs.existsSync(filePath), `Missing ${filePath}`).toBe(true);
      const code = fs.readFileSync(filePath, 'utf-8');

      expect(code, `${filePath} must use TaskLayout`).toContain('import TaskLayout');
      expect(code, `${filePath} must not contain <style>`).not.toMatch(/<style[\s>]/i);
      expect(code, `${filePath} must not use external CDNs`).not.toMatch(/https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/i);
      expect(code, `${filePath} must use LMSTelemetry`).toContain('LMSTelemetry');
      expect(code, `${filePath} must call .complete(`).toContain('.complete(');

      if (item.level === 3) {
        expect(code, `${filePath} must have intro/startGame`).toMatch(/intro|startGame|Начать/i);
        expect(code, `${filePath} must handle AFK timeout`).toContain('isTimeout');
        expect(code, `${filePath} must track wave/totalWaves`).toMatch(/totalWaves|advanceWave/);
      } else {
        expect(code, `${filePath} must track stage/totalStages`).toMatch(/totalStages|advanceStage/);
      }
    }
  });

  test('9-класс/5/level1: deferred start_time, stage/total_stages on hardcore_reset, advanceStage and level_complete', async ({ page }) => {
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

    await page.goto(encodeURI('/tasks/9-класс/5/level1'));
    await expect(page.locator('#instruction-panel')).toBeVisible();
    await expect(page.locator('.jodit-wysiwyg')).toBeVisible();
    await page.waitForTimeout(300);

    // Zero telemetry before user interacts
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    // Submit empty doc -> hardcore_reset with stage=1, total_stages=3, start_time, time_spent_sec
    await page.locator('#check-btn').click();
    const afterFail = await page.evaluate(() => window.__sentTelemetry);
    expect(afterFail.length).toBe(1);
    expect(afterFail[0].action_type).toBe('hardcore_reset');
    expect(afterFail[0].stage).toBe(1);
    expect(afterFail[0].total_stages).toBe(3);
    expect(afterFail[0].start_time).toBeTruthy();
    expect(typeof afterFail[0].time_spent_sec).toBe('number');

    // Wait for phase regeneration (1.5s)
    await page.waitForTimeout(1650);

    // Solve all 3 phases using WYSIWYG formatting
    for (let phase = 1; phase <= 3; phase++) {
      await expect(page.locator('#phase-counter')).toHaveText(String(phase));
      const taskInfo = await page.evaluate(() => {
        const panel = document.getElementById('instruction-panel');
        return {
          sentence: panel?.querySelector('.text-info')?.textContent?.replace(/^"|"$/g, '').trim() || '',
          targetWord: panel?.querySelector('.text-warning')?.textContent?.replace(/[«»]/g, '').trim() || '',
          formatLabel: panel?.querySelector('.text-danger')?.textContent?.trim() || ''
        };
      });

      let tag = 'strong';
      if (taskInfo.formatLabel.includes('КУРСИВОМ')) tag = 'em';
      else if (taskInfo.formatLabel.includes('ПОДЧЕРКНУТЫМ')) tag = 'u';

      const formatted = taskInfo.sentence.replace(taskInfo.targetWord, `<${tag}>${taskInfo.targetWord}</${tag}>`);
      await page.locator('.jodit-wysiwyg').evaluate((el, html) => {
        el.innerHTML = `<p>${html}</p>`;
      }, formatted);

      await page.locator('#check-btn').click();
      if (phase < 3) {
        await expect(page.locator('#phase-counter')).toHaveText(String(phase + 1), { timeout: 5000 });
        await page.waitForTimeout(1600);
      }
    }

    await expect(page.locator('#instruction-panel')).toContainText('ЗАДАНИЕ УСПЕШНО ВЫПОЛНЕНО');

    const allEvents = await page.evaluate(() => window.__sentTelemetry);
    const inProgressStages = allEvents.filter(e => e.action_type === 'in_progress').map(e => e.stage);
    expect(inProgressStages).toEqual([2, 3]);
    const completes = allEvents.filter(e => e.action_type === 'level_complete');
    expect(completes.length).toBe(1);
    expect(completes[0].stage).toBe(3);
    expect(completes[0].total_stages).toBe(3);
    expect(completes[0].start_time).toBeTruthy();
    expect(completes[0].time_spent_sec).toBeGreaterThanOrEqual(1);
  });

  test('9-класс/7/level2: deferred start_time, stage/total_stages in hardcore_reset and in_progress', async ({ page }) => {
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

    await page.goto(encodeURI('/tasks/9-класс/7/level2'));
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    // Wrong answer in phase 1
    await page.locator('#p1-input').fill('99999');
    await page.locator('#p1-btn').click();

    const afterFail = await page.evaluate(() => window.__sentTelemetry);
    expect(afterFail.length).toBe(1);
    expect(afterFail[0].action_type).toBe('hardcore_reset');
    expect(afterFail[0].stage).toBe(1);
    expect(afterFail[0].total_stages).toBe(5);
    expect(afterFail[0].start_time).toBeTruthy();
    expect(typeof afterFail[0].time_spent_sec).toBe('number');

    await page.waitForTimeout(1300);

    // Solve phase 1 -> advances to stage 2 with in_progress
    const delta = await page.evaluate(() => {
      const xt = parseInt(document.getElementById('p1-x-true').textContent, 10);
      const xm = parseInt(document.getElementById('p1-x-model').textContent, 10);
      return Math.abs(xm - xt);
    });
    await page.locator('#p1-input').fill(String(delta));
    await page.locator('#p1-btn').click();

    await expect(page.locator('#phase2')).toBeVisible();
    const afterAdvance = await page.evaluate(() => window.__sentTelemetry);
    const adv = afterAdvance.find(e => e.action_type === 'in_progress');
    expect(adv).toBeTruthy();
    expect(adv.stage).toBe(2);
    expect(adv.total_stages).toBe(5);
  });

  test('9-класс/8/level1: no duplicate addEventListener on Phase 1 reset and single telemetry per action', async ({ page }) => {
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

    await page.goto(encodeURI('/tasks/9-класс/8/level1'));
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    // Trigger Phase 1 error (incomplete distribution) twice -> regenerates Phase 1 twice
    await page.locator('#verify-btn').click();
    await page.waitForTimeout(1400);
    await page.locator('#verify-btn').click();
    await page.waitForTimeout(1400);

    const resets = await page.evaluate(() => window.__sentTelemetry.filter(e => e.action_type === 'hardcore_reset'));
    expect(resets.length).toBe(2);
    expect(resets[0].stage).toBe(1);
    expect(resets[0].total_stages).toBe(3);

    // Click first card, then click bin-os; verify card moved cleanly once and counter is 1
    const firstCard = page.locator('#cards-pool .draggable-card').first();
    await firstCard.click();
    await page.locator('#bin-os').click();

    await expect(page.locator('#count-os')).toHaveText('1');
    await expect(page.locator('#items-os .draggable-card')).toHaveCount(1);
  });

  const level3AfkCases = [
    { lessonId: '7', totalWaves: 8, waitMs: 12500, resetDelayMs: 1600 },
    { lessonId: '8', totalWaves: 10, waitMs: 14500, resetDelayMs: 1500 }
  ];

  for (const cfg of level3AfkCases) {
    test(`9-класс/${cfg.lessonId}/level3: AFK guard pauses after 2 consecutive Wave-1 timeouts and resumes on #lms-afk-retry-btn`, async ({ page }) => {
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

      await page.goto(encodeURI(`/tasks/9-класс/${cfg.lessonId}/level3`));
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

      // No further spam while paused
      await page.clock.runFor(cfg.waitMs * 3);
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

  test('Telemetry DB aggregation works accurately for 9-класс lessons {5,7,8} in /api/teacher/stats, /api/progress, /api/matrix-progress', async ({ request }) => {
    for (const lessonId of ['5', '7', '8', 'all']) {
      const res = await request.get(`/api/teacher/stats?course=9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81&lesson=${lessonId}&class=all&date=all&exclude_tests=1`);
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.kpi).toBeDefined();
      expect(Number.isFinite(data.kpi.totalStudents)).toBe(true);
      expect(Number.isFinite(data.kpi.avgTimeSec)).toBe(true);
      if (lessonId === '7' || lessonId === '8') {
        expect(data.students.length).toBeGreaterThan(0);
      }
    }

    const dbPath = path.join(rootDir, 'telemetry.db');
    const db = new Database(dbPath);
    const uid = Date.now();
    const fn = `Stage6Test_${uid}`;
    const ln = 'Grade9';
    const cls = '9-а';

    try {
      const insert = db.prepare(`
        INSERT INTO telemetry (
          first_name, last_name, class_name, student_class, course_slug, lesson_id, level_number,
          mission_name, action_type, status, success, time_spent_sec, attempts_count, is_hardcore,
          stage_current, stage_total, wave_number
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      insert.run(fn, ln, cls, cls, '9-класс', '5', 1, 'Урок 5 :: Навыки форматирования документов (Уровень 1)', 'level_complete', 'completed', 1, 30, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, '9-класс', '7', 1, 'Урок 7 :: Модели и моделирование. Классификации моделей (Уровень 1)', 'level_complete', 'completed', 1, 40, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, '9-класс', '8', 1, 'Урок 8 :: Табличные модели (Уровень 1)', 'level_complete', 'completed', 1, 25, 0, 0, 3, 3, null);
      insert.run(fn, ln, cls, cls, '9-класс', '8', 2, 'Урок 8 :: Табличные модели (Уровень 2)', 'level_complete', 'completed', 1, 45, 1, 0, 5, 5, null);
      insert.run(fn, ln, cls, cls, '9-класс', '8', 3, 'Урок 8 :: Табличные модели (Уровень 3 / Аркада)', 'level_complete', 'completed', 1, 60, 0, 0, 10, 10, 10);

      const progRes = await request.get(`/api/progress?firstName=${encodeURIComponent(fn)}&lastName=${encodeURIComponent(ln)}&className=${encodeURIComponent(cls)}&lessonPrefix=${encodeURIComponent('Урок 8')}&courseSlug=${encodeURIComponent('9-класс')}&lessonId=8`);
      expect(progRes.status()).toBe(200);
      const prog = await progRes.json();
      expect(prog.isNormalCompleted).toBe(true);
      expect(prog.unlockedNormal).toBe(4);

      const matrixRes = await request.get(`/api/matrix-progress?firstName=${encodeURIComponent(fn)}&lastName=${encodeURIComponent(ln)}&className=${encodeURIComponent(cls)}`);
      expect(matrixRes.status()).toBe(200);
      const matrix = await matrixRes.json();
      expect(matrix.lessons['9-класс::8'].completed).toBe(true);
      expect(matrix.lessons['9-класс::7'].stoppedLevel).toBe(2);

      const statsRes = await request.get(`/api/teacher/stats?course=9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81&lesson=8&date=all&exclude_tests=0&search=${encodeURIComponent(fn)}`);
      expect(statsRes.status()).toBe(200);
      const stats = await resJsonOrThrow(statsRes);
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

async function resJsonOrThrow(res) {
  expect(res.status()).toBe(200);
  return res.json();
}
