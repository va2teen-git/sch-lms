import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

test.describe('Prince of Persia Cross-Lesson Campaign API & DB Contracts', () => {
  const dbPath = path.join(process.cwd(), 'telemetry.db');
  const campaignPath = path.join(process.cwd(), 'src', 'data', 'prince-campaign.json');
  const baseUrl = process.env.BASE_URL || 'http://localhost:4321';
  const createdStudents = [];

  function makeStudent(tag) {
    const uniq = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
    const student = {
      firstName: `ПринцТест_${tag}`,
      lastName: `Уник_${uniq}`,
      studentClass: '8-класс'
    };
    createdStudents.push(student);
    return student;
  }

  async function postTelemetry(request, payload) {
    return request.post(`${baseUrl}/api/telemetry`, {
      data: payload,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async function completeLessonLevels(request, student, courseSlug, lessonId, isHardcore) {
    for (const lvl of [1, 2, 3]) {
      const res = await postTelemetry(request, {
        student_firstName: student.firstName,
        student_lastName: student.lastName,
        student_class: student.studentClass,
        course_slug: courseSlug,
        lesson_id: lessonId,
        level_number: lvl,
        mission_name: `Урок ${lessonId} :: Тест Принца (Уровень ${lvl})`,
        action_type: 'level_complete',
        status: 'completed',
        time_spent_sec: 15,
        attempts_count: 1,
        success: true,
        is_hardcore: isHardcore
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

  test('1. Campaign config prince-campaign.json has 15-20 valid stages with existing map files', async () => {
    expect(fs.existsSync(campaignPath)).toBe(true);
    const stages = JSON.parse(fs.readFileSync(campaignPath, 'utf-8'));
    expect(Array.isArray(stages)).toBe(true);
    expect(stages.length).toBeGreaterThanOrEqual(15);
    expect(stages.length).toBeLessThanOrEqual(20);

    stages.forEach((s, idx) => {
      expect(s.stage).toBe(idx + 1);
      expect(typeof s.mapLevel).toBe('number');
      expect(typeof s.title).toBe('string');
      expect(s.title.length).toBeGreaterThan(0);
      expect(typeof s.health).toBe('number');
      expect(typeof s.time).toBe('number');
      expect(typeof s.skipCutscenes).toBe('boolean');

      const mapRel = s.mapLevel < 90
        ? path.join('public', 'static', 'prince', 'assets', 'maps', `level${s.mapLevel}.json`)
        : path.join('public', 'static', 'prince', 'assets', 'maps', 'custom', `level${s.mapLevel}.json`);
      expect(fs.existsSync(path.join(process.cwd(), mapRel))).toBe(true);
    });
  });

  test('2. Database schema contains prince_progress table and UNIQUE constraints', async () => {
    const db = new Database(dbPath);
    const cols = db.prepare('PRAGMA table_info(prince_progress)').all();
    const colNames = cols.map((c) => c.name);

    expect(colNames).toEqual(
      expect.arrayContaining([
        'id',
        'first_name',
        'last_name',
        'student_class',
        'course_slug',
        'lesson_id',
        'stage',
        'map_level',
        'time_spent_sec',
        'completed_at'
      ])
    );

    const indexes = db.prepare('PRAGMA index_list(prince_progress)').all();
    const uniqueIndexCols = indexes
      .filter((idx) => idx.unique === 1)
      .map((idx) => {
        const info = db.prepare(`PRAGMA index_info(${idx.name})`).all();
        return info.map((i) => i.name).join(',');
      });

    expect(uniqueIndexCols).toContain('first_name,last_name,student_class,course_slug,lesson_id');
    expect(uniqueIndexCols).toContain('first_name,last_name,student_class,stage');
    db.close();
  });

  test('3. Hardcore requirement: normal completion or reset hardcore blocks prince_complete (403)', async ({ request }) => {
    const student = makeStudent('hardcore_gate');
    await completeLessonLevels(request, student, '8-класс', '6', false);

    const progressRes = await request.get(`${baseUrl}/api/progress`, {
      params: {
        firstName: student.firstName,
        lastName: student.lastName,
        className: student.studentClass,
        lessonPrefix: 'Урок 6',
        courseSlug: '8-класс',
        lessonId: '6'
      }
    });
    expect(progressRes.status()).toBe(200);
    const progress = await progressRes.json();
    expect(progress.isNormalCompleted).toBe(true);
    expect(progress.isHardcoreCompleted).toBe(false);
    expect(progress.princeCompleted).toBe(false);
    expect(progress.princeProgress.eligibleForHardcoreBonus).toBe(false);
    expect(progress.princeProgress.lessonStageCompleted).toBeNull();
    expect(progress.princeProgress.completedStages).toEqual([]);
    expect(progress.princeProgress.nextStage).toMatchObject({ stage: 1, mapLevel: 1 });

    // Attempt to submit prince_complete without hardcore completion
    const deniedRes = await postTelemetry(request, {
      student_firstName: student.firstName,
      student_lastName: student.lastName,
      student_class: student.studentClass,
      course_slug: '8-класс',
      lesson_id: '6',
      level_number: 1,
      stage_current: 1,
      mission_name: 'Урок 6 :: Prince of Persia (Этап 1)',
      action_type: 'prince_complete',
      status: 'completed',
      time_spent_sec: 30,
      success: true
    });
    expect(deniedRes.status()).toBe(403);

    // Partial hardcore + reset must also block
    await postTelemetry(request, {
      student_firstName: student.firstName,
      student_lastName: student.lastName,
      student_class: student.studentClass,
      course_slug: '8-класс',
      lesson_id: '6',
      level_number: 1,
      mission_name: 'Урок 6 :: Тест (Уровень 1)',
      action_type: 'level_complete',
      success: true,
      is_hardcore: true
    });
    await postTelemetry(request, {
      student_firstName: student.firstName,
      student_lastName: student.lastName,
      student_class: student.studentClass,
      course_slug: '8-класс',
      lesson_id: '6',
      mission_name: 'Урок 6 :: Сброс хардкора',
      action_type: 'hardcore_reset',
      success: false,
      is_hardcore: true
    });

    const deniedAfterReset = await postTelemetry(request, {
      student_firstName: student.firstName,
      student_lastName: student.lastName,
      student_class: student.studentClass,
      course_slug: '8-класс',
      lesson_id: '6',
      mission_name: 'Урок 6 :: Prince of Persia (Уровень 1)',
      action_type: 'level_complete',
      success: true
    });
    expect(deniedAfterReset.status()).toBe(403);

    const db = new Database(dbPath);
    const rows = db
      .prepare('SELECT * FROM prince_progress WHERE first_name = ? AND last_name = ?')
      .all(student.firstName, student.lastName);
    expect(rows).toHaveLength(0);
    db.close();
  });

  test('4. 1 lesson = 1 stage, idempotent retries, and cross-lesson progression to Stage 2', async ({ request }) => {
    const student = makeStudent('progression');
    const campaign = JSON.parse(fs.readFileSync(campaignPath, 'utf-8'));

    // Lesson A (8-класс, lesson 6): complete hardcore
    await completeLessonLevels(request, student, '8-класс', '6', true);

    const progA1 = await (
      await request.get(`${baseUrl}/api/progress`, {
        params: {
          firstName: student.firstName,
          lastName: student.lastName,
          className: student.studentClass,
          lessonPrefix: 'Урок 6',
          courseSlug: '8-класс',
          lessonId: '6'
        }
      })
    ).json();

    expect(progA1.isHardcoreCompleted).toBe(true);
    expect(progA1.princeCompleted).toBe(false);
    expect(progA1.princeProgress).toEqual({
      eligibleForHardcoreBonus: true,
      lessonStageCompleted: null,
      lessonMapLevel: null,
      completedStages: [],
      totalStages: campaign.length,
      nextStage: {
        stage: campaign[0].stage,
        mapLevel: campaign[0].mapLevel,
        title: campaign[0].title
      },
      campaignFinished: false
    });

    // Complete Stage 1 in Lesson A
    const winStage1 = await postTelemetry(request, {
      student_firstName: student.firstName,
      student_lastName: student.lastName,
      student_class: student.studentClass,
      course_slug: '8-класс',
      lesson_id: '6',
      level_number: campaign[0].mapLevel,
      stage_current: 1,
      stage_total: campaign.length,
      mission_name: 'Урок 6 :: Prince of Persia (Этап 1)',
      action_type: 'prince_complete',
      status: 'completed',
      time_spent_sec: 55,
      success: true,
      is_hardcore: true
    });
    expect(winStage1.status()).toBe(200);
    const winStage1Body = await winStage1.json();
    expect(winStage1Body.success).toBe(true);
    expect(winStage1Body.stage).toBe(1);
    expect(winStage1Body.mapLevel).toBe(campaign[0].mapLevel);

    // Idempotent retry of Stage 1 in Lesson A must return 200 without duplicating rows
    const retryStage1 = await postTelemetry(request, {
      student_firstName: student.firstName,
      student_lastName: student.lastName,
      student_class: student.studentClass,
      course_slug: '8-класс',
      lesson_id: '6',
      level_number: campaign[0].mapLevel,
      stage_current: 1,
      mission_name: 'Урок 6 :: Prince of Persia (Этап 1)',
      action_type: 'prince_complete',
      status: 'completed',
      time_spent_sec: 60,
      success: true,
      is_hardcore: true
    });
    expect(retryStage1.status()).toBe(200);
    const retryBody = await retryStage1.json();
    expect(retryBody.success).toBe(true);
    expect(retryBody.idempotent).toBe(true);
    expect(retryBody.stage).toBe(1);

    // Rule "1 lesson = 1 stage": attempting to claim Stage 2 in Lesson A must be rejected (409)
    const secondStageSameLesson = await postTelemetry(request, {
      student_firstName: student.firstName,
      student_lastName: student.lastName,
      student_class: student.studentClass,
      course_slug: '8-класс',
      lesson_id: '6',
      level_number: campaign[1].mapLevel,
      stage_current: 2,
      mission_name: 'Урок 6 :: Prince of Persia (Этап 2)',
      action_type: 'prince_complete',
      status: 'completed',
      time_spent_sec: 40,
      success: true,
      is_hardcore: true
    });
    expect(secondStageSameLesson.status()).toBe(409);

    // Verify /api/progress for Lesson A reflects Stage 1 completed
    const progA2 = await (
      await request.get(`${baseUrl}/api/progress`, {
        params: {
          firstName: student.firstName,
          lastName: student.lastName,
          className: student.studentClass,
          lessonPrefix: 'Урок 6',
          courseSlug: '8-класс',
          lessonId: '6'
        }
      })
    ).json();
    expect(progA2.princeCompleted).toBe(true);
    expect(progA2.princeProgress.lessonStageCompleted).toBe(1);
    expect(progA2.princeProgress.lessonMapLevel).toBe(campaign[0].mapLevel);
    expect(progA2.princeProgress.completedStages).toEqual([1]);
    expect(progA2.princeProgress.nextStage).toEqual({
      stage: campaign[1].stage,
      mapLevel: campaign[1].mapLevel,
      title: campaign[1].title
    });

    // Lesson B (8-класс, lesson 7): complete hardcore -> should immediately offer Stage 2
    await completeLessonLevels(request, student, '8-класс', '7', true);

    const progB1 = await (
      await request.get(`${baseUrl}/api/progress`, {
        params: {
          firstName: student.firstName,
          lastName: student.lastName,
          className: student.studentClass,
          lessonPrefix: 'Урок 7',
          courseSlug: '8-класс',
          lessonId: '7'
        }
      })
    ).json();
    expect(progB1.princeCompleted).toBe(false);
    expect(progB1.princeProgress.eligibleForHardcoreBonus).toBe(true);
    expect(progB1.princeProgress.lessonStageCompleted).toBeNull();
    expect(progB1.princeProgress.lessonMapLevel).toBeNull();
    expect(progB1.princeProgress.completedStages).toEqual([1]);
    expect(progB1.princeProgress.nextStage).toEqual({
      stage: campaign[1].stage,
      mapLevel: campaign[1].mapLevel,
      title: campaign[1].title
    });

    // Cannot re-claim Stage 1 in Lesson B
    const duplicateStageInB = await postTelemetry(request, {
      student_firstName: student.firstName,
      student_lastName: student.lastName,
      student_class: student.studentClass,
      course_slug: '8-класс',
      lesson_id: '7',
      level_number: campaign[0].mapLevel,
      stage_current: 1,
      mission_name: 'Урок 7 :: Prince of Persia (Этап 1)',
      action_type: 'prince_complete',
      success: true
    });
    expect(duplicateStageInB.status()).toBe(409);

    // Complete Stage 2 in Lesson B (omitting explicit stage_current to verify backend auto-computation)
    const winStage2 = await postTelemetry(request, {
      student_firstName: student.firstName,
      student_lastName: student.lastName,
      student_class: student.studentClass,
      course_slug: '8-класс',
      lesson_id: '7',
      mission_name: 'Урок 7 :: Prince of Persia',
      action_type: 'prince_complete',
      status: 'completed',
      time_spent_sec: 72,
      success: true,
      is_hardcore: true
    });
    expect(winStage2.status()).toBe(200);
    const winStage2Body = await winStage2.json();
    expect(winStage2Body.stage).toBe(2);
    expect(winStage2Body.mapLevel).toBe(campaign[1].mapLevel);

    const progB2 = await (
      await request.get(`${baseUrl}/api/progress`, {
        params: {
          firstName: student.firstName,
          lastName: student.lastName,
          className: student.studentClass,
          lessonPrefix: 'Урок 7',
          courseSlug: '8-класс',
          lessonId: '7'
        }
      })
    ).json();
    expect(progB2.princeCompleted).toBe(true);
    expect(progB2.princeProgress.lessonStageCompleted).toBe(2);
    expect(progB2.princeProgress.lessonMapLevel).toBe(campaign[1].mapLevel);
    expect(progB2.princeProgress.completedStages).toEqual([1, 2]);
    expect(progB2.princeProgress.nextStage.stage).toBe(3);

    // Verify DB rows directly
    const db = new Database(dbPath);
    const rows = db
      .prepare('SELECT course_slug, lesson_id, stage, map_level FROM prince_progress WHERE first_name = ? AND last_name = ? ORDER BY stage ASC')
      .all(student.firstName, student.lastName);
    expect(rows).toEqual([
      { course_slug: '8-класс', lesson_id: '6', stage: 1, map_level: campaign[0].mapLevel },
      { course_slug: '8-класс', lesson_id: '7', stage: 2, map_level: campaign[1].mapLevel }
    ]);
    db.close();
  });
});
