import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 27: Level 2 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/27/level2.astro');

  test('Level 2 adheres to architectural and cognitive complexity requirements', async () => {
    expect(fs.existsSync(taskPath), 'level2.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}>');

    // 5 phases (Sawtooth 2-1-2)
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="phase4"');
    expect(code).toContain('id="phase5"');

    // Keyboard manual inputs
    expect(code).toContain('inputmode="decimal"');
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 27');
  });

  test('Level 2 full 5-phase algorithmic walkthrough', async ({ page }) => {
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level2');

    // --- Phase 1: Direct count calculation ---
    await expect(page.locator('#phase1')).toBeVisible();
    const p1P = parseInt((await page.locator('#p1-p-val').innerText()).replace(/\D+/g, ''), 10);
    const p1N = parseInt(await page.locator('#p1-n-val').innerText(), 10);
    const p1Ans = Math.floor((p1N - p1P * p1P) / p1P) + 1;

    await page.locator('#p1-input').fill(String(p1Ans));
    await page.locator('#p1-submit-btn').click();

    // --- Phase 2: First-time multiples ---
    await expect(page.locator('#phase2')).toBeVisible();
    const p2P = parseInt((await page.locator('#p2-p-val').innerText()).replace(/\D+/g, ''), 10);
    const p2N = parseInt(await page.locator('#p2-n-val').innerText(), 10);
    let p2Count = 0;
    for (let k = p2P * p2P; k <= p2N; k += p2P) {
      if (k % 2 !== 0 && k % 3 !== 0) p2Count++;
    }

    await page.locator('#p2-input').fill(String(p2Count));
    await page.locator('#p2-submit-btn').click();

    // --- Phase 3: Reverse problem ---
    await expect(page.locator('#phase3')).toBeVisible();
    const p3P = parseInt((await page.locator('#p3-p-val').innerText()).replace(/\D+/g, ''), 10);
    const nextPrimesMap = { 5: 7, 7: 11, 11: 13, 13: 17 };
    const nextP = nextPrimesMap[p3P] || 11;
    const p3Ans = nextP * nextP - 1;

    await page.locator('#p3-input').fill(String(p3Ans));
    await page.locator('#p3-submit-btn').click();

    // --- Phase 4: Memory footprint ---
    await expect(page.locator('#phase4')).toBeVisible();
    const p4N = parseInt(await page.locator('#p4-n-val').innerText(), 10);
    const p4Ans = Math.ceil((p4N + 1) / 8);

    await page.locator('#p4-input').fill(String(p4Ans));
    await page.locator('#p4-submit-btn').click();

    // --- Phase 5: Segmented Sieve synthesis ---
    await expect(page.locator('#phase5')).toBeVisible();
    const p5L = parseInt(await page.locator('#p5-l-val').innerText(), 10);
    const p5R = parseInt(await page.locator('#p5-r-val').innerText(), 10);
    const p5P = parseInt((await page.locator('#p5-p-val').innerText()).replace(/\D+/g, ''), 10);

    const p5Start = Math.max(p5P * p5P, Math.ceil(p5L / p5P) * p5P);
    let p5Count = 0;
    for (let k = p5Start; k <= p5R; k += p5P) p5Count++;

    const p5Ans = `${p5Start}:${p5Count}`;
    await page.locator('#p5-input').fill(p5Ans);
    await page.locator('#p5-submit-btn').click();

    // Victory screen
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('h3', { hasText: 'УРОВЕНЬ 2 УСПЕШНО ПРОЙДЕН!' })).toBeVisible();
  });
});
