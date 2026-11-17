import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Curriculum & Architecture Linting Suite (7-класс, Урок 10)', () => {
  const lessonPath = path.join(process.cwd(), 'src/content/lessons/7-класс/10');
  const tasksPath = path.join(process.cwd(), 'src/pages/tasks/7-класс/10');

  test('Theory file exists, covers Polyakov topics, Logo-Storm terms, and Additional Info', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    expect(fs.existsSync(theoryFile)).toBe(true);

    const content = fs.readFileSync(theoryFile, 'utf-8');
    expect(content.length).toBeGreaterThan(2000);
    expect(content).toContain('Информационные процессы');
    expect(content).toContain('Сбор');
    expect(content).toContain('Хранение');
    expect(content).toContain('Передача');
    expect(content).toContain('Обработка');
    expect(content).toContain('Дополнительная информация');
    expect(content).toContain('Для уровня 1');
    expect(content).toContain('Для уровня 2');
    expect(content).toContain('Для уровня 3');
  });

  test('Theory file complies with Zero-LaTeX policy', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    const content = fs.readFileSync(theoryFile, 'utf-8');

    const inlineLatexMatches = content.match(/(?<!\\|\$)\$([^$\n]+)\$(?!\$)/g);
    const displayLatexMatches = content.match(/\$\$([^$]+)\$\$/g);

    expect(displayLatexMatches, 'Display LaTeX found in theory.md').toBeNull();
    expect(inlineLatexMatches, 'Inline LaTeX found in theory.md').toBeNull();
    expect(content).toMatch(/<sub.*>|<sup.*>/);
  });

  test('Theory file has 5 to 12 Logo-Storm terms', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    const content = fs.readFileSync(theoryFile, 'utf-8');

    const spanRegex = /<span\s+data-term="([^"]+)"\s+data-definition="([^"]+)"[^>]*>(.*?)<\/span>/gis;
    const terms = [];
    let match;
    while ((match = spanRegex.exec(content)) !== null) {
      terms.push({ term: match[1].trim(), def: match[2].trim() });
      expect(match[1].trim().length).toBeGreaterThanOrEqual(2);
      expect(match[2].trim().length).toBeGreaterThanOrEqual(10);
    }

    expect(terms.length).toBeGreaterThanOrEqual(5);
    expect(terms.length).toBeLessThanOrEqual(12);
  });

  test('Level 1, 2, 3 adhere to TaskLayout, LMSTelemetry, Zero-Style, Zero-CDN, Zero-Multiple-Choice', async () => {
    for (const lvl of [1, 2, 3]) {
      const file = path.join(tasksPath, `level${lvl}.astro`);
      expect(fs.existsSync(file)).toBe(true);
      const code = fs.readFileSync(file, 'utf-8');

      expect(code).toContain('import TaskLayout');
      expect(code).toContain(`<TaskLayout level={${lvl}}`);
      expect(code).toContain('LMSTelemetry');
      expect(code).toContain('.complete(');
      expect(code).toContain('.hardcoreReset(');
      expect(code).toContain('Урок 10');
      expect(code.includes('<style>')).toBe(false);
      expect(code.includes('<style ')).toBe(false);
      expect(code).not.toMatch(/https?:\/\/cdn/i);
      expect(code).not.toContain('type="radio"');
      expect(code).not.toContain('<select');
    }

    const l2 = fs.readFileSync(path.join(tasksPath, 'level2.astro'), 'utf-8');
    for (let p = 1; p <= 5; p++) {
      expect(l2).toContain(`id="phase${p}"`);
    }

    const l3 = fs.readFileSync(path.join(tasksPath, 'level3.astro'), 'utf-8');
    expect(l3).toContain('vue.global.js');
    expect(l3).toContain('createApp');
    expect(l3).toContain('showAfkOverlay');
    expect(l3).toContain('start-btn');
  });
});
