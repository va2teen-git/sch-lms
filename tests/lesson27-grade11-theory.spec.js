import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 27: Sieve of Eratosthenes Theory Suite', () => {
  const lessonPath = path.join(process.cwd(), 'src/content/lessons/11-класс_углубленный/27');

  test('Theory file exists and contains Polyakov curriculum essentials for Lesson 27', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    expect(fs.existsSync(theoryFile), 'theory.md must exist in lesson directory').toBe(true);

    const content = fs.readFileSync(theoryFile, 'utf-8');
    expect(content.length).toBeGreaterThan(4000);

    // Essential Polyakov concepts for Sieve of Eratosthenes
    expect(content).toMatch(/прост.*числ/i);
    expect(content).toMatch(/составн.*числ/i);
    expect(content).toMatch(/основн.*теорем.*арифметик/i);
    expect(content).toMatch(/решет.*эратосфен/i);
    expect(content).toMatch(/выч[её]ркиван/i);
    expect(content).toMatch(/Мертенс/i);
    expect(content).toMatch(/сегментирован|блочн/i);
    expect(content).toMatch(/битов.*массив|vector<bool>/i);
    expect(content).toMatch(/криптограф|RSA/i);

    // Mandatory Additional Information blocks for levels
    expect(content).toMatch(/10\.1 Для уровня 1/i);
    expect(content).toMatch(/10\.2 Для уровня 2/i);
    expect(content).toMatch(/10\.3 Для уровня 3/i);
  });

  test('Theory file strictly complies with zero-LaTeX policy (pure Unicode and HTML)', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    const content = fs.readFileSync(theoryFile, 'utf-8');

    const inlineLatexMatches = content.match(/(?<!\\|\$)\$([^$\n]+)\$(?!\$)/g);
    const displayLatexMatches = content.match(/\$\$([^$]+)\$\$/g);

    expect(displayLatexMatches, 'Display LaTeX ($$...$$) found in theory.md!').toBeNull();
    expect(inlineLatexMatches, 'Inline LaTeX ($...$) found in theory.md!').toBeNull();

    // Check for LaTeX commands
    expect(content).not.toContain('\\to');
    expect(content).not.toContain('\\times');
    expect(content).not.toContain('\\cdot');
    expect(content).not.toContain('\\le');
    expect(content).not.toContain('\\ge');
    expect(content).not.toContain('\\sqrt');
  });
});
