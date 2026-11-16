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
  { name: 'level_number', type: 'INTEGER' },
  { name: 'attempt_id', type: 'TEXT' },
  { name: 'attempt_number', type: 'INTEGER DEFAULT 1' },
  { name: 'attempt_mode', type: 'TEXT DEFAULT "normal"' },
  { name: 'stage_current', type: 'INTEGER' },
  { name: 'stage_total', type: 'INTEGER' },
  { name: 'wave_number', type: 'INTEGER' }
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
  CREATE INDEX IF NOT EXISTS idx_telemetry_attempt ON telemetry(attempt_id);
  CREATE INDEX IF NOT EXISTS idx_telemetry_student_attempt ON telemetry(student_class, last_name, first_name, attempt_id);
  CREATE INDEX IF NOT EXISTS idx_telemetry_sprint ON telemetry(course_slug, lesson_id, student_class, action_type);
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

// Step 3: Helper functions
function toPosInt(val) {
  if (val === undefined || val === null || val === '') return null;
  const n = parseInt(String(val), 10);
  return !isNaN(n) && n > 0 ? n : null;
}

function parseLevel(missionName, actionType, rawLog) {
  const m = String(missionName || '');
  if (actionType === 'sprint_complete' || actionType === 'prince_complete' || m.includes('Prince of Persia')) {
    return 0;
  }
  if (/Уровень\s*1/i.test(m) || /Ур\s*1/i.test(m) || /\(Базовый\)/i.test(m)) return 1;
  if (/Уровень\s*2/i.test(m) || /Ур\s*2/i.test(m)) return 2;
  if (/Уровень\s*3/i.test(m) || /Ур\s*3/i.test(m) || /Аркада/i.test(m) || /10\s*волн/i.test(m)) return 3;

  if (rawLog) {
    try {
      const parsed = typeof rawLog === 'string' ? JSON.parse(rawLog) : rawLog;
      const items = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? [parsed] : []);
      for (const item of items) {
        if (item && typeof item === 'object') {
          const nested = item.payload && typeof item.payload === 'object' ? item.payload : null;
          const tl = toPosInt(
            item.task_level ?? item.level_number ?? item.level ??
            (nested ? (nested.task_level ?? nested.level_number ?? nested.level) : null)
          );
          if (tl && tl >= 1 && tl <= 3) return tl;
        }
      }
    } catch (e) {}
  }

  // Legacy monolithic task.html fallback ("Урок 17: Сетевое администрирование :: Interactive Task")
  if (/Interactive\s+Task/i.test(m)) return 1;

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

  // 3. Topic matching for legacy mission names
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
    } else if (/Сетевое\s+администрирование/i.test(m) || /g10_adv_16/i.test(m)) {
      courseSlug = '10-класс_углубленный';
      lessonId = '17';
    } else if (/Деревья/i.test(m) || /g11_adv_1[45]/i.test(m)) {
      courseSlug = '11-класс_углубленный';
      lessonId = '15';
    } else if (/Основы\s+теории\s+игр/i.test(m)) {
      if (m.includes('10-класс_углубленный')) {
        courseSlug = '10-класс_углубленный';
        lessonId = '19';
      } else {
        courseSlug = '11-класс_углубленный';
        lessonId = '16';
      }
    } else if (/Средства\s+искусственного\s+интеллекта/i.test(m)) {
      courseSlug = '11-класс_углубленный';
      lessonId = '18';
    } else if (/Глобальная\s+сеть/i.test(m)) {
      courseSlug = '9-класс';
      lessonId = '6';
    } else if (/Законодательство\s+РФ/i.test(m) || /Законодательство\s+Российской/i.test(m)) {
      courseSlug = '10-класс_базовый';
      lessonId = '6';
    } else if (/Государственные\s+электронные\s+сервисы/i.test(m)) {
      courseSlug = '11-класс_базовый';
      lessonId = '5';
    } else if (/Сервисы\s+Интернета/i.test(m)) {
      courseSlug = '10-класс_углубленный';
      lessonId = '18';
    } else if (/электронные\s+сервисы/i.test(m)) {
      courseSlug = '11-класс_базовый';
      lessonId = '5';
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

function defaultTotalStages(lvlNum, stage, wave) {
  if (!stage && !wave) return null;
  if (lvlNum === 1) return Math.max(3, stage || 0);
  if (lvlNum === 2) return Math.max(5, stage || 0);
  if (lvlNum === 3) return Math.max(10, stage || 0, wave || 0);
  return null;
}

function extractStageAndWaveFromLog(rawLog, lvlNum, actionType) {
  let stage = null;
  let totalStages = null;
  let wave = null;

  if (!rawLog) {
    return { stageCurrent: null, stageTotal: null, waveNumber: null };
  }

  try {
    const parsed = typeof rawLog === 'string' ? JSON.parse(rawLog) : rawLog;
    const items = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? [parsed] : []);

    for (const item of items) {
      if (typeof item === 'string') {
        const phaseStrMatch = item.match(/\b(?:Phase|Фаза|Этап|Шаг)\s*(\d+)\b/i);
        if (phaseStrMatch) {
          const n = toPosInt(phaseStrMatch[1]);
          if (n) stage = Math.max(stage || 0, n);
        }
        const waveStrMatch = item.match(/\b(?:Wave|Волна)\s*(\d+)\b/i);
        if (waveStrMatch) {
          const w = toPosInt(waveStrMatch[1]);
          if (w) {
            wave = Math.max(wave || 0, w);
            if (!stage) stage = wave;
          }
        }
        continue;
      }

      if (!item || typeof item !== 'object') continue;

      const tStages = toPosInt(item.total_stages ?? item.totalStages ?? item.total_phases ?? item.totalPhases);
      if (tStages) totalStages = tStages;

      const tWaves = toPosInt(item.total_waves ?? item.totalWaves);
      if (tWaves && !totalStages) totalStages = tWaves;

      const sVal = toPosInt(item.stage);
      const pVal = toPosInt(item.phase);
      const stepVal = toPosInt(item.step);
      const act = String(item.action || '');

      if (sVal) {
        stage = sVal;
      } else if (pVal) {
        stage = pVal;
      } else if (stepVal) {
        stage = act.includes('_complete') ? stepVal + 1 : stepVal;
      } else if (act) {
        const actMatch = act.match(/^(?:phase|step|stage)[_-]?(\d+)(?:_(complete))?/i);
        if (actMatch) {
          const n = toPosInt(actMatch[1]);
          if (n) {
            stage = actMatch[2] ? n + 1 : n;
          }
        }
      }

      const wVal = toPosInt(item.wave ?? item.wave_number);
      if (wVal) {
        wave = wVal;
        if (!stage) stage = wVal;
      }
    }
  } catch (e) {
    // Ignore malformed JSON in legacy logs
  }

  if (lvlNum === 3 && stage && !wave) {
    wave = stage;
  }

  if ((stage || wave) && !totalStages) {
    totalStages = defaultTotalStages(lvlNum, stage, wave);
  }

  if (actionType === 'level_complete' && totalStages && stage && stage < totalStages && lvlNum >= 1 && lvlNum <= 3) {
    stage = totalStages;
    if (lvlNum === 3) wave = totalStages;
  }

  return {
    stageCurrent: stage,
    stageTotal: totalStages,
    waveNumber: wave
  };
}

