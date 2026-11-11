import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Basic Lesson 9: Level 2 Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_базовый/9/level2.astro');

  test('Level 2 adheres to architectural and cognitive complexity requirements', async () => {
    expect(fs.existsSync(taskPath), 'level2.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}>');

    // Exactly 5 phases (Sawtooth 2-1-2)
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="phase4"');
    expect(code).toContain('id="phase5"');

    // Anti-paste protection
    expect(code).toContain('onpaste="return false;"');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 9');

    // Zero-style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Zero Multiple Choice Policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Inputs for all 5 phases
    expect(code).toContain('p1-input-abs');
    expect(code).toContain('p1-input-rel');
    expect(code).toContain('p2-input-steps');
    expect(code).toContain('p2-input-kb');
    expect(code).toContain('p3-input-emin');
    expect(code).toContain('p3-input-emax');
    expect(code).toContain('p4-input-growth');
    expect(code).toContain('p4-input-target');
    expect(code).toContain('p5-input-nom');
    expect(code).toContain('p5-input-peak');
    expect(code).toContain('p5-input-racks');
  });

  test('Level 2 full 5-phase mathematical walkthrough', async ({ page }) => {
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level2'));
    await page.waitForLoadState('domcontentloaded');

    // --- Phase 1: Absolute and Relative Error ---
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 1 из 5');

    const p1Fact = parseInt(await page.locator('#p1-fact-val').innerText(), 10);
    const p1Calc = parseInt(await page.locator('#p1-mod-val').innerText(), 10);
    const p1Abs = Math.abs(p1Calc - p1Fact);
    const p1Rel = Math.round((p1Abs / p1Fact) * 100);

    await page.locator('#p1-input-abs').fill(String(p1Abs));
    await page.locator('#p1-input-rel').fill(String(p1Rel));
    await page.locator('#p1-submit-btn').click();

    // --- Phase 2: Iterations and KB Calculation ---
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 2 из 5');

    const p2Hours = parseInt(await page.locator('#p2-hours-val').innerText(), 10);
    const p2Step = parseInt(await page.locator('#p2-dt-val').innerText(), 10);
    const p2Bytes = parseInt(await page.locator('#p2-record-val').innerText(), 10);

    const p2TotalSec = p2Hours * 3600;
    const p2Steps = Math.round(p2TotalSec / p2Step);
    const p2Kb = Math.round((p2Steps * p2Bytes) / 1024);

    await page.locator('#p2-input-steps').fill(String(p2Steps));
    await page.locator('#p2-input-kb').fill(String(p2Kb));
    await page.locator('#p2-submit-btn').click();

    // --- Phase 3: Tolerance Interval (In Silico) ---
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 3 из 5');

    const p3Base = parseInt(await page.locator('#p3-efact-val').innerText(), 10);
    const p3Tol = parseInt(await page.locator('#p3-delta-val').innerText(), 10);

    const p3Delta = Math.round(p3Base * (p3Tol / 100));
    const p3Emin = p3Base - p3Delta;
    const p3Emax = p3Base + p3Delta;

    await page.locator('#p3-input-delta').fill(String(p3Delta));
    await page.locator('#p3-input-emin').fill(String(p3Emin));
    await page.locator('#p3-input-emax').fill(String(p3Emax));
    await page.locator('#p3-submit-btn').click();

    // --- Phase 4: Linear Interpolation ---
    await expect(page.locator('#phase4')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 4 из 5');

    const p4Year1 = parseInt(await page.locator('#p4-y1-label').innerText(), 10);
    const p4Vol1 = parseInt(await page.locator('#p4-v1-val').innerText(), 10);
    const p4Year2 = parseInt(await page.locator('#p4-y2-label').innerText(), 10);
    const p4Vol2 = parseInt(await page.locator('#p4-v2-val').innerText(), 10);
    const p4YearTarget = parseInt(await page.locator('#p4-ytarget-val').innerText(), 10);

    const p4Growth = Math.round((p4Vol2 - p4Vol1) / (p4Year2 - p4Year1));
    const p4Target = p4Vol1 + p4Growth * (p4YearTarget - p4Year1);

    await page.locator('#p4-input-growth').fill(String(p4Growth));
    await page.locator('#p4-input-target').fill(String(p4Target));
    await page.locator('#p4-submit-btn').click();

    // --- Phase 5: Extrapolation and Server Racks ---
    await expect(page.locator('#phase5')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 5 из 5');

    const p5Base = parseInt(await page.locator('#p5-v0-val').innerText(), 10);
    const p5Growth = parseInt(await page.locator('#p5-annual-val').innerText(), 10);
    const p5Years = parseInt(await page.locator('#p5-years-val').innerText(), 10);
    const p5Margin = parseInt(await page.locator('#p5-margin-val').innerText(), 10);
    const p5Cap = parseInt(await page.locator('#p5-rack-val').innerText(), 10);

    const p5Nom = p5Base + p5Growth * p5Years;
    const p5Peak = Math.round(p5Nom * (1 + p5Margin / 100));
    const p5Racks = Math.ceil(p5Peak / p5Cap);

    await page.locator('#p5-input-nom').fill(String(p5Nom));
    await page.locator('#p5-input-peak').fill(String(p5Peak));
    await page.locator('#p5-input-racks').fill(String(p5Racks));
    await page.locator('#p5-submit-btn').click();

    // --- Victory Screen ---
    await expect(page.locator('#final-screen')).toBeVisible();
    await expect(page.locator('h3:has-text("Аналитический расчет моделирования завершен")')).toBeVisible();
  });

  test('Level 2 anti-paste and input hygiene audit', async ({ page }) => {
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level2'));
    await page.waitForLoadState('domcontentloaded');

    const input = page.locator('#p1-input-abs');
    await expect(input).toBeVisible();

    // Check onpaste attribute exists
    const onpasteAttr = await input.getAttribute('onpaste');
    expect(onpasteAttr).toContain('return false');
  });

  test('Level 2 failure handling and attempt increment', async ({ page }) => {
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level2'));
    await page.waitForLoadState('domcontentloaded');

    // Input wrong value
    await page.locator('#p1-input-abs').fill('9999');
    await page.locator('#p1-input-rel').fill('9999');
    await page.locator('#p1-submit-btn').click();

    // Verify error feedback appears
    await expect(page.locator('#error-feedback')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    // Wait for recovery
    await page.waitForTimeout(1600);
    await expect(page.locator('#error-feedback')).toBeHidden();
  });
});
