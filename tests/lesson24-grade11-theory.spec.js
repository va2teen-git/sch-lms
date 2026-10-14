import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 24: Undecidable Problems & Halting Problem Theory Suite', () => {
  const lessonPath = path.join(process.cwd(), 'src/content/lessons/11-класс_углубленный/24');

  test('Theory file exists and contains Polyakov curriculum essentials for Lesson 24', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    expect(fs.existsSync(theoryFile)).toBe(true);

    const content = fs.readFileSync(theoryFile, 'utf-8');
    expect(content.length).toBeGreaterThan(3000);

    // Essential Polyakov concepts
    expect(content).toMatch(/алгоритмически неразрешим/i);
    expect(content).toMatch(/проблема останов|задача останов/i);
    expect(content).toContain('Тьюринг');
    expect(content).toContain('Райс');
    expect(content).toMatch(/невозможность.*отладк/i);
    expect(content).toMatch(/антивирус/i);
    expect(content).toMatch(/соответствий Поста/i);
    expect(content).toMatch(/Гильберт/i);
    expect(content).toMatch(/Матиясевич/i);
    expect(content).toMatch(/плитк.*Ван/i);
    expect(content).toMatch(/сведени/i);

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

    expect(displayLatexMatches, 'Display LaTeX ($$...$$) found in theory.md!').toBeNull();
    expect(inlineLatexMatches, 'Inline LaTeX ($...$) found in theory.md!').toBeNull();
    expect(content).toMatch(/<sub.*>|<sup.*>/);
  });
});
