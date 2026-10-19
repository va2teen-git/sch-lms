// @ts-check
import { test, expect } from '@playwright/test';

test.describe('Унифицированный модуль валидации WriterValidator', () => {

  test('Базовая нормализация строк, BOM, невидимых символов, индексов и омоглифов', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level3');

    const result = await page.evaluate(() => {
      const V = window.WriterValidator;
      if (!V) return { error: 'WriterValidator is not defined on window' };

      // 1. Очистка BOM и невидимых символов
      const rawBom = '\uFEFF\u200BТекст\u00A0с\u200D пробелами\uFEFF';
      const stripped = V.stripInvisibleChars(rawBom);
      const spacesNorm = V.normalizeSpaces(rawBom);

      // 2. Индексные цифры
      const subSupDigits = 'x² + y³ = H₂O + A₁';
      const indexNorm = V.normalizeIndexDigits(subSupDigits);

      // 3. Омоглифы и ё/е
      const cyrillicMixed = 'Форматирование документа: ёлка, Cервер, H2O';
      const compNorm = V.normalizeComparable(cyrillicMixed);
      const compStrictLatin = V.normalizeComparable(cyrillicMixed, { strictLatin: true });

      return {
        stripped,
        spacesNorm,
        indexNorm,
        compNorm,
        compStrictLatin
      };
    });

    expect(result.error).toBeUndefined();
    expect(result.stripped).toBe('Текст с пробелами');
    expect(result.spacesNorm).toBe('Текст с пробелами');
    expect(result.indexNorm).toBe('x2 + y3 = H2O + A1');
    expect(result.compNorm).toContain('елка'); // ё -> е
    expect(result.compNorm).toContain('Сервер'); // Latin C -> Cyrillic С
    expect(result.compStrictLatin).toContain('Cервер'); // exact Latin C preserved
  });

  test('DOM-хелперы начертаний: b, strong, i, em, u, sup, sub, style-атрибуты', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level3');

    const evalReport = await page.evaluate(() => {
      const V = window.WriterValidator;
      const testContainer = document.createElement('div');
      document.body.appendChild(testContainer);

      testContainer.innerHTML = `
        <p id="p1"><b>Полужирный</b> и <strong>Стронг</strong> и <span style="font-weight: 700;">СтильБолд</span></p>
        <p id="p2"><i>Курсив</i> и <em>Эмфасис</em> и <span style="font-style: italic;">СтильКурсив</span></p>
        <p id="p3"><u>Подчёркнутый</u> и <span style="text-decoration: underline;">СтильПодчёркнутый</span></p>
        <p id="p4">Формула E = mc<sup>2</sup> и H<sub>2</sub>O</p>
        <p id="p5">Ускорение 10 м/с² и индекс A₁</p>
      `;

      const p1 = testContainer.querySelector('#p1');
      const p2 = testContainer.querySelector('#p2');
      const p3 = testContainer.querySelector('#p3');
      const p4 = testContainer.querySelector('#p4');
      const p5 = testContainer.querySelector('#p5');

      const bold1 = V.hasBoldWord(p1, 'Полужирный');
      const bold2 = V.hasBoldWord(p1, 'Стронг');
      const bold3 = V.hasBoldWord(p1, 'СтильБолд');
      const boldFail = V.hasBoldWord(p1, 'Несуществующий');

      const italic1 = V.hasItalicWord(p2, 'Курсив');
      const italic2 = V.hasItalicWord(p2, 'Эмфасис');
      const italic3 = V.hasItalicWord(p2, 'СтильКурсив');

      const u1 = V.hasUnderlineWord(p3, 'Подчёркнутый');
      const u2 = V.hasUnderlineWord(p3, 'СтильПодчёркнутый');

      const supTag = V.hasSuperscript(p4, '2');
      const subTag = V.hasSubscript(p4, '2', { requireLatinWords: ['H', 'O'] });

      const supUnicode = V.hasSuperscript(p5, '2');
      const subUnicode = V.hasSubscript(p5, '1');

      document.body.removeChild(testContainer);

      return {
        bold1, bold2, bold3, boldFail,
        italic1, italic2, italic3,
        u1, u2,
        supTag, subTag,
        supUnicode, subUnicode
      };
    });

    expect(evalReport.bold1).toBe(true);
    expect(evalReport.bold2).toBe(true);
    expect(evalReport.bold3).toBe(true);
    expect(evalReport.boldFail).toBe(false);

    expect(evalReport.italic1).toBe(true);
    expect(evalReport.italic2).toBe(true);
    expect(evalReport.italic3).toBe(true);

    expect(evalReport.u1).toBe(true);
    expect(evalReport.u2).toBe(true);

    expect(evalReport.supTag).toBe(true);
    expect(evalReport.subTag).toBe(true);
    expect(evalReport.supUnicode).toBe(true);
    expect(evalReport.subUnicode).toBe(true);
  });

  test('DOM-хелперы геометрии абзаца, списков и таблиц', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level3');

    const evalReport = await page.evaluate(() => {
      const V = window.WriterValidator;
      const testContainer = document.createElement('div');
      document.body.appendChild(testContainer);

      testContainer.innerHTML = `
        <p id="geo-p" style="font-family: 'Liberation Serif', serif; font-size: 14pt; text-align: justify; text-indent: 1cm; line-height: 1.15;">
          Отступ первой строки абзаца и межстрочный интервал.
        </p>

        <div id="typo-div">
          Модуль «Термостат» — поддерживает температуру 20 °C с точностью ±1 °C.
        </div>

        <div id="list-div">
          <ol>
            <li><b>Символ</b> — минимальная единица текста.</li>
            <li><strong>Слово</strong> — цепочка букв между пробелами.</li>
            <li><span style="font-weight: bold;">Абзац</span> — блок текста.</li>
          </ol>
        </div>

        <div id="table-div">
          <table align="center" style="margin-left: auto; margin-right: auto;">
            <thead>
              <tr>
                <th style="text-align: center;">Параметр</th>
                <th style="text-align: center;">Значение</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Кегль</td>
                <td>14 пунктов</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;

      const geo = V.checkParagraphGeometry(testContainer.querySelector('#geo-p'), {
        font: 'Liberation Serif',
        sizePt: 14,
        textAlign: 'justify',
        indentCm: 1.0,
        lineHeight: '1.15'
      });

      const typo = V.checkTypography(testContainer.querySelector('#typo-div'), {
        quotes: '«Термостат»',
        dash: true,
        symbols: ['°', '±']
      });

      const list = V.checkListStructure(testContainer.querySelector('#list-div'), {
        type: 'ol',
        minItems: 3,
        boldTerms: ['Символ', 'Слово', 'Абзац'],
        texts: ['минимальная единица', 'цепочка букв', 'блок текста']
      });

      const table = V.checkTableStructure(testContainer.querySelector('#table-div'), {
        centered: true,
        headers: ['Параметр', 'Значение'],
        cells: ['Кегль', '14 пунктов'],
        alignHeadersCenter: true
      });

      document.body.removeChild(testContainer);

      return { geo, typo, list, table };
    });

    expect(evalReport.geo.allOk).toBe(true);
    expect(evalReport.typo.allOk).toBe(true);
    expect(evalReport.list.allOk).toBe(true);
    expect(evalReport.table.allOk).toBe(true);
  });

  test('Сквозное тестирование урока 9 класса (Урок 5 Уровень 1) с валидацией через WriterValidator', async ({ page }) => {
    await page.goto('/tasks/9-класс/5/level1');

    // Ожидаем отрисовки редактора и панели инструкции
    await expect(page.locator('#instruction-panel')).toBeVisible();
    await expect(page.locator('.jodit-wysiwyg')).toBeVisible();

    // Читаем текущую задачу (предложение и целевое слово)
    const taskInfo = await page.evaluate(() => {
      const panel = document.getElementById('instruction-panel');
      const textSpan = panel?.querySelector('.text-info');
      const targetSpan = panel?.querySelector('.text-warning');
      const formatSpan = panel?.querySelector('.text-danger');
      return {
        sentence: textSpan?.textContent?.replace(/^"|"$/g, '').trim() || '',
        targetWord: targetSpan?.textContent?.replace(/[«»]/g, '').trim() || '',
        formatLabel: formatSpan?.textContent?.trim() || ''
      };
    });

    expect(taskInfo.sentence.length).toBeGreaterThan(0);
    expect(taskInfo.targetWord.length).toBeGreaterThan(0);

    // Вводим предложение в редактор
    await page.locator('.jodit-wysiwyg').click();
    await page.keyboard.type(taskInfo.sentence);

    // Выделяем целевое слово и применяем нужное форматирование
    await page.evaluate((word) => {
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      if (!wysiwyg) return;
      const range = document.createRange();
      const sel = window.getSelection();

      // Находим текстовый узел
      const walker = document.createTreeWalker(wysiwyg, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const idx = node.textContent?.indexOf(word);
        if (idx !== undefined && idx >= 0) {
          range.setStart(node, idx);
          range.setEnd(node, idx + word.length);
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
          break;
        }
      }
    }, taskInfo.targetWord);

    if (taskInfo.formatLabel.includes('ЖИРНЫМ')) {
      await page.locator('#btn-bold').click();
    } else if (taskInfo.formatLabel.includes('КУРСИВОМ')) {
      await page.locator('#btn-italic').click();
    } else if (taskInfo.formatLabel.includes('ПОДЧЕРКНУТЫМ')) {
      await page.locator('#btn-underline').click();
    }

    // Нажимаем кнопку проверки #check-btn
    await page.locator('#check-btn').click();

    // Проверяем переход на Фазу 2
    await expect(page.locator('#phase-counter')).toHaveText('2', { timeout: 5000 });
  });

});
