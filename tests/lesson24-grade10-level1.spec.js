import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 24: Level 1 Task Suite', () => {
  const tasksPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/24');
  const level1File = path.join(tasksPath, 'level1.astro');

  test('Level 1 adheres to architectural requirements', async () => {
    expect(fs.existsSync(level1File), 'level1.astro must exist').toBe(true);

    const code = fs.readFileSync(level1File, 'utf-8');

    // 1. TaskLayout component usage
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}');

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

    // 5. Must contain exactly 3 procedural phases with unique IDs
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="success-screen"');
  });

  test('Level 1 contains robust procedural generators, error handling and bank data', async () => {
    const code = fs.readFileSync(level1File, 'utf-8');

    // Phase 1: Slot & Snap blocks for RSA
    expect(code).toContain('P1_CORRECT_BLOCKS');
    expect(code).toContain('P1_DISTRACTORS');
    expect(code).toContain('p1-verify-btn');
    expect(code).toContain('pipeline-slot');

    // Phase 2: LSB Bit Grid
    expect(code).toContain('p2-channels-grid');
    expect(code).toContain('lsb-toggle-btn');
    expect(code).toContain('p2-verify-btn');

    // Phase 3: Drag-to-Bucket Classification
    expect(code).toContain('P3_BANK');
    expect(code).toContain('bucket-rsa');
    expect(code).toContain('bucket-stego');
    expect(code).toContain('bucket-symmetric');
    expect(code).toContain('p3-verify-btn');

    // Hardcore reset on error
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('triggerError');
  });
});
