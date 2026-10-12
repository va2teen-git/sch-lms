import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 20: Malware and Cybersecurity Suite', () => {
  const lessonPath = path.join(process.cwd(), 'src/content/lessons/10-класс_углубленный/20');
  const tasksPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/20');

  test('Theory file exists and contains Polyakov curriculum essentials', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    expect(fs.existsSync(theoryFile)).toBe(true);

    const content = fs.readFileSync(theoryFile, 'utf-8');
    expect(content.length).toBeGreaterThan(1500);

    // Essential Polyakov topics
    expect(content).toContain('Вредоносное программное обеспечение');
    expect(content).toContain('273'); // УК РФ ст. 273
    expect(content).toContain('Компьютерный вирус');
    expect(content).toContain('Сетевой червь');
    expect(content).toContain('Троянская программа');
    expect(content).toContain('Полиморфизм');
    expect(content).toContain('Метаморфизм');
    expect(content).toContain('Руткит');
    expect(content).toContain('Сигнатурный анализ');
    expect(content).toContain('Эвристический анализ');
    expect(content).toContain('Дополнительная информация. Задание 1');
    expect(content).toContain('Дополнительная информация. Задание 2');
    expect(content).toContain('Дополнительная информация. Задание 3');
  });

  test('Theory file strictly complies with zero-LaTeX policy', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    const content = fs.readFileSync(theoryFile, 'utf-8');

    const inlineLatexMatches = content.match(/(?<!\\|\$)\$([^$\n]+)\$(?!\$)/g);
    const displayLatexMatches = content.match(/\$\$([^$]+)\$\$/g);

    expect(displayLatexMatches, 'Display LaTeX ($$...$$) found in theory.md!').toBeNull();
    expect(inlineLatexMatches, 'Inline LaTeX ($...$) found in theory.md!').toBeNull();
  });

  test('Level 1 adheres to architectural requirements', async () => {
    const level1File = path.join(tasksPath, 'level1.astro');
    expect(fs.existsSync(level1File)).toBe(true);

    const code = fs.readFileSync(level1File, 'utf-8');
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}>');
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 20');
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 2 adheres to architectural requirements (5 procedural phases, manual text input)', async () => {
    const level2File = path.join(tasksPath, 'level2.astro');
    expect(fs.existsSync(level2File)).toBe(true);

    const code = fs.readFileSync(level2File, 'utf-8');
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}>');
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="phase4"');
    expect(code).toContain('id="phase5"');
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 20');
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 3 adheres to arcade requirements (Vue 3, local countdown timer, hardcore reset)', async () => {
    const level3File = path.join(tasksPath, 'level3.astro');
    expect(fs.existsSync(level3File)).toBe(true);

    const code = fs.readFileSync(level3File, 'utf-8');
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={3}>');
    expect(code).toContain('createApp');
    expect(code).toContain('Vue');
    expect(code).toMatch(/phaseTimeLeft|timerInterval/);
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 20');
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });
});
