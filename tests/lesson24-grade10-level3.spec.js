import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 24: Level 3 Arcade Task Suite', () => {
  const tasksPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/24');
  const level3File = path.join(tasksPath, 'level3.astro');

  test('Level 3 adheres to arcade requirements (Vue 3, local countdown timer, hardcore reset)', async () => {
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

    // 5. Local countdown timer per wave
    expect(code).toMatch(/phaseTimeLeft/);
    expect(code).toMatch(/timerInterval/);
    expect(code).toMatch(/timeLimit/);

    // 6. Hardcore reset (any error or timeout resets to wave 1)
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('currentWaveIdx = 0');
    expect(code).toContain('triggerHardcoreFailure');

    // 7. Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('Урок 24');
  });

  test('Level 3 implements Archetype 10 Hamming Entropy Decryptor with 8 escalating waves', async () => {
    const code = fs.readFileSync(level3File, 'utf-8');

    // 8 escalating waves
    expect(code).toContain('WAVE_CONFIGS');
    expect(code).toContain('РУБЕЖ 1');
    expect(code).toContain('РУБЕЖ 8');

    // Archetype 10 specifics: Hamming distance, entropy, collisions
    expect(code).toMatch(/Hamming|Хэмминг/i);
    expect(code).toMatch(/Entropy|энтропи/i);
    expect(code).toMatch(/LSB|RSA|подпис/i);

    // Candidate cards and interactive triggers
    expect(code).toContain('candidate-card');
    expect(code).toContain('selectCandidate');
  });
});
