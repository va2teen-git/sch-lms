import type { APIRoute } from 'astro';
import Database from 'better-sqlite3';
import path from 'path';
import {
  getStudentHotlineProgress,
  upsertHotlineKumirProgress,
} from '../../../lib/hotline-kumir-progress';

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const firstName = url.searchParams.get('firstName')?.trim() || '';
  const lastName = url.searchParams.get('lastName')?.trim() || '';
  const className = url.searchParams.get('className')?.trim() || '';

  if (!firstName || !lastName || !className) {
    return new Response(JSON.stringify({ error: 'Missing parameters' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const dbPath = path.join(process.cwd(), 'telemetry.db');
  let db: Database.Database | null = null;
  try {
    db = new Database(dbPath, { readonly: true });
    const summary = getStudentHotlineProgress(db, { firstName, lastName, className });
    return new Response(JSON.stringify({ success: true, ...summary }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('hotline-kumir progress GET error:', err);
    return new Response(JSON.stringify({ success: true, completedCount: 0, totalLevels: 5, levels: [] }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } finally {
    db?.close();
  }
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const firstName = String(body.firstName || body.student_firstName || '').trim();
    const lastName = String(body.lastName || body.student_lastName || '').trim();
    const className = String(body.className || body.student_class || '').trim();
    const levelId = parseInt(String(body.levelId || body.level || ''), 10);

    if (!firstName || !lastName || !className || isNaN(levelId) || levelId < 1 || levelId > 5) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid student or levelId (1..5)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const gradeRaw = String(body.grade || 'C').toUpperCase();
    const grade = (['S', 'A', 'B', 'C'].includes(gradeRaw) ? gradeRaw : 'C') as 'S' | 'A' | 'B' | 'C';
    const styleRaw = String(body.styleBadge || 'ESCAPE').toUpperCase();
    const styleBadge = (['GHOST', 'ESCAPE', 'COMBAT'].includes(styleRaw) ? styleRaw : 'ESCAPE') as
      | 'GHOST'
      | 'ESCAPE'
      | 'COMBAT';

    const dbPath = path.join(process.cwd(), 'telemetry.db');
    const db = new Database(dbPath);
    try {
      db.pragma('busy_timeout = 5000');
      const summary = upsertHotlineKumirProgress(db, {
        firstName,
        lastName,
        className,
        levelId,
        grade,
        score: Math.max(0, parseInt(String(body.score || 0), 10) || 0),
        styleBadge,
        maskId: String(body.maskId || body.mask || 'richard'),
        locCount: Math.max(0, parseInt(String(body.locCount || body.lines_of_code || 0), 10) || 0),
        usedLoops: Boolean(body.usedLoops ?? body.used_loops),
        usedConditions: Boolean(body.usedConditions ?? body.used_conditions),
        usedSubprograms: Boolean(body.usedSubprograms ?? body.used_subprograms),
        linuxCommandsCount: Math.max(
          0,
          parseInt(String(body.linuxCommandsCount || body.linux_commands_count || 0), 10) || 0
        ),
        timeSpentSec: Math.max(1, parseInt(String(body.timeSpentSec || body.time_spent_sec || 1), 10) || 1),
      });

      return new Response(JSON.stringify({ success: true, ...summary }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    } finally {
      db.close();
    }
  } catch (err) {
    console.error('hotline-kumir progress POST error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
