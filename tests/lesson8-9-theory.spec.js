import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Lesson 8-9: Determining Truth of a Compound Statement (Theory Lint Suite)', () => {
  const lessonPath = path.join(process.cwd(), 'src/content/lessons/8-класс/9');

  test('Theory file exists and contains essential educational sections (Polyakov 8th grade curriculum)', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    expect(fs.existsSync(theoryFile), 'theory.md must exist in 8-класс/9 folder').toBe(true);

    const content = fs.readFileSync(theoryFile, 'utf-8');
    expect(content.length).toBeGreaterThan(3000);

    // Ключевые понятия учебника К.Ю. Полякова (8 класс, базовый уровень)
    expect(content).toMatch(/составное высказывание/i);
    expect(content).toMatch(/логическое выражение/i);
    expect(content).toMatch(/инверсия/i);
    expect(content).toMatch(/конъюнкция/i);
    expect(content).toMatch(/дизъюнкция/i);
    expect(content).toMatch(/приоритет/i);
    expect(content).toMatch(/дерево вычислен/i);
    expect(content).toMatch(/де Морган/i);
    expect(content).toMatch(/закон непротиворечия/i);
    expect(content).toMatch(/закон исключенного третьего/i);
    expect(content).toMatch(/закон двойного отрицания/i);
    expect(content).toMatch(/Эйлера—Венна|Эйлера-Венна/i);
    expect(content).toMatch(/строгий знак|нестрогий знак/i);

    // Профильная дифференциация (базовый курс 7-9 классов + блок углубленного технологического профиля)
    expect(content).toMatch(/базовый уровень/i);
    expect(content).toMatch(/углубленный курс|технологический профиль/i);
    expect(content).toMatch(/импликация/i);
    expect(content).toMatch(/эквивалентность/i);
    expect(content).toMatch(/строгая дизъюнкция|исключающее ИЛИ/i);

    // Обязательные блоки «Дополнительная информация» для всех 3 уровней
    expect(content).toContain('## Дополнительная информация');
    expect(content).toContain('### Для уровня 1 (Базовый)');
    expect(content).toContain('### Для уровня 2 (Продвинутый)');
    expect(content).toContain('### Для уровня 3 (Аркада)');
  });

  test('Theory file strictly complies with zero-LaTeX policy (pure Unicode and HTML sub/sup)', async () => {
    const theoryFile = path.join(lessonPath, 'theory.md');
    const content = fs.readFileSync(theoryFile, 'utf-8');

    // Запрет на сырой LaTeX ($...$ и $$...$$ и служебные команды \to, \wedge, \vee, \neg)
    const inlineLatexMatches = content.match(/(?<!\\|\$)\$([^$\n]+)\$(?!\$)/g);
    const displayLatexMatches = content.match(/\$\$([^$]+)\$\$/g);
    const rawLatexCommands = content.match(/\\(to|times|wedge|vee|neg|overline|leq|geq|neq|multicolumn)\b/g);

    expect(displayLatexMatches, 'Display LaTeX ($$...$$) found in theory.md!').toBeNull();
    expect(inlineLatexMatches, 'Inline LaTeX ($...$) found in theory.md!').toBeNull();
    expect(rawLatexCommands, 'Raw LaTeX command found in theory.md!').toBeNull();

    // Использование чистых HTML-тегов <sub> и <sup>
    expect(content).toMatch(/<sub.*>|<sup.*>/);
  });
});
