import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 23: Markov Normal Algorithms Theory Suite', () => {
  const lessonPath = path.join(process.cwd(), 'src/content/lessons/11-класс_углубленный/23');

  test('Theory file exists and contains Polyakov curriculum essentials for Lesson 23', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    expect(fs.existsSync(theoryFile), 'theory.md must exist in lesson 23 folder').toBe(true);

    const content = fs.readFileSync(theoryFile, 'utf-8');
    expect(content.length).toBeGreaterThan(3000);

    // Essential Polyakov concepts for Markov Algorithms
    expect(content).toMatch(/Марков/i);
    expect(content).toMatch(/алгорифм/i);
    expect(content).toMatch(/алфавит/i);
    expect(content).toMatch(/пустое слово|λ/i);
    expect(content).toMatch(/формул.*подстановк|правил.*подстановк|схем.*алгорифм/i);
    expect(content).toMatch(/простая подстановка/i);
    expect(content).toMatch(/заключительн.*подстановк|терминальн/i);
    expect(content).toMatch(/маркер/i);
    expect(content).toMatch(/Тьюринг/i);
    expect(content).toMatch(/Пост/i);
    expect(content).toMatch(/нормализаци|тезис Маркова/i);
    expect(content).toMatch(/детерминизм|детерминирован/i);
    expect(content).toMatch(/зацикливан/i);

    // Mandatory Additional Information blocks for levels
    expect(content).toContain('Дополнительная информация. Задание 1');
    expect(content).toContain('Дополнительная информация. Задание 2');
    expect(content).toContain('Дополнительная информация. Задание 3');
  });

  test('Theory file strictly complies with zero-LaTeX policy (pure Unicode and HTML)', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    const content = fs.readFileSync(theoryFile, 'utf-8');

    const inlineLatexMatches = content.match(/(?<!\\|\$)\$([^$\n]+)\$(?!\$)/g);
    const displayLatexMatches = content.match(/\$\$([^$]+)\$\$/g);

    expect(displayLatexMatches, 'Display LaTeX ($$...$$) found in theory.md! Use clean HTML/Unicode instead.').toBeNull();
    expect(inlineLatexMatches, 'Inline LaTeX ($...$) found in theory.md! Formulas must be readable without raw LaTeX markdown.').toBeNull();
    expect(content).toMatch(/<sub.*>|<sup.*>/);
  });
});
