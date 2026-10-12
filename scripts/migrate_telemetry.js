import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const dbPath = path.join(rootDir, 'telemetry.db');
const coursesPath = path.join(rootDir, 'src', 'data', 'courses.json');
const courses = JSON.parse(fs.readFileSync(coursesPath, 'utf-8'));

console.log('Connecting to database:', dbPath);
const db = new Database(dbPath);

// Step 1: Ensure columns exist
console.log('Checking and altering table schema...');
const columnsToAdd = [
  { name: 'student_class', type: 'TEXT' },
  { name: 'course_slug', type: 'TEXT' },
  { name: 'lesson_id', type: 'TEXT' },
  { name: 'level_number', type: 'INTEGER' }
];

for (const col of columnsToAdd) {
  try {
    db.exec(`ALTER TABLE telemetry ADD COLUMN ${col.name} ${col.type}`);
    console.log(`Added column ${col.name}`);
  } catch (e) {
    // Column already exists
  }
}

// Ensure indexes
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_telemetry_student_cohort ON telemetry(student_class, timestamp);
  CREATE INDEX IF NOT EXISTS idx_telemetry_course_lesson ON telemetry(course_slug, lesson_id, timestamp);
`);
console.log('Indexes created/verified.');

// Step 2: Build primary student_class mapping
console.log('Analyzing student cohorts...');
const classCountRows = db.prepare(`
  SELECT first_name, last_name, class_name, count(*) as cnt 
  FROM telemetry 
  WHERE first_name NOT LIKE '%Unknown%' AND last_name NOT LIKE '%Unknown%' 
    AND class_name NOT LIKE '%Unknown%' AND class_name != '11-ИТ' 
  GROUP BY first_name, last_name, class_name
