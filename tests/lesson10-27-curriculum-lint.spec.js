import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Curriculum & Architecture Linting Suite (10th Grade Advanced - Lesson 27: Discretization & Signals)', () => {
  const lessonPath = path.join(process.cwd(), 'src/content/lessons/10-класс_углубленный/27');
  const tasksPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/27');

  test('Theory file exists and contains essential educational sections from Polyakov 10th grade (advanced)', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    expect(fs.existsSync(theoryFile)).toBe(true);

    const content = fs.readFileSync(theoryFile, 'utf-8');
    expect(content.length).toBeGreaterThan(10000);

    // Key Polyakov curriculum topics
    expect(content).toMatch(/непрерывн.*дискретн.*величин/i);
    expect(content).toMatch(/сигнал/i);
    expect(content).toMatch(/квантован/i);
    expect(content).toMatch(/котельников/i);
    expect(content).toMatch(/найквист/i);
    expect(content).toMatch(/алиасинг|наложение спектров/i);
    expect(content).toMatch(/ацп|аналогово-цифровой/i);
    expect(content).toMatch(/цап|цифро-аналоговый/i);
    expect(content).toMatch(/устройство выборки|увх/i);
    expect(content).toMatch(/шаг квантования/i);
    expect(content).toMatch(/отношение сигнал\/шум|sqnr/i);
    expect(content).toMatch(/битрейт/i);

    // Required sections for the 3 levels
    expect(content).toContain('Для уровня 1 (Базовый)');
    expect(content).toContain('Для уровня 2 (Продвинутый)');
    expect(content).toContain('Для уровня 3 (Аркада)');
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

  test('Level 1 adheres to architectural and game design requirements', async () => {
    const level1File = path.join(tasksPath, 'level1.astro');
    expect(fs.existsSync(level1File)).toBe(true);

    const code = fs.readFileSync(level1File, 'utf-8');

    // TaskLayout component usage
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 27');

    // 3 phases
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('Шаг 1 из 3');
    expect(code).toContain('Шаг 2 из 3');
    expect(code).toContain('Шаг 3 из 3');

    // Zero-Style Policy (no <style> tags)
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Zero Multiple Choice Policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Container Responsiveness
    expect(code).toContain('container-fluid');
    expect(code.includes('class="container"')).toBe(false);
  });
});
