import type Database from 'better-sqlite3';

export interface HotlineProgressRecord {
  firstName: string;
  lastName: string;
  className: string;
  levelId: number;
  grade: 'S' | 'A' | 'B' | 'C';
  score: number;
  styleBadge: 'GHOST' | 'ESCAPE' | 'COMBAT';
  maskId: string;
  locCount: number;
  usedLoops: boolean;
  usedConditions: boolean;
  usedSubprograms: boolean;
  linuxCommandsCount: number;
  timeSpentSec: number;
}

export interface HotlineLevelProgressRow {
  levelId: number;
  bestRank: string;
  bestScore: number;
  bestStyle: string;
  maskId: string;
  kumirLoc: number;
  usedLoops: boolean;
  usedConditions: boolean;
  usedSubprograms: boolean;
  linuxCommandsCount: number;
  bestTimeSec: number;
  attempts: number;
  updatedAt: string;
}

export interface StudentHotlineProgressSummary {
  completedCount: number;
  totalLevels: number;
  levels: HotlineLevelProgressRow[];
}

const RANK_WEIGHT: Record<string, number> = { S: 4, A: 3, B: 2, C: 1 };

export function ensureHotlineKumirProgressSchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS hotline_kumir_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      student_class TEXT NOT NULL,
      level_id INTEGER NOT NULL,
      best_rank TEXT NOT NULL,
      best_score INTEGER NOT NULL DEFAULT 0,
      best_style TEXT NOT NULL,
      mask_id TEXT NOT NULL,
      kumir_loc INTEGER DEFAULT 0,
      used_loops BOOLEAN DEFAULT 0,
      used_conditions BOOLEAN DEFAULT 0,
      used_subprograms BOOLEAN DEFAULT 0,
      linux_commands_count INTEGER DEFAULT 0,
      best_time_sec INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(first_name, last_name, student_class, level_id)
    );
    CREATE INDEX IF NOT EXISTS idx_hk_progress_student
      ON hotline_kumir_progress(first_name, last_name, student_class);
  `);
}

export function hasHotlineKumirProgressTable(db: Database.Database): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='hotline_kumir_progress'")
    .get() as { name?: string } | undefined;
  return Boolean(row?.name);
}

export function upsertHotlineKumirProgress(
  db: Database.Database,
  rec: HotlineProgressRecord
): StudentHotlineProgressSummary {
  ensureHotlineKumirProgressSchema(db);

  const firstName = rec.firstName.trim();
  const lastName = rec.lastName.trim();
  const className = rec.className.trim();

  const existing = db
    .prepare(
      `SELECT id, best_rank, best_score, best_style, mask_id, kumir_loc,
              used_loops, used_conditions, used_subprograms, linux_commands_count,
              best_time_sec, attempts
       FROM hotline_kumir_progress
       WHERE first_name = ? AND last_name = ? AND student_class = ? AND level_id = ?`
    )
    .get(firstName, lastName, className, rec.levelId) as
    | {
        id: number;
        best_rank: string;
        best_score: number;
        best_style: string;
        mask_id: string;
        kumir_loc: number;
        used_loops: number;
        used_conditions: number;
        used_subprograms: number;
        linux_commands_count: number;
        best_time_sec: number;
        attempts: number;
      }
    | undefined;

  if (!existing) {
    db.prepare(
      `INSERT INTO hotline_kumir_progress (
        first_name, last_name, student_class, level_id, best_rank, best_score, best_style,
        mask_id, kumir_loc, used_loops, used_conditions, used_subprograms,
        linux_commands_count, best_time_sec, attempts
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
    ).run(
      firstName,
      lastName,
      className,
      rec.levelId,
      rec.grade,
      rec.score,
      rec.styleBadge,
      rec.maskId,
      rec.locCount,
      rec.usedLoops ? 1 : 0,
      rec.usedConditions ? 1 : 0,
      rec.usedSubprograms ? 1 : 0,
      rec.linuxCommandsCount,
      rec.timeSpentSec
    );
  } else {
    const newRankBetter = (RANK_WEIGHT[rec.grade] || 0) > (RANK_WEIGHT[existing.best_rank] || 0);
    const bestRank = newRankBetter ? rec.grade : existing.best_rank;
    const bestScore = Math.max(existing.best_score, rec.score);
    const bestStyle = rec.score >= existing.best_score ? rec.styleBadge : existing.best_style;
    const maskId = rec.score >= existing.best_score ? rec.maskId : existing.mask_id;
    const bestTime =
      existing.best_time_sec > 0 ? Math.min(existing.best_time_sec, rec.timeSpentSec) : rec.timeSpentSec;

    db.prepare(
      `UPDATE hotline_kumir_progress
       SET best_rank = ?,
           best_score = ?,
           best_style = ?,
           mask_id = ?,
           kumir_loc = ?,
           used_loops = ?,
           used_conditions = ?,
           used_subprograms = ?,
           linux_commands_count = ?,
           best_time_sec = ?,
           attempts = attempts + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).run(
      bestRank,
      bestScore,
      bestStyle,
      maskId,
      rec.locCount || existing.kumir_loc,
      rec.usedLoops || existing.used_loops ? 1 : 0,
      rec.usedConditions || existing.used_conditions ? 1 : 0,
      rec.usedSubprograms || existing.used_subprograms ? 1 : 0,
      Math.max(existing.linux_commands_count, rec.linuxCommandsCount),
      bestTime,
      existing.id
    );
  }

  return getStudentHotlineProgress(db, { firstName, lastName, className });
}

export function getStudentHotlineProgress(
  db: Database.Database,
  student: { firstName: string; lastName: string; className: string }
): StudentHotlineProgressSummary {
  if (!hasHotlineKumirProgressTable(db)) {
    return { completedCount: 0, totalLevels: 5, levels: [] };
  }

  const rows = db
    .prepare(
      `SELECT level_id, best_rank, best_score, best_style, mask_id, kumir_loc,
              used_loops, used_conditions, used_subprograms, linux_commands_count,
              best_time_sec, attempts, updated_at
       FROM hotline_kumir_progress
       WHERE first_name = ? AND last_name = ? AND student_class = ?
       ORDER BY level_id ASC`
    )
    .all(student.firstName.trim(), student.lastName.trim(), student.className.trim()) as Array<{
    level_id: number;
    best_rank: string;
    best_score: number;
    best_style: string;
    mask_id: string;
    kumir_loc: number;
    used_loops: number;
    used_conditions: number;
    used_subprograms: number;
    linux_commands_count: number;
    best_time_sec: number;
    attempts: number;
    updated_at: string;
  }>;

  const levels: HotlineLevelProgressRow[] = rows.map((r) => ({
    levelId: Number(r.level_id),
    bestRank: r.best_rank,
    bestScore: Number(r.best_score),
    bestStyle: r.best_style,
    maskId: r.mask_id,
    kumirLoc: Number(r.kumir_loc),
    usedLoops: Boolean(r.used_loops),
    usedConditions: Boolean(r.used_conditions),
    usedSubprograms: Boolean(r.used_subprograms),
    linuxCommandsCount: Number(r.linux_commands_count),
    bestTimeSec: Number(r.best_time_sec),
    attempts: Number(r.attempts),
    updatedAt: r.updated_at,
  }));

  return {
    completedCount: levels.length,
    totalLevels: 5,
    levels,
  };
}