`).all();

const studentClassCounts = new Map();
classCountRows.forEach(r => {
  const normKey = [r.first_name.trim().toLowerCase(), r.last_name.trim().toLowerCase()].sort().join(' ');
  if (!studentClassCounts.has(normKey)) studentClassCounts.set(normKey, {});
  studentClassCounts.get(normKey)[r.class_name] = (studentClassCounts.get(normKey)[r.class_name] || 0) + r.cnt;
});

const studentPrimaryClass = new Map();
studentClassCounts.forEach((counts, normKey) => {
  let best = '', max = -1;
  for (const [cls, cnt] of Object.entries(counts)) {
    if (cnt > max) { max = cnt; best = cls; }
  }
  studentPrimaryClass.set(normKey, best);
});

console.log(`Mapped ${studentPrimaryClass.size} students to permanent cohorts.`);

// Step 3: Helper functions for parsing mission_name
function parseLevel(missionName) {
  if (!missionName) return null;
  if (/Уровень\s*1/i.test(missionName) || /Ур\s*1/i.test(missionName) || /\(Базовый\)/i.test(missionName)) return 1;
  if (/Уровень\s*2/i.test(missionName) || /Ур\s*2/i.test(missionName)) return 2;
  if (/Уровень\s*3/i.test(missionName) || /Ур\s*3/i.test(missionName) || /Аркада/i.test(missionName)) return 3;
  return null;
}

function parseLessonAndCourse(missionName, recordedClassName) {
  let lessonId = null;
  let courseSlug = null;
  const m = missionName || '';

  // 1. Explicit slug in mission_name: e.g. "10-класс_углубленный :: 19 :: Уровень 1"
  for (const c of courses) {
    if (m.includes(c.slug)) {
      courseSlug = c.slug;
      break;
    }
  }

  // 2. Lesson ID extraction
  const lMatch = m.match(/Урок\s+(\d+)/i);
  if (lMatch) {
    lessonId = lMatch[1];
  } else {
    const numMatch = m.match(/::\s*(\d+)\s*::/);
    if (numMatch) {
      lessonId = numMatch[1];
    }
  }

  // 3. Topic matching
  if (!courseSlug || !lessonId) {
    if (/Машина\s+Тьюринга/i.test(m)) {
      courseSlug = '11-класс_углубленный';
      lessonId = '20';
    } else if (/Машина\s+Поста/i.test(m)) {
      courseSlug = '11-класс_углубленный';
      lessonId = '22';
    } else if (/Логические\s+высказывания/i.test(m)) {
      courseSlug = '8-класс';
      lessonId = '7';
    } else if (/Архивация/i.test(m)) {
      courseSlug = '7-класс';
      lessonId = '5';
    } else if (/Системы\s+счисления/i.test(m)) {
      courseSlug = '8-класс';
      lessonId = '6';
    } else if (/Вредоносн/i.test(m)) {
      courseSlug = '10-класс_базовый';
      lessonId = '20';
    } else if (/Основы\s+теории\s+игр/i.test(m)) {
      courseSlug = '10-класс_углубленный';
      lessonId = '19';
    } else if (/Средства\s+искусственного\s+интеллекта/i.test(m)) {
      courseSlug = '11-класс_базовый';
      lessonId = '18';
    } else if (/Глобальная\s+сеть/i.test(m)) {
      courseSlug = '9-класс';
      lessonId = '6';
    } else if (/Законодательство\s+РФ/i.test(m) || /Законодательство\s+Российской/i.test(m)) {
      courseSlug = '10-класс_базовый';
      lessonId = '6';
    } else if (/Сервисы\s+Интернета/i.test(m) || /электронные\s+сервисы/i.test(m)) {
      courseSlug = '11-класс_базовый';
      lessonId = '18';
    } else if (/Форматирование\s+текста/i.test(m)) {
      courseSlug = '7-класс';
      lessonId = '22';
    }
  }

  // 4. If lessonId is known (e.g. "Урок 20") and courseSlug not yet determined
  if (lessonId && !courseSlug) {
    if (m.includes('7 класс')) courseSlug = '7-класс';
    else if (m.includes('8 класс')) courseSlug = '8-класс';
    else if (m.includes('9 класс')) courseSlug = '9-класс';
    else if (m.includes('10 класс')) courseSlug = '10-класс_углубленный';
    else if (m.includes('11 класс') || recordedClassName === '11-ИТ') courseSlug = '11-класс_углубленный';
    else if (recordedClassName && recordedClassName !== 'Unknown') {
      courseSlug = recordedClassName;
    }
  }

  // 5. Fallback for courseSlug if still null
  if (!courseSlug && recordedClassName && recordedClassName !== 'Unknown') {
    courseSlug = recordedClassName;
  }

  return { lessonId, courseSlug };
}

// Step 4: Migrate rows in a single transaction
console.log('Fetching all telemetry rows for migration...');
const rows = db.prepare('SELECT id, first_name, last_name, class_name, mission_name FROM telemetry').all();

const updateStmt = db.prepare(`
  UPDATE telemetry 
  SET student_class = ?, course_slug = ?, lesson_id = ?, level_number = ? 
  WHERE id = ?
`);

console.log(`Starting migration for ${rows.length} rows...`);

const runMigration = db.transaction(() => {
  let updated = 0;
  for (const r of rows) {
    const fn = (r.first_name || '').trim();
    const ln = (r.last_name || '').trim();
    const normKey = [fn.toLowerCase(), ln.toLowerCase()].sort().join(' ');
    
    // Student class
    let sClass = studentPrimaryClass.get(normKey);
    if (!sClass) {
      sClass = r.class_name || 'Unknown';
    }

    // Level, Lesson, Course
    const lvlNum = parseLevel(r.mission_name);
    const { lessonId, courseSlug } = parseLessonAndCourse(r.mission_name, r.class_name);

    updateStmt.run(sClass, courseSlug, lessonId, lvlNum, r.id);
    updated++;
  }
  return updated;
});

const count = runMigration();
console.log(`Successfully migrated ${count} rows!`);

// Step 5: Verification check
const check = db.prepare(`
  SELECT 
    COUNT(*) as total,
    COUNT(student_class) as with_student_class,
    COUNT(course_slug) as with_course_slug,
    COUNT(lesson_id) as with_lesson_id,
    COUNT(level_number) as with_level_number
  FROM telemetry
`).get();

console.log('Migration results:', check);

// Cross-course check
const crossCourse = db.prepare(`
  SELECT student_class, course_slug, lesson_id, COUNT(*) as cnt
  FROM telemetry
  WHERE student_class = '10-класс_углубленный' AND course_slug = '8-класс' AND lesson_id = '7'
  GROUP BY student_class, course_slug, lesson_id
`).all();

console.log('Cross-course 10th grade on 8th grade lesson 7:', crossCourse);

db.close();
