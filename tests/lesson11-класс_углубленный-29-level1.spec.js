import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 29: Level 1 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/29/level1.astro');

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
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 29');

    // Zero-style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Zero Multiple Choice Policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Direct manipulation mechanics
    // Phase 1: Slot & Snap Little-Endian Token Puzzle
    expect(code).toContain('p1-tokens-palette');
    expect(code).toContain('p1-slot-0');
    expect(code).toContain('p1-slot-1');
    expect(code).toContain('p1-slot-2');
    expect(code).toContain('p1-submit-btn');

    // Phase 2: Additive carry pipeline
    expect(code).toContain('p2-tokens-palette');
    expect(code).toContain('p2-slot-carry1');
    expect(code).toContain('p2-slot-carry2');
    expect(code).toContain('p2-slot-res0');
    expect(code).toContain('p2-slot-res1');
    expect(code).toContain('p2-slot-res2');
    expect(code).toContain('p2-submit-btn');

    // Phase 3: Complexity Bin Classification
    expect(code).toContain('p3-pool');
    expect(code).toContain('bucket-card');
    expect(code).toContain('data-bucket="linear"');
    expect(code).toContain('data-bucket="poly"');
    expect(code).toContain('data-bucket="log"');
    expect(code).toContain('p3-submit-btn');
  });

  test('Level 1 full interactive walkthrough in browser', async ({ page }) => {
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/29/level1');

    // --- Phase 1: Little-Endian block slotting ---
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    const numStr = await page.locator('#p1-target-number').innerText();
    const block0 = numStr.slice(-4);
    const block1 = numStr.slice(-8, -4);
    const block2 = numStr.slice(0, -8);
    const expectedBlocks = [block0, block1, block2];

    for (let slot = 0; slot < 3; slot++) {
      const token = page.locator(`.p1-token-btn[data-val="${expectedBlocks[slot]}"]`).first();
      await expect(token).toBeVisible();
      await token.click();
      await page.locator(`#p1-slot-${slot}`).click();
    }
    await page.locator('#p1-submit-btn').click();

    // --- Phase 2: Additive Carry Pipeline ---
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');

    const a0 = parseInt(await page.locator('#p2-val-a0').innerText(), 10);
    const b0 = parseInt((await page.locator('#p2-val-b0').innerText()).replace(/\D+/g, ''), 10);
    const a1 = parseInt(await page.locator('#p2-val-a1').innerText(), 10);
    const b1 = parseInt((await page.locator('#p2-val-b1').innerText()).replace(/\D+/g, ''), 10);

    const sum0 = a0 + b0;
    const res0 = String(sum0 % 1000);
    const carry1 = String(Math.floor(sum0 / 1000));
    const sum1 = a1 + b1 + parseInt(carry1, 10);
    const res1 = String(sum1 % 1000);
    const carry2 = String(Math.floor(sum1 / 1000));
    const res2 = String(carry2);

    const p2Assignments = [
      { slotId: 'carry1', val: carry1 },
      { slotId: 'carry2', val: carry2 },
      { slotId: 'res0', val: res0 },
      { slotId: 'res1', val: res1 },
      { slotId: 'res2', val: res2 }
    ];

    for (const item of p2Assignments) {
      const token = page.locator(`#p2-tokens-palette .p2-token-btn[data-val="${item.val}"]:not(.d-none)`).first();
      await expect(token).toBeVisible();
      await token.click();
      await page.locator(`#p2-slot-${item.slotId}`).click();
    }
    await page.locator('#p2-submit-btn').click();

    // --- Phase 3: Algorithm Complexity Buckets ---
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');

    const poolCards = page.locator('#p3-pool .p3-card');
    while (await poolCards.count() > 0) {
      const card = poolCards.first();
      const expectedBucket = await card.getAttribute('data-expected-bucket');
      await card.click();
      await page.locator(`#bucket-${expectedBucket}`).click({ position: { x: 20, y: 20 } });
      await page.waitForTimeout(50);
    }
    await page.locator('#p3-submit-btn').click();

    // --- Victory Screen ---
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('h3', { hasText: 'УРОВЕНЬ 1 УСПЕШНО ПРОЙДЕН!' })).toBeVisible();
  });
});
