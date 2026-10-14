import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 24: Level 2 Task Suite', () => {
  const tasksPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/24');
  const level2File = path.join(tasksPath, 'level2.astro');

  test('Level 2 adheres to architectural requirements (5 procedural phases, manual text/number input)', async () => {
    expect(fs.existsSync(level2File), 'level2.astro must exist').toBe(true);

    const code = fs.readFileSync(level2File, 'utf-8');

    // 1. TaskLayout component usage
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}');

    // 2. Strict Zero Multiple Choice Policy: no radio buttons or select dropdowns
    expect(code.includes('type="radio"'), 'Radio buttons are strictly forbidden (Zero Multiple Choice)!').toBe(false);
    expect(code.includes('<select'), 'Select dropdowns with answers are strictly forbidden!').toBe(false);

    // 3. No forbidden style tags (must use utility classes)
    expect(code.includes('<style>'), 'Forbidden <style> tags found! Use utility classes instead.').toBe(false);
    expect(code.includes('<style '), 'Forbidden <style ...> tags found! Use utility classes instead.').toBe(false);

    // 4. Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 24');

    // 5. Must contain exactly 5 procedural phases with unique IDs
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="phase4"');
    expect(code).toContain('id="phase5"');
    expect(code).toContain('id="success-screen"');
  });

  test('Level 2 contains procedural generators, state verification and telemetry handling', async () => {
    const code = fs.readFileSync(level2File, 'utf-8');

    // Phase 1: n and phi(n) calculation
    expect(code).toContain('id="p1-input-n"');
    expect(code).toContain('id="p1-input-phi"');
    expect(code).toContain('id="p1-btn"');

    // Phase 2: secret exponent d
    expect(code).toContain('id="p2-input"');
    expect(code).toContain('id="p2-btn"');
    expect(code).toContain('modInverse');

    // Phase 3: ciphertext C = M^e mod n
    expect(code).toContain('id="p3-input"');
    expect(code).toContain('id="p3-btn"');
    expect(code).toContain('modPow');

    // Phase 4: LSB capacity calculation in bytes
    expect(code).toContain('id="p4-input"');
    expect(code).toContain('id="p4-btn"');
    expect(code).toContain('P4_RESOLUTIONS');

    // Phase 5: LSB bit injection (C & 254) | b
    expect(code).toContain('id="p5-input"');
    expect(code).toContain('id="p5-btn"');

    // Error handling & hardcore reset
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('triggerError');
  });
});
