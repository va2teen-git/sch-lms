import type { APIRoute } from 'astro';
import Database from 'better-sqlite3';
import path from 'path';
import { ensurePrinceProgressSchema, getLessonProgressSnapshot } from '../../lib/prince-progress';
import { getNextCampaignStage, getTotalCampaignStages } from '../../lib/prince-campaign';

// Initialize DB
const dbPath = path.join(process.cwd(), 'telemetry.db');
const db = new Database(dbPath);

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT,
    last_name TEXT,
    class_name TEXT,
    mission_name TEXT,
    action_type TEXT,
    start_time TEXT,
    time_spent_sec INTEGER,
    attempts_count INTEGER,
    success BOOLEAN,
    status TEXT,
    action_log TEXT,
    is_hardcore BOOLEAN DEFAULT 0,
    student_class TEXT,
    course_slug TEXT,
    lesson_id TEXT,
    level_number INTEGER,
    attempt_id TEXT,
    attempt_number INTEGER DEFAULT 1,
    attempt_mode TEXT DEFAULT 'normal',
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

try {
  db.exec("ALTER TABLE telemetry ADD COLUMN is_hardcore BOOLEAN DEFAULT 0");
} catch(e) {}
try {
  db.exec("ALTER TABLE telemetry ADD COLUMN student_class TEXT");
} catch(e) {}
try {
  db.exec("ALTER TABLE telemetry ADD COLUMN course_slug TEXT");
} catch(e) {}
try {
  db.exec("ALTER TABLE telemetry ADD COLUMN lesson_id TEXT");
} catch(e) {}
try {
  db.exec("ALTER TABLE telemetry ADD COLUMN level_number INTEGER");
} catch(e) {}
try {
  db.exec("ALTER TABLE telemetry ADD COLUMN attempt_id TEXT");
} catch(e) {}
try {
  db.exec("ALTER TABLE telemetry ADD COLUMN attempt_number INTEGER DEFAULT 1");
} catch(e) {}
try {
  db.exec("ALTER TABLE telemetry ADD COLUMN attempt_mode TEXT DEFAULT 'normal'");
} catch(e) {}
try {
  db.exec("ALTER TABLE telemetry ADD COLUMN stage_current INTEGER");
} catch(e) {}
try {
  db.exec("ALTER TABLE telemetry ADD COLUMN stage_total INTEGER");
} catch(e) {}
try {
  db.exec("ALTER TABLE telemetry ADD COLUMN wave_number INTEGER");
} catch(e) {}

