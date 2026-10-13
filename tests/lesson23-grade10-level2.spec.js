import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 23: Level 2 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/23/level2.astro');

  test('Level 2 adheres to architectural requirements (5 procedural phases, manual text/number input)', async () => {
    expect(fs.existsSync(taskPath)).toBe(true);

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

    // Input elements for pure manual entry
    expect(code).toContain('id="p1-input"');
    expect(code).toContain('id="p2-input"');
    expect(code).toContain('id="p3-input"');
    expect(code).toContain('id="p4-input"');
    expect(code).toContain('id="p5-input"');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 23');

    // Zero multiple choice & No forbidden style tags
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 2 contains rigorous mathematical and cryptographic logic', async () => {
    const code = fs.readFileSync(taskPath, 'utf-8');

    // Key mathematical operations
    expect(code).toContain('xorByteStrings');
    expect(code).toContain('randomByteString');
    expect(code).toContain('% 33'); // Caesar mod 33
    expect(code).toContain('% 16'); // PKCS#7 mod 16
    expect(code).toMatch(/N\s*\*\s*\(\s*N\s*-\s*1\s*\)\s*\/\s*2/); // Combinatorics

    // Error and completion notifications
    expect(code).toContain('notifyError');
    expect(code).toContain('notifyComplete');
  });
});
