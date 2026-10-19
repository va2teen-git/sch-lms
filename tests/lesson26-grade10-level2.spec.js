import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 26: Level 2 Task Suite', () => {
  const tasksPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/26');
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
    expect(code).toContain('Урок 26');

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

    // Phase 1: Individual event information i = log2(1 / p)
    expect(code).toContain('id="p1-input"');
    expect(code).toContain('id="p1-btn"');
    expect(code).toContain('P1_MULTIPLIERS');

    // Phase 2: Shannon entropy H = sum p_k * log2(1 / p_k)
    expect(code).toContain('id="p2-input"');
    expect(code).toContain('id="p2-btn"');
    expect(code).toContain('P2_DISTRIBUTIONS');

    // Phase 3: Absolute D and relative R statistical redundancy
    expect(code).toContain('id="p3-input-d"');
    expect(code).toContain('id="p3-input-r"');
    expect(code).toContain('id="p3-btn"');
    expect(code).toContain('P3_CONFIGS');

    // Phase 4: Kharkevich pragmatic value V = log2(P1 / P0)
    expect(code).toContain('id="p4-input"');
    expect(code).toContain('id="p4-btn"');
    expect(code).toContain('P4_CONFIGS');

    // Phase 5: Genetic triplet code capacity in bytes
    expect(code).toContain('id="p5-input-nucl"');
    expect(code).toContain('id="p5-input-bytes"');
    expect(code).toContain('id="p5-btn"');
    expect(code).toContain('P5_AMINO_COUNTS');

    // Error handling & hardcore reset
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('triggerError');
  });
});
