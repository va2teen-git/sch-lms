import { test, expect } from '@playwright/test';
import { verifySurfaceContrast } from './procedural-contracts.js';

test.describe('7 класс - Урок 22 - Уровень 3 (Аркада в LibreOffice Writer: 10 волн)', () => {

  test('Отслеживание действий ученика в реальном времени (actionLog, панель инструментов, диалоги и живой чек-лист)', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level3');
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 1 / 10');

    // Получаем данные Волны 1 и проверяем увеличенный таймер (85 сек)
    const arcadeInit = await page.evaluate(() => window.getLevel3ArcadeState());
    const wave1Data = arcadeInit.activeWaveData;
    expect(wave1Data).toBeDefined();
    expect(arcadeInit.timeLeft).toBeGreaterThanOrEqual(80);

    // Изначально чек-лист показывает невыполненные требования (⏳)
    await expect(page.locator('#live-checklist')).toContainText('⏳');

    // Выполняем реальные действия в редакторе: кликаем по кнопкам панели и вводим отформатированный текст
    await page.locator('#btn-bold').click();
    await page.locator('#select-font').selectOption('Liberation Serif');
    await page.locator('#select-fontsize').selectOption('14pt');
    await page.locator('#btn-align-justify').click();

    // Проверяем, что трекер действий в реальном времени зафиксировал операции ученика
    const writerState = await page.evaluate(() => window.getWriterState());
    expect(writerState.actionLog.length).toBeGreaterThanOrEqual(4);
    const actionTypes = writerState.actionLog.map(a => a.type);
    expect(actionTypes).toContain('format_bold');
    expect(actionTypes).toContain('font_family');
    expect(actionTypes).toContain('font_size');
    expect(actionTypes).toContain('align_justify');

    await expect(page.locator('#action-tracker-badge')).not.toContainText('ДЕЙСТВИЙ: 0');

    // Вводим требуемый текст Волны 1 с полужирным словом и проверяем мгновенное обновление чек-листа (✅)
    await page.evaluate((w1) => {
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      wysiwyg.innerHTML = `<p><b>${w1.boldWord}</b>${w1.text.slice(w1.boldWord.length)}</p>`;
      wysiwyg.dispatchEvent(new Event('input', { bubbles: true }));
    }, wave1Data);

    const checksAfterInput = await page.evaluate(() => window.getLevel3ArcadeState().liveChecks);
    expect(checksAfterInput.every(c => c.passed)).toBe(true);
    await expect(page.locator('#live-checklist')).not.toContainText('⏳');
  });

  test('Полное боевое прохождение всех 10 волн скоростной печати и форматирования до экрана победы', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level3');

    // --- ВОЛНА 1: Полужирное начертание ---
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 1 / 10');
    let state = await page.evaluate(() => window.getLevel3ArcadeState());
    await page.evaluate((d) => {
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      wysiwyg.innerHTML = `<p><b>${d.boldWord}</b>${d.text.slice(d.boldWord.length)}</p>`;
      wysiwyg.dispatchEvent(new Event('input', { bubbles: true }));
    }, state.activeWaveData);
    await page.locator('#check-btn').click();

    // --- ВОЛНА 2: Курсив + Подчёркнутый ---
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 2 / 10');
    state = await page.evaluate(() => window.getLevel3ArcadeState());
    await page.evaluate((d) => {
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      const html = d.text
        .replace(d.italicWord, `<i>${d.italicWord}</i>`)
        .replace(d.underlineWord, `<u>${d.underlineWord}</u>`);
      wysiwyg.innerHTML = `<p>${html}</p>`;
      wysiwyg.dispatchEvent(new Event('input', { bubbles: true }));
    }, state.activeWaveData);
    await page.locator('#check-btn').click();

    // --- ВОЛНА 3: Верхний и нижний индексы (<sup> и <sub>) ---
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 3 / 10');
    state = await page.evaluate(() => window.getLevel3ArcadeState());
    await page.evaluate((d) => {
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      wysiwyg.innerHTML = `<p>${d.plainCheck} <sup>${d.supText}</sup> и <sub>${d.subText}</sub>.</p>`;
      wysiwyg.dispatchEvent(new Event('input', { bubbles: true }));
    }, state.activeWaveData);
    await page.locator('#check-btn').click();

    // --- ВОЛНА 4: Заголовок (Гарнитура, Кегль, По центру) ---
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 4 / 10');
    state = await page.evaluate(() => window.getLevel3ArcadeState());
    await page.evaluate((d) => {
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      wysiwyg.innerHTML = `<p id="w4-p">${d.heading}</p>`;
      wysiwyg.dispatchEvent(new Event('input', { bubbles: true }));
    }, state.activeWaveData);
    await page.locator('#select-font').selectOption(state.activeWaveData.font);
    await page.locator('#select-fontsize').selectOption(`${state.activeWaveData.sizePt}pt`);
    await page.locator('#btn-align-center').click();
    await page.locator('#check-btn').click();

    // --- ВОЛНА 5: Основной абзац (Liberation Serif, 14 пт, По ширине) ---
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 5 / 10');
    state = await page.evaluate(() => window.getLevel3ArcadeState());
    await page.evaluate((d) => {
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      wysiwyg.innerHTML = `<p id="w5-p">${d.text}</p>`;
      wysiwyg.dispatchEvent(new Event('input', { bubbles: true }));
    }, state.activeWaveData);
    await page.locator('#select-font').selectOption('Liberation Serif');
    await page.locator('#select-fontsize').selectOption('14pt');
    await page.locator('#btn-align-justify').click();
    await page.locator('#check-btn').click();

    // --- ВОЛНА 6: Геометрия абзаца (Красная строка 1.0 см + Интервал 1.15 + По ширине) ---
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 6 / 10');
    state = await page.evaluate(() => window.getLevel3ArcadeState());
    await page.evaluate((d) => {
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      wysiwyg.innerHTML = `<p id="w6-p">${d.text}</p>`;
      wysiwyg.dispatchEvent(new Event('input', { bubbles: true }));
    }, state.activeWaveData);
    // Используем реальный диалог Формат -> Абзац...
    await page.locator('.lo-menu-item').filter({ hasText: /^Формат$/ }).click();
    await page.locator('#menu-format-paragraph').click();
    await expect(page.locator('#modal-paragraph')).toBeVisible();
    await page.locator('#dialog-para-firstline').fill('1.0');
    await page.locator('#dialog-para-lineheight').selectOption('1.15');
    await page.locator('#align-radio-justify').check();
    await page.locator('#btn-apply-paragraph').click();
    await expect(page.locator('#modal-paragraph')).toBeHidden();
    await page.locator('#check-btn').click();

    // --- ВОЛНА 7: Типографика и спецсимволы ОГЭ (« », —, °, ±) ---
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 7 / 10');
    state = await page.evaluate(() => window.getLevel3ArcadeState());
    await page.evaluate((d) => {
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      wysiwyg.innerHTML = `<p>${d.text}</p>`;
      wysiwyg.dispatchEvent(new Event('input', { bubbles: true }));
    }, state.activeWaveData);
    await page.locator('#check-btn').click();

    // --- ВОЛНА 8: Нумерованный список (<ol><li>) с полужирными терминами ---
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 8 / 10');
    state = await page.evaluate(() => window.getLevel3ArcadeState());
    await page.evaluate((d) => {
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      wysiwyg.innerHTML = `<ol>
        <li><b>${d.items[0].bold}</b> — ${d.items[0].rest}</li>
        <li><b>${d.items[1].bold}</b> — ${d.items[1].rest}</li>
        <li><b>${d.items[2].bold}</b> — ${d.items[2].rest}</li>
      </ol>`;
      wysiwyg.dispatchEvent(new Event('input', { bubbles: true }));
    }, state.activeWaveData);
    await page.locator('#check-btn').click();

    // --- ВОЛНА 9: Таблица 2×2 по центру страницы с шапкой по центру ---
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 9 / 10');
    state = await page.evaluate(() => window.getLevel3ArcadeState());
    await page.evaluate((d) => {
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      wysiwyg.innerHTML = `<table>
        <thead><tr><th>${d.h1}</th><th>${d.h2}</th></tr></thead>
        <tbody><tr><td>${d.c1}</td><td>${d.c2}</td></tr></tbody>
      </table>`;
      wysiwyg.dispatchEvent(new Event('input', { bubbles: true }));
    }, state.activeWaveData);
    // Применяем выравнивание таблицы через диалог Таблица -> Свойства таблицы...
    await page.locator('.lo-menu-item').filter({ hasText: /^Таблица$/ }).click();
    await page.locator('#menu-table-props').click();
    await expect(page.locator('#modal-table-props')).toBeVisible();
    await page.locator('#dialog-table-align').selectOption('center');
    await page.locator('#dialog-table-header-align').selectOption('center');
    await page.locator('#btn-apply-table-props').click();
    await expect(page.locator('#modal-table-props')).toBeHidden();
    await page.locator('#check-btn').click();

    // --- ВОЛНА 10: Финальный босс — Полный регламент ОГЭ 13.2 (2 / 2 баллов) ---
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 10 / 10');
    state = await page.evaluate(() => window.getLevel3ArcadeState());

    // 1. Устанавливаем поля страницы 2.0 см через Формат -> Страница...
    await page.locator('.lo-menu-item').filter({ hasText: /^Формат$/ }).click();
    await page.locator('#menu-format-page').click();
    await expect(page.locator('#modal-page')).toBeVisible();
    await page.locator('#btn-page-set-oge').click();
    await page.locator('#btn-apply-page').click();
    await expect(page.locator('#modal-page')).toBeHidden();

    // 2. Вводим основной абзац и таблицу по стандарту ОГЭ 13.2
    await page.evaluate((d) => {
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      wysiwyg.innerHTML = `<p style="font-family: 'Liberation Serif', serif; font-size: 14pt; text-indent: 1cm; text-align: justify; line-height: 1.15;"><b>${d.boldWord}</b>${d.para.slice(d.boldWord.length)}</p><table style="margin-left: auto; margin-right: auto; border-collapse: collapse; width: 80%;"><thead><tr><th style="text-align: center; font-weight: bold; font-size: 14pt; border: 1px solid #000;">${d.h1}</th><th style="text-align: center; font-weight: bold; font-size: 14pt; border: 1px solid #000;">${d.h2}</th></tr></thead><tbody><tr><td style="font-size: 14pt; border: 1px solid #000;">${d.c1}</td><td style="font-size: 14pt; border: 1px solid #000;">${d.c2}</td></tr></tbody></table>`;
      wysiwyg.dispatchEvent(new Event('input', { bubbles: true }));
    }, state.activeWaveData);

    await page.locator('#check-btn').click();

    // Проверяем экран победы после прохождения 10 волн
    await expect(page.locator('#victory-banner')).toBeVisible();
    const finalState = await page.evaluate(() => window.getLevel3ArcadeState());
    expect(finalState.isCompleted).toBe(true);
  });

  test('Хардкор-сброс на Волну 1 при ошибке форматирования на старших волнах', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level3');

    // Переходим на Волну 5
    await page.evaluate(() => window.jumpToLevel3Wave(5));
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 5 / 10');

    // Пытаемся сдать пустой/неотформатированный документ
    await page.locator('#check-btn').click();

    // Должен произойти мгновенный хардкор-сброс на Волну 1 с выводом баннера причины
    await expect(page.locator('#hardcore-reset-banner')).toBeVisible();
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 1 / 10');
  });

  test('Контрастность текста образца (Surface-Foreground Pairing) на всех 10 волнах и защита от белого текста на белом фоне на уровне платформы', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level3');

    for (let waveNum = 1; waveNum <= 10; waveNum++) {
      await page.evaluate((w) => window.jumpToLevel3Wave(w), waveNum);
      await expect(page.locator('#wave-badge')).toContainText(`ВОЛНА ${waveNum} / 10`);

      // Проверяем контрастность блока-образца (.bg-white) и всех его дочерних текстовых узлов внутри #task-description
      const contrastReport = await verifySurfaceContrast(
        page,
        '#task-description .bg-white, #task-description .bg-white *',
        10.0 // Строгий порог: тёмный текст (#212529) на белом фоне (#ffffff) даёт ~15.4:1
      );

      expect(contrastReport.checkedCount).toBeGreaterThan(0);
      expect(
        contrastReport.violations,
        `На Волне ${waveNum} обнаружен нечитаемый текст в образце: ${JSON.stringify(contrastReport.violations, null, 2)}`
      ).toHaveLength(0);
    }

    // Проверяем платформенную защиту (CSS + MutationObserver в TaskLayout) при динамической генерации
    // элемента с белым фоном без явного указания класса text-dark внутри контейнера .text-light
    await page.evaluate(() => {
      const desc = document.getElementById('task-description');
      const dynamicBox = document.createElement('div');
      dynamicBox.id = 'dynamic-untyped-white-surface';
      dynamicBox.className = 'p-2 bg-white border border-dark';
      dynamicBox.textContent = 'Автоматически сгенерированная строка без класса text-dark';
      desc.appendChild(dynamicBox);

      const inlineWhiteBox = document.createElement('div');
      inlineWhiteBox.id = 'dynamic-inline-white-surface';
      inlineWhiteBox.setAttribute('style', 'background-color: rgb(252, 252, 252); padding: 8px;');
      inlineWhiteBox.textContent = 'Динамический блок со светлым inline-фоном';
      desc.appendChild(inlineWhiteBox);

      if (window.__enforcePlatformContrast) {
        window.__enforcePlatformContrast(desc);
      }
    });

    const dynamicContrast = await verifySurfaceContrast(
      page,
      '#dynamic-untyped-white-surface, #dynamic-inline-white-surface',
      10.0
    );
    expect(dynamicContrast.checkedCount).toBe(2);
    expect(dynamicContrast.violations).toHaveLength(0);
  });

  test('Стабильность геометрии страницы: при нажатии Пробела и наборе текста страница и рабочая область редактора не сжимаются', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level3');
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 1 / 10');

    const getDimensions = () => page.evaluate(() => ({
      bodyH: document.body.clientHeight,
      wrapperH: document.getElementById('workspace-wrapper')?.clientHeight || 0,
      workplaceH: document.querySelector('.jodit-workplace')?.clientHeight || 0,
      wysiwygH: document.querySelector('.jodit-wysiwyg')?.clientHeight || 0,
      wysiwygW: document.querySelector('.jodit-wysiwyg')?.clientWidth || 0
    }));

    const initial = await getDimensions();
    expect(initial.workplaceH).toBeGreaterThanOrEqual(1100);
    expect(initial.wysiwygW).toBeGreaterThanOrEqual(790);

    await page.locator('.jodit-wysiwyg').click();
    await page.keyboard.type('Форматирование изменяет внешний вид текста без изменения его содержания.');
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await page.waitForTimeout(150);

    const afterTyping = await getDimensions();
    expect(afterTyping.workplaceH).toBe(initial.workplaceH);
    expect(afterTyping.wrapperH).toBe(initial.wrapperH);
    expect(afterTyping.wysiwygH).toBe(initial.wysiwygH);
    expect(afterTyping.wysiwygW).toBe(initial.wysiwygW);
    expect(afterTyping.bodyH).toBe(initial.bodyH);
  });

  test('Глубокое тестирование Волны 3 (все 3 процедурных варианта и способы ввода: кнопки #btn-sup/#btn-sub при наборе, спецсимволы Ω, копирование образца, ввод е/ё, кириллических аналогов и дефиса)', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level3');

    for (let variantIdx = 0; variantIdx < 3; variantIdx++) {
      await page.evaluate((idx) => {
        window.forceLevel3Variant(idx);
        window.jumpToLevel3Wave(3);
      }, variantIdx);
      const d = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);

      // 1) Способ A: Реальный набор с клавиатуры с переключением кнопок #btn-sup и #btn-sub (проверка фильтрации \uFEFF от Jodit, е/ё, кириллицы и дефиса '-')
      await page.locator('.jodit-wysiwyg').click();

      if (d.plainCheck.includes('25 м2')) {
        await page.keyboard.type('Площадь поверхности составляет 25 м');
        await page.locator('#btn-sup').click();
        await page.keyboard.type('2');
        await page.locator('#btn-sup').click();
        await page.keyboard.type(', а формула воды - Н'); // кириллическая Н и дефис -
        await page.locator('#btn-sub').click();
        await page.keyboard.type('2');
        await page.locator('#btn-sub').click();
        await page.keyboard.type('О.'); // кириллическая О
      } else if (d.plainCheck.includes('x3')) {
        await page.keyboard.type('Объем куба равен х'); // 'е' вместо 'ё' и кириллическая 'х' вместо латинской 'x'
        await page.locator('#btn-sup').click();
        await page.keyboard.type('3');
        await page.locator('#btn-sup').click();
        await page.keyboard.type(', а основание двоичной системы - 101');
        await page.locator('#btn-sub').click();
        await page.keyboard.type('2');
        await page.locator('#btn-sub').click();
        await page.keyboard.type('.');
      } else {
        await page.keyboard.type('Ускорение равно 10 м/с');
        await page.locator('#btn-sup').click();
        await page.keyboard.type('2');
        await page.locator('#btn-sup').click();
        await page.keyboard.type(', а индекс элемента массива - А'); // кириллическая А и дефис -
        await page.locator('#btn-sub').click();
        await page.keyboard.type('1');
        await page.locator('#btn-sub').click();
        await page.keyboard.type('.');
      }

      let checks = await page.evaluate(() => window.getLevel3ArcadeState().liveChecks);
      expect(checks.every(c => c.passed), `Способ A не прошёл для варианта #${variantIdx}: ${d.displayPrompt}, checks=${JSON.stringify(checks)}`).toBe(true);

      // Нажимаем #check-btn и убеждаемся, что переход на Волну 4 происходит без ложного сброса детектором костылей
      await page.locator('#check-btn').click();
      await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 4 / 10');

      // 2) Способ B: Вставка спецсимволов ²/³ и ₁/₂ через диалоговое окно «Специальные символы» (#btn-symbol)
      await page.evaluate(() => window.jumpToLevel3Wave(3));
      await page.locator('.jodit-wysiwyg').click();
      const basePrefix = d.plainCheck.split(',')[0].slice(0, -1); // без последней цифры индекса
      await page.keyboard.type(basePrefix);
      await page.locator('#btn-symbol').click();
      await expect(page.locator('#modal-symbols')).toBeVisible();
      await page.locator(`.lo-sym-btn[data-sym="${d.supText === '3' ? '³' : '²'}"]`).click();
      await expect(page.locator('#modal-symbols')).toBeHidden();
      await page.keyboard.type(', индекс ');
      await page.locator('#btn-symbol').click();
      await expect(page.locator('#modal-symbols')).toBeVisible();
      await page.locator(`.lo-sym-btn[data-sym="${d.subText === '1' ? '₁' : '₂'}"]`).click();
      await expect(page.locator('#modal-symbols')).toBeHidden();

      checks = await page.evaluate(() => window.getLevel3ArcadeState().liveChecks);
      expect(checks.every(c => c.passed), `Способ B (через Ω) не прошёл для варианта #${variantIdx}: ${d.displayPrompt}`).toBe(true);

      // 3) Способ C: Копирование образца из блока задания в редактор
      await page.evaluate(() => window.jumpToLevel3Wave(3));
      await page.evaluate(() => {
        const sampleHtml = document.querySelector('#task-description .bg-white').innerHTML;
        const editor = document.querySelector('.jodit-wysiwyg');
        editor.innerHTML = `<p>${sampleHtml}</p>`;
        editor.dispatchEvent(new Event('input', { bubbles: true }));
      });
      checks = await page.evaluate(() => window.getLevel3ArcadeState().liveChecks);
      expect(checks.every(c => c.passed), `Способ C (копирование образца) не прошёл для варианта #${variantIdx}: ${d.displayPrompt}`).toBe(true);
    }
  });

  test('Реалистичное клавиатурно-мышечное прохождение всех 10 волн по всем 3 процедурным вариантам (30 комбинаций волн через реальный ввод текста, кнопки тулбара, спецсимволы Ω, списки и таблицы)', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/tasks/7-класс/22/level3');

    for (let variantIdx = 0; variantIdx < 3; variantIdx++) {
      await page.evaluate((idx) => {
        window.forceLevel3Variant(idx);
        window.jumpToLevel3Wave(1);
      }, variantIdx);

      // ВОЛНА 1: Реальный ввод с клавиатуры и кнопка #btn-bold
      await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 1 / 10');
      let d = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);
      await page.locator('.jodit-wysiwyg').click();
      await page.locator('#btn-bold').click();
      await page.keyboard.type(d.boldWord);
      await page.locator('#btn-bold').click();
      await page.keyboard.type(d.text.slice(d.boldWord.length));
      await page.locator('#check-btn').click();

      // ВОЛНА 2: Реальный ввод с клавиатуры + #btn-italic + #btn-underline (с заменой ё -> е)
      await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 2 / 10');
      d = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);
      await page.locator('.jodit-wysiwyg').click();
      await page.locator('#btn-italic').click();
      await page.keyboard.type(d.italicWord);
      await page.locator('#btn-italic').click();
      const midPart = d.text.slice(d.italicWord.length, d.text.indexOf(d.underlineWord)).replace(/ё/g, 'е');
      await page.keyboard.type(midPart);
      await page.locator('#btn-underline').click();
      await page.keyboard.type(d.underlineWord);
      await page.locator('#btn-underline').click();
      await page.keyboard.type(d.text.slice(d.text.indexOf(d.underlineWord) + d.underlineWord.length));
      await page.locator('#check-btn').click();

      // ВОЛНА 3: Реальный ввод с клавиатуры + #btn-sup + #btn-sub
      await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 3 / 10');
      d = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);
      await page.locator('.jodit-wysiwyg').click();
      const prefixWithoutDigit = d.plainCheck.split(',')[0].slice(0, -1).replace(/ё/g, 'е');
      await page.keyboard.type(prefixWithoutDigit);
      await page.locator('#btn-sup').click();
      await page.keyboard.type(d.supText);
      await page.locator('#btn-sup').click();
      await page.keyboard.type(', индекс ');
      await page.locator('#btn-sub').click();
      await page.keyboard.type(d.subText);
      await page.locator('#btn-sub').click();
      await page.keyboard.type('.');
      await page.locator('#check-btn').click();

      // ВОЛНА 4: Выпадающие списки #select-font, #select-fontsize и кнопка #btn-align-center + клавиатурный ввод
      await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 4 / 10');
      d = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);
      await page.locator('.jodit-wysiwyg').click();
      await page.keyboard.type(d.heading);
      await page.locator('#select-font').selectOption(d.font);
      await page.locator('#select-fontsize').selectOption(`${d.sizePt}pt`);
      await page.locator('#btn-align-center').click();
      await page.locator('#check-btn').click();

      // ВОЛНА 5: Набор текста + Liberation Serif + 14pt + #btn-align-justify
      await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 5 / 10');
      d = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);
      await page.locator('.jodit-wysiwyg').click();
      await page.keyboard.type(d.text);
      await page.locator('#select-font').selectOption('Liberation Serif');
      await page.locator('#select-fontsize').selectOption('14pt');
      await page.locator('#btn-align-justify').click();
      await page.locator('#check-btn').click();

      // ВОЛНА 6: Набор текста (с е вместо ё) + диалог Формат -> Абзац... (по умолчанию 1.0 см, 1.15, По ширине)
      await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 6 / 10');
      d = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);
      await page.locator('.jodit-wysiwyg').click();
      await page.keyboard.type(d.text.replace(/ё/g, 'е'));
      await page.locator('.lo-menu-item').filter({ hasText: /^Формат$/ }).click();
      await page.locator('#menu-format-paragraph').click();
      await expect(page.locator('#modal-paragraph')).toBeVisible();
      await page.locator('#btn-apply-paragraph').click();
      await expect(page.locator('#modal-paragraph')).toBeHidden();
      await page.locator('#check-btn').click();

      // ВОЛНА 7: Пошаговый клавиатурный набор с реальной вставкой спецсимволов через диалог Ω (#btn-symbol) и кириллической 'С'
      await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 7 / 10');
      d = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);
      await page.locator('.jodit-wysiwyg').click();
      const beforeQuote = d.text.split('«')[0];
      const insideQuote = d.quoted.slice(1, -1);
      const afterQuoteToDash = ' ';
      const afterDash = d.text.split('—')[1];
      await page.keyboard.type(beforeQuote);
      await page.locator('#btn-symbol').click();
      await page.locator('.lo-sym-btn[data-sym="«"]').click();
      await page.keyboard.type(insideQuote);
      await page.locator('#btn-symbol').click();
      await page.locator('.lo-sym-btn[data-sym="»"]').click();
      await page.keyboard.type(afterQuoteToDash);
      await page.locator('#btn-symbol').click();
      await page.locator('.lo-sym-btn[data-sym="—"]').click();
      const [partBeforeDeg1, restAfterDeg1] = afterDash.split('°C');
      const [partBetweenDeg1AndPm, partAfterPm] = restAfterDeg1.split('±');
      const [numBeforeDeg2] = partAfterPm.split('°C');
      await page.keyboard.type(partBeforeDeg1.trimEnd());
      await page.locator('#btn-symbol').click();
      await page.locator('.lo-sym-btn[data-sym="°"]').click();
      await page.keyboard.type('С' + partBetweenDeg1AndPm); // кириллическая С
      await page.locator('#btn-symbol').click();
      await page.locator('.lo-sym-btn[data-sym="±"]').click();
      await page.keyboard.type(numBeforeDeg2.trim());
      await page.locator('#btn-symbol').click();
      await page.locator('.lo-sym-btn[data-sym="°"]').click();
      await page.keyboard.type('С.');
      await page.locator('#check-btn').click();

      // ВОЛНА 8: Создание нумерованного списка через #btn-ol и #btn-bold с клавишей Enter
      await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 8 / 10');
      d = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);
      await page.locator('.jodit-wysiwyg').click();
      await page.locator('#btn-ol').click();
      for (let i = 0; i < 3; i++) {
        await page.locator('#btn-bold').click();
        await page.keyboard.type(d.items[i].bold);
        await page.locator('#btn-bold').click();
        await page.keyboard.type(' - ' + d.items[i].rest);
        if (i < 2) await page.keyboard.press('Enter');
      }
      await page.locator('#check-btn').click();

      // ВОЛНА 9: Вставка таблицы 2×2 через диалог #btn-table, заполнение ячеек и центрирование через Свойства таблицы
      await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 9 / 10');
      d = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);
      await page.locator('#btn-table').click();
      await expect(page.locator('#modal-table')).toBeVisible();
      await page.locator('#dialog-table-cols').fill('2');
      await page.locator('#dialog-table-rows').fill('2');
      await page.locator('#btn-apply-table').click();
      await expect(page.locator('#modal-table')).toBeHidden();

      const cells = page.locator('.jodit-wysiwyg th, .jodit-wysiwyg td');
      await cells.nth(0).click();
      await page.keyboard.type(d.h1);
      await cells.nth(1).click();
      await page.keyboard.type(d.h2);
      await cells.nth(2).click();
      await page.keyboard.type(d.c1);
      await cells.nth(3).click();
      await page.keyboard.type(d.c2);

      await page.locator('.lo-menu-item').filter({ hasText: /^Таблица$/ }).click();
      await page.locator('#menu-table-props').click();
      await expect(page.locator('#modal-table-props')).toBeVisible();
      await page.locator('#btn-apply-table-props').click();
      await expect(page.locator('#modal-table-props')).toBeHidden();
      await page.locator('#check-btn').click();

      // ВОЛНА 10: Финальный босс через реальный UI (Поля 2.0 см, шрифт Liberation Serif 14 пт, Абзац, Таблица 2×2)
      await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 10 / 10');
      d = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);

      await page.locator('.lo-menu-item').filter({ hasText: /^Формат$/ }).click();
      await page.locator('#menu-format-page').click();
      await page.locator('#btn-page-set-oge').click();
      await page.locator('#btn-apply-page').click();

      await page.locator('.jodit-wysiwyg').click();
      await page.locator('#btn-bold').click();
      await page.keyboard.type(d.boldWord);
      await page.locator('#btn-bold').click();
      await page.keyboard.type(d.para.slice(d.boldWord.length).replace(/ё/g, 'е'));
      await page.locator('#select-font').selectOption('Liberation Serif');
      await page.locator('#select-fontsize').selectOption('14pt');
      await page.locator('.lo-menu-item').filter({ hasText: /^Формат$/ }).click();
      await page.locator('#menu-format-paragraph').click();
      await page.locator('#btn-apply-paragraph').click();

      await page.locator('.jodit-wysiwyg').click();
      await page.keyboard.press('End');
      await page.keyboard.press('Enter');

      await page.locator('#btn-table').click();
      await page.locator('#dialog-table-cols').fill('2');
      await page.locator('#dialog-table-rows').fill('2');
      await page.locator('#btn-apply-table').click();

      const w10Cells = page.locator('.jodit-wysiwyg th, .jodit-wysiwyg td');
      await w10Cells.nth(0).click();
      await page.keyboard.type(d.h1);
      await w10Cells.nth(1).click();
      await page.keyboard.type(d.h2.replace(/ё/g, 'е'));
      await w10Cells.nth(2).click();
      await page.keyboard.type(d.c1);
      await w10Cells.nth(3).click();
      await page.keyboard.type(d.c2);

      await page.locator('.lo-menu-item').filter({ hasText: /^Таблица$/ }).click();
      await page.locator('#menu-table-props').click();
      await page.locator('#btn-apply-table-props').click();

      await page.locator('#check-btn').click();
      await expect(page.locator('#victory-banner')).toBeVisible();
    }
  });

});


