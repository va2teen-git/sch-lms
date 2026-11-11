import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 29: Level 3 Arcade Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/29/level3.astro');

  test('Level 3 adheres to architectural requirements (Vue 3, TaskLayout 3, Archetype 11, Telemetry)', async () => {
    expect(fs.existsSync(taskPath), 'level3.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={3}>');

    // Vue 3 Integration
    expect(code).toContain('createApp');
    expect(code).toContain('/static/vue.global.js');

    // Archetype 11: ALU Register Conveyor
    expect(code).toContain('Архетип 11: Регистровый конвейер АЛУ');
    expect(code).toContain('CARRY_OUT');
    expect(code).toContain('BORROW_IN');
    expect(code).toContain('NORMAL_PASS');
    expect(code).toContain('phaseTimeLeft');
    expect(code).toContain('triggerHardcoreReset');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 29');

    // Zero multiple choice policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Zero style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 3 contains 10 escalating waves and completes arcade progression', async ({ page }) => {
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/29/level3');

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

      // Determine expected action via dev hook or wave data
      const expectedAction = await page.evaluate(() => {
        return window.__DEV_LEVEL3_STATE__ ? window.__DEV_LEVEL3_STATE__.currentWave().correctAction : null;
      });

      expect(expectedAction).not.toBeNull();

      if (expectedAction === 'carry') {
        await page.keyboard.press('Digit1');
      } else if (expectedAction === 'borrow') {
        await page.keyboard.press('Digit2');
      } else if (expectedAction === 'normal') {
        await page.keyboard.press('Digit3');
      }

      await page.waitForTimeout(300);
    }

    // Victory Screen
    await expect(page.locator('h2', { hasText: 'ХАРДКОР-РЕЖИМ УСПЕШНО ПРЕОДОЛЕН!' })).toBeVisible();
  });
});
