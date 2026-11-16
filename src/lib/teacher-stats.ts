import coursesData from '../data/courses.json';

export interface LevelMetric {
  status: 'not_started' | 'in_progress' | 'completed' | 'reset';
  timeSpentSec: number;
  rawTimeSpentSec?: number;
  pureTimeReportedSec?: number | null;
  firstTs?: Date | null;
  lastTs?: Date | null;
  completeTs?: Date | null;
  startTime?: Date | null;
  errors: number;
  attempts: number;
  completed: boolean;
  hardcore: boolean;
  lastUpdated: string | null;
  currentStage: number | null;
  totalStages: number | null;
  lastResetWave: number | null;
  maxWaveReached: number | null;
}

export interface AttemptMetric {
  attemptId: string;
  attemptNumber: number;
  mode: 'normal' | 'hardcore';
  status: 'completed' | 'in_progress' | 'failed';
  courseSlug?: string | null;
  lessonId?: string | null;
  startedAt: string | null;
  lastActiveAt: string | null;
  totalTimeSec: number;
  errorsCount: number;
  completedLevelsCount: number;
  levels: {
    1: LevelMetric;
    2: LevelMetric;
    3: LevelMetric;
  };
  sprintCpm?: number | null;
  sprintWpm?: number | null;
  sprintTimeSec?: number | null;
  princeCompleted?: boolean;
  princeBestTimeSec?: number | null;
}

export interface StudentMetric {
  key: string;
  displayName: string;
  firstName: string;
  lastName: string;
  className: string;
  firstSeen: string | null;
  lastSeen: string | null;
  isActiveNow: boolean;
  latestIsHardcore?: number;
  levels: {
    1: LevelMetric;
    2: LevelMetric;
    3: LevelMetric;
  };
  normalCompletedLevels?: number[] | Set<number>;
  allHardcoreCompletedLevels?: number[] | Set<number>;
  hardcoreStreakLevels?: number[] | Set<number>;
  hardcoreAttempted?: boolean;
  hardcoreResetsCount?: number;
  hardcoreLevelsConquered?: number;
  hardcoreStatus?: 'none' | 'attempting' | 'failed' | 'completed';
  isHardcoreLegend?: boolean;
  totalActiveTimeSec: number;
  totalErrors: number;
  isHardcore: boolean;
  lessonStatus: 'hardcore_completed' | 'completed' | 'in_progress' | 'not_started';

  // Attempts & Run Tracking
  attemptsCount: number;
  normalAttemptsCount: number;
  hardcoreAttemptsCount: number;
  isNormalMastered: boolean;
  bestNormalTimeSec: number | null;
  bestHardcoreTimeSec: number | null;
  bestSprintTimeSec: number | null;
  sprintCpm?: number | null;
  sprintWpm?: number | null;
  sprintAccuracy?: number | null;
  sprintErrors?: number | null;
  princeCompleted?: boolean;
  princeBestTimeSec?: number | null;
  princeLevels?: number[];
  currentAttempt?: AttemptMetric | null;
  attempts: AttemptMetric[];
  lastCourseSlug?: string | null;
  lastLessonId?: string | null;
  workedLessons?: Array<{ courseSlug: string; lessonId: string }>;

  recentEvents: Array<{
    id: number;
    mission: string;
    course_slug?: string | null;
    lesson_id?: string | null;
    action_type: string;
    timestamp: string;
    time_spent: number;
    log: string;
  }>;
}

export interface TeacherStatsOptions {
  classParams?: string[];
  courseFilter?: string;
  lessonFilter?: string;
  dateFilter?: string;
  excludeTests?: boolean;
  search?: string;
}

interface InternalLevelState extends LevelMetric {
  _lastFailTsMs?: number | null;
  _lastFailAttemptsCount?: number | null;
  _sameSecondFailCount?: number;
  _afkWave1Streak?: number;
  _afkCapped?: boolean;
}

interface StudentAccumulator extends Omit<StudentMetric, 'levels' | 'normalCompletedLevels' | 'allHardcoreCompletedLevels' | 'hardcoreStreakLevels'> {
  levels: {
    1: InternalLevelState;
    2: InternalLevelState;
    3: InternalLevelState;
  };
  normalCompletedLevels: Set<number>;
  allHardcoreCompletedLevels: Set<number>;
  hardcoreStreakLevels: Set<number>;
  _attemptsMap: Record<string, AttemptMetric>;
  _attemptOrder: string[];
  _legacyIdx: number;
  _lastHc: number | null;
  _workedLessonsMap: Record<string, { courseSlug: string; lessonId: string }>;
}

function createEmptyLevel(hardcore = false): InternalLevelState {
  return {
    status: 'not_started',
    rawTimeSpentSec: 0,
    pureTimeReportedSec: null,
    timeSpentSec: 0,
    errors: 0,
    attempts: 0,
    completed: false,
    hardcore,
    firstTs: null,
    lastTs: null,
    completeTs: null,
    startTime: null,
    lastUpdated: null,
    currentStage: null,
    totalStages: null,
    lastResetWave: null,
    maxWaveReached: null,
    _lastFailTsMs: null,
    _lastFailAttemptsCount: null,
    _sameSecondFailCount: 0,
    _afkWave1Streak: 0,
    _afkCapped: false
  };
}

