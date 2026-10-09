import type { APIRoute } from 'astro';
import Database from 'better-sqlite3';
import path from 'path';

// Initialize DB
const dbPath = path.join(process.cwd(), 'telemetry.db');
const db = new Database(dbPath);

// Create table if not exists
db.exec(`
  CREATE TABLE IF NOT EXISTS telemetry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT,
    last_name TEXT,
    class_name TEXT,
    mission_name TEXT,
    action_type TEXT,
    start_time TEXT,
    time_spent_sec INTEGER,
    attempts_count INTEGER,
    success BOOLEAN,
    status TEXT,
    action_log TEXT,
    is_hardcore BOOLEAN DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

try {
  db.exec("ALTER TABLE telemetry ADD COLUMN is_hardcore BOOLEAN DEFAULT 0");
} catch(e) {
  // Column might already exist, ignore
}

export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get('Content-Type') === 'application/json') {
    try {
      const body = await request.json();
      
      const insert = db.prepare(`
        INSERT INTO telemetry (
          first_name, last_name, class_name, mission_name, action_type,
          start_time, time_spent_sec, attempts_count, success, status, action_log, is_hardcore
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);
      
      insert.run(
        body.student_firstName || 'Unknown',
        body.student_lastName || 'Unknown',
        body.student_class || 'Unknown',
        body.mission_name || '',
        body.action_type || '',
        body.start_time || '',
        body.time_spent_sec || 0,
        body.attempts_count || 0,
        body.success ? 1 : 0,
        body.status || '',
        JSON.stringify(body.action_log || []),
        body.is_hardcore ? 1 : 0
      );
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (err: any) {
      console.error('API Telemetry Error:', err);
      return new Response(JSON.stringify({ success: false, error: err.message }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }
  return new Response(null, { status: 400 });
};
