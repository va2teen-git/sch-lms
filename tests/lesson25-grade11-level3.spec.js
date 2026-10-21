import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 25: Level 3 Arcade Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/25/level3.astro');

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
    expect(code).toContain('АРХЕТИП 1');
    expect(code).toContain('CYBER MATRIX');
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
    expect(code).toContain('timeLeftFormatted');
    expect(code).toMatch(/timerInterval|setInterval/);

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 25');

    // Zero multiple choice policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Zero style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 3 contains 8 escalating waves, procedural matrix generation and hardcore reset', async () => {
    const code = fs.readFileSync(taskPath, 'utf-8');

    // 8 escalating waves
    expect(code).toContain('Волна 1:');
    expect(code).toContain('Волна 2:');
    expect(code).toContain('Волна 3:');
    expect(code).toContain('Волна 4:');
    expect(code).toContain('Волна 5:');
    expect(code).toContain('Волна 6:');
    expect(code).toContain('Волна 7:');
    expect(code).toContain('Волна 8:');

    // Procedural generation and hardcore reset
    expect(code).toContain('generateMatrix');
    expect(code).toContain('triggerHardcoreReset');
    expect(code).toContain('onWaveSuccess');
    expect(code).toContain('forceCompleteWave');
    expect(code).toContain('handleKeyDown');
  });
});