// Step 4: Idempotent migration in a single transaction
console.log('Fetching all telemetry rows for migration...');
const rows = db.prepare(`
  SELECT id, first_name, last_name, class_name, mission_name, action_type, action_log,
         student_class, course_slug, lesson_id, level_number,
         stage_current, stage_total, wave_number
  FROM telemetry
`).all();

const updateStmt = db.prepare(`
  UPDATE telemetry
  SET student_class = ?,
      course_slug = ?,
      lesson_id = ?,
      level_number = ?,
      stage_current = ?,
      stage_total = ?,
      wave_number = ?
  WHERE id = ?
`);

console.log(`Checking ${rows.length} rows for idempotent migration...`);

const runMigration = db.transaction(() => {
  let updated = 0;
  let stageBackfilled = 0;

  for (const r of rows) {
    const fn = (r.first_name || '').trim();
    const ln = (r.last_name || '').trim();
    const normKey = [fn.toLowerCase(), ln.toLowerCase()].sort().join(' ');

    // Preserve already populated student_class (unless empty or 'Unknown')
    let nextStudentClass = (r.student_class && r.student_class !== 'Unknown') ? r.student_class : null;
    if (!nextStudentClass) {
      nextStudentClass = studentPrimaryClass.get(normKey) || r.class_name || 'Unknown';
    }

    // Preserve already populated course_slug, lesson_id, level_number (including 0),
    // except for previously misclassified legacy topic strings corrected in Stage 3.
    const parsedMeta = parseLessonAndCourse(r.mission_name, r.class_name);
    const hasExplicitSlugInMission = courses.some(c => (r.mission_name || '').includes(c.slug));
    const isStage3TopicOverride = !hasExplicitSlugInMission && /Государственные\s+электронные\s+сервисы|Сервисы\s+Интернета|Основы\s+теории\s+игр|Средства\s+искусственного\s+интеллекта|Деревья/i.test(r.mission_name || '');
    const nextCourseSlug = (!isStage3TopicOverride && r.course_slug && r.course_slug !== 'Unknown') ? r.course_slug : parsedMeta.courseSlug;
    const nextLessonId = (!isStage3TopicOverride && r.lesson_id && String(r.lesson_id).trim() !== '') ? String(r.lesson_id).trim() : parsedMeta.lessonId;

    const hasExistingLevel = r.level_number !== null && r.level_number !== undefined;
    const nextLevelNumber = hasExistingLevel
      ? r.level_number
      : parseLevel(r.mission_name, r.action_type, r.action_log);

    // Idempotent backfill of stage_current / stage_total / wave_number from historical action_log
    const extracted = extractStageAndWaveFromLog(r.action_log, nextLevelNumber, r.action_type);
    const nextStageCurrent = toPosInt(r.stage_current) ?? extracted.stageCurrent;
    const nextStageTotal = toPosInt(r.stage_total) ?? extracted.stageTotal ?? (
      nextStageCurrent ? defaultTotalStages(nextLevelNumber, nextStageCurrent, toPosInt(r.wave_number) ?? extracted.waveNumber) : null
    );
    const nextWaveNumber = toPosInt(r.wave_number) ?? extracted.waveNumber;

    const changed =
      nextStudentClass !== r.student_class ||
      nextCourseSlug !== r.course_slug ||
      nextLessonId !== r.lesson_id ||
      nextLevelNumber !== r.level_number ||
      nextStageCurrent !== r.stage_current ||
      nextStageTotal !== r.stage_total ||
      nextWaveNumber !== r.wave_number;

    if (changed) {
      updateStmt.run(
        nextStudentClass,
        nextCourseSlug,
        nextLessonId,
        nextLevelNumber,
        nextStageCurrent,
        nextStageTotal,
        nextWaveNumber,
        r.id
      );
      updated++;
      if (
        (r.stage_current === null && nextStageCurrent !== null) ||
        (r.stage_total === null && nextStageTotal !== null) ||
        (r.wave_number === null && nextWaveNumber !== null)
      ) {
        stageBackfilled++;
      }
    }
  }
  return { updated, stageBackfilled };
});

const result = runMigration();
console.log(`Migration complete: ${result.updated} rows updated (${result.stageBackfilled} rows stage/wave backfilled).`);

// Step 5: Verification check
const check = db.prepare(`
  SELECT
    COUNT(*) as total,
    COUNT(student_class) as with_student_class,
    COUNT(course_slug) as with_course_slug,
    COUNT(lesson_id) as with_lesson_id,
    COUNT(level_number) as with_level_number,
    COUNT(stage_current) as with_stage_current,
    COUNT(stage_total) as with_stage_total,
    COUNT(wave_number) as with_wave_number
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
