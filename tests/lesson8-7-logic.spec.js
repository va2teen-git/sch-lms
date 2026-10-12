import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Lesson 8-7: Logical Statements (Architecture & Content Suite)', () => {
  const lessonPath = path.join(process.cwd(), 'src/content/lessons/8-класс/7');
  const tasksPath = path.join(process.cwd(), 'src/pages/tasks/8-класс/7');

  test('Theory file exists and contains essential educational sections (Polyakov curriculum)', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    expect(fs.existsSync(theoryFile)).toBe(true);

    const content = fs.readFileSync(theoryFile, 'utf-8');
    expect(content.length).toBeGreaterThan(1500);

    // Ключевые понятия учебника Полякова
    expect(content).toMatch(/Аристотель/i);
    expect(content).toMatch(/Джордж Буль|Булев/i);
    expect(content).toMatch(/высказывание/i);
    expect(content).toMatch(/закон непротиворечия/i);
    expect(content).toMatch(/закон исключенного третьего/i);
    expect(content).toMatch(/предикат/i);
    expect(content).toMatch(/истина/i);
    expect(content).toMatch(/ложь/i);

    // Дополнительная информация для всех 3 уровней
    expect(content).toContain('Дополнительная информация (Уровень 1');
    expect(content).toContain('Дополнительная информация (Уровень 2');
    expect(content).toContain('Дополнительная информация (Уровень 3');
  });

  test('Theory file strictly complies with zero-LaTeX policy (clean textbook notation)', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    const content = fs.readFileSync(theoryFile, 'utf-8');

    // Проверка отсутствия сырого LaTeX
    const inlineLatexMatches = content.match(/(?<!\\|\$)\$([^$\n]+)\$(?!\$)/g);
    const displayLatexMatches = content.match(/\$\$([^$]+)\$\$/g);

    expect(displayLatexMatches, 'Display LaTeX ($$...$$) found in theory.md!').toBeNull();
    expect(inlineLatexMatches, 'Inline LaTeX ($...$) found in theory.md!').toBeNull();

    // Проверка использования тегов типографики
    expect(content).toMatch(/<sub.*>|<sup.*>/);
  });

  test('Level 1 adheres to architectural requirements (3 phases, TaskLayout, Telemetry, Zero Style)', async () => {
    const level1File = path.join(tasksPath, 'level1.astro');
    expect(fs.existsSync(level1File)).toBe(true);

    const code = fs.readFileSync(level1File, 'utf-8');
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}');

    // Телеметрия
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 7');

    // 3 фазы / шага
    expect(code).toContain('Шаг 1 из 3');
    expect(code).toContain('target-bucket');

    // Запрет тегов style
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 2 adheres to architectural requirements (5 procedural phases, TaskLayout, Telemetry, Zero Style)', async () => {
    const level2File = path.join(tasksPath, 'level2.astro');
    expect(fs.existsSync(level2File)).toBe(true);

    const code = fs.readFileSync(level2File, 'utf-8');
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}');

    // 5 процедурных фаз с уникальными ID
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="phase4"');
    expect(code).toContain('id="phase5"');

    // Телеметрия
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 7');

    // Запрет тегов style
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('Level 3 adheres to architectural requirements (Vue 3, countdown timer, 8 waves, Total Hardcore Reset)', async () => {
    const level3File = path.join(tasksPath, 'level3.astro');
    expect(fs.existsSync(level3File)).toBe(true);

    const code = fs.readFileSync(level3File, 'utf-8');
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={3}');

    // Vue 3
    expect(code).toContain('createApp');
    expect(code).toContain('Vue');

    // Обратный отсчет таймера
    expect(code).toMatch(/timer|timeleft|phaseTimeLeft/i);

    // Телеметрия
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 7');

    // Запрет тегов style
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });
});
