import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Curriculum & Architecture Linting Suite (Lesson 20)', () => {
  const lessonPath = path.join(process.cwd(), 'src/content/lessons/11-класс_углубленный/20');
  const tasksPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/20');

  test('Theory file exists and contains essential educational sections', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    expect(fs.existsSync(theoryFile)).toBe(true);

    const content = fs.readFileSync(theoryFile, 'utf-8');
    expect(content.length).toBeGreaterThan(1000);
    // Key Polyakov curriculum topics
    expect(content).toContain('Машина Тьюринга');
    expect(content).toContain('Тезис Чёрча');
    expect(content).toMatch(/алфавит/i);
    expect(content).toMatch(/таблица переходов|матриц/i);
  });

  test('Theory file complies with zero-LaTeX policy (readable textbook notation)', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    const content = fs.readFileSync(theoryFile, 'utf-8');

    // Check for inline LaTeX like $x$ or display LaTeX like $$x$$
    const inlineLatexMatches = content.match(/(?<!\\|\$)\$([^$\n]+)\$(?!\$)/g);
    const displayLatexMatches = content.match(/\$\$([^$]+)\$\$/g);

    expect(displayLatexMatches, 'Display LaTeX ($$...$$) found in theory.md! Use clean HTML/Unicode instead.').toBeNull();
    expect(inlineLatexMatches, 'Inline LaTeX ($...$) found in theory.md! Formulas must be readable without raw LaTeX markdown.').toBeNull();

    // Check that clean HTML/Unicode notation is used instead
    expect(content).toMatch(/<sub.*>|<sup.*>/);
  });

  test('Level 1 adheres to architectural requirements', async () => {
    const level1File = path.join(tasksPath, 'level1.astro');
    expect(fs.existsSync(level1File)).toBe(true);

    const code = fs.readFileSync(level1File, 'utf-8');
    // TaskLayout component usage
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout');
    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 20');
    // No forbidden style tags (must use Tailwind CSS)
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 2 adheres to architectural requirements (5 procedural phases)', async () => {
    const level2File = path.join(tasksPath, 'level2.astro');
    expect(fs.existsSync(level2File)).toBe(true);

    const code = fs.readFileSync(level2File, 'utf-8');
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout');
    // Must contain 5 procedural phases
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="phase4"');
    expect(code).toContain('id="phase5"');
    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 20');
    // No forbidden style tags
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 3 adheres to architectural requirements (Vue 3, countdown timer)', async () => {
    const level3File = path.join(tasksPath, 'level3.astro');
    expect(fs.existsSync(level3File)).toBe(true);

    const code = fs.readFileSync(level3File, 'utf-8');
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout');
    // Uses Vue 3
    expect(code).toContain('createApp');
    expect(code).toContain('Vue');
    // Local countdown timer per phase/wave
    expect(code).toMatch(/timer|timeleft|phaseTimeLeft/i);
    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 20');
    // No forbidden style tags
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });
});
