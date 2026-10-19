import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 26: Level 3 Arcade Task Suite', () => {
  const tasksPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/26');
  const level3File = path.join(tasksPath, 'level3.astro');

  test('Level 3 adheres to arcade requirements (Vue 3, dynamic countdown timer, hardcore reset to wave 1)', async () => {
    expect(fs.existsSync(level3File), 'level3.astro must exist').toBe(true);

    const code = fs.readFileSync(level3File, 'utf-8');

    // 1. TaskLayout component usage
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={3}');

    // 2. Strict Zero Multiple Choice: no radio buttons or select dropdowns
    expect(code.includes('type="radio"'), 'Radio buttons are strictly forbidden!').toBe(false);
    expect(code.includes('<select'), 'Select dropdowns with answers are strictly forbidden!').toBe(false);

    // 3. No forbidden style tags (must use utility classes)
    expect(code.includes('<style>'), 'Forbidden <style> tags found! Use utility classes instead.').toBe(false);
    expect(code.includes('<style '), 'Forbidden <style ...> tags found! Use utility classes instead.').toBe(false);

    // 4. Vue 3 integration
    expect(code).toContain('createApp');
    expect(code).toContain('Vue');
    expect(code).toContain('/static/vue.global.js');

    // 5. Local countdown timer and spatial pulse progress
    expect(code).toMatch(/phaseTimeLeft/);
    expect(code).toMatch(/pulseProgress/);
    expect(code).toMatch(/resonancePercent/);

    // 6. Hardcore reset (any error or timeout resets to wave 1 / index 0)
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('currentWave.value = 0');
    expect(code).toContain('triggerHardcoreReset');

    // 7. Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('Урок 26');
  });

  test('Level 3 implements hybrid of unused Archetypes 2, 3, and 8 with 3-node spatial routing and 10 escalating waves', async () => {
    const code = fs.readFileSync(level3File, 'utf-8');

    // 10 escalating waves
    expect(code).toContain('SUBSYSTEMS');
    expect(code).toContain('КОНТУР 1:');
    expect(code).toContain('КОНТУР 10:');

    // 3-node spatial commutation (Shannon channel, Entropy compressor, Wiener feedback loop)
    expect(code).toContain('CHANNEL_SCENARIOS');
    expect(code).toContain('ENTROPY_SCENARIOS');
    expect(code).toContain('CYBER_SCENARIOS');
    expect(code).toContain('gate-node-1');
    expect(code).toContain('gate-node-2');
    expect(code).toContain('gate-node-3');
    expect(code).toContain('btn-boost');
    expect(code).toContain('firePulse');
  });
});
