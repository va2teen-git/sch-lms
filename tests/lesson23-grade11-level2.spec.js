import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Lesson 11-23 Level 2: Markov Normal Algorithms Advanced Suite', () => {
  const taskFile = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/23/level2.astro');

  test('1. Architectural compliance and standards check', async () => {
    expect(fs.existsSync(taskFile), 'level2.astro must exist').toBe(true);
    const code = fs.readFileSync(taskFile, 'utf-8');

    // TaskLayout component usage
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout');
    expect(code).toContain('level={2}');

    // Zero <style> tags policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Telemetry and mission naming
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 23');

    // Must contain exactly 5 procedural phases according to Level 2 specification
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="phase4"');
    expect(code).toContain('id="phase5"');
    expect(code).toContain('id="success-screen"');
  });

  test('2. Verification of all 5 Phase DOM elements and input contracts', async () => {
    const code = fs.readFileSync(taskFile, 'utf-8');

    // Phase 1 elements (Syntax injection)
    expect(code).toContain('id="p1-task-desc"');
    expect(code).toContain('id="p1-input"');
    expect(code).toContain('id="p1-btn"');
    expect(code).toContain('id="p1-feedback"');

    // Phase 2 elements (String trace)
    expect(code).toContain('id="p2-rules-display"');
    expect(code).toContain('id="p2-word-display"');
    expect(code).toContain('id="p2-input"');
    expect(code).toContain('id="p2-btn"');
    expect(code).toContain('id="p2-feedback"');

    // Phase 3 elements (Step calculation)
    expect(code).toContain('id="p3-rules-display"');
    expect(code).toContain('id="p3-word-display"');
    expect(code).toContain('id="p3-input"');
    expect(code).toContain('id="p3-btn"');
    expect(code).toContain('id="p3-feedback"');

    // Phase 4 elements (Arithmetic)
    expect(code).toContain('id="p4-rules-display"');
    expect(code).toContain('id="p4-expr-display"');
    expect(code).toContain('id="p4-input"');
    expect(code).toContain('id="p4-btn"');
    expect(code).toContain('id="p4-feedback"');

    // Phase 5 elements (Static Halting / Loop Analysis)
    expect(code).toContain('id="p5-rules-display"');
    expect(code).toContain('id="p5-word-display"');
    expect(code).toContain('id="p5-input"');
    expect(code).toContain('id="p5-btn"');
    expect(code).toContain('id="p5-feedback"');

    // Victory screen
    expect(code).toContain('id="final-time"');
    expect(code).toContain('id="final-errors"');
  });

  test('3. Verification of Zero Multiple Choice Policy (Manual Input Exclusively)', async () => {
    const code = fs.readFileSync(taskFile, 'utf-8');

    // Must not contain radio buttons or select dropdowns for answers
    expect(code).not.toMatch(/type=["']radio["']/i);
    expect(code).not.toMatch(/<select/i);

    // Must contain input fields
    expect(code).toContain('id="p1-input"');
    expect(code).toContain('id="p2-input"');
    expect(code).toContain('id="p3-input"');
    expect(code).toContain('id="p4-input"');
    expect(code).toContain('id="p5-input"');
  });
});
