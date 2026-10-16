import { test, expect } from '@playwright/test';

test.describe('Grade 9 Lesson 7 Layout & Responsiveness Verification Suite', () => {
  const lessonUrl = '/lesson/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7';
  const level1Url = '/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level1';
  const level2Url = '/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level2';
  const level3Url = '/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level3';

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Али');
      localStorage.setItem('student_lastName', 'Аль-Багдади');
      localStorage.setItem('student_class', '9-класс');
    });
  });

  const viewports = [
    { name: 'FullHD Desktop', width: 1920, height: 1080 },
    { name: 'Laptop', width: 1366, height: 768 },
    { name: 'Small Laptop / Tablet Landscape', width: 1024, height: 768 },
    { name: 'Tablet Portrait', width: 768, height: 1024 },
  ];

  for (const vp of viewports) {
    test(`Lesson 7 page layout adapts without horizontal overflow on ${vp.name} (${vp.width}x${vp.height})`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(lessonUrl);
      await page.waitForLoadState('domcontentloaded');

      // Verify no page horizontal overflow
      const hasHorizontalScroll = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalScroll, `Horizontal scroll detected on ${vp.name}!`).toBe(false);

      // Verify interactive tasks section exists and is visible
      const iframe1 = page.locator('#iframe-1');
      await expect(iframe1).toBeVisible();

      // Verify tabs exist and are visible
      const tabs = page.locator('.tab-btn');
      await expect(tabs).toHaveCount(3);
      await expect(tabs.first()).toBeVisible();

      // Verify iframe container adapts to available width
      const iframeBox = await iframe1.boundingBox();
      expect(iframeBox.width).toBeGreaterThan(300);
      expect(iframeBox.width).toBeLessThanOrEqual(vp.width);
    });
  }

  // Task-level viewport tests (simulating iframe widths inside split-view and standalone)
  // Inside split-view at 1366px laptop, the iframe width is ~650px. At 1920px, ~920px. On mobile/tablet, 350-700px.
  const taskViewports = [
    { name: 'Iframe in 1920px split-screen', width: 950, height: 800 },
    { name: 'Iframe in 1366px split-screen', width: 660, height: 700 },
    { name: 'Iframe in 1024px split-screen', width: 500, height: 700 },
    { name: 'Iframe mobile / narrow column', width: 380, height: 650 },
  ];

  for (const tvp of taskViewports) {
    test(`Level 3 (Cyber Matrix) fits without horizontal overflow at width ${tvp.width}px (${tvp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: tvp.width, height: tvp.height });
      await page.goto(level3Url);
      await page.waitForLoadState('domcontentloaded');

      // Click start button to enter the matrix game
      const startBtn = page.locator('#start-btn');
      if (await startBtn.isVisible()) {
        await startBtn.click();
      }

      // Wait for matrix grid to render
      await page.waitForSelector('#matrix-grid');

      // 1. Verify document-level no horizontal overflow
      const pageOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(pageOverflow, `Level 3 has horizontal scroll at width ${tvp.width}px`).toBe(false);

      // 2. Verify matrix container bounds
      const matrixOverflow = await page.evaluate(() => {
        const matrix = document.getElementById('matrix-grid');
        if (!matrix) return { found: false };
        const rect = matrix.getBoundingClientRect();
        const parentRect = matrix.parentElement.getBoundingClientRect();
        return {
          found: true,
          matrixWidth: rect.width,
          parentWidth: parentRect.width,
          overflowsParent: rect.width > parentRect.width + 2, // 2px margin of error
          scrollWidth: matrix.scrollWidth,
          clientWidth: matrix.clientWidth,
          matrixRight: rect.right,
          windowWidth: window.innerWidth
        };
      });

      expect(matrixOverflow.found).toBe(true);
      expect(matrixOverflow.overflowsParent, `Matrix grid width (${matrixOverflow.matrixWidth}px) exceeds parent width (${matrixOverflow.parentWidth}px)`).toBe(false);
      expect(matrixOverflow.matrixRight, `Matrix right edge exceeds window width`).toBeLessThanOrEqual(tvp.width + 5);

      // 3. Verify matrix cells do not overflow their rows
      const rowOverflow = await page.evaluate(() => {
        const rows = document.querySelectorAll('#matrix-grid .d-flex');
        let anyOverflow = false;
        let details = [];
        rows.forEach((row, idx) => {
          if (row.scrollWidth > row.clientWidth + 2) {
            anyOverflow = true;
            details.push({ row: idx, scrollWidth: row.scrollWidth, clientWidth: row.clientWidth });
          }
        });
        return { anyOverflow, details };
      });
      expect(rowOverflow.anyOverflow, `Row cells overflowed: ${JSON.stringify(rowOverflow.details)}`).toBe(false);

      // 4. Verify buffer slots do not overflow
      const bufferOverflow = await page.evaluate(() => {
        const buffer = document.querySelector('.card-body:has(#matrix-grid)');
        if (!buffer) return false;
        return buffer.scrollWidth > buffer.clientWidth + 2;
      });
      expect(bufferOverflow, 'Card body containing matrix/buffer has horizontal overflow').toBe(false);
    });

    test(`Level 1 (Classification Buckets) fits without horizontal overflow at width ${tvp.width}px (${tvp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: tvp.width, height: tvp.height });
      await page.goto(level1Url);
      await page.waitForLoadState('domcontentloaded');

      const pageOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(pageOverflow, `Level 1 has horizontal scroll at width ${tvp.width}px`).toBe(false);

      // Verify buckets exist and fit inside container
      const bucketsRow = page.locator('#buckets-row');
      await expect(bucketsRow).toBeVisible();

      const bucketsFit = await page.evaluate(() => {
        const row = document.getElementById('buckets-row');
        return row.scrollWidth <= row.clientWidth + 2;
      });
      expect(bucketsFit, 'Buckets row has horizontal overflow').toBe(true);
    });

    test(`Level 2 (Terminal Investigation) fits without horizontal overflow at width ${tvp.width}px (${tvp.name})`, async ({ page }) => {
      await page.setViewportSize({ width: tvp.width, height: tvp.height });
      await page.goto(level2Url);
      await page.waitForLoadState('domcontentloaded');

      const pageOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(pageOverflow, `Level 2 has horizontal scroll at width ${tvp.width}px`).toBe(false);

      // Verify active phase form inputs fit within container
      const phase1 = page.locator('#phase1');
      await expect(phase1).toBeVisible();

      const phaseFit = await page.evaluate(() => {
        const p1 = document.getElementById('phase1');
        return p1.scrollWidth <= p1.clientWidth + 2;
      });
      expect(phaseFit, 'Phase 1 has horizontal overflow').toBe(true);
    });
  }
});
