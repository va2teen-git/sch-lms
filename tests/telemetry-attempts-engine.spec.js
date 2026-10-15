import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';

test.describe('Comprehensive Telemetry & Attempt Lifecycle Engine Suite', () => {
  const baseUrl = 'http://localhost:4321';
  const dbPath = path.join(process.cwd(), 'telemetry.db');

  test('1. Academic Mastery Retention: Normal pass is never revoked by subsequent hardcore failure', async ({ request }) => {
    const studentFn = `Мастери_${Date.now()}`;
    const studentLn = 'Попыткин';
    const sClass = '11-класс_углубленный';
    const lessonId = '991';
    const missionPrefix = `Урок ${lessonId} :: Машина Поста`;

    // Attempt 1: Normal mode pass (Levels 1, 2, 3 complete)
    const att1Id = `att_norm_${Date.now()}`;
    for (let lvl = 1; lvl <= 3; lvl++) {
      await request.post(`${baseUrl}/api/telemetry`, {
        data: {
          student_firstName: studentFn,
          student_lastName: studentLn,
          student_class: sClass,
          course_slug: sClass,
          lesson_id: lessonId,
          level_number: lvl,
          mission_name: `${missionPrefix} (Уровень ${lvl})`,
          action_type: 'level_complete',
          time_spent_sec: 120 * lvl,
          attempt_id: att1Id,
          attempt_number: 1,
          attempt_mode: 'normal',
          is_hardcore: false,
          success: true
        },
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Attempt 2: Hardcore attempt that wipes at Level 2
    const att2Id = `att_hc_${Date.now()}`;
    await request.post(`${baseUrl}/api/telemetry`, {
      data: {
        student_firstName: studentFn,
        student_lastName: studentLn,
        student_class: sClass,
        course_slug: sClass,
        lesson_id: lessonId,
        level_number: 1,
        mission_name: `${missionPrefix} (Уровень 1)`,
        action_type: 'level_complete',
        time_spent_sec: 90,
        attempt_id: att2Id,
        attempt_number: 2,
        attempt_mode: 'hardcore',
        is_hardcore: true,
        success: true
      },
      headers: { 'Content-Type': 'application/json' }
    });

    await request.post(`${baseUrl}/api/telemetry`, {
      data: {
        student_firstName: studentFn,
        student_lastName: studentLn,
        student_class: sClass,
        course_slug: sClass,
        lesson_id: lessonId,
        level_number: 2,
        mission_name: `${missionPrefix} (Уровень 2)`,
        action_type: 'hardcore_reset',
        time_spent_sec: 45,
        attempt_id: att2Id,
        attempt_number: 2,
        attempt_mode: 'hardcore',
        is_hardcore: true,
        success: false
      },
      headers: { 'Content-Type': 'application/json' }
    });

    // Query teacher stats API
    const res = await request.get(`${baseUrl}/api/teacher/stats?date=all&exclude_tests=0&lesson=${lessonId}&search=${encodeURIComponent(studentFn)}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.students.length).toBe(1);

    const s = body.students[0];
    // Check academic retention:
    expect(s.isNormalMastered).toBe(true);
    expect(s.lessonStatus).toBe('completed');
    expect(s.hardcoreStatus).toBe('failed');
    expect(s.attemptsCount).toBe(2);
    expect(s.normalAttemptsCount).toBe(1);
    expect(s.hardcoreAttemptsCount).toBe(1);

    // Verify individual attempt objects:
    expect(s.attempts.length).toBe(2);
    expect(s.attempts[0].attemptId).toBe(att1Id);
    expect(s.attempts[0].mode).toBe('normal');
    expect(s.attempts[0].status).toBe('completed');
    expect(s.attempts[0].completedLevelsCount).toBe(3);

    expect(s.attempts[1].attemptId).toBe(att2Id);
    expect(s.attempts[1].mode).toBe('hardcore');
    expect(s.attempts[1].status).toBe('failed');
  });

  test('2. Pure Active Time Deduplication across concurrent iframes within an attempt', async ({ request }) => {
    const studentFn = `Дедуп_${Date.now()}`;
    const studentLn = 'Попыткин';
    const sClass = '11-класс_углубленный';
    const lessonId = '992';
    const missionPrefix = `Урок ${lessonId} :: Задание`;
    const attId = `att_dedup_${Date.now()}`;

    // Level 1: 500s pure time
    await request.post(`${baseUrl}/api/telemetry`, {
      data: {
        student_firstName: studentFn,
        student_lastName: studentLn,
        student_class: sClass,
        lesson_id: lessonId,
        level_number: 1,
        mission_name: `${missionPrefix} (Уровень 1)`,
        action_type: 'level_complete',
        time_spent_sec: 500,
        attempt_id: attId,
        attempt_number: 1,
        attempt_mode: 'normal',
        is_hardcore: false,
        success: true
      },
      headers: { 'Content-Type': 'application/json' }
    });

    // Level 2: concurrently loaded at T0, reports 850s from page start
    await request.post(`${baseUrl}/api/telemetry`, {
      data: {
        student_firstName: studentFn,
        student_lastName: studentLn,
        student_class: sClass,
        lesson_id: lessonId,
        level_number: 2,
        mission_name: `${missionPrefix} (Уровень 2)`,
        action_type: 'level_complete',
        time_spent_sec: 850,
        attempt_id: attId,
        attempt_number: 1,
        attempt_mode: 'normal',
        is_hardcore: false,
        success: true
      },
      headers: { 'Content-Type': 'application/json' }
    });

    const res = await request.get(`${baseUrl}/api/teacher/stats?date=all&exclude_tests=0&lesson=${lessonId}&search=${encodeURIComponent(studentFn)}`);
    const body = await res.json();
    const s = body.students[0];
    const att = s.attempts[0];

    // Level 1 pure: 500s
    expect(att.levels[1].timeSpentSec).toBe(500);
    // Level 2 pure: 850 - 500 = 350s
    expect(att.levels[2].timeSpentSec).toBe(350);
    // Total pure time for attempt: 500 + 350 = 850s (not 500 + 850 = 1350s!)
    expect(att.totalTimeSec).toBe(850);
  });

  test('3. Multi-Run Cumulative Active Time vs Best Run Time tracking', async ({ request }) => {
    const studentFn = `МултиРан_${Date.now()}`;
    const studentLn = 'Попыткин';
    const sClass = '11-класс_углубленный';
    const lessonId = '993';
    const missionPrefix = `Урок ${lessonId} :: Марафон`;

    // Run 1: Slow pass (Levels 1,2,3 totaling 900s)
    const run1Id = `run1_${Date.now()}`;
    for (let lvl = 1; lvl <= 3; lvl++) {
      await request.post(`${baseUrl}/api/telemetry`, {
        data: {
          student_firstName: studentFn,
          student_lastName: studentLn,
          student_class: sClass,
          lesson_id: lessonId,
          level_number: lvl,
          mission_name: `${missionPrefix} (Уровень ${lvl})`,
          action_type: 'level_complete',
          time_spent_sec: 300 * lvl,
          attempt_id: run1Id,
          attempt_number: 1,
          attempt_mode: 'normal',
          is_hardcore: false,
          success: true
        },
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Run 2: Fast pass (Levels 1,2,3 totaling 300s)
    const run2Id = `run2_${Date.now()}`;
    for (let lvl = 1; lvl <= 3; lvl++) {
      await request.post(`${baseUrl}/api/telemetry`, {
        data: {
          student_firstName: studentFn,
          student_lastName: studentLn,
          student_class: sClass,
          lesson_id: lessonId,
          level_number: lvl,
          mission_name: `${missionPrefix} (Уровень ${lvl})`,
          action_type: 'level_complete',
          time_spent_sec: 100 * lvl,
          attempt_id: run2Id,
          attempt_number: 2,
          attempt_mode: 'normal',
          is_hardcore: false,
          success: true
        },
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const res = await request.get(`${baseUrl}/api/teacher/stats?date=all&exclude_tests=0&lesson=${lessonId}&search=${encodeURIComponent(studentFn)}`);
    const body = await res.json();
    const s = body.students[0];

    expect(s.attemptsCount).toBe(2);
    // Best normal run time is the faster run (300s)
    expect(s.bestNormalTimeSec).toBe(300);
    // Total engagement active time sums both runs (900 + 300 = 1200s)
    expect(s.totalActiveTimeSec).toBe(1200);
  });

  test('4. Hardcore Conquered (Ironman Victory) grants legend status and isolates hardcore time', async ({ request }) => {
    const studentFn = `Легенда_${Date.now()}`;
    const studentLn = 'Попыткин';
    const sClass = '11-класс_углубленный';
    const lessonId = '994';
    const missionPrefix = `Урок ${lessonId} :: Испытание`;

    const hcAttId = `att_hc_win_${Date.now()}`;
    for (let lvl = 1; lvl <= 3; lvl++) {
      await request.post(`${baseUrl}/api/telemetry`, {
        data: {
          student_firstName: studentFn,
          student_lastName: studentLn,
          student_class: sClass,
          lesson_id: lessonId,
          level_number: lvl,
          mission_name: `${missionPrefix} (Уровень ${lvl})`,
          action_type: 'level_complete',
          time_spent_sec: 80 * lvl,
          attempt_id: hcAttId,
          attempt_number: 1,
          attempt_mode: 'hardcore',
          is_hardcore: true,
          success: true
        },
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const res = await request.get(`${baseUrl}/api/teacher/stats?date=all&exclude_tests=0&lesson=${lessonId}&search=${encodeURIComponent(studentFn)}`);
    const body = await res.json();
    const s = body.students[0];

    expect(s.isHardcoreLegend).toBe(true);
    expect(s.lessonStatus).toBe('hardcore_completed');
    expect(s.hardcoreStatus).toBe('completed');
    expect(s.bestHardcoreTimeSec).toBe(240); // 80 * 3
  });

  test('5. Backward Compatibility: Legacy rows without attempt_id partition cleanly into attempts', async ({ request }) => {
    const studentFn = `Легаси_${Date.now()}`;
    const studentLn = 'Попыткин';
    const sClass = '11-класс_углубленный';
    const lessonId = '995';

    // Insert directly into SQLite without attempt_id
    const db = new Database(dbPath);
    const insert = db.prepare(`
      INSERT INTO telemetry (
        first_name, last_name, student_class, class_name, mission_name,
        action_type, time_spent_sec, is_hardcore, lesson_id, level_number, success
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Normal event
    insert.run(studentFn, studentLn, sClass, sClass, `Урок ${lessonId} (Ур 1)`, 'level_complete', 150, 0, lessonId, 1, 1);
    // Normal reset -> triggers legacy attempt 2
    insert.run(studentFn, studentLn, sClass, sClass, `Урок ${lessonId}`, 'normal_reset', 0, 0, lessonId, null, null);
    // Hardcore event -> triggers legacy attempt 3
    insert.run(studentFn, studentLn, sClass, sClass, `Урок ${lessonId} (Ур 1)`, 'level_complete', 120, 1, lessonId, 1, 1);
    db.close();

    const res = await request.get(`${baseUrl}/api/teacher/stats?date=all&exclude_tests=0&lesson=${lessonId}&search=${encodeURIComponent(studentFn)}`);
    const body = await res.json();
    const s = body.students[0];

    expect(s).toBeDefined();
    expect(s.attemptsCount).toBeGreaterThanOrEqual(2);
    expect(Array.isArray(s.attempts)).toBe(true);
    expect(s.attempts[0].levels[1].completed).toBe(true);
  });

  test('6. Browser UI Verification: Teacher modal renders Attempt History with level badges and times', async ({ page }) => {
    await page.goto(`${baseUrl}/teacher?date=all`);
    await page.waitForSelector('.view-log-btn');

    // Click on log button for any student
    await page.locator('.view-log-btn').first().click();

    // Verify modal elements
    await expect(page.locator('#detail-modal')).toBeVisible();
    await expect(page.locator('#modal-student-name')).toBeVisible();
    await expect(page.locator('#modal-attempts-container')).toBeVisible();
    await expect(page.locator('#modal-attempts-list')).toBeVisible();

    const attemptsText = await page.locator('#modal-attempts-list').innerText();
    expect(attemptsText.length).toBeGreaterThan(0);

    // Verify close
    await page.locator('#modal-close-btn').click();
    await expect(page.locator('#detail-modal')).toBeHidden();
  });

  test('7. Anti-Ghost Engine: Zero-second locked level pings and empty attempts are not registered as in_progress or extra runs', async ({ request }) => {
    const studentFn = `АнтиПризрак_${Date.now()}`;
    const studentLn = 'Чистый';
    const sClass = '8-класс';
    const lessonId = '997';
    const missionPrefix = `Урок ${lessonId} :: Задача`;
    const realAttId = `att_real_${Date.now()}`;

    // Level 1: real active work
    await request.post(`${baseUrl}/api/telemetry`, {
      data: {
        student_firstName: studentFn,
        student_lastName: studentLn,
        student_class: sClass,
        lesson_id: lessonId,
        level_number: 1,
        mission_name: `${missionPrefix} (Уровень 1)`,
        action_type: 'in_progress',
        time_spent_sec: 45,
        attempt_id: realAttId,
        attempt_number: 1,
        attempt_mode: 'normal'
      },
      headers: { 'Content-Type': 'application/json' }
    });

    // Level 2 & 3: automated 0s pings from background iframes (should be discarded from in_progress)
    await request.post(`${baseUrl}/api/telemetry`, {
      data: {
        student_firstName: studentFn,
        student_lastName: studentLn,
        student_class: sClass,
        lesson_id: lessonId,
        level_number: 2,
        mission_name: `${missionPrefix} (Уровень 2)`,
        action_type: 'in_progress',
        time_spent_sec: 0,
        attempt_id: realAttId,
        attempt_number: 1,
        attempt_mode: 'normal'
      },
      headers: { 'Content-Type': 'application/json' }
    });

    // Ghost attempt with 0s and no errors (e.g. spurious reload or hardcore toggle)
    const ghostAttId = `att_ghost_${Date.now()}`;
    await request.post(`${baseUrl}/api/telemetry`, {
      data: {
        student_firstName: studentFn,
        student_lastName: studentLn,
        student_class: sClass,
        lesson_id: lessonId,
        level_number: 1,
        mission_name: `${missionPrefix} (Уровень 1)`,
        action_type: 'in_progress',
        time_spent_sec: 0,
        attempt_id: ghostAttId,
        attempt_number: 2,
        attempt_mode: 'hardcore',
        is_hardcore: false
      },
      headers: { 'Content-Type': 'application/json' }
    });

    const res = await request.get(`${baseUrl}/api/teacher/stats?date=all&exclude_tests=0&lesson=${lessonId}&search=${encodeURIComponent(studentFn)}`);
    const body = await res.json();
    const s = body.students[0];

    // Level 1 is in_progress (45s)
    expect(s.levels[1].status).toBe('in_progress');
    expect(s.levels[1].timeSpentSec).toBe(45);

    // Level 2 and 3 remain not_started (0s) despite the 0s ping
    expect(s.levels[2].status).toBe('not_started');
    expect(s.levels[2].timeSpentSec).toBe(0);
    expect(s.levels[3].status).toBe('not_started');

    // Ghost attempt with 0s was filtered out: exactly 1 attempt remains
    expect(s.attemptsCount).toBe(1);
    expect(s.hardcoreStatus).toBe('none');
  });

  test('8. Dedicated Attempts Table Column: Renders header, attempts badge and supports sorting', async ({ page }) => {
    await page.goto(`${baseUrl}/teacher?date=all`);
    await page.waitForSelector('#progress-table');

    // Verify header exists
    const attemptsTh = page.locator('th[data-sort="attempts"]');
    await expect(attemptsTh).toBeVisible();
    await expect(attemptsTh).toContainText('Забеги');

    // Verify sort icon toggle
    await attemptsTh.click();
    const sortIcon = page.locator('#sort-attempts-icon');
    const iconText = await sortIcon.innerText();
    expect(iconText === '↑' || iconText === '↓' || iconText.includes('↑') || iconText.includes('↓')).toBe(true);

    // Verify that student rows contain the attempts column (column 5)
    const attemptsCells = await page.locator('.student-row td:nth-child(5)').allTextContents();
    expect(attemptsCells.length).toBeGreaterThan(0);
    expect(attemptsCells[0]).toMatch(/забег|попытка/i);
  });

  test('9. Decoupled Level 3 reset (level_fail) does not wipe normal session or attempt', async ({ request }) => {
    const studentFn = `СбросЛ3_${Date.now()}`;
    const studentLn = 'Аркадин';
    const sClass = '8-класс';
    const lessonId = '6';
    const attId = `att_lvl3_${Date.now()}`;

    // Level 1 complete
    await request.post(`${baseUrl}/api/telemetry`, {
      data: {
        student_firstName: studentFn,
        student_lastName: studentLn,
        student_class: sClass,
        lesson_id: lessonId,
        level_number: 1,
        mission_name: 'Урок 6 :: Уровень 1',
        action_type: 'level_complete',
        time_spent_sec: 100,
        attempt_id: attId,
        attempt_number: 1,
        attempt_mode: 'normal',
        is_hardcore: false,
        success: true
      },
      headers: { 'Content-Type': 'application/json' }
    });

    // Level 3 arcade fail (level_fail event)
    await request.post(`${baseUrl}/api/telemetry`, {
      data: {
        student_firstName: studentFn,
        student_lastName: studentLn,
        student_class: sClass,
        lesson_id: lessonId,
        level_number: 3,
        mission_name: 'Урок 6 :: Уровень 3',
        action_type: 'level_fail',
        time_spent_sec: 25,
        attempt_id: attId,
        attempt_number: 1,
        attempt_mode: 'normal',
        is_hardcore: false,
        success: false
      },
      headers: { 'Content-Type': 'application/json' }
    });

    const res = await request.get(`${baseUrl}/api/teacher/stats?date=all&exclude_tests=0&lesson=${lessonId}&search=${encodeURIComponent(studentFn)}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    const s = body.students[0];

    // Student and attempt remain in_progress (NOT failed or wiped)
    expect(s.lessonStatus).toBe('in_progress');
    expect(s.levels[1].status).toBe('completed');
    expect(s.levels[3].status).toBe('in_progress');
    expect(s.levels[3].errors).toBe(1);
    expect(s.hardcoreStatus).toBe('none');
    expect(s.attempts[0].status).toBe('in_progress');
    expect(s.attempts[0].errorsCount).toBe(1);
  });

  test('10. Teacher dashboard expandable attempt sub-rows toggle visibility on button click', async ({ page }) => {
    await page.goto(`${baseUrl}/teacher?date=all`);
    await page.waitForSelector('#progress-table');

    // Find the first toggle button
    const firstToggle = page.locator('.toggle-attempts-btn').first();
    await expect(firstToggle).toBeVisible();

    const studentKey = await firstToggle.getAttribute('data-student-key');
    expect(studentKey).toBeTruthy();

    const subrows = page.locator(`.attempt-subrow[data-parent-key="${studentKey}"]`);
    const count = await subrows.count();
    expect(count).toBeGreaterThan(0);

    // Initial state: sub-rows have .hidden
    await expect(subrows.first()).toBeHidden();

    // Click toggle button: unfolds subrows
    await firstToggle.click();
    await expect(subrows.first()).toBeVisible();
    await expect(firstToggle.locator('.attempt-toggle-icon')).toHaveText('▼');

    // Click toggle button again: collapses subrows
    await firstToggle.click();
    await expect(subrows.first()).toBeHidden();
    await expect(firstToggle.locator('.attempt-toggle-icon')).toHaveText('▶');
  });

  test('11. Teacher dashboard column headers display intuitive titles with subtitles', async ({ page }) => {
    await page.goto(`${baseUrl}/teacher`);
    await page.waitForSelector('#progress-table');

    const timeTh = page.locator('th[data-sort="time"]');
    await expect(timeTh).toBeVisible();
    await expect(timeTh).toContainText('Время решения');
    await expect(timeTh).toContainText('Активное время');

    const lastTh = page.locator('th[data-sort="last"]');
    await expect(lastTh).toBeVisible();
    await expect(lastTh).toContainText('Был на уроке');
    await expect(lastTh).toContainText('Время ухода');
  });
});
