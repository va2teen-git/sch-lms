import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Basic Lesson 9: Level 1 Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_базовый/9/level1.astro');

  test('Level 1 adheres to architectural contracts', async () => {
    expect(fs.existsSync(taskPath), 'level1.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}>');

    // Exactly 3 phases
    expect(code).toContain('id="phase-1-container"');
    expect(code).toContain('id="phase-2-container"');
    expect(code).toContain('id="phase-3-container"');

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

    // Direct manipulation mechanics
    // Phase 1: Classification Buckets
    expect(code).toContain('bucket-material');
    expect(code).toContain('bucket-static');
    expect(code).toContain('bucket-dynamic');
    expect(code).toContain('p1-verify-btn');

    // Phase 2: Slot & Snap Pipeline
    expect(code).toContain('p2-tokens-pool');
    expect(code).toContain('slot-target');
    expect(code).toContain('p2-verify-btn');

    // Phase 3: Analytical Dashboard
    expect(code).toContain('toggle-format-btn');
    expect(code).toContain('toggle-axis-btn');
    expect(code).toContain('slider-delta');
    expect(code).toContain('slider-step');
    expect(code).toContain('p3-verify-btn');
    expect(code).toContain('final-screen');
  });

  test('Level 1 full interactive walkthrough in browser', async ({ page }) => {
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level1'));
    await page.waitForLoadState('domcontentloaded');

    // --- Phase 1: Classification into 3 buckets ---
    await expect(page.locator('#phase-1-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    const cards = page.locator('#p1-cards-pool .phase1-card');
    const totalCards = await cards.count();
    expect(totalCards).toBeGreaterThanOrEqual(6);

    for (let i = 0; i < totalCards; i++) {
      const card = page.locator('#p1-cards-pool .phase1-card').first();
      const expectedType = await card.getAttribute('data-expected-type');
      await card.click();
      await page.locator(`#bucket-${expectedType} .bucket-slots`).click();
      await page.waitForTimeout(50);
    }
    await page.locator('#p1-verify-btn').click();

    // --- Phase 2: Slot & Snap 5-stage modeling pipeline ---
    await expect(page.locator('#phase-2-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');

    const steps = ['step1', 'step2', 'step3', 'step4', 'step5'];
    for (const stepName of steps) {
      const token = page.locator(`.p2-token[data-expected-slot="${stepName}"]`).first();
      await expect(token).toBeVisible();
      await token.click();
      await page.locator(`.slot-target[data-slot="${stepName}"]`).click();
      await page.waitForTimeout(50);
    }
    await page.locator('#p2-verify-btn').click();

    // --- Phase 3: Analytical Dashboard & Calibration ---
    await expect(page.locator('#phase-3-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');

    // Cycle format to Line (1 click from pie)
    await page.locator('#toggle-format-btn').click();

    // Cycle axis to Zero-based (1 click from truncated)
    await page.locator('#toggle-axis-btn').click();

    // Adjust delta slider to 4 (tolerance <= 5%) and step slider to 3
    await page.locator('#slider-delta').fill('4');
    await page.locator('#slider-delta').dispatchEvent('input');
    await page.locator('#slider-step').fill('3');
    await page.locator('#slider-step').dispatchEvent('input');

    await page.locator('#p3-verify-btn').click();

    // --- Victory Screen ---
    await expect(page.locator('#final-screen')).toBeVisible();
    await expect(page.locator('h3:has-text("Аналитический комплекс верифицирован")')).toBeVisible();
  });

  test('Level 1 failure scenario, feedback box and procedural retry', async ({ page }) => {
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level1'));
    await page.waitForLoadState('domcontentloaded');

    // Move all cards to bucket-material (guaranteed mistake)
    const cards = page.locator('#p1-cards-pool .phase1-card');
    const total = await cards.count();
    for (let i = 0; i < total; i++) {
      const c = page.locator('#p1-cards-pool .phase1-card').first();
      await c.click();
      await page.locator('#bucket-material .bucket-slots').click();
      await page.waitForTimeout(40);
    }

    // Now button is enabled, click it
    await page.locator('#p1-verify-btn').click();

    // Feedback box appears
    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#feedback-text')).toContainText('Некоторые модели отнесены не в свои сектора');

    // Wait for auto-dismiss / recovery
    await page.waitForTimeout(1600);
    await expect(page.locator('#feedback-box')).toBeHidden();
  });

  test('Level 1 hitbox ergonomics audit (>= 48px)', async ({ page }) => {
    await page.goto(encodeURI('/tasks/11-класс_базовый/9/level1'));
    await page.waitForLoadState('domcontentloaded');

    // Verify button Phase 1
    const btn1Box = await page.locator('#p1-verify-btn').boundingBox();
    expect(btn1Box.height).toBeGreaterThanOrEqual(48);

    // Cards
    const firstCardBox = await page.locator('#p1-cards-pool .phase1-card').first().boundingBox();
    expect(firstCardBox.height).toBeGreaterThanOrEqual(48);

    // Buckets
    const bucketBox = await page.locator('#bucket-material').boundingBox();
    expect(bucketBox.height).toBeGreaterThanOrEqual(48);
  });
});
