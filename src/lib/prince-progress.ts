import type Database from 'better-sqlite3';
import { getNextCampaignStage, getTotalCampaignStages, type PrinceStageSummary } from './prince-campaign';

export interface LessonProgressSnapshot {
  unlockedNormal: number;
  unlockedHardcore: number;
  isNormalCompleted: boolean;
  isHardcoreCompleted: boolean;
  princeCompletedFromTelemetry: boolean;
}

export interface PrinceProgressSummary {
  eligibleForHardcoreBonus: boolean;
  lessonStageCompleted: number | null;
  lessonMapLevel: number | null;
  completedStages: number[];
  totalStages: number;
  nextStage: PrinceStageSummary | null;
  campaignFinished: boolean;
}

export interface LessonProgressQuery {
  firstName: string;
  lastName: string;
  className: string;
  courseSlug?: string | null;
  lessonId?: string | null;
  lessonPrefix?: string | null;
}

/** Ensures the prince_progress table and its lookup indexes exist idempotently. */
export function ensurePrinceProgressSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS prince_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      student_class TEXT NOT NULL,
      course_slug TEXT NOT NULL,
      lesson_id TEXT NOT NULL,
      stage INTEGER NOT NULL,
      map_level INTEGER NOT NULL,
      time_spent_sec INTEGER DEFAULT 0,
      completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(first_name, last_name, student_class, course_slug, lesson_id),
      UNIQUE(first_name, last_name, student_class, stage)
    );
    CREATE INDEX IF NOT EXISTS idx_prince_progress_student ON prince_progress(first_name, last_name, student_class);
    CREATE INDEX IF NOT EXISTS idx_prince_progress_lesson ON prince_progress(course_slug, lesson_id);
  `);
}

/** Checks whether the prince_progress table exists in SQLite. */
export function hasPrinceProgressTable(db: Database.Database): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='prince_progress'")
    .get() as { name?: string } | undefined;
  return Boolean(row?.name);
}

/** Computes normal/hardcore completion and legacy Prince completion from telemetry rows. */
export function getLessonProgressSnapshot(
  db: Database.Database,
  params: LessonProgressQuery
): LessonProgressSnapshot {
  const firstName = params.firstName.trim();
  const lastName = params.lastName.trim();
  const className = params.className.trim();
  const courseSlug = params.courseSlug?.trim() || null;
  const lessonId = params.lessonId?.trim() || null;
  const trimmedPrefix = (params.lessonPrefix?.trim() || (lessonId ? `Урок ${lessonId}` : '')).trim();

  let rows: any[];
  if (courseSlug && lessonId && trimmedPrefix) {
    rows = db.prepare(`
      SELECT action_type, mission_name, is_hardcore, level_number, status, success
      FROM telemetry
      WHERE (first_name = ? AND last_name = ?)
        AND (student_class = ? OR class_name = ?)
        AND (
          (course_slug = ? AND lesson_id = ?)
          OR (
            (course_slug IS NULL OR course_slug = '')
            AND (mission_name = ? OR mission_name LIKE ? OR mission_name LIKE ? OR mission_name LIKE ?)
          )
        )
      ORDER BY timestamp ASC, id ASC
    `).all(
      firstName,
      lastName,
      className,
      className,
      courseSlug,
      lessonId,
      trimmedPrefix,
      `${trimmedPrefix} %`,
      `${trimmedPrefix}:%`,
      `%${trimmedPrefix} %`
    );
  } else if (courseSlug && lessonId) {
    rows = db.prepare(`
      SELECT action_type, mission_name, is_hardcore, level_number, status, success
      FROM telemetry
      WHERE (first_name = ? AND last_name = ?)
        AND (student_class = ? OR class_name = ?)
        AND (course_slug = ? AND lesson_id = ?)
      ORDER BY timestamp ASC, id ASC
    `).all(firstName, lastName, className, className, courseSlug, lessonId);
  } else {
    rows = db.prepare(`
      SELECT action_type, mission_name, is_hardcore, level_number, status, success
      FROM telemetry
      WHERE (first_name = ? AND last_name = ?)
        AND (student_class = ? OR class_name = ?)
        AND (mission_name = ? OR mission_name LIKE ? OR mission_name LIKE ? OR mission_name LIKE ?)
      ORDER BY timestamp ASC, id ASC
    `).all(
      firstName,
      lastName,
      className,
      className,
      trimmedPrefix,
      `${trimmedPrefix} %`,
      `${trimmedPrefix}:%`,
      `%${trimmedPrefix} %`
    );
  }

  const normalLevels = new Set<string>();
  const hardcoreLevels = new Set<string>();
  let princeCompletedFromTelemetry = false;

  for (const row of rows) {
    const mName = String(row.mission_name || '');
    const isPrince = mName.includes('Prince of Persia') || row.action_type === 'prince_complete';
    if (isPrince) {
      if ((row.action_type === 'level_complete' || row.action_type === 'prince_complete') && row.success !== 0) {
        princeCompletedFromTelemetry = true;
      }
      continue;
    }
    if (row.action_type === 'hardcore_reset' && row.is_hardcore === 1) {
      hardcoreLevels.clear();
    }
    if (row.action_type === 'normal_reset' && row.is_hardcore === 0) {
      normalLevels.clear();
    }
    const isLegacyComplete = row.action_type === '' && row.status === 'completed' && row.success === 1;
    if (row.action_type === 'level_complete' || row.action_type === 'task_completed' || isLegacyComplete) {
      let lvlKey = mName;
      if (row.level_number === 1 || row.level_number === 2 || row.level_number === 3) {
        lvlKey = `lvl_${row.level_number}`;
      } else if (/Уровень\s*1/i.test(mName) || /\(Базовый\)/i.test(mName)) {
        lvlKey = 'lvl_1';
      } else if (/Уровень\s*2/i.test(mName)) {
        lvlKey = 'lvl_2';
      } else if (/Уровень\s*3/i.test(mName) || /10\s*волн/i.test(mName)) {
        lvlKey = 'lvl_3';
      }
      if (row.is_hardcore === 1) {
        hardcoreLevels.add(lvlKey);
      } else {
        normalLevels.add(lvlKey);
      }
    }
  }

  return {
    unlockedNormal: Math.min(4, normalLevels.size + 1),
    unlockedHardcore: Math.min(4, hardcoreLevels.size + 1),
    isNormalCompleted: normalLevels.size >= 3,
    isHardcoreCompleted: hardcoreLevels.size >= 3,
    princeCompletedFromTelemetry,
  };
}

/** Builds student's cross-lesson Prince of Persia campaign progress summary. */
export function getStudentPrinceProgress(
  db: Database.Database,
  params: {
    firstName: string;
    lastName: string;
    className: string;
    courseSlug?: string | null;
    lessonId?: string | null;
    eligibleForHardcoreBonus: boolean;
  }
): PrinceProgressSummary {
  const totalStages = getTotalCampaignStages();
  let rows: Array<{ course_slug: string; lesson_id: string; stage: number; map_level: number }> = [];

  if (hasPrinceProgressTable(db)) {
    rows = db.prepare(`
      SELECT course_slug, lesson_id, stage, map_level
      FROM prince_progress
      WHERE first_name = ? AND last_name = ? AND student_class = ?
      ORDER BY stage ASC
    `).all(params.firstName.trim(), params.lastName.trim(), params.className.trim()) as any[];
  }

  const completedStages = rows.map((r) => Number(r.stage));
  const lessonRow =
    params.courseSlug && params.lessonId
      ? rows.find((r) => r.course_slug === params.courseSlug && r.lesson_id === params.lessonId) ?? null
      : null;

  const nextStageObj = getNextCampaignStage(completedStages);

  return {
    eligibleForHardcoreBonus: params.eligibleForHardcoreBonus,
    lessonStageCompleted: lessonRow ? Number(lessonRow.stage) : null,
    lessonMapLevel: lessonRow ? Number(lessonRow.map_level) : null,
    completedStages,
    totalStages,
    nextStage: nextStageObj
      ? {
          stage: nextStageObj.stage,
          mapLevel: nextStageObj.mapLevel,
          title: nextStageObj.title,
        }
      : null,
    campaignFinished: nextStageObj === null,
  };
}
