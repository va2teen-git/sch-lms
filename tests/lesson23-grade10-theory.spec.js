import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 23: Data Encryption Theory Suite', () => {
  const lessonPath = path.join(process.cwd(), 'src/content/lessons/10-класс_углубленный/23');

  test('Theory file exists and contains Polyakov curriculum essentials for Lesson 23', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    expect(fs.existsSync(theoryFile)).toBe(true);

    const content = fs.readFileSync(theoryFile, 'utf-8');
    expect(content.length).toBeGreaterThan(2500);

    // Essential Polyakov concepts
    expect(content).toContain('Шифрование данных');
    expect(content).toContain('Криптография');
    expect(content).toContain('Криптоанализ');
    expect(content).toContain('Керкгоффс');
    expect(content).toContain('Шифр Цезаря');
    expect(content).toContain('Шифр Виженера');
    expect(content).toContain('Шифр Вернама');
    expect(content).toMatch(/частотн/i);
    expect(content).toMatch(/симметричн/i);
    expect(content).toMatch(/асимметричн/i);
    expect(content).toContain('AES');
    expect(content).toContain('RSA');
    expect(content).toMatch(/подпис/i);
    expect(content).toMatch(/хэш/i);

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
