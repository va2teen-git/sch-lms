import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 29: Level 2 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/29/level2.astro');

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

    // Anti-paste protection
    expect(code).toContain('onpaste="return false;"');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 29');

    // Zero style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 2 full 5-phase algorithmic walkthrough', async ({ page }) => {
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/29/level2');

    // --- Phase 1: Direct block capacity ---
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');

    const digits = parseInt(await page.locator('#p1-digits-val').innerText(), 10);
    const k = parseInt(await page.locator('#p1-k-val').innerText(), 10);
    const p1Ans = Math.ceil(digits / k);

    await page.locator('#p1-input').fill(String(p1Ans));
    await page.locator('#p1-submit-btn').click();

    // --- Phase 2: Elementary multiplications ---
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');

    const lenA = parseInt(await page.locator('#p2-len-a').innerText(), 10);
    const lenB = parseInt(await page.locator('#p2-len-b').innerText(), 10);
    const blocksA = Math.ceil(lenA / 4);
    const blocksB = Math.ceil(lenB / 4);
    const p2Ans = blocksA * blocksB;

    await page.locator('#p2-input').fill(String(p2Ans));
    await page.locator('#p2-submit-btn').click();

    // --- Phase 3: Borrow inversion ---
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 5');

    const a0 = parseInt(await page.locator('#p3-val-a0').innerText(), 10);
    const c0 = parseInt(await page.locator('#p3-val-c0').innerText(), 10);
    const p3Ans = a0 + 1000 - c0;

    await page.locator('#p3-input').fill(String(p3Ans));
    await page.locator('#p3-submit-btn').click();

    // --- Phase 4: Binary exponentiation step count ---
    await expect(page.locator('#phase4')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 4 из 5');

    const bitsLen = parseInt(await page.locator('#p4-bits-len').innerText(), 10);
    const onesCnt = parseInt(await page.locator('#p4-ones-cnt').innerText(), 10);
    const p4Ans = (bitsLen - 1) + (onesCnt - 1);

    await page.locator('#p4-input').fill(String(p4Ans));
    await page.locator('#p4-submit-btn').click();

    // --- Phase 5: Karatsuba cross product ---
    await expect(page.locator('#phase5')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 5 из 5');

    const p1Val = parseInt(await page.locator('#p5-val-p1').innerText(), 10);
    const p2Val = parseInt(await page.locator('#p5-val-p2').innerText(), 10);
    const p3Val = parseInt(await page.locator('#p5-val-p3').innerText(), 10);
    const p5Ans = p3Val - p1Val - p2Val;

    await page.locator('#p5-input').fill(String(p5Ans));
    await page.locator('#p5-submit-btn').click();

    // --- Victory Screen ---
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('h3', { hasText: 'УРОВЕНЬ 2 УСПЕШНО ПРОЙДЕН!' })).toBeVisible();
  });
});
