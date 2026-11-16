import type { APIRoute } from 'astro';
import Database from 'better-sqlite3';
import path from 'path';
import { computeTeacherStats, type LevelMetric, type AttemptMetric, type StudentMetric } from '../../../lib/teacher-stats';

export type { LevelMetric, AttemptMetric, StudentMetric };

const dbPath = path.join(process.cwd(), 'telemetry.db');

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const classParams = url.searchParams.getAll('class');
  const courseFilter = url.searchParams.get('course') || 'all';
  const lessonFilter = url.searchParams.get('lesson') || 'all';
  const dateFilter = url.searchParams.get('date') || 'today';
  const excludeTests = url.searchParams.get('exclude_tests') !== '0';
  const search = (url.searchParams.get('search') || '').trim().toLowerCase();

  let db: any;
  try {
    db = new Database(dbPath, { readonly: true });
    const result = computeTeacherStats(db, {
      classParams,
      courseFilter,
      lessonFilter,
      dateFilter,
      excludeTests,
      search
    });

    return new Response(JSON.stringify({
      success: true,
      ...result
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate'
      }
    });
  } catch (err: any) {
    console.error('Teacher stats API error:', err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    if (db) db.close();
  }
};
