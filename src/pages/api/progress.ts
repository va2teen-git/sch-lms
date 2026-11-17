import type { APIRoute } from 'astro';
import Database from 'better-sqlite3';
import path from 'path';
import { getLessonProgressSnapshot, getStudentPrinceProgress } from '../../lib/prince-progress';

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

    const courseSlug = url.searchParams.get('courseSlug')?.trim() || null;
    const lessonId = url.searchParams.get('lessonId')?.trim() || null;
    const trimmedPrefix = lessonPrefix.trim();

    const snapshot = getLessonProgressSnapshot(db, {
      firstName,
      lastName,
      className,
      courseSlug,
      lessonId,
      lessonPrefix: trimmedPrefix
    });

    const parsedLessonId = trimmedPrefix.match(/Урок\s+(\d+)/i)?.[1] ?? null;
    const effectiveCourseSlug = courseSlug || className.trim();
    const effectiveLessonId = lessonId || parsedLessonId;

    const princeProgress = getStudentPrinceProgress(db, {
      firstName,
      lastName,
      className,
      courseSlug: effectiveCourseSlug,
      lessonId: effectiveLessonId,
      eligibleForHardcoreBonus: snapshot.isHardcoreCompleted
    });

    const princeCompleted = Boolean(
      snapshot.princeCompletedFromTelemetry || princeProgress.lessonStageCompleted !== null
    );

    return new Response(JSON.stringify({
      unlockedNormal: snapshot.unlockedNormal,
      unlockedHardcore: snapshot.unlockedHardcore,
      isNormalCompleted: snapshot.isNormalCompleted,
      isHardcoreCompleted: snapshot.isHardcoreCompleted,
      princeCompleted,
      princeProgress
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
