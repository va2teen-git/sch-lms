import { test, expect } from '@playwright/test';

test.describe('Teacher Monitoring Dashboard & Telemetry Analytics Suite', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:4321';

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
    expect(sample.attempts).toBeDefined();
    expect(Array.isArray(sample.attempts)).toBe(true);
    expect(typeof sample.attemptsCount).toBe('number');
    expect(typeof sample.isNormalMastered).toBe('boolean');
    expect('bestSprintTimeSec' in sample).toBe(true);
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

    // Click Logo-Storm sprint column header: sorts ascending
    await page.locator('th[data-sort="sprint"]').click();
    await expect(page.locator('#sort-sprint-icon')).toHaveText('↓');
    await expect(page.locator('#sort-time-icon')).toHaveText('↕');

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
    await page.getByRole('heading', { name: 'Панель мониторинга урока' }).click();
    await expect(page.locator('#class-dropdown-menu')).toBeHidden();

    // Check that table rows contain the selected classes
    await expect(async () => {
      const classCells = await page.locator('.student-row td:nth-child(3)').allTextContents();
      const unique = [...new Set(classCells.map(c => c.trim()))];
      expect(unique.length).toBeGreaterThan(0);
      expect(unique.every(c => c === '10-класс_углубленный' || c === '11-класс_углубленный')).toBe(true);
    }).toPass({ timeout: 5000 });
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

  test('GET /api/teacher/stats filters by course parameter accurately', async ({ request }) => {
    const res = await request.get(`${baseUrl}/api/teacher/stats?class=10-класс_углубленный&course=8-класс&lesson=7&date=2026-10-12`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.students.length).toBeGreaterThan(0);
    expect(body.students.every(s => s.className === '10-класс_углубленный')).toBe(true);
    expect(body.selectedFilters.course).toBe('8-класс');
  });

  test('GET /api/teacher/stats displays competitive multi-class leaderboard across courses without no-data error', async ({ request }) => {
    const res = await request.get(`${baseUrl}/api/teacher/stats?class=10-класс_углубленный,11-класс_углубленный&course=8-класс&lesson=7&date=2026-10-12`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.students.length).toBeGreaterThan(0);
  });

  test('Student dashboard /courses renders scrollable all-class lesson matrix without single-class lock', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(baseUrl);
    await page.fill('#firstName', 'Алексей');
    await page.fill('#lastName', 'Смирнов');
    await page.selectOption('#classSelect', '11-класс_углубленный');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/courses');
    await expect(page.locator('#student-name')).toHaveText('Смирнов Алексей');
    await expect(page.locator('#class-name')).toContainText('11 класс_углубленный');

    // Dropdown course-select must no longer exist; matrix must render all 7 classes
    await expect(page.locator('#course-select')).toHaveCount(0);
    const matrix = page.locator('#lessons-matrix');
    await expect(matrix).toBeVisible();
    await expect(page.locator('[data-course-row]')).toHaveCount(7);

    // Matrix scrolls horizontally to the right
    const scrollDims = await matrix.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      overflowX: getComputedStyle(el).overflowX,
      overflowY: getComputedStyle(el).overflowY,
    }));
    expect(scrollDims.scrollWidth).toBeGreaterThan(scrollDims.clientWidth);
    expect(['auto', 'scroll']).toContain(scrollDims.overflowX);
    expect(['auto', 'scroll']).toContain(scrollDims.overflowY);

    // Matrix scrolls vertically when viewport height is constrained
    await page.setViewportSize({ width: 1280, height: 360 });
    const smallHeightDims = await matrix.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
    }));
    expect(smallHeightDims.scrollHeight).toBeGreaterThan(smallHeightDims.clientHeight);

    // Card displays class label, ordinal number, and topic for 7-класс lesson 7
    const card7_7 = page.locator('#lessons-matrix a[data-course="7-класс"][data-lesson="7"]');
    await expect(card7_7).toHaveAttribute('href', '/lesson/7-класс/7');
    const cardText = await card7_7.textContent();
    expect(cardText).toContain('7 кл');
    expect(cardText).toContain('№7');

    // Profile stays 11th grade in localStorage
    const savedClass = await page.evaluate(() => localStorage.getItem('student_class'));
    expect(savedClass).toBe('11-класс_углубленный');
  });

  test('GET /api/progress isolates lesson progress across courses with the same lesson number', async ({ request }) => {
    const uniq = Date.now();
    const fName = `ТестИзоляция${uniq}`;
    const lName = 'Ученик';
    const sClass = '11-класс_углубленный';

    // Complete 11-класс_углубленный lesson 7 (all 3 levels)
    for (const lvl of [1, 2, 3]) {
      const postRes = await request.post(`${baseUrl}/api/telemetry`, {
        data: {
          student_firstName: fName,
          student_lastName: lName,
          student_class: sClass,
          course_slug: '11-класс_углубленный',
          lesson_id: '7',
          level_number: lvl,
          mission_name: `Урок 7 :: Тест 11 кл (Уровень ${lvl})`,
          action_type: 'level_complete',
          status: 'completed',
          time_spent_sec: 10,
          attempts_count: 1,
          success: true,
          is_hardcore: false
        }
      });
      expect(postRes.status()).toBe(200);
    }

    // 11-класс_углубленный lesson 7 must be completed
    const prog11 = await request.get(`${baseUrl}/api/progress?firstName=${encodeURIComponent(fName)}&lastName=${encodeURIComponent(lName)}&className=${encodeURIComponent(sClass)}&lessonPrefix=${encodeURIComponent('Урок 7')}&courseSlug=11-класс_углубленный&lessonId=7`);
    expect(prog11.status()).toBe(200);
    const body11 = await prog11.json();
    expect(body11.isNormalCompleted).toBe(true);

    // 7-класс lesson 7 for the SAME 11th grade student must NOT be marked completed!
    const prog7 = await request.get(`${baseUrl}/api/progress?firstName=${encodeURIComponent(fName)}&lastName=${encodeURIComponent(lName)}&className=${encodeURIComponent(sClass)}&lessonPrefix=${encodeURIComponent('Урок 7')}&courseSlug=7-класс&lessonId=7`);
    expect(prog7.status()).toBe(200);
    const body7 = await prog7.json();
    expect(body7.isNormalCompleted).toBe(false);
    expect(body7.unlockedNormal).toBe(1);
  });

  test('Teacher dashboard displays cross-course lesson badge and filters 11th grade student solving 7th grade lesson', async ({ page, request }) => {
    const uniq = Date.now();
    const fName = `Максим${uniq}`;
    const lName = 'КроссКурс';

    const postRes = await request.post(`${baseUrl}/api/telemetry`, {
      data: {
        student_firstName: fName,
        student_lastName: lName,
        student_class: '11-класс_углубленный',
        course_slug: '7-класс',
        lesson_id: '7',
        level_number: 1,
        mission_name: 'Урок 7 :: Устройство сетей (Уровень 1)',
        action_type: 'level_complete',
        status: 'completed',
        time_spent_sec: 25,
        attempts_count: 1,
        success: true,
        is_hardcore: false
      }
    });
    expect(postRes.status()).toBe(200);

    // Stats API returns workedLessons with 7-класс lesson 7 under student's 11-класс_углубленный cohort
    const statsRes = await request.get(`${baseUrl}/api/teacher/stats?class=11-класс_углубленный&course=7-класс&lesson=7&date=today&exclude_tests=0`);
    expect(statsRes.status()).toBe(200);
    const statsBody = await statsRes.json();
    const found = statsBody.students.find(s => s.firstName === fName && s.lastName === lName);
    expect(found).toBeDefined();
    expect(found.className).toBe('11-класс_углубленный');
    expect(found.workedLessons).toContainEqual({ courseSlug: '7-класс', lessonId: '7' });

    // Teacher UI filters by 11-класс_углубленный + Другой курс 7-класс Урок 7 and renders cross-course badge
    await page.goto(`${baseUrl}/teacher?date=today`);
    await page.locator('#filter-exclude-tests').uncheck();
    await page.locator('#filter-class').click();
    await page.locator('input[value="11-класс_углубленный"]').check();
    await page.locator('#progress-table').click();
    await page.locator('#filter-lesson').selectOption('7-класс::Урок 7');
    await page.fill('#filter-search', fName);

    const row = page.locator('.student-row', { hasText: fName });
    await expect(row).toBeVisible();
    await expect(row.locator('td:nth-child(3)')).toHaveText('11-класс_углубленный');
    await expect(row.locator('td:nth-child(4)')).toContainText('7 кл • Ур. 7');
  });

  test('Teacher dashboard detail modal displays student attempt history', async ({ page }) => {
    await page.goto(`${baseUrl}/teacher?date=today`);
    await page.waitForSelector('.view-log-btn');
    
    // Click log on first student
    await page.locator('.view-log-btn').first().click();
    await expect(page.locator('#detail-modal')).toBeVisible();
    await expect(page.locator('#modal-attempts-container')).toBeVisible();
    await expect(page.locator('#modal-attempts-list')).toBeVisible();
    const attemptsContent = await page.locator('#modal-attempts-list').innerText();
    expect(attemptsContent.length).toBeGreaterThan(0);
    
    // Close modal
    await page.locator('#modal-close-btn').click();
    await expect(page.locator('#detail-modal')).toBeHidden();
  });

  test('Matrix displays level colors for incomplete lessons and achievement emojis (✅ 💀 ⚔️ ⚡) + Prince badge on /teacher', async ({ page, request }) => {
    const uniq = Date.now();
    const fName = `МатрицаСтатус${uniq}`;
    const lName = 'Ученик';
    const sClass = '11-класс_углубленный';

    const postEvent = async (payload) => {
      const r = await request.post(`${baseUrl}/api/telemetry`, { data: payload });
      expect(r.status()).toBe(200);
    };

    // 1. 7-класс Урок 4 -> stopped at Level 1 (in_progress with time > 0)
    await postEvent({
      student_firstName: fName,
      student_lastName: lName,
      student_class: sClass,
      course_slug: '7-класс',
      lesson_id: '4',
      level_number: 1,
      mission_name: 'Урок 4 :: Тест (Уровень 1)',
      action_type: 'in_progress',
      status: 'in_progress',
      time_spent_sec: 15,
      attempts_count: 1,
      success: false,
      is_hardcore: false
    });

    // 2. 7-класс Урок 5 -> stopped at Level 2 (Level 1 completed)
    await postEvent({
      student_firstName: fName,
      student_lastName: lName,
      student_class: sClass,
      course_slug: '7-класс',
      lesson_id: '5',
      level_number: 1,
      mission_name: 'Урок 5 :: Тест (Уровень 1)',
      action_type: 'level_complete',
      status: 'completed',
      time_spent_sec: 20,
      attempts_count: 1,
      success: true,
      is_hardcore: false
    });

    // 3. 7-класс Урок 6 -> stopped at Level 3 (Levels 1 & 2 completed)
    for (const lvl of [1, 2]) {
      await postEvent({
        student_firstName: fName,
        student_lastName: lName,
        student_class: sClass,
        course_slug: '7-класс',
        lesson_id: '6',
        level_number: lvl,
        mission_name: `Урок 6 :: Тест (Уровень ${lvl})`,
        action_type: 'level_complete',
        status: 'completed',
        time_spent_sec: 20,
        attempts_count: 1,
        success: true,
        is_hardcore: false
      });
    }

    // 4. 7-класс Урок 7 -> completed in Hardcore + Prince of Persia + Logo-Storm
    for (const lvl of [1, 2, 3]) {
      await postEvent({
        student_firstName: fName,
        student_lastName: lName,
        student_class: sClass,
        course_slug: '7-класс',
        lesson_id: '7',
        level_number: lvl,
        mission_name: `Урок 7 :: Тест (Уровень ${lvl})`,
        action_type: 'level_complete',
        status: 'completed',
        time_spent_sec: 25,
        attempts_count: 1,
        success: true,
        is_hardcore: true
      });
    }
    await postEvent({
      student_firstName: fName,
      student_lastName: lName,
      student_class: sClass,
      course_slug: '7-класс',
      lesson_id: '7',
      level_number: 0,
      mission_name: 'Урок 7 :: Двоичное кодирование :: Prince of Persia (Уровень 1)',
      action_type: 'level_complete',
      status: 'completed',
      time_spent_sec: 42,
      attempts_count: 1,
      success: true,
      is_hardcore: true
    });
    await postEvent({
      student_firstName: fName,
      student_lastName: lName,
      student_class: sClass,
      course_slug: '7-класс',
      lesson_id: '7',
      level_number: 0,
      mission_name: 'Урок 7 :: Лого-Шторм',
      action_type: 'sprint_complete',
      status: 'completed',
      time_spent_sec: 18,
      attempts_count: 1,
      success: true,
      action_log: JSON.stringify({ cpm: 240, wpm: 48, accuracy: 98 })
    });

    // Open /courses as this student
    await page.goto(baseUrl);
    await page.evaluate(({ fName, lName, sClass }) => {
      localStorage.setItem('student_firstName', fName);
      localStorage.setItem('student_lastName', lName);
      localStorage.setItem('student_class', sClass);
    }, { fName, lName, sClass });

    await page.goto(`${baseUrl}/courses`);

    const c4 = page.locator('.lesson-card[data-course="7-класс"][data-lesson="4"]');
    await expect(c4).toHaveAttribute('data-progress-state', 'stopped-1');
    await expect(c4).toHaveClass(/bg-emerald-50/);
    await expect(c4).toContainText('Ур.1');

    const c5 = page.locator('.lesson-card[data-course="7-класс"][data-lesson="5"]');
    await expect(c5).toHaveAttribute('data-progress-state', 'stopped-2');
    await expect(c5).toHaveClass(/bg-amber-50/);
    await expect(c5).toContainText('Ур.2');

    const c6 = page.locator('.lesson-card[data-course="7-класс"][data-lesson="6"]');
    await expect(c6).toHaveAttribute('data-progress-state', 'stopped-3');
    await expect(c6).toHaveClass(/bg-red-50/);
    await expect(c6).toContainText('Ур.3');

    const c7 = page.locator('.lesson-card[data-course="7-класс"][data-lesson="7"]');
    await expect(c7).toHaveAttribute('data-progress-state', 'completed');
    const c7Badges = await c7.locator('.card-status-badges').textContent();
    expect(c7Badges).toContain('✅');
    expect(c7Badges).toContain('💀');
    expect(c7Badges).toContain('⚔️ Эт.1');
    expect(c7Badges).toContain('⚡');
    await expect(page.locator('#prince-campaign-counter')).toContainText('⚔️ Принц: 1 /');

    // Verify /teacher shows Prince of Persia achievement badge, campaign column, and modal card
    await page.goto(`${baseUrl}/teacher?date=today`);
    await page.locator('#filter-exclude-tests').uncheck();
    await page.locator('#filter-lesson').selectOption('7-класс::Урок 7');
    await page.fill('#filter-search', fName);

    const row = page.locator('.student-row', { hasText: fName });
    await expect(row).toBeVisible();
    await expect(row.locator('td:nth-child(4)')).toContainText('⚔️ Принц Персии');
    await expect(row.locator('td:nth-child(10)')).toContainText('⚔️ 1/');

    await row.locator('.view-log-btn').click();
    await expect(page.locator('#modal-level-cards')).toContainText('Prince of Persia (1989)');
    await expect(page.locator('#modal-level-cards')).toContainText('Покорен');
    await expect(page.locator('#modal-prince-container')).toBeVisible();
    await expect(page.locator('#modal-prince-stages-list')).toContainText('Этап 1');
    await expect(page.locator('#modal-prince-stages-list')).toContainText('7 кл • Ур. 7');
  });

  test('Teacher dashboard renders stage stars (*****), Level 3 reset wave, active_tab time, and accurate error counts', async ({ page, request }) => {
    const uid = Date.now();
    const fName = `Этап_${uid}`;
    const lName = 'Волнов';
    const sClass = '9-класс';
    const attId = `att_stage_${uid}`;

    const postEvent = async (payload) => {
      const res = await request.post(`${baseUrl}/api/telemetry`, {
        data: {
          student_firstName: fName,
          student_lastName: lName,
          student_class: sClass,
          course_slug: sClass,
          lesson_id: '8',
          attempt_id: attId,
          attempt_number: 1,
          attempt_mode: 'normal',
          is_hardcore: false,
          ...payload
        },
        headers: { 'Content-Type': 'application/json' }
      });
      expect(res.ok()).toBeTruthy();
    };

    // Level 1 completed with active_tab pure time 45s and cumulative "Error:" string in action_log (must NOT count as error!)
    await postEvent({
      level_number: 1,
      mission_name: 'Урок 8 :: Табличные модели (Уровень 1)',
      action_type: 'level_complete',
      status: 'completed',
      time_spent_sec: 45,
      timer_mode: 'active_tab',
      stage: 3,
      total_stages: 3,
      success: true,
      action_log: ['Error: old log entry', 'Correct: final']
    });

    // Level 2 in progress at stage 3 of 5 with 2 real errors (burst duplicate should collapse to 1 + 1 = 2)
    await postEvent({
      level_number: 2,
      mission_name: 'Урок 8 :: Табличные модели (Уровень 2)',
      action_type: 'level_fail',
      status: 'in_progress',
      time_spent_sec: 20,
      timer_mode: 'active_tab',
      stage: 2,
      total_stages: 5,
      attempts_count: 1
    });
    // Burst duplicate within same second and same attempts_count -> ignored
    await postEvent({
      level_number: 2,
      mission_name: 'Урок 8 :: Табличные модели (Уровень 2)',
      action_type: 'level_fail',
      status: 'in_progress',
      time_spent_sec: 20,
      timer_mode: 'active_tab',
      stage: 2,
      total_stages: 5,
      attempts_count: 1
    });
    // Second distinct error + stage 3 heartbeat
    await postEvent({
      level_number: 2,
      mission_name: 'Урок 8 :: Табличные модели (Уровень 2)',
      action_type: 'level_fail',
      status: 'in_progress',
      time_spent_sec: 55,
      timer_mode: 'active_tab',
      stage: 3,
      total_stages: 5,
      attempts_count: 2
    });

    // Level 3 in progress: reached wave 6, got reset on wave 6, now at wave 2/10, pure active_tab time 70s (> L2 55s, must NOT be deducted!)
    await postEvent({
      level_number: 3,
      mission_name: 'Урок 8 :: Табличные модели (Уровень 3)',
      action_type: 'level_fail',
      status: 'failed',
      time_spent_sec: 50,
      timer_mode: 'active_tab',
      wave: 6,
      total_waves: 10,
      attempts_count: 1
    });
    await postEvent({
      level_number: 3,
      mission_name: 'Урок 8 :: Табличные модели (Уровень 3)',
      action_type: 'in_progress',
      status: 'in_progress',
      time_spent_sec: 70,
      timer_mode: 'active_tab',
      wave: 2,
      total_waves: 10,
      attempts_count: 1
    });

    // Manual lesson reset with level_number: null must NOT inflate totalErrors
    await postEvent({
      level_number: null,
      mission_name: 'Урок 8 :: Табличные модели',
      action_type: 'hardcore_reset',
      is_hardcore: true,
      is_manual_reset: true,
      attempt_id: `att_hc_${uid}`,
      attempt_number: 2,
      attempt_mode: 'hardcore'
    });

    // Verify API contract
    const res = await request.get(`${baseUrl}/api/teacher/stats?date=today&exclude_tests=0&search=${encodeURIComponent(fName)}`);
    const body = await res.json();
    expect(body.success).toBe(true);
    const s = body.students.find(st => st.firstName === fName);
    expect(s).toBeDefined();

    // Pure times preserved without cross-level deduction
    expect(s.levels[1].timeSpentSec).toBe(45);
    expect(s.levels[2].timeSpentSec).toBe(55);
    expect(s.levels[3].timeSpentSec).toBe(70);
    expect(s.totalActiveTimeSec).toBe(170);

    // Accurate error count: 0 (L1) + 2 (L2, duplicate collapsed) + 1 (L3) = 3 (manual reset & action_log 'Error:' ignored)
    expect(s.levels[1].errors).toBe(0);
    expect(s.levels[2].errors).toBe(2);
    expect(s.levels[3].errors).toBe(1);
    expect(s.totalErrors).toBe(3);

    // Stages and Level 3 reset wave
    expect(s.levels[2].currentStage).toBe(3);
    expect(s.levels[2].totalStages).toBe(5);
    expect(s.levels[3].currentStage).toBe(2);
    expect(s.levels[3].totalStages).toBe(10);
    expect(s.levels[3].lastResetWave).toBe(6);

    // Verify UI rendering on /teacher
    await page.goto(`${baseUrl}/teacher?date=today`);
    await page.locator('#filter-exclude-tests').uncheck();
    await page.fill('#filter-search', fName);

    const row = page.locator('.student-row', { hasText: fName });
    await expect(row).toBeVisible();

    // Level 2 cell: time + errors + 3 filled / 2 empty stars (★★★☆☆)
    const l2Cell = row.locator('td:nth-child(7)');
    await expect(l2Cell).toContainText('55с');
    await expect(l2Cell).toContainText('2 ош.');
    await expect(l2Cell).toContainText('★★★');
    await expect(l2Cell).toContainText('☆☆');

    // Level 3 cell: time + errors + wave stars + last reset wave (↩ В.6)
    const l3Cell = row.locator('td:nth-child(8)');
    await expect(l3Cell).toContainText('1м 10с');
    await expect(l3Cell).toContainText('1 ош.');
    await expect(l3Cell).toContainText('★★');
    await expect(l3Cell).toContainText('↩ В.6');
  });

  test('Teacher dashboard aggregates cross-lesson Prince campaign progress, modal stages, and CSV export', async ({ page, request }) => {
    const uniq = Date.now();
    const fName = `ПринцДашборд${uniq}`;
    const lName = 'Кампания';
    const sClass = '8-класс';

    const postEvent = async (payload) => {
      const r = await request.post(`${baseUrl}/api/telemetry`, { data: payload });
      expect(r.status()).toBe(200);
    };

    for (const lessonId of ['7', '8']) {
      for (const lvl of [1, 2, 3]) {
        await postEvent({
          student_firstName: fName,
          student_lastName: lName,
          student_class: sClass,
          course_slug: '8-класс',
          lesson_id: lessonId,
          level_number: lvl,
          mission_name: `Урок ${lessonId} :: Кампания (Уровень ${lvl})`,
          action_type: 'level_complete',
          status: 'completed',
          time_spent_sec: 12,
          attempts_count: 1,
          success: true,
          is_hardcore: true
        });
      }
    }

    await postEvent({
      student_firstName: fName,
      student_lastName: lName,
      student_class: sClass,
      course_slug: '8-класс',
      lesson_id: '7',
      level_number: 1,
      mission_name: 'Урок 7 :: Prince of Persia (Этап 1)',
      action_type: 'prince_complete',
      status: 'completed',
      time_spent_sec: 35,
      attempts_count: 1,
      success: true,
      is_hardcore: true,
      stage_current: 1,
      stage_total: 18
    });

    await postEvent({
      student_firstName: fName,
      student_lastName: lName,
      student_class: sClass,
      course_slug: '8-класс',
      lesson_id: '8',
      level_number: 2,
      mission_name: 'Урок 8 :: Prince of Persia (Этап 2)',
      action_type: 'prince_complete',
      status: 'completed',
      time_spent_sec: 48,
      attempts_count: 1,
      success: true,
      is_hardcore: true,
      stage_current: 2,
      stage_total: 18
    });

    // Even when filtering to a single lesson (Урок 7), cross-lesson campaign progress stays 2 / total
    const statsRes = await request.get(
      `${baseUrl}/api/teacher/stats?date=today&class=${encodeURIComponent(sClass)}&course=8-класс&lesson=7&exclude_tests=1&search=${encodeURIComponent(fName)}`
    );
    expect(statsRes.status()).toBe(200);
    const statsBody = await statsRes.json();
    expect(statsBody.students.length).toBe(1);

    const st = statsBody.students[0];
    expect(st.princeCampaignCompleted).toBe(2);
    expect(st.princeCampaignTotal).toBeGreaterThanOrEqual(15);
    expect(st.princeStages.map(p => ({ stage: p.stage, mapLevel: p.mapLevel, courseSlug: p.courseSlug, lessonId: p.lessonId }))).toEqual([
      { stage: 1, mapLevel: 1, courseSlug: '8-класс', lessonId: '7' },
      { stage: 2, mapLevel: 2, courseSlug: '8-класс', lessonId: '8' }
    ]);

    await page.goto(`${baseUrl}/teacher?date=today`);
    await page.locator('#filter-course').selectOption('8-класс');
    await page.locator('#filter-lesson').selectOption('Урок 7');
    await page.fill('#filter-search', fName);

    const row = page.locator('.student-row', { hasText: fName });
    await expect(row).toBeVisible();
    await expect(row.locator('td:nth-child(10)')).toContainText(`⚔️ 2/${st.princeCampaignTotal}`);

    // Open modal and check detailed stage list with linked lessons
    await row.locator('.view-log-btn').click();
    await expect(page.locator('#modal-prince-container')).toBeVisible();
    await expect(page.locator('#modal-prince-title')).toContainText(`2 / ${st.princeCampaignTotal}`);
    const stagesList = page.locator('#modal-prince-stages-list');
    await expect(stagesList).toContainText('Этап 1');
    await expect(stagesList).toContainText('Ур. 7');
    await expect(stagesList).toContainText('Этап 2');
    await expect(stagesList).toContainText('Ур. 8');
    await page.locator('#modal-close-btn').click();

    // Verify CSV export includes Prince campaign progress column
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export-btn').click();
    const download = await downloadPromise;
    const csvStream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of csvStream) {
      chunks.push(chunk);
    }
    const csvText = Buffer.concat(chunks).toString('utf-8');
    expect(csvText).toContain('Прогресс Принца');
    expect(csvText).toContain(`"2/${st.princeCampaignTotal}"`);
  });
});
