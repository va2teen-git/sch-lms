import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 27: Level 2 Task Suite', () => {
  const tasksPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/27');
  const level2File = path.join(tasksPath, 'level2.astro');

  test('Level 2 adheres to architectural and game design requirements', async () => {
    expect(fs.existsSync(level2File), 'level2.astro must exist').toBe(true);

    const code = fs.readFileSync(level2File, 'utf-8');

    // 1. TaskLayout component usage with level 2
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}');

    // 2. Strict Zero Multiple Choice Policy: strictly manual keyboard inputs, no radio/select
    expect(code.includes('type="radio"'), 'Radio buttons are strictly forbidden!').toBe(false);
    expect(code.includes('<select'), 'Select dropdowns with answers are strictly forbidden!').toBe(false);
    expect(code).toMatch(/<input[^>]+type="(text|number)"/);

    // 3. No forbidden style tags (must use utility classes)
    expect(code.includes('<style>'), 'Forbidden <style> tags found!').toBe(false);
    expect(code.includes('<style '), 'Forbidden <style ...> tags found!').toBe(false);

    // 4. Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 27');

    // 5. Must contain exactly 5 procedural phases with unique IDs
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="phase4"');
    expect(code).toContain('id="phase5"');
    expect(code).toContain('id="success-screen"');
  });

  test('Level 2 contains procedural calculation models and math invariants', async () => {
    const code = fs.readFileSync(level2File, 'utf-8');

    // Phase 1: Kotelnikov frequency and interval
    expect(code).toContain('P1_VARIANTS');
    expect(code).toContain('p1-input-fd');
    expect(code).toContain('p1-input-dt');
    expect(code).toContain('p1-btn');

    // Phase 2: ADC Quantization levels and voltage step
    expect(code).toContain('P2_VARIANTS');
    expect(code).toContain('p2-input-n');
    expect(code).toContain('p2-input-du');
    expect(code).toContain('p2-btn');

    // Phase 3: Error max and SQNR
    expect(code).toContain('P3_VARIANTS');
    expect(code).toContain('p3-input-err');
    expect(code).toContain('p3-input-sqnr');
    expect(code).toContain('p3-btn');

    // Phase 4: Bitrate and Audio Volume
    expect(code).toContain('P4_VARIANTS');
    expect(code).toContain('p4-input-rate');
    expect(code).toContain('p4-input-vol');
    expect(code).toContain('p4-btn');

    // Phase 5: Nyquist frequency and Aliasing
    expect(code).toContain('P5_VARIANTS');
    expect(code).toContain('p5-input-fn');
    expect(code).toContain('p5-input-alias');
    expect(code).toContain('p5-btn');

    // Error handling and hardcore_reset
    expect(code).toContain('triggerFailure');
    expect(code).toContain('hardcore_reset');

    // Decimal comma and dot normalization
    expect(code).toContain("replace(',', '.')");
  });
});
