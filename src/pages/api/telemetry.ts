import type { APIRoute } from 'astro';
import Database from 'better-sqlite3';
import path from 'path';

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
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_telemetry_student ON telemetry (class_name, last_name, first_name);
    CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp ON telemetry (timestamp);
    CREATE INDEX IF NOT EXISTS idx_telemetry_mission ON telemetry (mission_name);
    CREATE INDEX IF NOT EXISTS idx_telemetry_student_cohort ON telemetry(student_class, timestamp);
    CREATE INDEX IF NOT EXISTS idx_telemetry_course_lesson ON telemetry(course_slug, lesson_id, timestamp);
  `);
} catch(e) {
  // Indexes might already exist, ignore
}

export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get('Content-Type') === 'application/json') {
    try {
      const body = await request.json();
      
      const insert = db.prepare(`
        INSERT INTO telemetry (
          first_name, last_name, class_name, mission_name, action_type,
          start_time, time_spent_sec, attempts_count, success, status, action_log, is_hardcore,
          student_class, course_slug, lesson_id, level_number
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
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
      const aLog = typeof body.action_log === 'string' ? body.action_log : JSON.stringify(body.action_log || []);
      const isHc = body.is_hardcore ? 1 : 0;

      let courseSlug = body.course_slug ? String(body.course_slug).trim() : null;
      let lessonId = body.lesson_id ? String(body.lesson_id).trim() : null;
      let levelNum = (body.level_number !== undefined && body.level_number !== null)
        ? parseInt(body.level_number, 10)
        : null;

      if (!levelNum && mName) {
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
        levelNum
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
