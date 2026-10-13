import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 23: Level 1 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/23/level1.astro');

  test('Level 1 adheres to architectural requirements', async () => {
    expect(fs.existsSync(taskPath)).toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}>');

    // 3 phases
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 23');

    // No forbidden style tags
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Mouse manipulation mechanics
    expect(code).toContain('target-bucket');
    expect(code).toContain('p2-slider');
    expect(code).toContain('pipeline-slot');
  });

  test('Level 1 contains robust procedural generators and error handlers', async () => {
    const code = fs.readFileSync(taskPath, 'utf-8');

    // Procedural structures
    expect(code).toContain('P1_DATABASE');
    expect(code).toContain('P2_DICTIONARY');
    expect(code).toContain('P3_DATABASE');
    expect(code).toContain('caesarEncrypt');
    expect(code).toContain('caesarDecrypt');
    expect(code).toContain('notifyError');
    expect(code).toContain('notifyComplete');
  });
});
