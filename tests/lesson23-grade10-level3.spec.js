import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 23: Level 3 Arcade Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/23/level3.astro');

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
    expect(code).toContain('Урок 23');

    // No forbidden style tags
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 3 implements Archetype 1 Cyber Matrix / Protocol Breach mechanics with 8 waves', async () => {
    const code = fs.readFileSync(taskPath, 'utf-8');

    // Cyber Matrix mechanics
    expect(code).toContain('activeDirection');
    expect(code).toContain('activeLineIndex');
    expect(code).toContain('isCellSelectable');
    expect(code).toContain('selectCell');
    expect(code).toContain('targetSequence');
    expect(code).toContain('playerBuffer');
    expect(code).toContain('checkTargetAchieved');

    // Exactly 8 escalating waves
    expect(code).toContain('WAVE_CONFIGS');
    expect(code).toContain('totalPhases: 8');
    expect(code).toContain('ВОЛНА 8: ФИНАЛЬНЫЙ БОСС');
  });
});
