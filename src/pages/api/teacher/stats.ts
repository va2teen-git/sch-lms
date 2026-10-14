import type { APIRoute } from 'astro';
import Database from 'better-sqlite3';
import path from 'path';
import coursesData from '../../../data/courses.json';

const dbPath = path.join(process.cwd(), 'telemetry.db');

export interface LevelMetric {
  status: 'not_started' | 'in_progress' | 'completed' | 'reset';
  timeSpentSec: number;
  rawTimeSpentSec?: number;
  firstTs?: Date | null;
  errors: number;
  attempts: number;
  completed: boolean;
  hardcore: boolean;
  lastUpdated: string | null;
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
  normalCompletedLevels?: Set<number>;
  allHardcoreCompletedLevels?: Set<number>;
  hardcoreStreakLevels?: Set<number>;
  hardcoreAttempted?: boolean;
  hardcoreResetsCount?: number;
  hardcoreLevelsConquered?: number;
  hardcoreStatus?: 'none' | 'attempting' | 'failed' | 'completed';
  isHardcoreLegend?: boolean;
  totalActiveTimeSec: number;
  totalErrors: number;
  isHardcore: boolean;
  lessonStatus: 'hardcore_completed' | 'completed' | 'in_progress' | 'not_started';
  recentEvents: Array<{
    id: number;
    mission: string;
    action_type: string;
    timestamp: string;
    time_spent: number;
    log: string;
  }>;
}

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const classFilter = url.searchParams.get('class') || 'all';
  const courseFilter = url.searchParams.get('course') || 'all'; // e.g. '8-класс' or 'all'
  const lessonFilter = url.searchParams.get('lesson') || 'all'; // e.g. 'Урок 20' or '20' or 'all'
  const dateFilter = url.searchParams.get('date') || 'today'; // 'today', 'all', or 'YYYY-MM-DD'
  const excludeTests = url.searchParams.get('exclude_tests') !== '0';
  const search = (url.searchParams.get('search') || '').trim().toLowerCase();

  let db: any;
  try {
    db = new Database(dbPath, { readonly: true });

    // Determine date boundaries in local / UTC format
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

    // Support multi-class filtering (comma-separated or multiple ?class= params)
    const rawClassParams = url.searchParams.getAll('class');
    const selectedClasses = rawClassParams
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
        lessonCondition = ' AND (lesson_id = ? OR mission_name LIKE ?)';
        params.push(lId, `%Урок ${lId}%`);
      } else {
        const prefix = lessonFilter.startsWith('Урок ') ? lessonFilter : `Урок ${lessonFilter}`;
        lessonCondition = ' AND mission_name LIKE ?';
        params.push(`%${prefix}%`);
      }
    }

    let testCondition = '';
    if (excludeTests) {
      testCondition = ` AND first_name NOT LIKE '%Unknown%' 
                        AND last_name NOT LIKE '%Unknown%' 
                        AND first_name NOT LIKE '%Тест%' 
                        AND last_name NOT LIKE '%Тест%' 
                        AND COALESCE(student_class, class_name) NOT LIKE '%Unknown%'
                        AND COALESCE(student_class, class_name) != '11-ИТ'`;
    }

    const query = `
      SELECT id, first_name, last_name, class_name, mission_name, action_type,
             time_spent_sec, attempts_count, success, status, action_log,
             is_hardcore, student_class, course_slug, lesson_id, level_number, timestamp
      FROM telemetry
      WHERE 1=1 ${dateCondition} ${classCondition} ${courseCondition} ${lessonCondition} ${testCondition}
      ORDER BY timestamp ASC
    `;

    const rows = db.prepare(query).all(...params);

    // Grouping by student
    const studentsMap: Record<string, StudentMetric> = {};

    rows.forEach((r: any) => {
      const fn = (r.first_name || '').trim();
      const ln = (r.last_name || '').trim();
      const effectiveCls = (r.student_class || r.class_name || 'Unknown').trim();
      const nameWords = [fn.toLowerCase(), ln.toLowerCase()].sort();

      // Canonical key (word-sorted to treat "Вадим Басин" and "Басин Вадим" as one)
      const canonicalKey = `${effectiveCls}_${nameWords.join('_')}`;

      if (!studentsMap[canonicalKey]) {
        // Detect Russian surname for proper display name
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
            1: { status: 'not_started', rawTimeSpentSec: 0, timeSpentSec: 0, errors: 0, attempts: 0, completed: false, hardcore: false, firstTs: null, lastUpdated: null },
            2: { status: 'not_started', rawTimeSpentSec: 0, timeSpentSec: 0, errors: 0, attempts: 0, completed: false, hardcore: false, firstTs: null, lastUpdated: null },
            3: { status: 'not_started', rawTimeSpentSec: 0, timeSpentSec: 0, errors: 0, attempts: 0, completed: false, hardcore: false, firstTs: null, lastUpdated: null }
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
          recentEvents: []
        };
      }

      const s = studentsMap[canonicalKey];
      s.lastSeen = r.timestamp;
      s.latestIsHardcore = r.is_hardcore;
      const rTs = r.timestamp ? new Date(r.timestamp.replace(' ', 'T') + 'Z') : null;

      // Extract Level Number
      let lvlNum: 1 | 2 | 3 | null = null;
      if (r.level_number === 1 || r.level_number === 2 || r.level_number === 3) {
        lvlNum = r.level_number as 1 | 2 | 3;
      } else if (r.mission_name.includes('Уровень 1')) lvlNum = 1;
      else if (r.mission_name.includes('Уровень 2')) lvlNum = 2;
      else if (r.mission_name.includes('Уровень 3')) lvlNum = 3;

      const isError = r.action_type === 'hardcore_reset' || (r.action_log && r.action_log.includes('Error'));

      if (isError) {
        s.totalErrors++;
      }

      if (r.is_hardcore === 1) {
        s.hardcoreAttempted = true;
      }

      if (r.action_type === 'hardcore_reset' && r.is_hardcore === 1) {
        s.hardcoreStreakLevels.clear();
        s.hardcoreResetsCount++;
      }
      if (r.action_type === 'normal_reset' && r.is_hardcore === 0) {
        s.normalCompletedLevels.clear();
      }

      if (lvlNum) {
        const lvl = s.levels[lvlNum];
        lvl.attempts++;
        lvl.lastUpdated = r.timestamp;
        if (lvl.firstTs === null && rTs) {
          lvl.firstTs = rTs;
        }

        if (isError) {
          lvl.errors++;
        }

        if (typeof r.time_spent_sec === 'number' && r.time_spent_sec > (lvl.rawTimeSpentSec || 0)) {
          lvl.rawTimeSpentSec = r.time_spent_sec;
        }

        if (r.action_type === 'level_complete') {
          lvl.completed = true;
          lvl.status = 'completed';
          if (r.is_hardcore === 1) {
            s.allHardcoreCompletedLevels.add(lvlNum);
            s.hardcoreStreakLevels.add(lvlNum);
          } else {
            s.normalCompletedLevels.add(lvlNum);
          }
        } else if (r.action_type === 'hardcore_reset') {
          if (!lvl.completed) {
            lvl.status = r.is_hardcore === 1 ? 'reset' : 'in_progress';
          }
        } else if (r.action_type === 'in_progress' || r.status === 'in_progress') {
          if (!lvl.completed) {
            lvl.status = 'in_progress';
          }
        }
      }

      // Add to recent events (up to 20 per student)
      s.recentEvents.push({
        id: r.id,
        mission: r.mission_name,
        action_type: r.action_type,
        timestamp: r.timestamp,
        time_spent: r.time_spent_sec,
        log: r.action_log
      });
      if (s.recentEvents.length > 20) {
        s.recentEvents.shift();
      }
    });

    // Check active students (seen in last 15 minutes)
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    const students = Object.values(studentsMap).map(s => {
      const l1Raw = s.levels[1].rawTimeSpentSec || 0;
      const l2Raw = s.levels[2].rawTimeSpentSec || 0;
      const l3Raw = s.levels[3].rawTimeSpentSec || 0;

      let l1Pure = l1Raw;
      let l2Pure = l2Raw;
      let l3Pure = l3Raw;

      const l1First = s.levels[1].firstTs;
      const l2First = s.levels[2].firstTs;
      const l3First = s.levels[3].firstTs;

      // If Level 2 was preloaded concurrently with Level 1 (first timestamps within 60s)
      // and reports cumulative time from page start (l2Raw >= l1Raw):
      if (l1First && l2First && l1Raw > 0 && l2Raw >= l1Raw) {
        if (Math.abs(l2First.getTime() - l1First.getTime()) < 60000) {
          l2Pure = l2Raw - l1Raw;
        }
      }

      // If Level 3 was preloaded concurrently with Level 1/2:
      if (l1First && l3First && l2Raw > 0 && l3Raw >= l2Raw) {
        if (Math.abs(l3First.getTime() - l1First.getTime()) < 60000) {
          l3Pure = l3Raw - l2Raw;
        }
      }

      s.levels[1].timeSpentSec = l1Pure;
      s.levels[2].timeSpentSec = l2Pure;
      s.levels[3].timeSpentSec = l3Pure;

      // Calculate total active time from pure times of all 3 levels
      s.totalActiveTimeSec = l1Pure + l2Pure + l3Pure;

      const isHardcoreCompleted = s.hardcoreStreakLevels.size >= 3;
      const isNormalCompleted = s.normalCompletedLevels.size >= 3;
      s.hardcoreLevelsConquered = s.allHardcoreCompletedLevels.size;

      // Update level hardcore badges: level indicates if it was solved on hardcore
      [1, 2, 3].forEach(num => {
        s.levels[num as 1 | 2 | 3].hardcore = s.allHardcoreCompletedLevels.has(num);
      });

      if (isHardcoreCompleted) {
        s.lessonStatus = 'hardcore_completed';
        s.isHardcoreLegend = true;
        s.hardcoreStatus = 'completed';
      } else if (isNormalCompleted) {
        s.lessonStatus = 'completed';
        s.isHardcoreLegend = false;
        s.hardcoreStatus = (s.latestIsHardcore === 1) ? 'attempting' : 'none';
      } else if (s.normalCompletedLevels.size > 0 || s.hardcoreStreakLevels.size > 0 || s.levels[1].attempts > 0 || s.levels[2].attempts > 0 || s.levels[3].attempts > 0) {
        s.lessonStatus = 'in_progress';
        s.isHardcoreLegend = false;
        s.hardcoreStatus = (s.latestIsHardcore === 1) ? 'attempting' : 'none';
      } else {
        s.lessonStatus = 'not_started';
        s.isHardcoreLegend = false;
        s.hardcoreStatus = 'none';
      }

      s.isHardcore = isHardcoreCompleted;
      s.isActiveNow = !!(s.lastSeen && (new Date(s.lastSeen.replace(' ', 'T') + 'Z').toISOString() >= fifteenMinutesAgo));

      // Reverse recent events so newest is first
      s.recentEvents.reverse();

      return s;
    });

    // Filter by search string if provided
    const filteredStudents = search
      ? students.filter(s => s.displayName.toLowerCase().includes(search) || s.className.toLowerCase().includes(search))
      : students;

    // Sort by lastSeen descending
    filteredStudents.sort((a, b) => {
      const timeA = a.lastSeen ? new Date(a.lastSeen + 'Z').getTime() : 0;
      const timeB = b.lastSeen ? new Date(b.lastSeen + 'Z').getTime() : 0;
      return timeB - timeA;
    });

    // KPI Summary
    const totalStudents = filteredStudents.length;
    const completedStudents = filteredStudents.filter(s => s.lessonStatus === 'completed' || s.lessonStatus === 'hardcore_completed');
    const completedCount = completedStudents.length;
    const hardcoreCount = filteredStudents.filter(s => s.lessonStatus === 'hardcore_completed').length;
    const inProgressCount = filteredStudents.filter(s => s.lessonStatus === 'in_progress').length;
    const totalErrors = filteredStudents.reduce((sum, s) => sum + s.totalErrors, 0);

    const avgTimeSec = completedCount > 0
      ? Math.round(completedStudents.reduce((sum, s) => sum + s.totalActiveTimeSec, 0) / completedCount)
      : 0;

    // Fetch available dates
    const dateRows = db.prepare(`SELECT DISTINCT DATE(timestamp) as d FROM telemetry ORDER BY d DESC LIMIT 30`).all();
    const availableDates = dateRows.map((r: any) => r.d).filter(Boolean);

    // Fetch classes from courses.json
    const classes = coursesData.map(c => ({
      slug: c.slug,
      name: c.name,
      lessons: c.lessons.map(l => ({ id: l.id, topic: l.topic }))
    }));

    return new Response(JSON.stringify({
      success: true,
      students: filteredStudents,
      kpi: {
        totalStudents,
        completedCount,
        hardcoreCount,
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
