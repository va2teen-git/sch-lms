import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 25: Level 1 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/25/level1.astro');

  test('Level 1 adheres to architectural requirements', async () => {
    expect(fs.existsSync(taskPath), 'level1.astro must exist in tasks directory').toBe(true);

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
    expect(code).toContain('Урок 25');

    // Zero-style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Zero Multiple Choice Policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Mouse manipulation mechanics
    // Phase 1: Slot & Snap Asymptotic Ordering
    expect(code).toContain('p1-slot');
    expect(code).toContain('p1-token');
    expect(code).toContain('p1-slots-container');

    // Phase 2: Interactive Bucket Sorting (Drag-to-bucket)
    expect(code).toContain('target-bucket');
    expect(code).toContain('bucket-class-p');
    expect(code).toContain('bucket-class-npc');
    expect(code).toContain('bucket-class-nphard');

    // Phase 3: Karp Reductions Wire Patching / Logic Node Connector
    expect(code).toContain('p3-node-source');
    expect(code).toContain('p3-node-target');
    expect(code).toContain('p3Connections');
  });

  test('Level 1 contains robust procedural generators, error handling and bank data', async () => {
    const code = fs.readFileSync(taskPath, 'utf-8');

    // Essential banks and procedural algorithms
    expect(code).toContain('ASYMPTOTIC_BANK');
    expect(code).toContain('ALL_CLASS_P_CARDS');
    expect(code).toContain('ALL_CLASS_NPC_CARDS');
    expect(code).toContain('ALL_CLASS_NPHARD_CARDS');
    expect(code).toContain('KARP_REDUCTIONS_BANK');

    // Telemetry and feedback functions
    expect(code).toContain('triggerErrorReset');
    expect(code).toContain('completeLevel');
    expect(code).toContain('initPhase1');
    expect(code).toContain('initPhase2');
    expect(code).toContain('initPhase3');
  });
});
