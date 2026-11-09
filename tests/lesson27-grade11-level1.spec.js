import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 27: Level 1 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/27/level1.astro');

  test('Level 1 adheres to architectural requirements', async () => {
    expect(fs.existsSync(taskPath), 'level1.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}>');

    // 3 phases
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('Урок 27');

    // Zero-style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Zero Multiple Choice Policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Mouse manipulation mechanics
    // Phase 1: Interactive Number Grid Toggle
    expect(code).toContain('p1-grid');
    expect(code).toContain('p1-submit-btn');

    // Phase 2: Slot & Snap Algorithm Pipeline
    expect(code).toContain('slot-0');
    expect(code).toContain('p2-tokens-palette');

    // Phase 3: Bucket Classification
    expect(code).toContain('bucket-2');
    expect(code).toContain('bucket-3');
    expect(code).toContain('bucket-prime');
  });

  test('Level 1 full interactive walkthrough in browser', async ({ page }) => {
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level1');

    // Phase 1: solve
    const pText = await page.locator('#p1-prime-val').innerText();
    const p = parseInt(pText.replace(/\D+/g, ''), 10);
    const maxNum = parseInt(await page.locator('#p1-max-val').innerText(), 10);

    for (let k = p * p; k <= maxNum; k += p) {
      const btn = page.locator(`.grid-num-btn[data-num="${k}"]`);
      if (await btn.isVisible()) {
        await btn.click();
      }
    }
    await page.locator('#p1-submit-btn').click();

    // Reached Phase 2
    await expect(page.locator('#phase2')).toBeVisible();

    // Fill all 4 slots using exact token IDs
    const slotTokenIds = ['t_init', 't_outer', 't_inner', 't_comp'];
    for (let slot = 0; slot < 4; slot++) {
      const tokenBtn = page.locator(`.token-btn[data-token-id="${slotTokenIds[slot]}"]`);
      await tokenBtn.click();
      await page.locator(`#slot-${slot}`).click();
    }
    await page.locator('#p2-submit-btn').click();

    // Reached Phase 3
    await expect(page.locator('#phase3')).toBeVisible();

    // Classify all cards in Phase 3
    const poolCards = page.locator('#p3-pool .p3-card');
    while (await poolCards.count() > 0) {
      const card = poolCards.first();
      const expectedBucket = await card.getAttribute('data-expected-bucket');
      await card.click();

      if (expectedBucket === 'p2') {
        await page.locator('#bucket-2').click();
      } else if (expectedBucket === 'p3') {
        await page.locator('#bucket-3').click();
      } else {
        await page.locator('#bucket-prime').click();
      }
    }
    await page.locator('#p3-submit-btn').click();

    // Victory screen
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('h3', { hasText: 'УРОВЕНЬ 1 УСПЕШНО ПРОЙДЕН!' })).toBeVisible();
  });
});
