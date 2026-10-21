import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 25: Level 2 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/25/level2.astro');

  test('Level 2 adheres to architectural requirements (5 procedural phases, manual text/number input)', async () => {
    expect(fs.existsSync(taskPath), 'level2.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}>');

    // Exactly 5 phases
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="phase4"');
    expect(code).toContain('id="phase5"');

    // Input elements for manual entry (Zero Multiple Choice)
    expect(code).toContain('id="p1-input"');
    expect(code).toContain('id="p2-input"');
    expect(code).toContain('id="p3-input"');
    expect(code).toContain('id="p4-input"');
    expect(code).toContain('id="p5-input"');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 25');

    // Zero multiple choice policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // No forbidden style tags
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 2 contains procedural generators, state verification and telemetry handling', async () => {
    const code = fs.readFileSync(taskPath, 'utf-8');

    // Procedural structures and logic
    expect(code).toContain('CODE_SNIPPETS_BANK');
    expect(code).toContain('STATEMENTS_BANK');
    expect(code).toContain('KARP_CHAINS_BANK');
    expect(code).toContain('triggerErrorReset');
    expect(code).toContain('completeLevel');
    expect(code).toContain('randInt');

    // Phase verification functions
    expect(code).toContain('initPhase1');
    expect(code).toContain('initPhase2');
    expect(code).toContain('initPhase3');
    expect(code).toContain('initPhase4');
    expect(code).toContain('initPhase5');
    expect(code).toContain('verifyPhase1');
    expect(code).toContain('verifyPhase2');
    expect(code).toContain('verifyPhase3');
    expect(code).toContain('verifyPhase4');
    expect(code).toContain('verifyPhase5');
  });
});