try {
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_telemetry_student ON telemetry (class_name, last_name, first_name);
    CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry (timestamp);
    CREATE INDEX IF NOT EXISTS idx_telemetry_mission ON telemetry (mission_name);
    CREATE INDEX IF NOT EXISTS idx_telemetry_student_cohort ON telemetry(student_class, timestamp);
    CREATE INDEX IF NOT EXISTS idx_telemetry_course_lesson ON telemetry(course_slug, lesson_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_telemetry_attempt ON telemetry(attempt_id);
    CREATE INDEX IF NOT EXISTS idx_telemetry_student_attempt ON telemetry(student_class, last_name, first_name, attempt_id);
    CREATE INDEX IF NOT EXISTS idx_telemetry_sprint ON telemetry(course_slug, lesson_id, student_class, action_type);
  `);
} catch(e) {
  // Indexes might already exist, ignore
}

ensurePrinceProgressSchema(db);

export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get('Content-Type') === 'application/json') {
    try {
      const body = await request.json();
      
      const insert = db.prepare(`
        INSERT INTO telemetry (
          first_name, last_name, class_name, mission_name, action_type,
          start_time, time_spent_sec, attempts_count, success, status, action_log, is_hardcore,
          student_class, course_slug, lesson_id, level_number,
          attempt_id, attempt_number, attempt_mode,
          stage_current, stage_total, wave_number
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);
      
      const fName = String(body.student_firstName || body.first_name || 'Unknown').trim();
      const lName = String(body.student_lastName || body.last_name || 'Unknown').trim();
      const sClass = String(body.student_class || body.class_name || 'Unknown').trim();
      const cName = sClass;
      const mName = String(body.mission_name || '').trim();
      const aType = String(body.action_type || '').trim();
      const sTime = String(body.start_time || '');
      const tSpent = Math.max(0, Math.min(86400, parseInt(body.time_spent_sec, 10) || 0));
      const aCount = Math.max(0, parseInt(body.attempts_count, 10) || 0);
      const isSuccess = body.success ? 1 : 0;
      const curStatus = String(body.status || '');

      let rawLogArr: any = body.action_log;
      if (typeof rawLogArr === 'string') {
        try { rawLogArr = JSON.parse(rawLogArr); } catch (e) {}
      }
      if (body.timer_mode || body.is_manual_reset) {
        const metaItem: Record<string, any> = {};
        if (body.timer_mode) metaItem.timerMode = String(body.timer_mode);
        if (body.is_manual_reset) metaItem.action = 'manual_reset';
        if (Array.isArray(rawLogArr)) {
          rawLogArr = [...rawLogArr, metaItem];
        } else if (rawLogArr && typeof rawLogArr === 'object') {
          rawLogArr = [rawLogArr, metaItem];
        } else {
          rawLogArr = [metaItem];
        }
      }
      const aLog = typeof rawLogArr === 'string' ? rawLogArr : JSON.stringify(rawLogArr || []);
      const isHc = body.is_hardcore ? 1 : 0;

      let courseSlug = body.course_slug ? String(body.course_slug).trim() : null;
      let lessonId = body.lesson_id ? String(body.lesson_id).trim() : null;
      let levelNum = (body.level_number !== undefined && body.level_number !== null)
        ? parseInt(body.level_number, 10)
        : null;

      const attemptId = body.attempt_id ? String(body.attempt_id).trim() : null;
      const attemptNum = body.attempt_number ? Math.max(1, parseInt(body.attempt_number, 10) || 1) : 1;
      const attemptMode = body.attempt_mode ? String(body.attempt_mode).trim() : (isHc ? 'hardcore' : 'normal');

      const parseOptInt = (v: any) => {
        if (v === undefined || v === null || v === '') return null;
        const n = parseInt(String(v), 10);
        return !isNaN(n) && n > 0 ? n : null;
      };
      const stageCurrent = parseOptInt(body.stage_current ?? body.stage ?? body.phase ?? body.step ?? body.wave);
      const stageTotal = parseOptInt(body.stage_total ?? body.total_stages ?? body.total_phases ?? body.total_waves);
      const waveNumber = parseOptInt(body.wave_number ?? body.wave);

      if (levelNum === null && mName) {
        if (/Уровень\s*1/i.test(mName) || /Ур\s*1/i.test(mName)) levelNum = 1;
        else if (/Уровень\s*2/i.test(mName) || /Ур\s*2/i.test(mName)) levelNum = 2;
        else if (/Уровень\s*3/i.test(mName) || /Ур\s*3/i.test(mName)) levelNum = 3;
      }
      if (!lessonId && mName) {
        const match = mName.match(/Урок\s+(\d+)/i);
        if (match) lessonId = match[1];
      }
      if (!courseSlug && sClass && sClass !== 'Unknown') {
        courseSlug = sClass;
      }

      const isPrinceCompletion =
        (aType === 'prince_complete' && body.success !== false && body.success !== 0) ||
        (mName.includes('Prince of Persia') &&
          isSuccess === 1 &&
          (aType === 'level_complete' || aType === 'prince_complete' || aType === 'task_completed' || aType === ''));

      if (isPrinceCompletion) {
        if (!courseSlug || !lessonId) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing course_slug or lesson_id for Prince completion' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }

        const requestedStage = parseOptInt(body.stage_current ?? body.stage);
        let requestedMapLevel = parseOptInt(body.map_level);
        if (requestedMapLevel === null && levelNum !== null && !isNaN(levelNum) && levelNum > 0) {
          requestedMapLevel = levelNum;
        }
        if (requestedMapLevel === null && requestedStage === null && mName) {
          const lvlMatch = mName.match(/Prince of Persia\s*\(Уровень\s*(\d+)\)/i);
          if (lvlMatch) {
            requestedMapLevel = parseOptInt(lvlMatch[1]);
          }
        }

        const handlePrinceTx = db.transaction(() => {
          const snapshot = getLessonProgressSnapshot(db, {
            firstName: fName,
            lastName: lName,
            className: sClass,
            courseSlug,
            lessonId
          });

          if (!snapshot.isHardcoreCompleted) {
            return {
              status: 403,
              payload: { success: false, error: 'Hardcore mode not completed for this lesson' }
            };
          }

          const progressRows = db.prepare(`
            SELECT course_slug, lesson_id, stage, map_level
            FROM prince_progress
            WHERE first_name = ? AND last_name = ? AND student_class = ?
            ORDER BY stage ASC
          `).all(fName, lName, sClass) as Array<{
            course_slug: string;
            lesson_id: string;
            stage: number;
            map_level: number;
          }>;

          const existingLessonRow = progressRows.find(
            (r) => r.course_slug === courseSlug && r.lesson_id === lessonId
          );

          if (existingLessonRow) {
            const completedStage = Number(existingLessonRow.stage);
            const completedMapLevel = Number(existingLessonRow.map_level);
            if (requestedStage !== null && requestedStage !== completedStage) {
              return {
                status: 409,
                payload: {
                  success: false,
                  error: 'Stage already completed for this lesson (1 lesson = 1 stage)',
                  lessonStageCompleted: completedStage
                }
              };
            }
            if (requestedMapLevel !== null && requestedMapLevel !== completedMapLevel) {
              return {
                status: 409,
                payload: {
                  success: false,
                  error: 'Stage already completed for this lesson (1 lesson = 1 stage)',
                  lessonStageCompleted: completedStage,
                  lessonMapLevel: completedMapLevel
                }
              };
            }
            return {
              status: 200,
              payload: {
                success: true,
                idempotent: true,
                stage: completedStage,
                mapLevel: completedMapLevel
              }
            };
          }

          const completedStages = progressRows.map((r) => Number(r.stage));
          const expectedStage = getNextCampaignStage(completedStages);
          if (!expectedStage) {
            return {
              status: 409,
              payload: {
                success: false,
                error: 'All Prince campaign stages already completed',
                campaignFinished: true
              }
            };
          }

          if (requestedStage !== null && requestedStage !== expectedStage.stage) {
            return {
              status: 409,
              payload: {
                success: false,
                error: 'Unexpected stage for Prince campaign',
                expectedStage: expectedStage.stage,
                requestedStage
              }
            };
          }

          if (requestedMapLevel !== null && requestedMapLevel !== expectedStage.mapLevel) {
            return {
              status: 409,
              payload: {
                success: false,
                error: 'Unexpected map_level for Prince campaign',
                expectedStage: expectedStage.stage,
                expectedMapLevel: expectedStage.mapLevel,
                requestedMapLevel
              }
            };
          }

          const totalStages = getTotalCampaignStages();
          insert.run(
            fName,
            lName,
            cName,
            mName || `Урок ${lessonId} :: Prince of Persia (Этап ${expectedStage.stage})`,
            aType,
            sTime,
            tSpent,
            aCount,
            1,
            curStatus || 'completed',
            aLog,
            isHc,
            sClass,
            courseSlug,
            lessonId,
            levelNum,
            attemptId,
            attemptNum,
            attemptMode,
            stageCurrent ?? expectedStage.stage,
            stageTotal ?? totalStages,
            waveNumber
          );

          db.prepare(`
            INSERT INTO prince_progress (
              first_name, last_name, student_class, course_slug, lesson_id,
              stage, map_level, time_spent_sec
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            fName,
            lName,
            sClass,
            courseSlug,
            lessonId,
            expectedStage.stage,
            expectedStage.mapLevel,
            tSpent
          );

          return {
            status: 200,
            payload: {
              success: true,
              idempotent: false,
              stage: expectedStage.stage,
              mapLevel: expectedStage.mapLevel
            }
          };
        });

        const txResult = handlePrinceTx();
        return new Response(JSON.stringify(txResult.payload), {
          status: txResult.status,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      insert.run(
        fName,
        lName,
        cName,
        mName,
        aType,
        sTime,
        tSpent,
        aCount,
        isSuccess,
        curStatus,
        aLog,
        isHc,
        sClass,
        courseSlug,
        lessonId,
        levelNum,
        attemptId,
        attemptNum,
        attemptMode,
        stageCurrent,
        stageTotal,
        waveNumber
      );
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (err: any) {
      console.error('API Telemetry Error:', err);
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }
  return new Response(null, { status: 400 });
};
