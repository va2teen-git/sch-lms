import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 24: Level 1 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/24/level1.astro');

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
    expect(code).toContain('Урок 24');

    // Zero-style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Zero Multiple Choice Policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Mouse manipulation mechanics
    // Phase 1: Interactive Bucket Sorting (Drag-to-bucket)
    expect(code).toContain('target-bucket');
    expect(code).toContain('bucket-syntax');
    expect(code).toContain('bucket-semantic');

    // Phase 2: Wire Patching / Logic Node Connector
    expect(code).toContain('p2-node-source');
    expect(code).toContain('p2-node-target');
    expect(code).toContain('p2Connections');

    // Phase 3: Domino Slot & Snap (Post Correspondence Problem)
    expect(code).toContain('p3-slot');
    expect(code).toContain('p3-tile');
    expect(code).toContain('p3-slots-container');
  });

  test('Level 1 contains robust procedural generators, error handling and bank data', async () => {
    const code = fs.readFileSync(taskPath, 'utf-8');

    // Essential banks and procedural algorithms
    expect(code).toContain('ALL_SYNTAX_CARDS');
    expect(code).toContain('ALL_SEMANTIC_CARDS');
    expect(code).toContain('SOURCES_DATA');
    expect(code).toContain('TARGETS_DATA');
    expect(code).toContain('PCP_PUZZLES');

    // Telemetry and feedback functions
    expect(code).toContain('triggerErrorReset');
    expect(code).toContain('completeLevel');
    expect(code).toContain('initPhase1');
    expect(code).toContain('initPhase2');
    expect(code).toContain('initPhase3');
  });
});
