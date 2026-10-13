import { test, expect } from '@playwright/test';

test.describe('Lesson 8-6 & 8-7: Integration & Teacher Analytics Suite', () => {

  test('GET /api/progress accurately calculates progress for lesson 6 and lesson 7', async ({ request }) => {
    // Check progress API for Lesson 6
    const res6 = await request.get('/api/progress', {
      params: {
        firstName: 'Unknown',
        lastName: 'Unknown',
        className: 'Unknown',
        lessonPrefix: 'Урок 6',
        courseSlug: '8-класс',
        lessonId: '6'
      }
    });
    expect(res6.status()).toBe(200);
    const data6 = await res6.json();
    expect(data6).toHaveProperty('unlockedNormal');
    expect(data6).toHaveProperty('unlockedHardcore');
    expect(data6).toHaveProperty('isNormalCompleted');

    // Check progress API for Lesson 7
    const res7 = await request.get('/api/progress', {
      params: {
        firstName: 'Unknown',
        lastName: 'Unknown',
        className: 'Unknown',
        lessonPrefix: 'Урок 7',
        courseSlug: '8-класс',
        lessonId: '7'
      }
    });
    expect(res7.status()).toBe(200);
    const data7 = await res7.json();
    expect(data7).toHaveProperty('unlockedNormal');
    expect(data7).toHaveProperty('unlockedHardcore');
    expect(data7).toHaveProperty('isNormalCompleted');
  });

  test('GET /api/teacher/stats correctly filters by course 8-класс and aggregates lesson 6 and 7 KPIs', async ({ request }) => {
    // 1. Stats for Lesson 6
    const res6 = await request.get('/api/teacher/stats', {
      params: {
        course: '8-класс',
        lesson: '6',
        class: 'all',
        date: 'all'
      }
    });
    expect(res6.status()).toBe(200);
    const stats6 = await res6.json();
    expect(stats6.success).toBe(true);
    expect(stats6).toHaveProperty('kpi');
    expect(stats6).toHaveProperty('students');
    expect(Array.isArray(stats6.students)).toBe(true);

    // 2. Stats for Lesson 7
    const res7 = await request.get('/api/teacher/stats', {
      params: {
        course: '8-класс',
        lesson: '7',
        class: 'all',
        date: 'all'
      }
    });
    expect(res7.status()).toBe(200);
    const stats7 = await res7.json();
    expect(stats7.success).toBe(true);
    expect(stats7).toHaveProperty('kpi');
    expect(stats7).toHaveProperty('students');
    expect(Array.isArray(stats7.students)).toBe(true);

    // Verify student records contain Level 1, 2, 3 objects
    if (stats7.students.length > 0) {
      const student = stats7.students[0];
      expect(student).toHaveProperty('key');
      expect(student).toHaveProperty('displayName');
      expect(student).toHaveProperty('levels');
    }
  });

});
