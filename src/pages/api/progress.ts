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
    
    const rows = db.prepare(`
      SELECT action_type, mission_name, is_hardcore 
      FROM telemetry 
      WHERE first_name = ? AND last_name = ? AND class_name = ? 
        AND mission_name LIKE ?
      ORDER BY timestamp ASC
    `).all(firstName, lastName, className, `%${lessonPrefix}%`);

    const normalLevels = new Set();
    const hardcoreLevels = new Set();

    rows.forEach((row: any) => {
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
      isHardcoreCompleted
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
