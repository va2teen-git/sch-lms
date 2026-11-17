import type { APIRoute } from 'astro';
import Database from 'better-sqlite3';
import path from 'path';
import { getNextCampaignStage, getTotalCampaignStages } from '../../lib/prince-campaign';
import { hasPrinceProgressTable } from '../../lib/prince-progress';

interface LessonAccum {
  normalLevels: Set<string>;
  hardcoreLevels: Set<string>;
  isNormalCompleted: boolean;
  isHardcoreCompleted: boolean;
  princeCompleted: boolean;
  sprintCompleted: boolean;
  hasActivity: boolean;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const firstName = url.searchParams.get('firstName')?.trim();
  const lastName = url.searchParams.get('lastName')?.trim();
  const className = url.searchParams.get('className')?.trim();

  if (!firstName || !lastName || !className) {
    return new Response(JSON.stringify({ error: 'Missing parameters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const dbPath = path.join(process.cwd(), 'telemetry.db');
  let db: any;
  try {
    db = new Database(dbPath, { readonly: true });

    const rows = db.prepare(`
      SELECT course_slug, lesson_id, level_number, mission_name, action_type, is_hardcore, time_spent_sec, status, success
      FROM telemetry
      WHERE (first_name = ? AND last_name = ?)
        AND (student_class = ? OR class_name = ?)
        AND course_slug IS NOT NULL AND course_slug != ''
        AND lesson_id IS NOT NULL AND lesson_id != ''
      ORDER BY timestamp ASC, id ASC
    `).all(firstName, lastName, className, className);

    const map: Record<string, LessonAccum> = {};

    for (const r of rows as any[]) {
      const cSlug = String(r.course_slug).trim();
      const lId = String(r.lesson_id).trim();
      const key = `${cSlug}::${lId}`;

      if (!map[key]) {
        map[key] = {
          normalLevels: new Set<string>(),
          hardcoreLevels: new Set<string>(),
          isNormalCompleted: false,
          isHardcoreCompleted: false,
          princeCompleted: false,
          sprintCompleted: false,
          hasActivity: false
        };
      }

      const entry = map[key];
      const mName = String(r.mission_name || '');
      const aType = String(r.action_type || '');

      const isPrince = mName.includes('Prince of Persia') || aType === 'prince_complete';
      if (isPrince) {
        if ((aType === 'level_complete' || aType === 'prince_complete') && r.success !== 0) {
          entry.princeCompleted = true;
        }
        continue;
      }

      if (aType === 'sprint_complete') {
        if (r.success !== 0) {
          entry.sprintCompleted = true;
        }
        continue;
      }

      if (aType === 'hardcore_reset' && r.is_hardcore === 1) {
        entry.hardcoreLevels.clear();
        entry.hasActivity = true;
        continue;
      }

      if (aType === 'normal_reset' && r.is_hardcore === 0) {
        entry.normalLevels.clear();
        entry.hasActivity = true;
        continue;
      }

      const isLegacyComplete = aType === '' && r.status === 'completed' && r.success === 1;
      if (aType === 'level_complete' || aType === 'task_completed' || isLegacyComplete) {
        entry.hasActivity = true;
        let lvlKey = mName;
        if (r.level_number === 1 || r.level_number === 2 || r.level_number === 3) {
          lvlKey = `lvl_${r.level_number}`;
        } else if (mName.includes('Уровень 1') || /\(Базовый\)/i.test(mName)) {
          lvlKey = 'lvl_1';
        } else if (mName.includes('Уровень 2')) {
          lvlKey = 'lvl_2';
        } else if (mName.includes('Уровень 3') || /10\s*волн/i.test(mName)) {
          lvlKey = 'lvl_3';
        }

        if (r.is_hardcore === 1) {
          entry.hardcoreLevels.add(lvlKey);
          if (entry.hardcoreLevels.size >= 3) {
            entry.isHardcoreCompleted = true;
          }
        } else {
          entry.normalLevels.add(lvlKey);
          if (entry.normalLevels.size >= 3) {
            entry.isNormalCompleted = true;
          }
        }
        continue;
      }

      if (
        aType === 'level_fail' ||
        (aType === 'in_progress' && Number(r.time_spent_sec || 0) > 0)
      ) {
        entry.hasActivity = true;
      }
    }

    const princeByLesson = new Map<string, number>();
    const completedStages: number[] = [];

    if (hasPrinceProgressTable(db)) {
      const princeRows = db.prepare(`
        SELECT course_slug, lesson_id, stage
        FROM prince_progress
        WHERE first_name = ? AND last_name = ? AND student_class = ?
        ORDER BY stage ASC
      `).all(firstName, lastName, className) as Array<{
        course_slug: string;
        lesson_id: string;
        stage: number;
      }>;

      for (const pr of princeRows) {
        const pKey = `${String(pr.course_slug).trim()}::${String(pr.lesson_id).trim()}`;
        const stageNum = Number(pr.stage);
        princeByLesson.set(pKey, stageNum);
        completedStages.push(stageNum);
      }
    }

    const lessons: Record<
      string,
      {
        completed: boolean;
        hardcoreCompleted: boolean;
        princeCompleted: boolean;
        princeStage: number | null;
        sprintCompleted: boolean;
        stoppedLevel: number;
      }
    > = {};

    for (const [key, entry] of Object.entries(map)) {
      const completed = entry.isNormalCompleted || entry.isHardcoreCompleted;
      let stoppedLevel = 0;
      if (!completed && entry.hasActivity) {
        const doneCount = Math.max(entry.normalLevels.size, entry.hardcoreLevels.size);
        stoppedLevel = Math.min(3, doneCount + 1);
      }
      const princeStage = princeByLesson.get(key) ?? null;
      const princeCompleted = entry.princeCompleted || princeStage !== null;

      if (completed || stoppedLevel > 0 || princeCompleted || entry.sprintCompleted) {
        lessons[key] = {
          completed,
          hardcoreCompleted: entry.isHardcoreCompleted,
          princeCompleted,
          princeStage,
          sprintCompleted: entry.sprintCompleted,
          stoppedLevel
        };
      }
    }

    for (const [pKey, princeStage] of princeByLesson.entries()) {
      if (!lessons[pKey]) {
        lessons[pKey] = {
          completed: false,
          hardcoreCompleted: false,
          princeCompleted: true,
          princeStage,
          sprintCompleted: false,
          stoppedLevel: 0
        };
      }
    }

    const totalStages = getTotalCampaignStages();
    const nextStage = getNextCampaignStage(completedStages);
    const princeCampaign = {
      completedCount: new Set(completedStages).size,
      totalStages,
      currentStage: nextStage ? nextStage.stage : null
    };

    return new Response(JSON.stringify({ success: true, lessons, princeCampaign }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (err: any) {
    console.error('API Matrix Progress Error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (db) db.close();
  }
};
