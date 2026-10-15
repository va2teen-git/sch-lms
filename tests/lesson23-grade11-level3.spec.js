import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Lesson 11-23 Level 3: Markov Reactor (Archetype 12 Dynamic Rule Morphing) Suite', () => {
  const taskFile = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/23/level3.astro');

  test('1. Architectural compliance and standards check', async () => {
    expect(fs.existsSync(taskFile), 'level3.astro must exist').toBe(true);
    const code = fs.readFileSync(taskFile, 'utf-8');

    // TaskLayout component usage
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout');
    expect(code).toContain('level={3}');

    // Zero <style> tags policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Uses Vue 3
    expect(code).toContain('createApp');
    expect(code).toContain('Vue');

    // Local countdown timer per wave
    expect(code).toMatch(/phaseTimeLeft/i);
    expect(code).toContain('timer-display');

    // Telemetry and mission naming
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 23');

    // Archetype 12 Dynamic Rule Morphing specification
    expect(code).toContain('АРХЕТИП 12');
    expect(code).toContain('DYNAMIC RULE MORPHING');

    // Victory screen
    expect(code).toContain('id="success-screen"');
  });

  test('2. Verification of 8 Waves Data Structure & Dynamic Rule Morphing Mechanics', async () => {
    const code = fs.readFileSync(taskFile, 'utf-8');

    // Must define 8 arcade waves
    expect(code).toContain('ВОЛНА 1');
    expect(code).toContain('ВОЛНА 2');
    expect(code).toContain('ВОЛНА 3');
    expect(code).toContain('ВОЛНА 4');
    expect(code).toContain('ВОЛНА 5');
    expect(code).toContain('ВОЛНА 6');
    expect(code).toContain('ВОЛНА 7');
    expect(code).toContain('ВОЛНА 8');

    // Interactive arcade buttons for morphing
    expect(code).toContain('btn-morph-');
    expect(code).toContain('handleMorphAction');

    // Hardcore fail state with reset to Wave 1
    expect(code).toContain('triggerMeltdown');
    expect(code).toContain('btn-restart');
  });

  test('3. Verification of Zero Multiple Choice Policy', async () => {
    const code = fs.readFileSync(taskFile, 'utf-8');

    // Must not contain radio buttons or select dropdowns
    expect(code).not.toMatch(/type=["']radio["']/i);
    expect(code).not.toMatch(/<select/i);
  });
});
