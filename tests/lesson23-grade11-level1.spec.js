import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Lesson 11-23 Level 1: Markov Normal Algorithms Architecture & E2E Suite', () => {
  const taskFile = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/23/level1.astro');

  test('1. Architectural compliance and standards check', async () => {
    expect(fs.existsSync(taskFile), 'level1.astro must exist').toBe(true);
    const code = fs.readFileSync(taskFile, 'utf-8');

    // TaskLayout component usage
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout');
    expect(code).toContain('level={1}');

    // Zero <style> tags policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Telemetry and mission naming
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 23');

    // 3 Phases according to Level 1 specification
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="success-screen"');
  });

  test('2. Verification of Phase 1, Phase 2, and Phase 3 DOM elements and interaction contracts', async () => {
    const code = fs.readFileSync(taskFile, 'utf-8');

    // Phase 1 interactive word elements
    expect(code).toContain('id="p1-initial-word"');
    expect(code).toContain('id="p1-work-word"');
    expect(code).toContain('id="p1-rule-display"');
    expect(code).toContain('id="p1-submit-step"');
    expect(code).toContain('id="p1-submit-not-applicable"');
    expect(code).toContain('id="p1-feedback"');

    // Phase 2 slot & snap tokens elements
    expect(code).toContain('id="p2-task-desc"');
    expect(code).toContain('id="p2-slot-left"');
    expect(code).toContain('id="p2-slot-arrow"');
    expect(code).toContain('id="p2-slot-right"');
    expect(code).toContain('id="p2-tokens-palette"');
    expect(code).toContain('id="p2-submit-btn"');
    expect(code).toContain('id="p2-feedback"');

    // Phase 3 rule ordering elements
    expect(code).toContain('id="p3-task-desc"');
    expect(code).toContain('id="p3-rules-list"');
    expect(code).toContain('id="p3-submit-btn"');
    expect(code).toContain('id="p3-feedback"');

    // Victory screen
    expect(code).toContain('id="final-time"');
    expect(code).toContain('id="final-errors"');
  });

  test('3. Verification of Zero Multiple Choice Policy', async () => {
    const code = fs.readFileSync(taskFile, 'utf-8');

    // Must not contain radio buttons or select dropdowns for answer guessing
    expect(code).not.toMatch(/type=["']radio["']/i);
    expect(code).not.toMatch(/<select/i);
  });
});
