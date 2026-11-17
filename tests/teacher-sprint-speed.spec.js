import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';

test.describe('Teacher Dashboard Logo-Storm Speed Metrics Suite', () => {
  const baseUrl = process.env.BASE_URL || 'http://localhost:4321';
  const dbPath = path.join(process.cwd(), 'telemetry.db');

  test('Database contains sprint records with speed metrics', () => {
    const db = new Database(dbPath, { readonly: true });
    const count = db.prepare("SELECT count(*) as cnt FROM telemetry WHERE action_type = 'sprint_complete'").get();
    expect(count.cnt).toBeGreaterThan(0);
    db.close();
  });

  test('GET /api/teacher/stats outputs sprint speed (sprintCpm/sprintWpm) for students who completed Logo-Storm', async ({ request }) => {
    const res = await request.get(`${baseUrl}/api/teacher/stats?course=all&lesson=all&date=all&exclude_tests=1`);
    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);

    const runners = data.students.filter(s => s.bestSprintTimeSec !== null);
    expect(runners.length).toBeGreaterThan(0);

    // Every runner with a recorded sprint must have a valid positive speed metric
    for (const r of runners) {
      expect(typeof r.sprintCpm).toBe('number');
      expect(r.sprintCpm).toBeGreaterThan(0);
      expect(typeof r.sprintWpm).toBe('number');
      expect(r.sprintWpm).toBeGreaterThan(0);
      expect(r.sprintWpm).toBe(Math.round(r.sprintCpm / 5));
    }
  });

  test('Teacher dashboard HTML page outputs student speed (зн/мин) in Logo-Storm column without time fallbacks', async ({ page }) => {
    await page.goto(`${baseUrl}/teacher`);

    // Verify column header clearly indicates speed
    const sprintHeader = page.locator('th[data-sort="sprint"]');
    await expect(sprintHeader).toBeVisible();
    await expect(sprintHeader).toContainText('Лого-Шторм');
    await expect(sprintHeader).toContainText('зн/мин и сл/мин');

    // Wait for table to populate
    await page.waitForSelector('#table-body tr.student-row');

    // Filter by "За всё время" to see students who completed sprint
    await page.selectOption('#filter-date', 'all');
    await page.waitForTimeout(500);

    // Find student rows with Logo-Storm badge
    const sprintBadges = page.locator('#table-body tr.student-row td:nth-child(9) span.bg-cyan-100');
    const badgeCount = await sprintBadges.count();
    expect(badgeCount).toBeGreaterThan(0);

    // Verify badges display speed (зн/мин)
    for (let i = 0; i < Math.min(5, badgeCount); i++) {
      const badge = sprintBadges.nth(i);
      const text = await badge.textContent();
      expect(text).toContain('зн/мин');
      expect(text).toContain('сл/мин');
      // Must not be a raw time string like "⚡ 42с" or "⚡ 01:20"
      expect(text).not.toMatch(/^⚡\s*\d+[см]\b/);
    }
  });

  test('Attempt subrow has aligned columns with sprint cell and does not display attempt total time under Logo-Storm', async ({ page }) => {
    await page.goto(`${baseUrl}/teacher`);
    await page.selectOption('#filter-date', 'all');
    await page.waitForTimeout(500);

    // Expand the first student with attempts
    const expandBtn = page.locator('.toggle-attempts-btn').first();
    await expect(expandBtn).toBeVisible();
    await expandBtn.click();

    // Verify subrow appears and has 14 cells
    const subrow = page.locator('.attempt-subrow').first();
    await expect(subrow).toBeVisible();
    const cells = subrow.locator('td');
    await expect(cells).toHaveCount(14);

    // Cell 9 is the Logo-Storm column; Cell 10 is Prince of Persia; Cell 11 is the Total Time column
    const sprintCell = cells.nth(8); // 0-indexed: 8 = 9th column
    const timeCell = cells.nth(10);  // 0-indexed: 10 = 11th column

    // Cell 10 must contain time format (e.g. "0с", "1м 20с" or "—")
    const timeText = await timeCell.textContent();
    expect(timeText).toMatch(/\d+[см]|^—$/);

    // Cell 9 (Sprint column) must either show speed (зн/мин) or "—", never total attempt time
    const sprintText = await sprintCell.textContent();
    expect(sprintText.includes('зн/мин') || sprintText.trim() === '—').toBe(true);
  });

  test('Logo-Storm column width matches level columns and speed card wraps cleanly across viewports', async ({ page }) => {
    for (const vp of [
      { width: 1366, height: 768, expectedMaxLines: 3 },
      { width: 1920, height: 1080, expectedMaxLines: 2 },
      { width: 2560, height: 1440, expectedMaxLines: 2 },
    ]) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(`${baseUrl}/teacher`);
      await page.selectOption('#filter-date', 'all');
      await page.waitForSelector('#table-body tr.student-row td:nth-child(9) span.bg-cyan-100');

      const metrics = await page.evaluate(() => {
        const ths = Array.from(document.querySelectorAll('#progress-table thead th'));
        const lvl1W = ths[5].getBoundingClientRect().width;
        const lvl2W = ths[6].getBoundingClientRect().width;
        const lvl3W = ths[7].getBoundingClientRect().width;
        const sprintW = ths[8].getBoundingClientRect().width;

        const badge = document.querySelector('#table-body tr.student-row td:nth-child(9) span.bg-cyan-100');
        const cell = badge.closest('td');
        const badgeRect = badge.getBoundingClientRect();
        const cellRect = cell.getBoundingClientRect();
        const leafSpans = Array.from(badge.querySelectorAll('span')).filter(s => s.children.length === 0);
        const tops = leafSpans
          .map(el => el.getBoundingClientRect().top)
          .sort((a, b) => a - b);
        const visualLines = [];
        for (const t of tops) {
          if (visualLines.length === 0 || Math.abs(t - visualLines[visualLines.length - 1]) > 4) {
            visualLines.push(t);
          }
        }

        return {
          lvl1W,
          lvl2W,
          lvl3W,
          sprintW,
          fitsInCell: badgeRect.left >= cellRect.left - 1 && badgeRect.right <= cellRect.right + 1,
          linesCount: visualLines.length,
        };
      });

      expect(metrics.sprintW).toBeLessThanOrEqual(metrics.lvl1W + 1);
      expect(metrics.sprintW).toBeLessThanOrEqual(metrics.lvl2W + 1);
      expect(metrics.sprintW).toBeLessThanOrEqual(metrics.lvl3W + 1);
      expect(Math.abs(metrics.sprintW - metrics.lvl1W)).toBeLessThanOrEqual(2);
      expect(Math.abs(metrics.sprintW - metrics.lvl2W)).toBeLessThanOrEqual(2);
      expect(Math.abs(metrics.sprintW - metrics.lvl3W)).toBeLessThanOrEqual(2);
      expect(metrics.fitsInCell).toBe(true);
      expect(metrics.linesCount).toBeGreaterThanOrEqual(2);
      expect(metrics.linesCount).toBeLessThanOrEqual(vp.expectedMaxLines);
    }
  });
});
