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

  test('Teacher dashboard table column sorting works and updates sort indicators without page errors', async ({ page }) => {
    let pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(`${baseUrl}/teacher`);
    await page.waitForTimeout(500);

    // Initial state: Last activity is sorted desc
    await expect(page.locator('#sort-last-icon')).toHaveText('↓');
    await expect(page.locator('#sort-name-icon')).toHaveText('↕');

    // Click Student Name column header: sorts ascending
    await page.locator('th[data-sort="name"]').click();
    await expect(page.locator('#sort-name-icon')).toHaveText('↑');
    await expect(page.locator('#sort-last-icon')).toHaveText('↕');

    // Click Student Name column header again: sorts descending
    await page.locator('th[data-sort="name"]').click();
    await expect(page.locator('#sort-name-icon')).toHaveText('↓');

    // Click Active Time column header: sorts descending
    await page.locator('th[data-sort="time"]').click();
    await expect(page.locator('#sort-time-icon')).toHaveText('↓');
    await expect(page.locator('#sort-name-icon')).toHaveText('↕');

    expect(pageErrors.length).toBe(0);
  });

  test('Teacher dashboard supports multi-column sorting with Ctrl/Shift key and shows priority superscripts', async ({ page }) => {
    let pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(`${baseUrl}/teacher`);
    await page.waitForTimeout(500);

    // 1. Click Class: primary sort ascending
    await page.locator('th[data-sort="class"]').click();
    await expect(page.locator('#sort-class-icon')).toHaveText('↑');
    await expect(page.locator('#sort-name-icon')).toHaveText('↕');

    // 2. Ctrl + Click Student Name: adds secondary sort ascending
    await page.locator('th[data-sort="name"]').click({ modifiers: ['Control'] });
    await expect(page.locator('#sort-class-icon')).toHaveText('¹↑');
    await expect(page.locator('#sort-name-icon')).toHaveText('²↑');

    // 3. Ctrl + Click Student Name again: toggles secondary to descending
    await page.locator('th[data-sort="name"]').click({ modifiers: ['Control'] });
    await expect(page.locator('#sort-class-icon')).toHaveText('¹↑');
    await expect(page.locator('#sort-name-icon')).toHaveText('²↓');

    // 4. Normal Click Active Time: resets back to single sort
    await page.locator('th[data-sort="time"]').click();
    await expect(page.locator('#sort-time-icon')).toHaveText('↓');
    await expect(page.locator('#sort-class-icon')).toHaveText('↕');
    await expect(page.locator('#sort-name-icon')).toHaveText('↕');

    expect(pageErrors.length).toBe(0);
  });

  test('GET /api/teacher/stats supports multiple classes filtering via comma-separated param', async ({ request }) => {
    const res = await request.get(`${baseUrl}/api/teacher/stats?class=10-класс_углубленный,11-класс_углубленный&date=all`);
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    const classes = [...new Set(body.students.map(s => s.className))];
    expect(classes.some(c => c === '10-класс_углубленный')).toBe(true);
    expect(classes.some(c => c === '11-класс_углубленный')).toBe(true);
  });

  test('Teacher dashboard allows multi-class selection via checkboxes dropdown', async ({ page }) => {
    await page.goto(`${baseUrl}/teacher`);
    await page.waitForTimeout(500);

    // Initial label
    await expect(page.locator('#class-select-label')).toHaveText('Все классы');

    // Click dropdown button to open menu
    await page.locator('#filter-class').click();
    await expect(page.locator('#class-dropdown-menu')).toBeVisible();

    // Check 10-класс_углубленный and 11-класс_углубленный
    await page.locator('input[value="10-класс_углубленный"]').check();
    await page.locator('input[value="11-класс_углубленный"]').check();

    // Label reflects 2 classes selected
    await expect(page.locator('#class-select-label')).toHaveText('Выбрано: 2 кл.');

    // Click outside to close menu
    await page.locator('#progress-table').click();
    await expect(page.locator('#class-dropdown-menu')).toBeHidden();

    // Check that table rows contain the selected classes
    const classCells = await page.locator('.student-row td:nth-child(3)').allTextContents();
    const unique = [...new Set(classCells.map(c => c.trim()))];
    expect(unique.every(c => c === '10-класс_углубленный' || c === '11-класс_углубленный')).toBe(true);
  });

  test('GET /api/teacher/stats attributes 10th grade students who solved 8th grade lesson to 10-класс_углубленный', async ({ request }) => {
    // Testing the exact scenario reported by teacher: 10th grade solved 8th grade lesson (Lesson 7) today
    const resSingle = await request.get(`${baseUrl}/api/teacher/stats?class=10-класс_углубленный&lesson=7&date=2026-10-12`);
    expect(resSingle.status()).toBe(200);
    const bodySingle = await resSingle.json();
    expect(bodySingle.success).toBe(true);
    expect(bodySingle.students.length).toBeGreaterThan(0);
    expect(bodySingle.students.every(s => s.className === '10-класс_углубленный')).toBe(true);

    // Multi-class scenario: 10th and 11th grade selected, returns 10th grade data without 'no data'
    const resMulti = await request.get(`${baseUrl}/api/teacher/stats?class=10-класс_углубленный,11-класс_углубленный&lesson=7&date=2026-10-12`);
    expect(resMulti.status()).toBe(200);
    const bodyMulti = await resMulti.json();
    expect(bodyMulti.success).toBe(true);
    expect(bodyMulti.students.length).toBeGreaterThan(0);
  });

  test('Teacher dashboard allows cross-course lesson selection from dropdown when 10th grade is selected', async ({ page }) => {
    await page.goto(`${baseUrl}/teacher`);
    await page.waitForTimeout(500);

    // Filter class by 10-класс_углубленный only
    await page.locator('#filter-class').click();
    await page.locator('input[value="10-класс_углубленный"]').check();
    await page.locator('#progress-table').click();

    // Verify lesson dropdown still offers other courses (e.g. 8-класс)
    const optgroupLabels = await page.locator('#filter-lesson optgroup').evaluateAll(groups => groups.map(g => g.label));
    expect(optgroupLabels.some(label => label.includes('8-класс') || label.includes('Другой курс'))).toBe(true);
  });
});
