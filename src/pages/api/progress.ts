import type { APIRoute } from 'astro';
import Database from 'better-sqlite3';
import path from 'path';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const firstName = url.searchParams.get('firstName');
  const lastName = url.searchParams.get('lastName');
  const className = url.searchParams.get('className');
  const lessonPrefix = url.searchParams.get('lessonPrefix');

  if (!firstName || !lastName || !className || !lessonPrefix) {
    return new Response(JSON.stringify({ error: 'Missing parameters' }), { status: 400 });
  }

  const dbPath = path.join(process.cwd(), 'telemetry.db');
  let db;
  try {
    db = new Database(dbPath, { readonly: true });
    
    const courseSlug = url.searchParams.get('courseSlug');
    const lessonId = url.searchParams.get('lessonId');

    const trimmedPrefix = lessonPrefix.trim();
    let rows: any[];
    if (courseSlug && lessonId) {
      rows = db.prepare(`
        SELECT action_type, mission_name, is_hardcore 
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
        ORDER BY timestamp ASC
      `).all(
        firstName.trim(),
        lastName.trim(),
        className.trim(),
        className.trim(),
        courseSlug.trim(),
        lessonId.trim(),
        trimmedPrefix,
        `${trimmedPrefix} %`,
        `${trimmedPrefix}:%`,
        `%${trimmedPrefix} %`
      );
    } else {
      rows = db.prepare(`
        SELECT action_type, mission_name, is_hardcore 
        FROM telemetry 
        WHERE (first_name = ? AND last_name = ?)
          AND (student_class = ? OR class_name = ?)
          AND (mission_name = ? OR mission_name LIKE ? OR mission_name LIKE ? OR mission_name LIKE ?)
        ORDER BY timestamp ASC
      `).all(
        firstName.trim(),
        lastName.trim(),
        className.trim(),
        className.trim(),
        trimmedPrefix,
        `${trimmedPrefix} %`,
        `${trimmedPrefix}:%`,
        `%${trimmedPrefix} %`
      );
    }

    const normalLevels = new Set();
    const hardcoreLevels = new Set();
    let princeCompleted = false;

    rows.forEach((row: any) => {
      const mName = String(row.mission_name || '');
      const isPrince = mName.includes('Prince of Persia') || row.action_type === 'prince_complete';
      if (isPrince) {
        if (row.action_type === 'level_complete' || row.action_type === 'prince_complete') {
          princeCompleted = true;
        }
        return;
      }
      if (row.action_type === 'hardcore_reset' && row.is_hardcore === 1) {
        hardcoreLevels.clear();
      }
      if (row.action_type === 'normal_reset' && row.is_hardcore === 0) {
        normalLevels.clear();
      }
      if (row.action_type === 'level_complete') {
        if (row.is_hardcore === 1) {
          hardcoreLevels.add(row.mission_name);
        } else {
          normalLevels.add(row.mission_name);
        }
      }
    });

    const isNormalCompleted = normalLevels.size >= 3;
    const isHardcoreCompleted = hardcoreLevels.size >= 3;
    
    const unlockedNormal = Math.min(4, normalLevels.size + 1);
    const unlockedHardcore = Math.min(4, hardcoreLevels.size + 1);

    return new Response(JSON.stringify({
      unlockedNormal,
      unlockedHardcore,
      isNormalCompleted,
      isHardcoreCompleted,
      princeCompleted
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('API Progress Error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  } finally {
    if (db) db.close();
  }
};
