import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 26: Information, Data, Knowledge & Information Processes Theory Suite', () => {
  const lessonPath = path.join(process.cwd(), 'src/content/lessons/10-класс_углубленный/26');

  test('Theory file exists and contains Polyakov curriculum essentials for Lesson 26', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    expect(fs.existsSync(theoryFile)).toBe(true);

    const content = fs.readFileSync(theoryFile, 'utf-8');
    expect(content.length).toBeGreaterThan(15000);

    // Essential Polyakov concepts for Lesson 26 (Information, Data, Knowledge, Processes, Entropy)
    expect(content).toContain('Информация, данные и знания');
    expect(content).toContain('Информационные процессы в природе, технике и обществе');
    expect(content).toMatch(/атрибутивн/i);
    expect(content).toMatch(/функциональн/i);
    expect(content).toMatch(/антропоцентрич/i);
    expect(content).toMatch(/сигнал/i);
    expect(content).toMatch(/данн/i);
    expect(content).toMatch(/знани/i);
    expect(content).toMatch(/декларативн/i);
    expect(content).toMatch(/процедурн/i);
    expect(content).toMatch(/синтаксич/i);
    expect(content).toMatch(/семантич/i);
    expect(content).toMatch(/прагматич/i);
    expect(content).toMatch(/тезаурус/i);
    expect(content).toMatch(/Шеннон/i);
    expect(content).toMatch(/Хартли/i);
    expect(content).toMatch(/Винер/i);
    expect(content).toMatch(/энтропи/i);
    expect(content).toMatch(/кибернетик/i);
    expect(content).toMatch(/обратн.*связ/i);
    expect(content).toMatch(/ДНК|нуклеотид|триплет|кодон/i);
    expect(content).toMatch(/информационн.*революц/i);
    expect(content).toMatch(/информационн.*обществ/i);

    // Mandatory Additional Information blocks for levels
    expect(content).toContain('Дополнительная информация. Задание 1');
    expect(content).toContain('Дополнительная информация. Задание 2');
    expect(content).toContain('Дополнительная информация. Задание 3');
    expect(content).toContain('### Для уровня 1 (Базовый)');
    expect(content).toContain('### Для уровня 2 (Продвинутый)');
    expect(content).toContain('### Для уровня 3 (Аркада)');
  });

  test('Theory file strictly complies with zero-LaTeX policy (pure Unicode and HTML)', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    const content = fs.readFileSync(theoryFile, 'utf-8');

    const inlineLatexMatches = content.match(/(?<!\\|\$)\$([^$\n]+)\$(?!\$)/g);
    const displayLatexMatches = content.match(/\$\$([^$]+)\$\$/g);
    const rawLatexCommands = content.match(/\\(to|times|cdot|leq|geq|neq|sum|log|frac|subset|in)\b/g);

    expect(displayLatexMatches, 'Display LaTeX ($$...$$) found in theory.md!').toBeNull();
    expect(inlineLatexMatches, 'Inline LaTeX ($...$) found in theory.md!').toBeNull();
    expect(rawLatexCommands, 'Raw LaTeX commands found in theory.md!').toBeNull();
    expect(content).toMatch(/<sub.*>|<sup.*>/);
  });
});
