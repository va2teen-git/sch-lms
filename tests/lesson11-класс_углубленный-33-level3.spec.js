import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 33: Level 3 Arcade Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/33/level3.astro');

  test('Level 3 adheres to architectural requirements (Vue 3, TaskLayout 3, Archetype 9, Telemetry)', async () => {
    expect(fs.existsSync(taskPath), 'level3.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={3}>');

    // Vue 3 Integration
    expect(code).toContain('createApp');
    expect(code).toContain('/static/vue.global.js');

    // Arcade Archetype 9 Action Gates
    expect(code).toContain('PASS_VALID');
    expect(code).toContain('SPAM_FILTER');
    expect(code).toContain('BLOCK_EXPLOIT');
    expect(code).toContain('REDOS_DEFENSE');
    expect(code).toContain('triggerHardcoreWipe');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 33');

    // Zero multiple choice policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Zero style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 3 contains 10 escalating waves and completes arcade progression with telemetry verification', async ({ page }) => {
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

    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33/level3');

    // Intro screen
    const startBtn = page.locator('#start-btn');
    await expect(startBtn).toBeVisible();

    // Start run
    await startBtn.click();

    // Verify Wave 1 starts
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    // Solve all 10 waves via action gates
    for (let wave = 1; wave <= 10; wave++) {
      await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${wave} ИЗ 10`);

      const expectedAction = await page.evaluate(() => {
        return window.__DEV_LEVEL3_STATE__ ? window.__DEV_LEVEL3_STATE__.currentWave().correctAction : null;
      });

      expect(expectedAction).not.toBeNull();

      if (expectedAction === 'pass') {
        await page.keyboard.press('Digit1');
      } else if (expectedAction === 'spam_filter') {
        await page.keyboard.press('Digit2');
      } else if (expectedAction === 'block_exploit') {
        await page.keyboard.press('Digit3');
      } else if (expectedAction === 'redos_defense') {
        await page.keyboard.press('Digit4');
      }

      await page.waitForTimeout(250);
    }

    // Victory Screen
    await expect(page.locator('h2', { hasText: 'ХАРДКОР-РЕЖИМ УСПЕШНО ПРЕОДОЛЕН!' })).toBeVisible();

    // Verify telemetry event
    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvent, 'level_complete telemetry event must be emitted').toBeDefined();
    expect(completeEvent.success).toBe(true);
    expect(completeEvent.status).toBe('completed');
  });

  test('Level 3 triggers hardcore wipe, alarm banner, and resets to Wave 1 on mistake', async ({ page }) => {
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

    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33/level3');

    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    const expectedAction = await page.evaluate(() => {
      return window.__DEV_LEVEL3_STATE__ ? window.__DEV_LEVEL3_STATE__.currentWave().correctAction : null;
    });

    // Deliberately trigger wrong action
    const wrongAction = expectedAction === 'pass' ? 'block_exploit' : 'pass';
    if (wrongAction === 'pass') {
      await page.keyboard.press('Digit1');
    } else {
      await page.keyboard.press('Digit3');
    }

    // Alarm banner appears
    await expect(page.locator('#alarm-box')).toBeVisible();
    await expect(page.locator('#alarm-box')).toContainText('КРИТИЧЕСКИЙ СБОЙ ФИЛЬТРАЦИИ!');

    // Telemetry event hardcore_reset
    const resetEvent = telemetryEvents.find(e => e.action_type === 'hardcore_reset');
    expect(resetEvent, 'hardcore_reset telemetry event must be emitted').toBeDefined();

    // After reset delay (1.8s + buffer), alarm hides and wave is 1
    await page.waitForTimeout(2100);
    await expect(page.locator('#alarm-box')).not.toBeVisible();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');
  });
});
