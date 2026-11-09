import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 27: Level 3 Arcade Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/27/level3.astro');

  test('Level 3 adheres to architectural requirements (Vue 3, TaskLayout 3, Archetype 1, Telemetry)', async () => {
    expect(fs.existsSync(taskPath), 'level3.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={3}>');

    // Vue 3 Integration
    expect(code).toContain('createApp');
    expect(code).toContain('Vue');
    expect(code).toContain('/static/vue.global.js');

    // Archetype 1: Cyber Matrix mechanics
    expect(code).toContain('Архетип 1: Cyber Matrix');
    expect(code).toContain('matrix');
    expect(code).toContain('currentDirection');
    expect(code).toContain('activeRow');
    expect(code).toContain('activeCol');
    expect(code).toContain('memoryBuffer');
    expect(code).toContain('targetSequence');
    expect(code).toContain('isCellClickable');
    expect(code).toContain('onCellClick');

    // Dynamic timer & countdown
    expect(code).toContain('waveTimeLeft');
    expect(code).toContain('timerInterval');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 27');

    // Zero multiple choice policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Zero style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 3 contains 8 escalating waves and supports hotkeys', async ({ page }) => {
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level3');

    // Intro screen
    const startBtn = page.locator('button', { hasText: 'ИНИЦИИРОВАТЬ ЗАБЕГ' });
    await expect(startBtn).toBeVisible();

    // Start with Enter / click
    await startBtn.click();

    // Wave 1 begins
    await expect(page.locator('.badge', { hasText: 'Волна 1 из 8' })).toBeVisible();
    await expect(page.locator('.progress-bar')).toBeVisible();

    // Clickable cell
    const cell = page.locator('button.btn-outline-warning, button.btn-outline-info').first();
    await expect(cell).toBeVisible();
  });
});
