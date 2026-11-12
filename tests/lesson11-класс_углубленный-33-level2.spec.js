import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 33: Level 2 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/33/level2.astro');

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
    expect(code).toContain('inputmode="numeric"');
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Anti-paste protection
    expect(code).toContain('onpaste="return false;"');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 33');

    // Zero style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 2 full 5-phase algorithmic walkthrough with telemetry verification', async ({ page }) => {
    // Collect telemetry messages
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryEvent', (event) => {
      telemetryEvents.push(event);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryEvent(e.data);
        }
      });
    });

    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33/level2');

    // --- Phase 1: Zipf's Law direct calculation ---
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');

    const p1Ans = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.getP1Expected());
    await page.locator('#p1-input').fill(String(p1Ans));
    await page.locator('#p1-submit-btn').click();

    // --- Phase 2: TF-IDF calculation ---
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');

    const p2Ans = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.getP2Expected());
    await page.locator('#p2-input').fill(String(p2Ans));
    await page.locator('#p2-input').press('Enter');

    // --- Phase 3: Corpus volume inversion (Peak 1) ---
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 5');

    const p3Ans = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.getP3Expected());
    await page.locator('#p3-input').fill(String(p3Ans));
    await page.locator('#p3-submit-btn').click();

    // --- Phase 4: Token match count re.findall (Valley) ---
    await expect(page.locator('#phase4')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 4 из 5');

    const p4Ans = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.getP4Expected());
    await page.locator('#p4-input').fill(String(p4Ans));
    await page.locator('#p4-input').press('Enter');

    // --- Phase 5: ReDoS combinatorics 2^N (Culmination Peak) ---
    await expect(page.locator('#phase5')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 5 из 5');

    const p5Ans = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.getP5Expected());
    await page.locator('#p5-input').fill(String(p5Ans));
    await page.locator('#p5-submit-btn').click();

    // --- Victory Screen ---
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-attempts')).toHaveText('0');

    // Verify telemetry event
    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvent, 'level_complete telemetry event must be emitted').toBeDefined();
    expect(completeEvent.success).toBe(true);
    expect(completeEvent.status).toBe('completed');
  });

  test('Level 2 handles incorrect answers and resets with error banner', async ({ page }) => {
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33/level2');

    await expect(page.locator('#phase1')).toBeVisible();

    // Enter wrong answer
    await page.locator('#p1-input').fill('999999');
    await page.locator('#p1-submit-btn').click();

    // Verify error banner and incremented attempt count
    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    // Wait for auto-hide timeout
    await page.waitForTimeout(1700);
    await expect(page.locator('#feedback-box')).toBeHidden();

    // UI remains operational
    await expect(page.locator('#p1-input')).toBeVisible();
  });
});
