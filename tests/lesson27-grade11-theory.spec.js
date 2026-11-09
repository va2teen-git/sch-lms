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

  test('Theory provides comprehensive mathematical foundations for all Level 1, 2, and 3 mechanics (Didactic Completeness)', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    const content = fs.readFileSync(theoryFile, 'utf-8');

    // Section 10.1: Level 1 foundations
    expect(content).toMatch(/p²|p\^2|квадрат/i);
    expect(content).toMatch(/наименьш.*прост.*делител/i);
    expect(content).toMatch(/O\(N.*log.*log.*N\)/i);

    // Section 10.2: Level 2 analytical formulas
    // 1. Direct formula
    expect(content).toMatch(/⌊\(N - p²\) \/ p⌋ \+ 1|\(N - p\^2\)/i);
    // 2. Collision / first-time sieve
    expect(content).toMatch(/коллизи.*делител/i);
    // 3. Reverse problem: maximum bound
    expect(content).toMatch(/p.*next.*² - 1|p_next.*² - 1/i);
    // 4. Memory formula
    expect(content).toMatch(/⌈\(N \+ 1\) \/ 8⌉|\(N \+ 1 \+ 7\) \/ 8/i);
    // 5. Segmented sieve start index
    expect(content).toMatch(/max\(p².*⌈L \/ p⌉/i);

    // Section 10.3: Level 3 Cyber Matrix foundations
    expect(content).toMatch(/ортогональн|строк.*столбец|горизонтальн.*вертикальн/i);
    expect(content).toMatch(/буфер.*памят/i);
    expect(content).toMatch(/форсаж|пробел|space/i);
  });

  test('Theory strictly obeys Zero-Leakage / Zero-Spoiler Policy (No direct answer keys)', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    const content = fs.readFileSync(theoryFile, 'utf-8');

    // Ensure theory does not leak specific answers for Level 2 generated configurations
    expect(content).not.toMatch(/ответ:\s*(48|120|168|288)/i);
    expect(content).not.toMatch(/введите\s*(143:4|169:4|105:7)/i);
    expect(content).not.toMatch(/ответ\s*на\s*фазу\s*[1-5]/i);
    expect(content).not.toMatch(/готовый\s*ответ/i);

    // Ensure didactic examples in theory use distinct pedagogical parameters (N=20, N=24)
    // rather than the actual live task inputs (N=70, N=85, N=100, N=1000, N=2048)
    expect(content).toMatch(/Пример \(дидактический\)/i);
  });
});
