import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Curriculum & Architecture Linting Suite (9th Grade - Lesson 7: Models & Modeling)', () => {
  const lessonPath = path.join(process.cwd(), 'src/content/lessons/9-класс/7');

  test('Theory file exists and contains essential educational sections from Polyakov', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    expect(fs.existsSync(theoryFile)).toBe(true);

    const content = fs.readFileSync(theoryFile, 'utf-8');
    expect(content.length).toBeGreaterThan(3000);

    // Key Polyakov curriculum topics
    expect(content).toContain('Моделирование как метод');
    expect(content).toMatch(/прототип|объект-оригинал/i);
    expect(content).toMatch(/адекватность/i);
    expect(content).toMatch(/натурн.*материальн/i);
    expect(content).toMatch(/информационн.*модел/i);
    expect(content).toMatch(/образн.*знаков.*смешанн/i);
    expect(content).toMatch(/статическ.*динамическ/i);
    expect(content).toMatch(/гуманитарн.*базов/i);
    expect(content).toMatch(/технологическ.*углубленн/i);
    expect(content).toMatch(/детерминированн.*стохастическ/i);
    expect(content).toMatch(/дискретн.*непрерывн/i);
    expect(content).toMatch(/погрешност/i);
    expect(content).toMatch(/этап.*моделирования/i);

    // Required sections for the 3 levels
    expect(content).toContain('Для Уровня 1');
    expect(content).toContain('Для Уровня 2');
    expect(content).toContain('Для Уровня 3');
  });

  test('Theory file complies with zero-LaTeX policy (readable textbook notation)', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    const content = fs.readFileSync(theoryFile, 'utf-8');

    // Check for inline LaTeX like $x$ or display LaTeX like $$x$$
    const inlineLatexMatches = content.match(/(?<!\\|\$)\$([^$\n]+)\$(?!\$)/g);
    const displayLatexMatches = content.match(/\$\$([^$]+)\$\$/g);

    expect(displayLatexMatches, 'Display LaTeX ($$...$$) found in theory.md!').toBeNull();
    expect(inlineLatexMatches, 'Inline LaTeX ($...$) found in theory.md!').toBeNull();

    // Check that clean HTML/Unicode notation is used instead
    expect(content).toMatch(/<sub.*>|<sup.*>/);
  });

  test('Level 1 adheres to architectural and game design requirements', async () => {
    const tasksPath = path.join(process.cwd(), 'src/pages/tasks/9-класс/7');
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
    expect(code).toContain('Урок 7');
    // No forbidden style tags (must use Tailwind CSS / Bootstrap utility classes)
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
    // Zero Multiple Choice Policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);
    // 3 phases
    expect(code).toContain('currentPhase < 3');
    expect(code).toContain('Шаг 1 из 3');
  });
});

