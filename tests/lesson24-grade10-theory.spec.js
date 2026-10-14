import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 24: RSA Algorithm & Steganography Theory Suite', () => {
  const lessonPath = path.join(process.cwd(), 'src/content/lessons/10-класс_углубленный/24');

  test('Theory file exists and contains Polyakov curriculum essentials for Lesson 24', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    expect(fs.existsSync(theoryFile)).toBe(true);

    const content = fs.readFileSync(theoryFile, 'utf-8');
    expect(content.length).toBeGreaterThan(3000);

    // Essential Polyakov concepts for Lesson 24 (RSA and Steganography)
    expect(content).toContain('Алгоритм шифрования RSA');
    expect(content).toContain('Стеганография');
    expect(content).toMatch(/асимметричн/i);
    expect(content).toMatch(/Диффи/i);
    expect(content).toMatch(/Хеллман/i);
    expect(content).toMatch(/Ривест|Шамир|Адлеман/i);
    expect(content).toMatch(/односторонн/i);
    expect(content).toMatch(/лазейк/i);
    expect(content).toMatch(/Эйлер/i);
    expect(content).toMatch(/φ\(n\)|функци/i);
    expect(content).toMatch(/модул/i);
    expect(content).toMatch(/экспонент/i);
    expect(content).toMatch(/факторизац/i);
    expect(content).toMatch(/подпис|ЭЦП/i);
    expect(content).toMatch(/сертификат|PKI/i);
    expect(content).toMatch(/контейнер/i);
    expect(content).toMatch(/LSB|наименьш/i);
    expect(content).toMatch(/пиксел/i);
    expect(content).toMatch(/стеганоанализ|хи-квадрат/i);

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
