import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Lesson 7-7: Computer Networks and Internet Search (Theory Lint Suite)', () => {
  const lessonPath = path.join(process.cwd(), 'src/content/lessons/7-класс/7');

  test('Theory file exists and contains essential educational sections (Polyakov curriculum)', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    expect(fs.existsSync(theoryFile)).toBe(true);

    const content = fs.readFileSync(theoryFile, 'utf-8');
    expect(content.length).toBeGreaterThan(2500);

    // Ключевые понятия учебника Полякова (7 класс)
    expect(content).toMatch(/компьютерная сеть/i);
    expect(content).toMatch(/локальная сеть/i);
    expect(content).toMatch(/глобальная сеть/i);
    expect(content).toMatch(/витая пара/i);
    expect(content).toMatch(/оптоволокон/i);
    expect(content).toMatch(/RJ-45/);
    expect(content).toMatch(/сервер/i);
    expect(content).toMatch(/клиент/i);
    expect(content).toMatch(/Тим Бернерс-Ли/);
    expect(content).toMatch(/Всемирная паутина|WWW/);
    expect(content).toMatch(/гипертекст/i);
    expect(content).toMatch(/URL/);
    expect(content).toMatch(/домен/i);
    expect(content).toMatch(/DNS/);
    expect(content).toMatch(/поисковая система/i);
    expect(content).toMatch(/ключевые слова/i);
    expect(content).toMatch(/инвертированный индекс|индексац/i);
    expect(content).toMatch(/авторское право/i);
    expect(content).toMatch(/146 УК РФ/);

    // Разделение базового и углубленного курса
    expect(content).toMatch(/углубленный курс|технологический профиль/i);

    // Дополнительная информация для всех 3 уровней
    expect(content).toContain('Дополнительная информация');
    expect(content).toContain('Для уровня 1 (Базовый)');
    expect(content).toContain('Для уровня 2 (Продвинутый)');
    expect(content).toContain('Для уровня 3 (Аркада)');
  });

  test('Theory file strictly complies with zero-LaTeX policy', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    const content = fs.readFileSync(theoryFile, 'utf-8');

    // Проверка отсутствия сырого LaTeX
    const inlineLatexMatches = content.match(/(?<!\\|\$)\$([^$\n]+)\$(?!\$)/g);
    const displayLatexMatches = content.match(/\$\$([^$]+)\$\$/g);

    expect(displayLatexMatches, 'Display LaTeX ($$...$$) found in theory.md!').toBeNull();
    expect(inlineLatexMatches, 'Inline LaTeX ($...$) found in theory.md!').toBeNull();
  });
});
