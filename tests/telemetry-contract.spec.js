import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';

test.describe('Telemetry & Database Contract Integrity', () => {
  const dbPath = path.join(process.cwd(), 'telemetry.db');

  test('Database schema contains all required telemetry columns', async () => {
    const db = new Database(dbPath);
    const columns = db.prepare("PRAGMA table_info(telemetry)").all();
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('mission_name');
    expect(columnNames).toContain('action_type');
    expect(columnNames).toContain('time_spent_sec');
    expect(columnNames).toContain('attempts_count');
    expect(columnNames).toContain('success');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('action_log');
    expect(columnNames).toContain('is_hardcore');
    expect(columnNames).toContain('student_class');
    expect(columnNames).toContain('course_slug');
    expect(columnNames).toContain('lesson_id');
    expect(columnNames).toContain('level_number');
    expect(columnNames).toContain('attempt_id');
    expect(columnNames).toContain('attempt_number');
    expect(columnNames).toContain('attempt_mode');
    expect(columnNames).toContain('stage_current');
    expect(columnNames).toContain('stage_total');
    expect(columnNames).toContain('wave_number');
    expect(columnNames).toContain('timestamp');

    const indexList = db.prepare("PRAGMA index_list(telemetry)").all();
    const indexNames = indexList.map(i => i.name);
    expect(indexNames).toContain('idx_telemetry_sprint');

    db.close();
  });

  test('POST /api/telemetry inserts valid completion record', async ({ request }) => {
    const testMission = `Урок 20 :: Автотест Проверка (Уровень 1) [${Date.now()}]`;
    const payload = {
      student_firstName: 'Тест',
      student_lastName: 'Автоматический',
      student_class: '11-ИТ',
      course_slug: '11-класс_углубленный',
      lesson_id: '20',
      level_number: 1,
      mission_name: testMission,
      action_type: 'level_complete',
      start_time: new Date().toISOString(),
      time_spent_sec: 42,
      attempts_count: 1,
      success: true,
      status: 'completed',
      is_hardcore: false,
      action_log: [{ time: new Date().toISOString(), action: 'test_action' }]
    };

    const baseUrl = process.env.BASE_URL || 'http://localhost:4321';
    const res = await request.post(`${baseUrl}/api/telemetry`, {
      data: payload,
      headers: { 'Content-Type': 'application/json' }
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify row in database
    const db = new Database(dbPath);
    const row = db.prepare("SELECT * FROM telemetry WHERE mission_name = ?").get(testMission);
    expect(row).toBeDefined();
    expect(row.action_type).toBe('level_complete');
    expect(row.time_spent_sec).toBe(42);
    expect(row.attempts_count).toBe(1);
    expect(row.success).toBe(1);
    expect(row.is_hardcore).toBe(0);
    expect(row.student_class).toBe('11-ИТ');
    expect(row.course_slug).toBe('11-класс_углубленный');
    expect(row.lesson_id).toBe('20');
    expect(row.level_number).toBe(1);

    const parsedLog = JSON.parse(row.action_log);
    expect(Array.isArray(parsedLog)).toBe(true);
    expect(parsedLog[0].action).toBe('test_action');
    db.close();
  });

  test('POST /api/telemetry correctly records hardcore_reset event', async ({ request }) => {
    const testMission = `Урок 20 :: Хардкор Сброс [${Date.now()}]`;
    const payload = {
      mission_name: testMission,
      action_type: 'hardcore_reset',
      time_spent_sec: 15,
      attempts_count: 2,
      success: false,
      is_hardcore: true
    };

    const baseUrl = process.env.BASE_URL || 'http://localhost:4321';
    const res = await request.post(`${baseUrl}/api/telemetry`, {
      data: payload,
      headers: { 'Content-Type': 'application/json' }
    });

    expect(res.status()).toBe(200);

    // Verify row in database
    const db = new Database(dbPath);
    const row = db.prepare("SELECT * FROM telemetry WHERE mission_name = ?").get(testMission);
    expect(row).toBeDefined();
    expect(row.action_type).toBe('hardcore_reset');
    expect(row.is_hardcore).toBe(1);
    expect(row.success).toBe(0);
    db.close();
  });

  test('POST /api/telemetry rejects invalid content type with 400 or 403', async ({ request }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:4321';
    const res = await request.post(`${baseUrl}/api/telemetry`, {
      data: 'plain text not json',
      headers: { 
        'Content-Type': 'text/plain',
        'Origin': baseUrl
      }
    });
    expect([400, 403]).toContain(res.status());
  });

  test('POST /api/telemetry correctly records attempt_id, attempt_number and attempt_mode', async ({ request }) => {
    const testMission = `Урок 20 :: Attempt Test [${Date.now()}]`;
    const payload = {
      student_firstName: 'Аттемпт',
      student_lastName: 'Тестовый',
      student_class: '11-ИТ',
      mission_name: testMission,
      action_type: 'level_complete',
      time_spent_sec: 120,
      level_number: 1,
      attempt_id: 'att_test_123',
      attempt_number: 2,
      attempt_mode: 'hardcore',
      is_hardcore: true
    };

    const baseUrl = process.env.BASE_URL || 'http://localhost:4321';
    const res = await request.post(`${baseUrl}/api/telemetry`, {
      data: payload,
      headers: { 'Content-Type': 'application/json' }
    });

    expect(res.status()).toBe(200);

    const db = new Database(dbPath);
    const row = db.prepare("SELECT * FROM telemetry WHERE mission_name = ?").get(testMission);
    expect(row).toBeDefined();
    expect(row.attempt_id).toBe('att_test_123');
    expect(Number(row.attempt_number)).toBe(2);
    expect(row.attempt_mode).toBe('hardcore');
    db.close();
  });

  test('POST /api/telemetry correctly records sprint_complete event with level_number: 0 and action_log', async ({ request }) => {
    const testMission = `Урок 20 :: Logo-Storm Sprint Contract [${Date.now()}]`;
    const actionLog = {
      cpm: 265,
      wpm: 53,
      accuracy: 98.5,
      chars_count: 194,
      terms_count: 7,
      errors_count: 2
    };

    const payload = {
      student_firstName: 'Спринтер',
      student_lastName: 'Турбо',
      student_class: '11-ИТ',
      course_slug: '11-класс_углубленный',
      lesson_id: '20',
      mission_name: testMission,
      action_type: 'sprint_complete',
      level_number: 0,
      time_spent_sec: 44,
      attempts_count: 1,
      success: true,
      status: 'completed',
      action_log: JSON.stringify(actionLog)
    };

    const baseUrl = process.env.BASE_URL || 'http://localhost:4321';
    const res = await request.post(`${baseUrl}/api/telemetry`, {
      data: payload,
      headers: { 'Content-Type': 'application/json' }
    });

    expect(res.status()).toBe(200);

    const db = new Database(dbPath);
    const row = db.prepare("SELECT * FROM telemetry WHERE mission_name = ?").get(testMission);
    expect(row).toBeDefined();
    expect(row.action_type).toBe('sprint_complete');
    expect(Number(row.level_number)).toBe(0);
    expect(Number(row.time_spent_sec)).toBe(44);
    expect(row.action_log).toContain('265');
    db.close();
  });

  test('POST /api/telemetry persists stage_current, stage_total and wave_number columns', async ({ request }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:4321';
    const testMission = `Урок 20 :: Stage & Wave Contract [${Date.now()}]`;
    const res = await request.post(`${baseUrl}/api/telemetry`, {
      data: {
        student_firstName: 'Этап',
        student_lastName: 'Контракт',
        student_class: '11-ИТ',
        course_slug: '11-класс_углубленный',
        lesson_id: '20',
        level_number: 3,
        mission_name: testMission,
        action_type: 'in_progress',
        status: 'in_progress',
        start_time: new Date().toISOString(),
        time_spent_sec: 12,
        attempts_count: 1,
        success: false,
        stage: 4,
        total_stages: 10,
        wave: 4,
        total_waves: 10
      },
      headers: { 'Content-Type': 'application/json' }
    });
    expect(res.status()).toBe(200);

    const db = new Database(dbPath);
    const row = db.prepare('SELECT stage_current, stage_total, wave_number FROM telemetry WHERE mission_name = ?').get(testMission);
    expect(row).toBeDefined();
    expect(row.stage_current).toBe(4);
    expect(row.stage_total).toBe(10);
    expect(row.wave_number).toBe(4);
    db.close();
  });

  test('LMSTelemetry helper defers start_time, prevents duplicate level_complete, and halts AFK wave-1 loop', async ({ page }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:4321';
    await page.goto(`${baseUrl}/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level1`);
    const hasHelper = await page.evaluate(() => Boolean(window.LMSTelemetry && typeof window.LMSTelemetry.create === 'function'));
    expect(hasHelper).toBe(true);

    const result = await page.evaluate(async () => {
      const sent = [];
      const fakeParent = { postMessage: (msg) => sent.push(msg) };
      const tracker = window.LMSTelemetry.create({
        missionName: 'Урок 99 :: Тест SDK (Уровень 3)',
        level: 3,
        totalWaves: 10,
        autoBindActivity: false,
        targetWindow: fakeParent
      });

      const beforeStart = tracker.getState();
      tracker.start();
      const afterStart = tracker.getState();

      // 1st wave-1 timeout (allowed)
      const f1 = tracker.fail({ wave: 1, isTimeout: true });
      // 2nd consecutive wave-1 timeout without user activity (triggers AFK pause & blocks spam)
      const f2 = tracker.fail({ wave: 1, isTimeout: true });
      const pausedState = tracker.getState();
      const hasRetryBtn = Boolean(document.getElementById('lms-afk-retry-btn'));

      // Click Retry button -> resumes and hides overlay
      document.getElementById('lms-afk-retry-btn')?.click();
      const resumedState = tracker.getState();
      const retryBtnAfter = Boolean(document.getElementById('lms-afk-retry-btn'));

      // Double level_complete guard
      const c1 = tracker.complete({ wave: 10 });
      const c2 = tracker.complete({ wave: 10 });

      tracker.destroy();
      return {
        beforeStarted: beforeStart.started,
        beforeIso: beforeStart.startTimeIso,
        afterStarted: afterStart.started,
        afterIso: afterStart.startTimeIso,
        f1Sent: Boolean(f1),
        f2Sent: f2,
        isAfkPaused: pausedState.isAfkPaused,
        hasRetryBtn,
        resumedPaused: resumedState.isAfkPaused,
        retryBtnAfter,
        c1Sent: Boolean(c1),
        c2Sent: c2,
        completeEventsCount: sent.filter(e => e.action_type === 'level_complete').length
      };
    });

    expect(result.beforeStarted).toBe(false);
    expect(result.beforeIso).toBeNull();
    expect(result.afterStarted).toBe(true);
    expect(result.afterIso).toBeTruthy();
    expect(result.f1Sent).toBe(true);
    expect(result.f2Sent).toBe(false);
    expect(result.isAfkPaused).toBe(true);
    expect(result.hasRetryBtn).toBe(true);
    expect(result.resumedPaused).toBe(false);
    expect(result.retryBtnAfter).toBe(false);
    expect(result.c1Sent).toBe(true);
    expect(result.c2Sent).toBe(false);
    expect(result.completeEventsCount).toBe(1);
  });

  test('Lesson shell [id].astro does not count theory reading time before first interaction in iframe-1', async ({ page }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:4321';
    const uid = Date.now();
    await page.addInitScript((id) => {
      localStorage.setItem('student_firstName', `Таймер_${id}`);
      localStorage.setItem('student_lastName', 'Теории');
      localStorage.setItem('student_class', '11-класс_углубленный');
    }, uid);

    const postedTelemetry = [];
    await page.route('**/api/telemetry', async (route) => {
      const req = route.request();
      if (req.method() === 'POST') {
        try {
          postedTelemetry.push(req.postDataJSON());
        } catch (e) {}
      }
      await route.continue();
    });

    await page.goto(`${baseUrl}/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/20`);
    await page.waitForSelector('#iframe-1');
    // Wait 2.5 seconds simulating theory reading on the left panel without touching iframe-1
    await page.waitForTimeout(2500);

    // No active_tab telemetry with >0s should have been sent while only reading theory
    const nonZeroBeforeClick = postedTelemetry.filter(e => e.timer_mode === 'active_tab' && e.time_spent_sec > 0);
    expect(nonZeroBeforeClick).toEqual([]);

    // Now click inside iframe-1 -> timer starts from 0, then wait 1.5s and trigger a real gameplay event
    const frame = page.frameLocator('#iframe-1');
    await frame.locator('body').click({ position: { x: 20, y: 20 } });
    await page.waitForTimeout(1600);

    // Trigger a level_fail inside iframe-1 to observe parent-enriched active_tab time_spent_sec
    await page.evaluate(() => {
      const iframe = document.getElementById('iframe-1');
      iframe.contentWindow.parent.postMessage({
        type: 'TELEMETRY_EVENT',
        mission_name: 'Урок 20 :: Машина Тьюринга (Уровень 1)',
        action_type: 'level_fail',
        status: 'in_progress',
        attempts_count: 1,
        success: false
      }, '*');
    });
    await page.waitForTimeout(300);

    const activeEvent = postedTelemetry.find(e => e.action_type === 'level_fail' && e.timer_mode === 'active_tab');
    expect(activeEvent).toBeDefined();
    // Should be ~1-2s (from iframe click), NOT ~4s (which would include theory reading time!)
    expect(activeEvent.time_spent_sec).toBeGreaterThanOrEqual(1);
    expect(activeEvent.time_spent_sec).toBeLessThanOrEqual(3);
  });
});
