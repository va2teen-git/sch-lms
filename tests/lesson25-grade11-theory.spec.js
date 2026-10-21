import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 25: Computational Complexity Theory Suite', () => {
  const lessonPath = path.join(process.cwd(), 'src/content/lessons/11-класс_углубленный/25');

  test('Theory file exists and contains Polyakov curriculum essentials for Lesson 25', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    expect(fs.existsSync(theoryFile), 'theory.md must exist in lesson directory').toBe(true);

    const content = fs.readFileSync(theoryFile, 'utf-8');
    expect(content.length).toBeGreaterThan(4000);

    // Essential Polyakov concepts for Computational Complexity
    expect(content).toMatch(/сложность вычислений|временная сложность/i);
    expect(content).toMatch(/асимптотич.*анализ|нотация Бахмана/i);
    expect(content).toMatch(/O-нотац|О-больш/i);
    expect(content).toMatch(/класс P\b|класс NP\b/i);
    expect(content).toMatch(/полиномиальн.*сводим/i);
    expect(content).toMatch(/NP-полн/i);
    expect(content).toMatch(/NP-трудн/i);
    expect(content).toContain('Кук');
    expect(content).toContain('Левин');
    expect(content).toContain('Карп');
    expect(content).toMatch(/SAT|3-SAT/i);
    expect(content).toMatch(/рюкзак/i);
    expect(content).toMatch(/коммивояжер/i);
    expect(content).toMatch(/клик/i);
    expect(content).toMatch(/вершинн.*покрыти/i);
    expect(content).toMatch(/раскраск.*граф/i);
    expect(content).toMatch(/экспоненциальн.*взрыв/i);
    expect(content).toMatch(/приближенн.*алгоритм|эвристик/i);
    expect(content).toMatch(/динамическ.*программирован.*псевдополиномиальн/i);
    expect(content).toMatch(/криптограф|RSA/i);

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
