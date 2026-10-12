import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';

test.describe('Telemetry & Database Contract Integrity', () => {
  const dbPath = path.join(process.cwd(), 'telemetry.db');

  test('Database schema contains all required telemetry columns', async () => {
    const db = new Database(dbPath);
    const columns = db.prepare("PRAGMA table_info(telemetry)").all();
    const columnNames = columns.map(c => c.name);

    expect(columnNames).toContain('id');
    expect(columnNames).toContain('mission_name');
    expect(columnNames).toContain('action_type');
    expect(columnNames).toContain('time_spent_sec');
    expect(columnNames).toContain('attempts_count');
    expect(columnNames).toContain('success');
    expect(columnNames).toContain('status');
    expect(columnNames).toContain('action_log');
    expect(columnNames).toContain('is_hardcore');
    expect(columnNames).toContain('student_class');
    expect(columnNames).toContain('course_slug');
    expect(columnNames).toContain('lesson_id');
    expect(columnNames).toContain('level_number');
    expect(columnNames).toContain('timestamp');
    db.close();
  });

  test('POST /api/telemetry inserts valid completion record', async ({ request }) => {
    const testMission = `Урок 20 :: Автотест Проверка (Уровень 1) [${Date.now()}]`;
    const payload = {
      student_firstName: 'Тест',
      student_lastName: 'Автоматический',
      student_class: '11-ИТ',
      course_slug: '11-класс_углубленный',
      lesson_id: '20',
      level_number: 1,
      mission_name: testMission,
      action_type: 'level_complete',
      start_time: new Date().toISOString(),
      time_spent_sec: 42,
      attempts_count: 1,
      success: true,
      status: 'completed',
      is_hardcore: false,
      action_log: [{ time: new Date().toISOString(), action: 'test_action' }]
    };

    const res = await request.post('http://localhost:4321/api/telemetry', {
      data: payload,
      headers: { 'Content-Type': 'application/json' }
    });

    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify row in database
    const db = new Database(dbPath);
    const row = db.prepare("SELECT * FROM telemetry WHERE mission_name = ?").get(testMission);
    expect(row).toBeDefined();
    expect(row.action_type).toBe('level_complete');
    expect(row.time_spent_sec).toBe(42);
    expect(row.attempts_count).toBe(1);
    expect(row.success).toBe(1);
    expect(row.is_hardcore).toBe(0);
    expect(row.student_class).toBe('11-ИТ');
    expect(row.course_slug).toBe('11-класс_углубленный');
    expect(row.lesson_id).toBe('20');
    expect(row.level_number).toBe(1);

    const parsedLog = JSON.parse(row.action_log);
    expect(Array.isArray(parsedLog)).toBe(true);
    expect(parsedLog[0].action).toBe('test_action');
    db.close();
  });

  test('POST /api/telemetry correctly records hardcore_reset event', async ({ request }) => {
    const testMission = `Урок 20 :: Хардкор Сброс [${Date.now()}]`;
    const payload = {
      mission_name: testMission,
      action_type: 'hardcore_reset',
      time_spent_sec: 15,
      attempts_count: 2,
      success: false,
      is_hardcore: true
    };

    const res = await request.post('http://localhost:4321/api/telemetry', {
      data: payload,
      headers: { 'Content-Type': 'application/json' }
    });

    expect(res.status()).toBe(200);

    // Verify row in database
    const db = new Database(dbPath);
    const row = db.prepare("SELECT * FROM telemetry WHERE mission_name = ?").get(testMission);
    expect(row).toBeDefined();
    expect(row.action_type).toBe('hardcore_reset');
    expect(row.is_hardcore).toBe(1);
    expect(row.success).toBe(0);
    db.close();
  });

  test('POST /api/telemetry rejects invalid content type with 400 or 403', async ({ request }) => {
    const res = await request.post('http://localhost:4321/api/telemetry', {
      data: 'plain text not json',
      headers: { 
        'Content-Type': 'text/plain',
        'Origin': 'http://localhost:4321'
      }
    });
    expect([400, 403]).toContain(res.status());
  });
});
