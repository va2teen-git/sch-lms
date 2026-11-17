import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';

test.describe('Prince of Persia Cross-Lesson Campaign E2E', () => {
  const dbPath = path.join(process.cwd(), 'telemetry.db');
  const baseUrl = process.env.BASE_URL || 'http://localhost:4321';
  const lessonAUrl = '/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7';
  const lessonBUrl = '/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8';
  const createdStudents = [];

  function makeStudent(tag) {
    const uniq = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const student = {
      firstName: `ПринцЕ2Е_${tag}`,
      lastName: `Кампания_${uniq}`,
      studentClass: '8-класс'
    };
    createdStudents.push(student);
    return student;
  }

  async function completeLessonInDb(request, student, courseSlug, lessonId, isHardcore) {
    for (const lvl of [1, 2, 3]) {
      const res = await request.post(`${baseUrl}/api/telemetry`, {
        data: {
          student_firstName: student.firstName,
          student_lastName: student.lastName,
          student_class: student.studentClass,
          course_slug: courseSlug,
          lesson_id: lessonId,
          level_number: lvl,
          mission_name: `Урок ${lessonId} :: Кампания E2E (Уровень ${lvl})`,
          action_type: 'level_complete',
          status: 'completed',
          time_spent_sec: 12,
          attempts_count: 1,
          success: true,
          is_hardcore: isHardcore
        },
        headers: { 'Content-Type': 'application/json' }
      });
      expect(res.status()).toBe(200);
    }
  }

  test.afterAll(() => {
    const db = new Database(dbPath);
    for (const s of createdStudents) {
      db.prepare('DELETE FROM prince_progress WHERE first_name = ? AND last_name = ? AND student_class = ?').run(
        s.firstName,
        s.lastName,
        s.studentClass
      );
      db.prepare('DELETE FROM telemetry WHERE first_name = ? AND last_name = ? AND student_class = ?').run(
        s.firstName,
        s.lastName,
        s.studentClass
      );
    }
    db.close();
  });

  test('1. Normal completion + toggling Hardcore does NOT unlock Prince of Persia bonus', async ({ page, request }) => {
    const student = makeStudent('NormalExploit');
    await completeLessonInDb(request, student, '8-класс', '7', false);

    await page.addInitScript((s) => {
      if (!sessionStorage.getItem('_prince_e2e_init')) {
        sessionStorage.setItem('_prince_e2e_init', '1');
        localStorage.setItem('student_firstName', s.firstName);
        localStorage.setItem('student_lastName', s.lastName);
        localStorage.setItem('student_class', s.studentClass);
        localStorage.removeItem('hardcore_mode');
        sessionStorage.removeItem('school_lms_hardcore_8-класс_7');
      }
    }, student);

    await page.goto(lessonAUrl);
    await page.waitForLoadState('domcontentloaded');

    // Completed in normal mode -> completion screen visible, NOT hardcore title, bonus card hidden
    const completionScreen = page.locator('#completion-screen');
    await expect(completionScreen).toBeVisible();
    await expect(page.locator('#completion-title')).toContainText('Урок пройден!');
    await expect(page.locator('#completion-title')).not.toContainText('Хардкор');
    await expect(page.locator('#prince-bonus-card')).toBeHidden();

    // Toggle Hardcore button -> reloads in hardcore mode, must show Level 1 task and keep bonus hidden
    await page.locator('#hardcore-toggle').click();
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#lesson-content')).toBeVisible();
    await expect(completionScreen).toBeHidden();
    await expect(page.locator('#prince-bonus-card')).toBeHidden();
  });

  test('2. Hardcore Lesson A opens Stage 1, updates UI immediately on victory, blocks Stage 2 in Lesson A, and Lesson B opens Stage 2', async ({ page, request }) => {
    const student = makeStudent('Progression');
    await completeLessonInDb(request, student, '8-класс', '7', true);

    await page.addInitScript((s) => {
      localStorage.setItem('student_firstName', s.firstName);
      localStorage.setItem('student_lastName', s.lastName);
      localStorage.setItem('student_class', s.studentClass);
      sessionStorage.setItem('school_lms_hardcore_8-класс_7', 'true');
      sessionStorage.setItem('school_lms_hardcore_8-класс_8', 'true');
    }, student);

    // Capture outgoing prince_complete telemetry payload without blocking real DB write
    const princePayloads = [];
    page.on('request', (req) => {
      if (req.url().includes('/api/telemetry') && req.method() === 'POST') {
        try {
          const body = req.postDataJSON();
          if (body?.action_type === 'prince_complete') {
            princePayloads.push(body);
          }
        } catch (e) {}
      }
    });

    // --- Step A: Visit Lesson A (8-класс / 7) ---
    await page.goto(lessonAUrl);
    await page.waitForLoadState('domcontentloaded');

    const bonusCard = page.locator('#prince-bonus-card');
    await expect(bonusCard).toBeVisible();
    await expect(bonusCard).toContainText('Этап 1 из 18: Темницы Багдада');

    await page.locator('#open-prince-btn').click();
    await expect(page.locator('#prince-overlay')).toBeVisible();

    const iframeA = page.locator('#prince-game-iframe');
    const srcA = await iframeA.getAttribute('src');
    expect(srcA).toContain('/static/prince/index.html?level=1&minLevel=1&maxLevel=1&skipTitle=true&skipCutscenes=true');

    // Complete Stage 1 and wait for real POST /api/telemetry response
    const telemetryRespPromise = page.waitForResponse(
      (res) => res.url().includes('/api/telemetry') && res.request().method() === 'POST'
    );
    await page.evaluate(() => {
      window.postMessage({
        type: 'PRINCE_EVENT',
        action: 'level_complete',
        completedLevel: 1,
        nextLevel: null
      }, '*');
    });
    const telemetryResp = await telemetryRespPromise;
    expect(telemetryResp.status()).toBe(200);
    const telemetryRespJson = await telemetryResp.json();
    expect(telemetryRespJson.success).toBe(true);
    expect(telemetryRespJson.stage).toBe(1);

    expect(princePayloads.length).toBe(1);
    expect(princePayloads[0].action_type).toBe('prince_complete');
    expect(princePayloads[0].stage_current).toBe(1);
    expect(princePayloads[0].stage_total).toBe(18);
    expect(princePayloads[0].level_number).toBe(1);

    // Victory modal is shown
    const victoryModal = page.locator('#prince-victory-modal');
    await expect(victoryModal).toBeVisible();
    await page.locator('#prince-victory-close-btn').click();
    await expect(victoryModal).toBeHidden();
    await expect(page.locator('#prince-overlay')).toBeHidden();

    // Immediately WITHOUT reload: Lesson A card reflects Stage 1 completed and blocks Stage 2
    await expect(bonusCard).toContainText('Этап 1 пройден в этом уроке! Пройдите другой урок в режиме Хардкор, чтобы открыть Этап 2.');
    await expect(bonusCard).not.toContainText('ЗАПУСТИТЬ ЭТАП 2');

    // Reload Lesson A -> still locked on Stage 1 (only replay of Stage 1 allowed, never Stage 2)
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
    await expect(bonusCard).toBeVisible();
    await expect(bonusCard).toContainText('Этап 1 пройден в этом уроке! Пройдите другой урок в режиме Хардкор, чтобы открыть Этап 2.');
    await page.locator('#open-prince-btn').click();
    const srcAAfterReload = await iframeA.getAttribute('src');
    expect(srcAAfterReload).toContain('level=1&minLevel=1&maxLevel=1');
    expect(srcAAfterReload).not.toContain('level=2');

    // --- Step B: Complete Lesson B (8-класс / 8) in Hardcore -> opens Stage 2 immediately ---
    await completeLessonInDb(request, student, '8-класс', '8', true);
    await page.goto(lessonBUrl);
    await page.waitForLoadState('domcontentloaded');

    await expect(bonusCard).toBeVisible();
    await expect(bonusCard).toContainText('Этап 2 из 18: Стража дворца');

    await page.locator('#open-prince-btn').click();
    const srcB = await page.locator('#prince-game-iframe').getAttribute('src');
    expect(srcB).toContain('/static/prince/index.html?level=2&minLevel=2&maxLevel=2&skipTitle=true&skipCutscenes=true');
  });

  test('3. Campaign finished state displays Master Congratulations and blocks launching next stage', async ({ page }) => {
    await page.route('**/api/progress*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          unlockedNormal: 4,
          unlockedHardcore: 4,
          isNormalCompleted: true,
          isHardcoreCompleted: true,
          princeCompleted: false,
          princeProgress: {
            eligibleForHardcoreBonus: true,
            lessonStageCompleted: null,
            lessonMapLevel: null,
            completedStages: Array.from({ length: 18 }, (_, i) => i + 1),
            totalStages: 18,
            nextStage: null,
            campaignFinished: true
          }
        })
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Мастер');
      localStorage.setItem('student_lastName', 'Персии');
      localStorage.setItem('student_class', '8-класс');
      sessionStorage.setItem('school_lms_hardcore_8-класс_7', 'true');
    });

    await page.goto(lessonAUrl);
    await page.waitForLoadState('domcontentloaded');

    const bonusCard = page.locator('#prince-bonus-card');
    await expect(bonusCard).toBeVisible();
    await expect(bonusCard).toContainText('КАМПАНИЯ ПРОЙДЕНА ПОЛНОСТЬЮ');
    await expect(bonusCard).toContainText('Поздравляем, Мастер!');
    await expect(page.locator('#open-prince-btn')).toBeDisabled();
  });
});