function parseSqlTimestamp(ts: string | null | undefined): Date | null {
  if (!ts) return null;
  const s = String(ts).trim();
  if (!s) return null;
  const iso = s.includes('T') ? (s.endsWith('Z') ? s : s + 'Z') : s.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

interface ParsedLogMeta {
  stage: number | null;
  totalStages: number | null;
  wave: number | null;
  totalWaves: number | null;
  timerMode: string | null;
  isManualReset: boolean;
}

function parseActionLogMeta(rawLog: any, row?: any): ParsedLogMeta {
  const meta: ParsedLogMeta = {
    stage: null,
    totalStages: null,
    wave: null,
    totalWaves: null,
    timerMode: null,
    isManualReset: false
  };

  if (row) {
    if (typeof row.stage_current === 'number' && row.stage_current > 0) meta.stage = row.stage_current;
    if (typeof row.stage_total === 'number' && row.stage_total > 0) meta.totalStages = row.stage_total;
    if (typeof row.wave_number === 'number' && row.wave_number > 0) meta.wave = row.wave_number;
  }

  if (!rawLog) return meta;
  try {
    const parsed = typeof rawLog === 'string' ? JSON.parse(rawLog) : rawLog;
    const items = Array.isArray(parsed) ? parsed : (parsed && typeof parsed === 'object' ? [parsed] : []);
    for (const item of items) {
      if (!item || typeof item !== 'object') continue;
      if (item.action === 'manual_reset' || item.manual_reset === true) {
        meta.isManualReset = true;
      }
      if (typeof item.timerMode === 'string') meta.timerMode = item.timerMode;
      if (typeof item.timer_mode === 'string') meta.timerMode = item.timer_mode;

      const tStages = item.total_stages ?? item.totalStages ?? item.total_phases ?? item.totalPhases;
      if (typeof tStages === 'number' && tStages > 0) meta.totalStages = tStages;

      const tWaves = item.total_waves ?? item.totalWaves;
      if (typeof tWaves === 'number' && tWaves > 0) {
        meta.totalWaves = tWaves;
        if (!meta.totalStages) meta.totalStages = tWaves;
      }

      if (typeof item.stage === 'number' && item.stage > 0) {
        meta.stage = item.stage;
      } else if (typeof item.phase === 'number' && item.phase > 0) {
        meta.stage = item.phase;
      } else if (typeof item.step === 'number' && item.step > 0) {
        // e.g. { step: 1, action: 'phase1_complete' } -> next active stage is step + 1
        const act = String(item.action || '');
        meta.stage = act.includes('_complete') ? item.step + 1 : item.step;
      }

      if (typeof item.wave === 'number' && item.wave > 0) {
        meta.wave = item.wave;
        if (!meta.stage) meta.stage = item.wave;
      }
    }
  } catch (e) {
    // Ignore malformed JSON in legacy logs
  }
  return meta;
}

function defaultTotalStages(lvlNum: 1 | 2 | 3, stage: number | null, maxWave: number | null): number | null {
  if (!stage && !maxWave) return null;
  if (lvlNum === 1) return Math.max(3, stage || 0);
  if (lvlNum === 2) return Math.max(5, stage || 0);
  return Math.max(10, stage || 0, maxWave || 0);
}

/**
 * Deduplicate level times within a level-set (either one attempt or global fallback).
 * Avoids subtracting Level 1/2 time from Level 3 when Level 3 reports pure time or active_tab time.
 */
function deduplicateLevelTimes(levels: { 1: InternalLevelState; 2: InternalLevelState; 3: InternalLevelState }): [number, number, number] {
  const l1 = levels[1];
  const l2 = levels[2];
  const l3 = levels[3];

  const a1Raw = l1.pureTimeReportedSec !== null && l1.pureTimeReportedSec !== undefined ? l1.pureTimeReportedSec : (l1.rawTimeSpentSec || 0);
  const a2Raw = l2.pureTimeReportedSec !== null && l2.pureTimeReportedSec !== undefined ? l2.pureTimeReportedSec : (l2.rawTimeSpentSec || 0);
  const a3Raw = l3.pureTimeReportedSec !== null && l3.pureTimeReportedSec !== undefined ? l3.pureTimeReportedSec : (l3.rawTimeSpentSec || 0);

  const l1IsPure = l1.pureTimeReportedSec !== null && l1.pureTimeReportedSec !== undefined;
  const l2IsPure = l2.pureTimeReportedSec !== null && l2.pureTimeReportedSec !== undefined;
  const l3IsPure = l3.pureTimeReportedSec !== null && l3.pureTimeReportedSec !== undefined;

  const a1Pure = a1Raw;
  let a2Pure = a2Raw;
  let a3Pure = a3Raw;

  const a1Start = l1.startTime;
  const a2Start = l2.startTime;
  const a3Start = l3.startTime;

  // Level 2 deduplication
  if (!l2IsPure && !l1IsPure && a1Raw > 0 && a2Raw >= a1Raw) {
    let isConcurrent12 = true;
    if (a1Start && a2Start) {
      isConcurrent12 = Math.abs(a2Start.getTime() - a1Start.getTime()) < 60000;
      if (l1.completeTs && a2Start.getTime() >= l1.completeTs.getTime() - 2000 && Math.abs(a2Start.getTime() - a1Start.getTime()) > 5000) {
        isConcurrent12 = false;
      }
    } else if (l1.completeTs && l2.firstTs && l2.completeTs) {
      // Without start_time: if L2 started after L1 completed and L2 duration matches wall-clock delta, L2 is pure
      const wall2 = Math.max(0, Math.round((l2.completeTs.getTime() - l1.completeTs.getTime()) / 1000));
      if (l2.firstTs.getTime() > l1.completeTs.getTime() + 5000 && wall2 > 5 && a2Raw <= wall2 + 15 && a2Raw < a1Raw + wall2 * 0.5) {
        isConcurrent12 = false;
      }
    }
    if (isConcurrent12) {
      a2Pure = a2Raw - a1Raw;
    }
  }

  // Level 3 deduplication
  if (!l3IsPure) {
    const prevCumulative = (!l2IsPure && a2Raw > 0) ? a2Raw : (!l1IsPure ? a1Raw : 0);
    if (prevCumulative > 0 && a3Raw >= prevCumulative) {
      let isConcurrent13 = true;
      const refStart = a2Start || a1Start;
      const prevEnd = l2.completeTs || l1.completeTs;

      if (refStart && a3Start) {
        isConcurrent13 = Math.abs(a3Start.getTime() - refStart.getTime()) < 60000;
        // Critical fix: if Level 3's start_time is AFTER Level 1/2 completed (e.g., startGame() clicked after L2),
        // it cannot be cumulative with L1/L2 even if L1+L2 took < 60s!
        if (prevEnd && a3Start.getTime() >= prevEnd.getTime() - 2000 && Math.abs(a3Start.getTime() - refStart.getTime()) > 5000) {
          isConcurrent13 = false;
        }
      } else if (prevEnd && l3.completeTs) {
        // Without start_time (24 task files omit start_time):
        // Distinguish rapid API test bursts (wall3 < 5s) from real sequential Level 3 (startGame() pure time)
        const wall3 = Math.max(0, Math.round((l3.completeTs.getTime() - prevEnd.getTime()) / 1000));
        if (wall3 >= 10 && a3Raw <= wall3 + 20 && a3Raw < prevCumulative + wall3 * 0.5) {
          isConcurrent13 = false;
        }
      }

      if (isConcurrent13) {
        a3Pure = a3Raw - prevCumulative;
      }
    }
  }

  return [Math.max(0, a1Pure), Math.max(0, a2Pure), Math.max(0, a3Pure)];
}

function getTelemetryColumns(db: any): Set<string> {
  try {
    const info = db.prepare('PRAGMA table_info(telemetry)').all() as Array<{ name: string }>;
    return new Set(info.map(c => c.name));
  } catch (e) {
    return new Set();
  }
}

export function computeTeacherStats(db: any, options: TeacherStatsOptions = {}) {
  const courseFilter = options.courseFilter || 'all';
  const lessonFilter = options.lessonFilter || 'all';
  const dateFilter = options.dateFilter || 'today';
  const excludeTests = options.excludeTests !== false;
  const search = (options.search || '').trim().toLowerCase();

  let dateCondition = '';
  const params: any[] = [];

  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  if (dateFilter === 'today') {
    dateCondition = ' AND DATE(timestamp) = ?';
    params.push(todayStr);
  } else if (dateFilter !== 'all' && /^\d{4}-\d{2}-\d{2}$/.test(dateFilter)) {
    dateCondition = ' AND DATE(timestamp) = ?';
    params.push(dateFilter);
  }

  const selectedClasses = (options.classParams || [])
    .flatMap(c => c.split(','))
    .map(c => c.trim())
    .filter(c => c && c !== 'all');

  let classCondition = '';
  if (selectedClasses.length > 0) {
    const placeholders = selectedClasses.map(() => '?').join(', ');
    classCondition = ` AND COALESCE(student_class, class_name) IN (${placeholders})`;
    params.push(...selectedClasses);
  }

  let courseCondition = '';
  if (courseFilter !== 'all') {
    courseCondition = ' AND course_slug = ?';
    params.push(courseFilter);
  }

  let lessonCondition = '';
  if (lessonFilter !== 'all') {
    const match = lessonFilter.match(/\d+/);
    const lId = match ? match[0] : null;
    if (lId) {
      lessonCondition = " AND (lesson_id = ? OR ((lesson_id IS NULL OR lesson_id = '') AND (mission_name = ? OR mission_name LIKE ? OR mission_name LIKE ? OR mission_name LIKE ?)))";
      params.push(lId, `Урок ${lId}`, `%Урок ${lId} %`, `%Урок ${lId}:%`, `%Урок ${lId}`);
    } else {
      const prefix = lessonFilter.startsWith('Урок ') ? lessonFilter : `Урок ${lessonFilter}`;
      lessonCondition = ' AND mission_name LIKE ?';
      params.push(`%${prefix}%`);
    }
  }

  let testCondition = '';
  if (excludeTests) {
    testCondition = ` AND LOWER(first_name) NOT LIKE '%unknown%'
                      AND LOWER(last_name) NOT LIKE '%unknown%'
                      AND LOWER(first_name) NOT LIKE '%тест%'
                      AND LOWER(last_name) NOT LIKE '%тест%'
                      AND LOWER(first_name) NOT LIKE '%test%'
                      AND LOWER(last_name) NOT LIKE '%test%'
                      AND LOWER(first_name) NOT LIKE '%спринтер%'
                      AND LOWER(last_name) NOT LIKE '%спринтер%'
                      AND LOWER(first_name) NOT LIKE '%аттемпт%'
                      AND LOWER(last_name) NOT LIKE '%аттемпт%'
                      AND LOWER(first_name) NOT LIKE '%симулятор%'
                      AND LOWER(last_name) NOT LIKE '%симулятор%'
                      AND NOT (LOWER(first_name) = 'алиса' AND LOWER(last_name) = 'спринтер')
                      AND COALESCE(student_class, class_name) NOT LIKE '%Unknown%'
                      AND COALESCE(student_class, class_name) NOT LIKE '%Test%'
                      AND COALESCE(student_class, class_name) NOT LIKE '%тест%'
                      AND COALESCE(student_class, class_name) != '11-ИТ'`;
  }

  const cols = getTelemetryColumns(db);
  const optionalCols = [
    cols.has('stage_current') ? 'stage_current' : 'NULL as stage_current',
    cols.has('stage_total') ? 'stage_total' : 'NULL as stage_total',
    cols.has('wave_number') ? 'wave_number' : 'NULL as wave_number'
  ].join(', ');

  const query = `
    SELECT id, first_name, last_name, class_name, mission_name, action_type,
           time_spent_sec, attempts_count, success, status, action_log,
           is_hardcore, student_class, course_slug, lesson_id, level_number,
           attempt_id, attempt_number, attempt_mode, timestamp, start_time,
           ${optionalCols}
    FROM telemetry
    WHERE 1=1 ${dateCondition} ${classCondition} ${courseCondition} ${lessonCondition} ${testCondition}
    ORDER BY timestamp ASC, id ASC
  `;

  const rows = db.prepare(query).all(...params);
  const studentsMap: Record<string, StudentAccumulator> = {};

  rows.forEach((r: any) => {
    const fn = (r.first_name || '').trim();
    const ln = (r.last_name || '').trim();
    const effectiveCls = (r.student_class || r.class_name || 'Unknown').trim();
    const nameWords = [fn.toLowerCase(), ln.toLowerCase()].sort();
    const canonicalKey = `${effectiveCls}_${nameWords.join('_')}`;

    if (!studentsMap[canonicalKey]) {
      let disp = `${ln} ${fn}`;
      if (fn.match(/(?:ов|ев|ин|ын|ский|цкий|ова|ева|ина|ына|ская|цкая)$/i) && !ln.match(/(?:ов|ев|ин|ын|ский|цкий|ова|ева|ина|ына|ская|цкая)$/i)) {
        disp = `${fn} ${ln}`;
      }

      studentsMap[canonicalKey] = {
        key: canonicalKey,
        displayName: disp,
        firstName: fn,
        lastName: ln,
        className: effectiveCls,
        firstSeen: r.timestamp,
        lastSeen: r.timestamp,
        isActiveNow: false,
        levels: {
          1: createEmptyLevel(false),
          2: createEmptyLevel(false),
          3: createEmptyLevel(false)
        },
        normalCompletedLevels: new Set<number>(),
        allHardcoreCompletedLevels: new Set<number>(),
        hardcoreStreakLevels: new Set<number>(),
        hardcoreAttempted: false,
        latestIsHardcore: 0,
        hardcoreResetsCount: 0,
        hardcoreLevelsConquered: 0,
        totalActiveTimeSec: 0,
        totalErrors: 0,
        isHardcore: false,
        isHardcoreLegend: false,
        hardcoreStatus: 'none',
        lessonStatus: 'not_started',
        attemptsCount: 0,
        normalAttemptsCount: 0,
        hardcoreAttemptsCount: 0,
        isNormalMastered: false,
        bestNormalTimeSec: null,
        bestHardcoreTimeSec: null,
        bestSprintTimeSec: null,
        sprintCpm: null,
        sprintWpm: null,
        sprintAccuracy: null,
        sprintErrors: null,
        princeCompleted: false,
        princeBestTimeSec: null,
        princeLevels: [],
        currentAttempt: null,
        attempts: [],
        lastCourseSlug: null,
        lastLessonId: null,
        workedLessons: [],
        recentEvents: [],
        _attemptsMap: {},
        _attemptOrder: [],
        _legacyIdx: 1,
        _lastHc: null,
        _workedLessonsMap: {}
      };
    }

    const s = studentsMap[canonicalKey];
    s.lastSeen = r.timestamp;
    s.latestIsHardcore = r.is_hardcore;
    const rowCourse = r.course_slug ? String(r.course_slug).trim() : null;
    const rowLesson = r.lesson_id ? String(r.lesson_id).trim() : null;
    if (rowCourse) s.lastCourseSlug = rowCourse;
    if (rowLesson) s.lastLessonId = rowLesson;
    if (rowCourse && rowLesson) {
      const wlKey = `${rowCourse}::${rowLesson}`;
      if (s._workedLessonsMap[wlKey]) delete s._workedLessonsMap[wlKey];
      s._workedLessonsMap[wlKey] = { courseSlug: rowCourse, lessonId: rowLesson };
    }

    const rTs = parseSqlTimestamp(r.timestamp);
    const rStart = r.start_time ? new Date(r.start_time) : null;
    const validStart = rStart && !isNaN(rStart.getTime()) ? rStart : null;
    const logMeta = parseActionLogMeta(r.action_log, r);

    // Attempt assignment
    let attId = r.attempt_id;
    let attNum = r.attempt_number ? parseInt(r.attempt_number, 10) : null;
    let attMode: 'normal' | 'hardcore' = (r.attempt_mode === 'hardcore' || r.is_hardcore === 1) ? 'hardcore' : 'normal';

    if (!attId) {
      if (s._lastHc !== null && (r.is_hardcore !== s._lastHc || r.action_type === 'normal_reset' || (r.action_type === 'hardcore_reset' && s._lastHc === 1))) {
        s._legacyIdx++;
      }
      s._lastHc = r.is_hardcore;
      attId = `${canonicalKey}_att_${s._legacyIdx}`;
      attNum = s._legacyIdx;
      attMode = r.is_hardcore === 1 ? 'hardcore' : 'normal';
    }

    if (!s._attemptsMap[attId]) {
      s._attemptOrder.push(attId);
      s._attemptsMap[attId] = {
        attemptId: attId,
        attemptNumber: attNum || s._attemptOrder.length,
        mode: attMode,
        status: 'in_progress',
        courseSlug: rowCourse,
        lessonId: rowLesson,
        startedAt: r.timestamp,
        lastActiveAt: r.timestamp,
        totalTimeSec: 0,
        errorsCount: 0,
        completedLevelsCount: 0,
        levels: {
          1: createEmptyLevel(attMode === 'hardcore'),
          2: createEmptyLevel(attMode === 'hardcore'),
          3: createEmptyLevel(attMode === 'hardcore')
        },
        sprintCpm: null,
        sprintWpm: null,
        sprintTimeSec: null,
        princeCompleted: false,
        princeBestTimeSec: null
      };
    }

    const att = s._attemptsMap[attId];
    att.lastActiveAt = r.timestamp;
    if (!att.courseSlug && rowCourse) att.courseSlug = rowCourse;
    if (!att.lessonId && rowLesson) att.lessonId = rowLesson;

    const mNameStr = String(r.mission_name || '');
    const isPrinceRow = mNameStr.includes('Prince of Persia') || r.action_type === 'prince_complete';

    if (isPrinceRow && (r.action_type === 'level_complete' || r.action_type === 'prince_complete') && r.success !== 0) {
      s.princeCompleted = true;
      att.princeCompleted = true;
      const pMatch = mNameStr.match(/Уровень\s*(\d+)/i);
      if (pMatch) {
        const pLvl = parseInt(pMatch[1], 10);
        if (s.princeLevels && !s.princeLevels.includes(pLvl)) {
          s.princeLevels.push(pLvl);
        }
      }
      if (typeof r.time_spent_sec === 'number' && r.time_spent_sec > 0) {
        if (s.princeBestTimeSec === null || s.princeBestTimeSec === undefined || r.time_spent_sec < s.princeBestTimeSec) {
          s.princeBestTimeSec = r.time_spent_sec;
        }
        if (att.princeBestTimeSec === null || att.princeBestTimeSec === undefined || r.time_spent_sec < att.princeBestTimeSec) {
          att.princeBestTimeSec = r.time_spent_sec;
        }
      }
    }

    let lvlNum: 1 | 2 | 3 | null = null;
    if (!isPrinceRow) {
      if (r.level_number === 1 || r.level_number === 2 || r.level_number === 3) {
        lvlNum = r.level_number as 1 | 2 | 3;
      } else if (mNameStr.includes('Уровень 1')) lvlNum = 1;
      else if (mNameStr.includes('Уровень 2')) lvlNum = 2;
      else if (mNameStr.includes('Уровень 3')) lvlNum = 3;
    }

    // Manual lesson restart via "#reset-lesson-btn" should NOT count as an error
    const isManualReset = logMeta.isManualReset || ((r.action_type === 'hardcore_reset' || r.action_type === 'normal_reset') && lvlNum === null);
    const isGameplayFailEvent = r.action_type === 'level_fail' || (r.action_type === 'hardcore_reset' && !isManualReset);

    if (r.is_hardcore === 1) {
      s.hardcoreAttempted = true;
    }

    if (r.action_type === 'hardcore_reset' && r.is_hardcore === 1) {
      s.hardcoreStreakLevels.clear();
      s.hardcoreResetsCount = (s.hardcoreResetsCount || 0) + 1;
      att.status = 'failed';
    }
    if (r.action_type === 'normal_reset' && r.is_hardcore === 0) {
      s.normalCompletedLevels.clear();
    }

    // Track Logo-Storm (sprint_complete)
    if (r.action_type === 'sprint_complete' && typeof r.time_spent_sec === 'number') {
      let logCpm: number | null = null;
      let logWpm: number | null = null;
      let logAcc: number | null = null;
      let logErr: number | null = null;
      try {
        const logData = typeof r.action_log === 'string' ? JSON.parse(r.action_log) : r.action_log;
        if (logData && typeof logData === 'object') {
          const rawCpm = logData.cpm ?? logData.CPM ?? logData.speed_cpm;
          if (rawCpm !== undefined && rawCpm !== null && !isNaN(Number(rawCpm))) {
            logCpm = Math.round(Number(rawCpm));
          } else {
            const chars = logData.charsCount ?? logData.chars_count;
            if (typeof chars === 'number' && r.time_spent_sec > 0) {
              logCpm = Math.round((chars / (r.time_spent_sec / 60)));
            }
          }

          const rawWpm = logData.wpm ?? logData.WPM ?? logData.speed_wpm;
          if (rawWpm !== undefined && rawWpm !== null && !isNaN(Number(rawWpm))) {
            logWpm = Math.round(Number(rawWpm));
          } else if (logCpm !== null) {
            logWpm = Math.round(logCpm / 5);
          }

          const rawAcc = logData.accuracy ?? logData.acc;
          if (rawAcc !== undefined && rawAcc !== null && !isNaN(Number(rawAcc))) {
            logAcc = Math.round(Number(rawAcc) * 10) / 10;
          }

          const rawErr = logData.errorsCount ?? logData.errors_count;
          if (rawErr !== undefined && rawErr !== null && !isNaN(Number(rawErr))) {
            logErr = Math.max(0, Math.round(Number(rawErr)));
          }
        }
      } catch (e) {}

      const isBotSpeed = logCpm !== null && (logCpm > 1000 || logCpm <= 0);
      if (excludeTests && isBotSpeed) {
        logCpm = null;
        logWpm = null;
      }

      if (!excludeTests || !isBotSpeed) {
        const currentBestCpm = s.sprintCpm ?? null;
        let isBetter = false;

        if (currentBestCpm === null) {
          if (logCpm !== null) {
            isBetter = true;
          } else if (s.bestSprintTimeSec === null || r.time_spent_sec < s.bestSprintTimeSec) {
            isBetter = true;
          }
        } else if (logCpm !== null) {
          if (logCpm > currentBestCpm) {
            isBetter = true;
          } else if (logCpm === currentBestCpm && (s.bestSprintTimeSec === null || r.time_spent_sec < s.bestSprintTimeSec)) {
            isBetter = true;
          }
        }

        if (isBetter) {
          s.bestSprintTimeSec = r.time_spent_sec;
          if (logCpm !== null) s.sprintCpm = logCpm;
          if (logWpm !== null) s.sprintWpm = logWpm;
          if (logAcc !== null) s.sprintAccuracy = logAcc;
          if (logErr !== null) s.sprintErrors = logErr;
        }

        if (logCpm !== null && (!att.sprintCpm || logCpm > att.sprintCpm)) {
          att.sprintCpm = logCpm;
          att.sprintWpm = logWpm;
          att.sprintTimeSec = r.time_spent_sec;
        }
      }
    }

    if (lvlNum) {
      const aLvl = att.levels[lvlNum] as InternalLevelState;
      const gLvl = s.levels[lvlNum] as InternalLevelState;

      // Deduplicate click-storm & AFK Wave-1 timeout bursts per (attempt, level)
      let countThisError = false;
      let allowTimeAccumulation = true;

      if (isGameplayFailEvent) {
        const curMs = rTs ? rTs.getTime() : 0;
        const curAttCnt = typeof r.attempts_count === 'number' ? r.attempts_count : null;
        const prevMs = aLvl._lastFailTsMs ?? null;
        const prevAttCnt = aLvl._lastFailAttemptsCount ?? null;

        // 1. Click-storm guard (same attempts_count within 1s, or >= 3 distinct fails in the exact same second)
        const isSameAttDuplicate =
          prevMs !== null &&
          Math.abs(curMs - prevMs) <= 1000 &&
          curAttCnt !== null &&
          prevAttCnt !== null &&
          curAttCnt > 0 &&
          curAttCnt === prevAttCnt;

        if (!isSameAttDuplicate) {
          if (prevMs !== null && curMs === prevMs) {
            aLvl._sameSecondFailCount = (aLvl._sameSecondFailCount || 1) + 1;
          } else {
            aLvl._sameSecondFailCount = 1;
          }
        }
        const isBurstStorm = !isSameAttDuplicate && (aLvl._sameSecondFailCount || 1) >= 3;
        const isBurstDuplicate = isSameAttDuplicate || isBurstStorm;

        // 2. AFK Wave-1 timeout loop guard on Level 3 (repeating Wave-1 resets every 5-30s with no progress)
        if (lvlNum === 3 && (logMeta.wave === 1 || logMeta.wave === null) && prevMs !== null) {
          const deltaSec = (curMs - prevMs) / 1000;
          if (deltaSec >= 4 && deltaSec <= 35) {
            aLvl._afkWave1Streak = (aLvl._afkWave1Streak || 0) + 1;
            if (aLvl._afkWave1Streak > 3) {
              aLvl._afkCapped = true;
            }
          } else {
            aLvl._afkWave1Streak = 0;
            aLvl._afkCapped = false;
          }
        } else {
          aLvl._afkWave1Streak = 0;
          aLvl._afkCapped = false;
        }

        if (aLvl._afkCapped) {
          allowTimeAccumulation = false;
        }

        if (!isBurstDuplicate && !aLvl._afkCapped) {
          countThisError = true;
        }

        aLvl._lastFailTsMs = curMs;
        aLvl._lastFailAttemptsCount = curAttCnt;
      } else {
        // Any non-fail progress / completion breaks an AFK timeout streak
        if (r.action_type === 'level_complete' || (logMeta.wave && logMeta.wave > 1)) {
          aLvl._afkWave1Streak = 0;
          aLvl._afkCapped = false;
        }
      }

      if (countThisError) {
        s.totalErrors++;
        att.errorsCount++;
        aLvl.errors++;
        gLvl.errors++;
      }

      const updateLevelTarget = (target: InternalLevelState, isGlobal: boolean) => {
        target.attempts++;
        target.lastUpdated = r.timestamp;
        if (target.firstTs === null && rTs) target.firstTs = rTs;
        if (rTs) target.lastTs = rTs;
        if (validStart && (!target.startTime || (r.action_type === 'level_complete' && validStart.getTime() > target.startTime.getTime() && logMeta.timerMode !== 'active_tab'))) {
          target.startTime = validStart;
        }

        if (allowTimeAccumulation && typeof r.time_spent_sec === 'number') {
          if (logMeta.timerMode === 'active_tab') {
            if (target.pureTimeReportedSec === null || target.pureTimeReportedSec === undefined || r.time_spent_sec > target.pureTimeReportedSec) {
              target.pureTimeReportedSec = r.time_spent_sec;
            }
          }
          if (r.time_spent_sec > (target.rawTimeSpentSec || 0)) {
            target.rawTimeSpentSec = r.time_spent_sec;
          }
        }

        // Track stages & waves
        const stageCandidate = logMeta.stage;
        if (stageCandidate && stageCandidate > 0) {
          target.currentStage = stageCandidate;
          target.totalStages = logMeta.totalStages || target.totalStages || defaultTotalStages(lvlNum, stageCandidate, target.maxWaveReached);
        }

        if (lvlNum === 3) {
          const waveVal = logMeta.wave || (stageCandidate && stageCandidate > 0 ? stageCandidate : null);
          if (waveVal && waveVal > 0) {
            target.maxWaveReached = Math.max(target.maxWaveReached || 0, waveVal);
            if (!target.totalStages) {
              target.totalStages = logMeta.totalWaves || logMeta.totalStages || defaultTotalStages(3, waveVal, target.maxWaveReached);
            }
            if (isGameplayFailEvent) {
              target.lastResetWave = waveVal;
              // After a reset, active wave returns to 1
              target.currentStage = 1;
            } else if (r.action_type !== 'level_complete') {
              target.currentStage = waveVal;
            }
          }
        }

        if (r.action_type === 'level_complete') {
          target.completed = true;
          target.status = 'completed';
          if (rTs && !target.completeTs) target.completeTs = rTs;
          if (target.totalStages) {
            target.currentStage = target.totalStages;
          }
          if (isGlobal) {
            if (r.is_hardcore === 1) {
              s.allHardcoreCompletedLevels.add(lvlNum);
              s.hardcoreStreakLevels.add(lvlNum);
            } else {
              s.normalCompletedLevels.add(lvlNum);
            }
          }
        } else if (r.action_type === 'hardcore_reset') {
          if (!target.completed) {
            const isHcContext = isGlobal ? r.is_hardcore === 1 : att.mode === 'hardcore';
            target.status = isHcContext ? 'reset' : ((target.rawTimeSpentSec || 0) > 0 || target.errors > 0 ? 'in_progress' : 'not_started');
          }
        } else if (r.action_type === 'level_fail') {
          if (!target.completed) {
            target.status = 'in_progress';
          }
        } else if (r.action_type === 'in_progress' || r.status === 'in_progress' || r.status === 'wave_complete') {
          if (!target.completed && ((r.time_spent_sec || 0) > 0 || (target.rawTimeSpentSec || 0) > 0 || (target.currentStage || 0) > 1)) {
            target.status = 'in_progress';
          }
        }
      };

      updateLevelTarget(aLvl, false);
      updateLevelTarget(gLvl, true);
    }

    s.recentEvents.push({
      id: r.id,
      mission: r.mission_name,
      course_slug: rowCourse,
      lesson_id: rowLesson,
      action_type: r.action_type,
      timestamp: r.timestamp,
      time_spent: r.time_spent_sec,
      log: r.action_log
    });
    if (s.recentEvents.length > 20) {
      s.recentEvents.shift();
    }
  });

  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const students: StudentMetric[] = Object.values(studentsMap).map(s => {
    // 1. Finalize each attempt
    s._attemptOrder.forEach(id => {
      const att = s._attemptsMap[id];
      const [a1Pure, a2Pure, a3Pure] = deduplicateLevelTimes(att.levels as any);

      att.levels[1].timeSpentSec = a1Pure;
      att.levels[2].timeSpentSec = a2Pure;
      att.levels[3].timeSpentSec = a3Pure;
      att.totalTimeSec = a1Pure + a2Pure + a3Pure;

      ([1, 2, 3] as const).forEach(n => {
        const l = att.levels[n];
        if (l.completed) {
          l.status = 'completed';
        } else if (l.status === 'reset' && att.mode === 'hardcore') {
          l.status = 'reset';
        } else if (l.timeSpentSec > 0 || l.errors > 0 || (l.currentStage && l.currentStage > 1)) {
          l.status = 'in_progress';
        } else {
          l.status = 'not_started';
        }
      });

      const compCount = ([1, 2, 3] as const).filter(num => att.levels[num].completed).length;
      att.completedLevelsCount = compCount;
      if (compCount >= 3) {
        att.status = 'completed';
      }
    });

    // 2. Filter out ghost/empty attempts
    const allAttempts = s._attemptOrder.map(id => s._attemptsMap[id]);
    const realAttempts = allAttempts.filter(a =>
      a.totalTimeSec > 0 || a.errorsCount > 0 || a.completedLevelsCount > 0 || a.status === 'completed' || a.status === 'failed'
    );
    s.attempts = realAttempts.length > 0 ? realAttempts : (allAttempts.length > 0 ? [allAttempts[allAttempts.length - 1]] : []);

    s.attemptsCount = s.attempts.length;
    s.normalAttemptsCount = s.attempts.filter(a => a.mode === 'normal').length;
    s.hardcoreAttemptsCount = s.attempts.filter(a => a.mode === 'hardcore').length;

    const completedNormals = s.attempts.filter(a => a.mode === 'normal' && a.status === 'completed');
    const completedHardcores = s.attempts.filter(a => a.mode === 'hardcore' && a.status === 'completed');

    s.isNormalMastered = completedNormals.length > 0;
    s.isHardcoreLegend = completedHardcores.length > 0;

    s.bestNormalTimeSec = completedNormals.length > 0 ? Math.min(...completedNormals.map(a => a.totalTimeSec)) : null;
    s.bestHardcoreTimeSec = completedHardcores.length > 0 ? Math.min(...completedHardcores.map(a => a.totalTimeSec)) : null;

    s.currentAttempt = s.attempts.length > 0 ? s.attempts[s.attempts.length - 1] : null;

    const attemptsTotalTime = s.attempts.reduce((sum, a) => sum + a.totalTimeSec, 0);
    const [l1Pure, l2Pure, l3Pure] = deduplicateLevelTimes(s.levels);

    // Sync student-level summary metrics from the most representative attempt per level
    const preferredBestCompletedAttempt =
      (completedHardcores.length > 0 ? [...completedHardcores].sort((a, b) => a.totalTimeSec - b.totalTimeSec)[0] : null) ||
      (completedNormals.length > 0 ? [...completedNormals].sort((a, b) => a.totalTimeSec - b.totalTimeSec)[0] : null);

    if (s.attempts.length > 0) {
      ([1, 2, 3] as const).forEach(n => {
        const latestAttWithLvl = [...s.attempts].reverse().find(a => a.levels[n].status !== 'not_started' || a.levels[n].timeSpentSec > 0 || a.levels[n].errors > 0);
        const compAtt =
          (preferredBestCompletedAttempt && preferredBestCompletedAttempt.levels[n].completed ? preferredBestCompletedAttempt : null) ||
          s.attempts.find(a => a.levels[n].completed) ||
          latestAttWithLvl;

        if (compAtt && compAtt.levels[n].timeSpentSec > 0) {
          s.levels[n].timeSpentSec = compAtt.levels[n].timeSpentSec;
        } else {
          s.levels[n].timeSpentSec = n === 1 ? l1Pure : (n === 2 ? l2Pure : l3Pure);
        }

        // Sync stage & reset wave from latest attempt if student level is still not completed
        if (!s.levels[n].completed && latestAttWithLvl) {
          s.levels[n].currentStage = latestAttWithLvl.levels[n].currentStage ?? s.levels[n].currentStage;
          s.levels[n].totalStages = latestAttWithLvl.levels[n].totalStages ?? s.levels[n].totalStages;
          s.levels[n].lastResetWave = latestAttWithLvl.levels[n].lastResetWave ?? s.levels[n].lastResetWave;
          s.levels[n].maxWaveReached = latestAttWithLvl.levels[n].maxWaveReached ?? s.levels[n].maxWaveReached;
        }
      });
    } else {
      s.levels[1].timeSpentSec = l1Pure;
      s.levels[2].timeSpentSec = l2Pure;
      s.levels[3].timeSpentSec = l3Pure;
    }

    ([1, 2, 3] as const).forEach(n => {
      const l = s.levels[n];
      if (l.completed) {
        l.status = 'completed';
      } else if (l.status === 'reset' && (s.isHardcoreLegend || s.hardcoreAttemptsCount > 0)) {
        l.status = 'reset';
      } else if (l.timeSpentSec > 0 || l.errors > 0 || (l.currentStage && l.currentStage > 1)) {
        l.status = 'in_progress';
      } else {
        l.status = 'not_started';
      }

      // Clean up internal helper fields
      delete l._lastFailTsMs;
      delete l._lastFailAttemptsCount;
      delete l._sameSecondFailCount;
      delete l._afkWave1Streak;
      delete l._afkCapped;
    });

    s.attempts.forEach(a => {
      ([1, 2, 3] as const).forEach(n => {
        const l = a.levels[n] as InternalLevelState;
        delete l._lastFailTsMs;
        delete l._lastFailAttemptsCount;
        delete l._sameSecondFailCount;
        delete l._afkWave1Streak;
        delete l._afkCapped;
      });
    });

    s.totalActiveTimeSec = Math.max(attemptsTotalTime, s.levels[1].timeSpentSec + s.levels[2].timeSpentSec + s.levels[3].timeSpentSec);

    const isHardcoreCompleted = s.isHardcoreLegend || s.hardcoreStreakLevels.size >= 3;
    const isNormalCompleted = s.isNormalMastered || s.normalCompletedLevels.size >= 3;
    s.hardcoreLevelsConquered = s.allHardcoreCompletedLevels.size;

    ([1, 2, 3] as const).forEach(num => {
      s.levels[num].hardcore = s.allHardcoreCompletedLevels.has(num);
    });

    if (isHardcoreCompleted) {
      s.lessonStatus = 'hardcore_completed';
      s.isHardcoreLegend = true;
      s.hardcoreStatus = 'completed';
    } else if (isNormalCompleted) {
      s.lessonStatus = 'completed';
      s.isHardcoreLegend = false;
      const realHcAttempts = s.attempts.filter(a => a.mode === 'hardcore');
      if (realHcAttempts.length > 0) {
        const lastHc = realHcAttempts[realHcAttempts.length - 1];
        s.hardcoreStatus = lastHc.status === 'failed' ? 'failed' : (lastHc.status === 'completed' ? 'completed' : 'attempting');
      } else {
        s.hardcoreStatus = 'none';
      }
    } else if (s.normalCompletedLevels.size > 0 || s.hardcoreStreakLevels.size > 0 || s.levels[1].status !== 'not_started' || s.levels[2].status !== 'not_started' || s.levels[3].status !== 'not_started') {
      s.lessonStatus = 'in_progress';
      s.isHardcoreLegend = false;
      const realHcAttempts = s.attempts.filter(a => a.mode === 'hardcore');
      if (realHcAttempts.length > 0) {
        const lastHc = realHcAttempts[realHcAttempts.length - 1];
        s.hardcoreStatus = lastHc.status === 'failed' ? 'failed' : 'attempting';
      } else {
        s.hardcoreStatus = 'none';
      }
    } else {
      s.lessonStatus = 'not_started';
      s.isHardcoreLegend = false;
      s.hardcoreStatus = 'none';
    }

    s.isHardcore = isHardcoreCompleted;
    const lastSeenDate = parseSqlTimestamp(s.lastSeen);
    s.isActiveNow = !!(lastSeenDate && lastSeenDate.toISOString() >= fifteenMinutesAgo);
    s.recentEvents.reverse();
    s.workedLessons = Object.values(s._workedLessonsMap).reverse();

    const out: StudentMetric = {
      ...s,
      normalCompletedLevels: Array.from(s.normalCompletedLevels),
      allHardcoreCompletedLevels: Array.from(s.allHardcoreCompletedLevels),
      hardcoreStreakLevels: Array.from(s.hardcoreStreakLevels)
    };
    delete (out as any)._attemptsMap;
    delete (out as any)._attemptOrder;
    delete (out as any)._legacyIdx;
    delete (out as any)._lastHc;
    delete (out as any)._workedLessonsMap;

    return out;
  });

  const filteredStudents = search
    ? students.filter(s => s.displayName.toLowerCase().includes(search) || s.className.toLowerCase().includes(search))
    : students;

  filteredStudents.sort((a, b) => {
    const timeA = parseSqlTimestamp(a.lastSeen)?.getTime() || 0;
    const timeB = parseSqlTimestamp(b.lastSeen)?.getTime() || 0;
    return timeB - timeA;
  });

  const totalStudents = filteredStudents.length;
  const completedStudents = filteredStudents.filter(s => s.lessonStatus === 'completed' || s.lessonStatus === 'hardcore_completed');
  const completedCount = completedStudents.length;
  const hardcoreCount = filteredStudents.filter(s => s.lessonStatus === 'hardcore_completed').length;
  const inProgressCount = filteredStudents.filter(s => s.lessonStatus === 'in_progress').length;
  const totalErrors = filteredStudents.reduce((sum, s) => sum + s.totalErrors, 0);
  const princeCount = filteredStudents.filter(s => s.princeCompleted).length;
  const avgTimeSec = completedCount > 0
    ? Math.round(completedStudents.reduce((sum, s) => sum + s.totalActiveTimeSec, 0) / completedCount)
    : 0;

  const dateRows = db.prepare(`SELECT DISTINCT DATE(timestamp) as d FROM telemetry ORDER BY d DESC LIMIT 30`).all();
  const availableDates = dateRows.map((r: any) => r.d).filter(Boolean);

  const classes = coursesData.map(c => ({
    slug: c.slug,
    name: c.name,
    lessons: c.lessons.map(l => ({ id: l.id, topic: l.topic }))
  }));

  return {
    students: filteredStudents,
    kpi: {
      totalStudents,
      completedCount,
      hardcoreCount,
      princeCount,
      inProgressCount,
      avgTimeSec,
      totalErrors
    },
    availableDates,
    classes,
    selectedFilters: {
      class: selectedClasses.length > 0 ? selectedClasses.join(',') : 'all',
      classes: selectedClasses,
      course: courseFilter,
      lesson: lessonFilter,
      date: dateFilter,
      excludeTests,
      todayStr
    }
  };
}
