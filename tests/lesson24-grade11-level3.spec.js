import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 24: Level 3 Arcade Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/24/level3.astro');

  test('Level 3 adheres to arcade requirements (Vue 3, local countdown timer, hardcore reset)', async () => {
    expect(fs.existsSync(taskPath)).toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={3}>');

    // Uses Vue 3
    expect(code).toContain('createApp');
    expect(code).toContain('Vue');

    // Local countdown timer per wave
    expect(code).toMatch(/phaseTimeLeft|timerInterval/);

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 24');

    // Zero-style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 3 implements Archetype 9 Firewall Interceptor with 8 escalating waves', async () => {
    const code = fs.readFileSync(taskPath, 'utf-8');

    // Archetype 9 Firewall Interceptor mechanics
    expect(code).toContain('WAVE_CONFIGS');
    expect(code).toContain('totalPhases: 8');
    expect(code).toContain('ВОЛНА 8: ФИНАЛЬНЫЙ БОСС');
    expect(code).toContain('handleDefenseAction');
    expect(code).toContain('triggerHardcoreFailure');
    expect(code).toContain('handleTimeout');
    expect(code).toContain('btn-allow');
    expect(code).toContain('btn-sandbox');
    expect(code).toContain('btn-block');

    // Actions & hotkeys support
    expect(code).toContain('ALLOW');
    expect(code).toContain('SANDBOX');
    expect(code).toContain('BLOCK');
  });
});
