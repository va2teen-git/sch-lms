import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

test.describe('Prince of Persia Progress UI (/courses & /teacher)', () => {
  const dbPath = path.join(process.cwd(), 'telemetry.db');
  const campaignPath = path.join(process.cwd(), 'src', 'data', 'prince-campaign.json');
  const baseUrl = process.env.BASE_URL || 'http://localhost:4321';
  const createdStudents = [];

  function makeStudent(tag) {
    const uniq = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const student = {
      firstName: `ПринцВитрина_${tag}`,
      lastName: `Прогресс_${uniq}`,
      studentClass: '9-класс'
    };
    createdStudents.push(student);
    return student;
  }

  async function postTelemetry(request, payload) {
    const res = await request.post(`${baseUrl}/api/telemetry`, {
      data: payload,
      headers: { 'Content-Type': 'application/json' }
    });
    expect(res.status()).toBe(200);
    return res.json();
  }

  async function completeHardcoreLesson(request, student, courseSlug, lessonId) {
    for (const lvl of [1, 2, 3]) {
      await postTelemetry(request, {
        student_firstName: student.firstName,
        student_lastName: student.lastName,
        student_class: student.studentClass,
        course_slug: courseSlug,
        lesson_id: lessonId,
        level_number: lvl,
        mission_name: `Урок ${lessonId} :: Витрина Принца (Уровень ${lvl})`,
        action_type: 'level_complete',
        status: 'completed',
        time_spent_sec: 15,
        attempts_count: 1,
        success: true,
        is_hardcore: true
      });
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

  test('1. /api/matrix-progress returns per-lesson princeStage and student princeCampaign summary', async ({ request }) => {
    const campaignStages = JSON.parse(fs.readFileSync(campaignPath, 'utf-8'));
    const totalStages = campaignStages.length;
    const student = makeStudent('MatrixAPI');

    const emptyRes = await request.get(
      `${baseUrl}/api/matrix-progress?firstName=${encodeURIComponent(student.firstName)}&lastName=${encodeURIComponent(student.lastName)}&className=${encodeURIComponent(student.studentClass)}`
    );
    expect(emptyRes.status()).toBe(200);
    const emptyBody = await emptyRes.json();
    expect(emptyBody.success).toBe(true);
    expect(emptyBody.princeCampaign).toEqual({
      completedCount: 0,
      totalStages,
      currentStage: 1
    });

    // Complete 2 different lessons on hardcore and earn Stage 1 and Stage 2
    await completeHardcoreLesson(request, student, '9-класс', '6');
    await postTelemetry(request, {
      student_firstName: student.firstName,
      student_lastName: student.lastName,
      student_class: student.studentClass,
      course_slug: '9-класс',
      lesson_id: '6',
      level_number: campaignStages[0].mapLevel,
      mission_name: 'Урок 6 :: Prince of Persia (Этап 1)',
      action_type: 'prince_complete',
      status: 'completed',
      time_spent_sec: 32,
      attempts_count: 1,
      success: true,
      is_hardcore: true,
      stage_current: 1,
      stage_total: totalStages
    });

    await completeHardcoreLesson(request, student, '7-класс', '7');
    await postTelemetry(request, {
      student_firstName: student.firstName,
      student_lastName: student.lastName,
      student_class: student.studentClass,
      course_slug: '7-класс',
      lesson_id: '7',
      level_number: campaignStages[1].mapLevel,
      mission_name: 'Урок 7 :: Prince of Persia (Этап 2)',
      action_type: 'prince_complete',
      status: 'completed',
      time_spent_sec: 44,
      attempts_count: 1,
      success: true,
      is_hardcore: true,
      stage_current: 2,
      stage_total: totalStages
    });

    const res = await request.get(
      `${baseUrl}/api/matrix-progress?firstName=${encodeURIComponent(student.firstName)}&lastName=${encodeURIComponent(student.lastName)}&className=${encodeURIComponent(student.studentClass)}`
    );
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.princeCampaign).toEqual({
      completedCount: 2,
      totalStages,
      currentStage: 3
    });
    expect(body.lessons['9-класс::6'].princeCompleted).toBe(true);
    expect(body.lessons['9-класс::6'].princeStage).toBe(1);
    expect(body.lessons['7-класс::7'].princeCompleted).toBe(true);
    expect(body.lessons['7-класс::7'].princeStage).toBe(2);
  });

  test('2. /courses displays campaign counter in header and stage badges (⚔️ Эт.N) on lesson cards', async ({ page, request }) => {
    const campaignStages = JSON.parse(fs.readFileSync(campaignPath, 'utf-8'));
    const totalStages = campaignStages.length;
    const student = makeStudent('CoursesUI');

    await completeHardcoreLesson(request, student, '9-класс', '6');
    await postTelemetry(request, {
      student_firstName: student.firstName,
      student_lastName: student.lastName,
      student_class: student.studentClass,
      course_slug: '9-класс',
      lesson_id: '6',
      level_number: campaignStages[0].mapLevel,
      mission_name: 'Урок 6 :: Prince of Persia (Этап 1)',
      action_type: 'prince_complete',
      status: 'completed',
      time_spent_sec: 29,
      attempts_count: 1,
      success: true,
      is_hardcore: true,
      stage_current: 1,
      stage_total: totalStages
    });

    await completeHardcoreLesson(request, student, '9-класс', '7');
    await postTelemetry(request, {
      student_firstName: student.firstName,
      student_lastName: student.lastName,
      student_class: student.studentClass,
      course_slug: '9-класс',
      lesson_id: '7',
      level_number: campaignStages[1].mapLevel,
      mission_name: 'Урок 7 :: Prince of Persia (Этап 2)',
      action_type: 'prince_complete',
      status: 'completed',
      time_spent_sec: 41,
      attempts_count: 1,
      success: true,
      is_hardcore: true,
      stage_current: 2,
      stage_total: totalStages
    });

    await page.addInitScript((s) => {
      localStorage.setItem('student_firstName', s.firstName);
      localStorage.setItem('student_lastName', s.lastName);
      localStorage.setItem('student_class', s.studentClass);
    }, student);

    await page.goto(`${baseUrl}/courses`);

    const counter = page.locator('#prince-campaign-counter');
    await expect(counter).toBeVisible();
    await expect(counter).toHaveText(`⚔️ Принц: 2 / ${totalStages} этапов`);

    const card1 = page.locator('.lesson-card[data-course="9-класс"][data-lesson="6"]');
    await expect(card1).toHaveAttribute('data-progress-state', 'completed');
    await expect(card1.locator('.card-status-badges')).toContainText('⚔️ Эт.1');

    const card2 = page.locator('.lesson-card[data-course="9-класс"][data-lesson="7"]');
    await expect(card2).toHaveAttribute('data-progress-state', 'completed');
    await expect(card2.locator('.card-status-badges')).toContainText('⚔️ Эт.2');
  });

  test('3. /api/teacher/stats excludes test accounts or respects class filter for prince_progress', async ({ request }) => {
    const campaignStages = JSON.parse(fs.readFileSync(campaignPath, 'utf-8'));
    const totalStages = campaignStages.length;
    const student = makeStudent('TeacherFilter');

    await completeHardcoreLesson(request, student, '9-класс', '7');
    await postTelemetry(request, {
      student_firstName: student.firstName,
      student_lastName: student.lastName,
      student_class: student.studentClass,
      course_slug: '9-класс',
      lesson_id: '7',
      level_number: campaignStages[0].mapLevel,
      mission_name: 'Урок 7 :: Prince of Persia (Этап 1)',
      action_type: 'prince_complete',
      status: 'completed',
      time_spent_sec: 27,
      attempts_count: 1,
      success: true,
      is_hardcore: true,
      stage_current: 1,
      stage_total: totalStages
    });

    // Wrong class filter -> student should not appear
    const wrongClassRes = await request.get(
      `${baseUrl}/api/teacher/stats?date=today&class=7-класс&exclude_tests=1&search=${encodeURIComponent(student.firstName)}`
    );
    expect(wrongClassRes.status()).toBe(200);
    const wrongClassBody = await wrongClassRes.json();
    expect(wrongClassBody.students.length).toBe(0);

    // Matching class filter + exclude_tests=1 -> student appears with princeCampaignCompleted=1
    const okRes = await request.get(
      `${baseUrl}/api/teacher/stats?date=today&class=9-класс&exclude_tests=1&search=${encodeURIComponent(student.firstName)}`
    );
    expect(okRes.status()).toBe(200);
    const okBody = await okRes.json();
    expect(okBody.students.length).toBe(1);
    expect(okBody.students[0].princeCampaignCompleted).toBe(1);
    expect(okBody.students[0].princeCampaignTotal).toBe(totalStages);
    expect(okBody.students[0].princeStages).toHaveLength(1);
    expect(okBody.students[0].princeStages[0]).toMatchObject({
      stage: 1,
      mapLevel: campaignStages[0].mapLevel,
      courseSlug: '9-класс',
      lessonId: '7',
      timeSpentSec: 27
    });
  });
});
