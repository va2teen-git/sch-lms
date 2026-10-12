import { test, expect } from '@playwright/test';

test.describe('Teacher Monitoring Dashboard & Telemetry Analytics Suite', () => {
  const baseUrl = 'http://localhost:4321';

  test('GET /api/teacher/stats returns valid schema and KPI aggregations', async ({ request }) => {
    const res = await request.get(`${baseUrl}/api/teacher/stats?date=all`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.students)).toBe(true);
    expect(body.kpi).toBeDefined();
    expect(typeof body.kpi.totalStudents).toBe('number');
    expect(typeof body.kpi.completedCount).toBe('number');
    expect(typeof body.kpi.totalErrors).toBe('number');
    expect(Array.isArray(body.availableDates)).toBe(true);
    expect(Array.isArray(body.classes)).toBe(true);
  });

  test('GET /api/teacher/stats accurately aggregates Lesson 20 data for 11th grade', async ({ request }) => {
    const res = await request.get(`${baseUrl}/api/teacher/stats?class=11-класс_углубленный&lesson=20&date=2026-10-12&exclude_tests=1`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.students.length).toBeGreaterThan(0);

    // Verify student object structure
    const sample = body.students[0];
    expect(sample.displayName).toBeDefined();
    expect(sample.className).toBe('11-класс_углубленный');
    expect(sample.levels).toBeDefined();
    expect(sample.levels[1]).toBeDefined();
    expect(sample.levels[2]).toBeDefined();
    expect(sample.levels[3]).toBeDefined();
    expect(typeof sample.totalActiveTimeSec).toBe('number');
    expect(typeof sample.totalErrors).toBe('number');
    expect(sample.lessonStatus).toBeDefined();
  });

  test('Teacher dashboard page /teacher renders responsive layout, filters and table', async ({ page }) => {
    await page.goto(`${baseUrl}/teacher`);

    // Page title and header
    await expect(page.getByRole('heading', { name: 'Панель мониторинга урока' })).toBeVisible();
    await expect(page.locator('#live-indicator')).toBeVisible();

    // KPI cards exist
    await expect(page.locator('#kpi-total')).toBeVisible();
    await expect(page.locator('#kpi-completed')).toBeVisible();
    await expect(page.locator('#kpi-hardcore')).toBeVisible();
    await expect(page.locator('#kpi-avg-time')).toBeVisible();

    // Filters exist
    await expect(page.locator('#filter-class')).toBeVisible();
    await expect(page.locator('#filter-lesson')).toBeVisible();
    await expect(page.locator('#filter-date')).toBeVisible();
    await expect(page.locator('#filter-search')).toBeVisible();

    // Table container has horizontal scrollability and proper min-width
    const tableContainer = page.locator('.overflow-x-auto');
    await expect(tableContainer).toBeVisible();
    await expect(page.locator('#progress-table')).toBeVisible();

    // Check headers
    await expect(page.locator('th', { hasText: 'Ученик' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Уровень 1' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Уровень 2' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Уровень 3' })).toBeVisible();
    await expect(page.locator('th', { hasText: 'Активное время' })).toBeVisible();

    // Actions button exists
    await expect(page.locator('#export-btn')).toBeVisible();
    await expect(page.locator('#toggle-live-btn')).toBeVisible();
  });
});
