import { test, expect } from '@playwright/test';

test.describe('7 класс - Урок 22 - Уровень 3 (Аркада в LibreOffice Writer: 10 волн)', () => {

  test('Отслеживание действий ученика в реальном времени (actionLog, панель инструментов, диалоги и живой чек-лист)', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level3');
    await expect(page.locator('#wave-badge')).toContainText('ВОЛНА 1 / 10');

    // Получаем данные Волны 1
    const wave1Data = await page.evaluate(() => window.getLevel3ArcadeState().activeWaveData);
    expect(wave1Data).toBeDefined();

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

});
