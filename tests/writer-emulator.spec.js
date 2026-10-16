import { test, expect } from '@playwright/test';

test.describe('LibreOffice Writer Emulator Suite', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level1');
    const taskDescription = page.locator('#task-description');
    await expect(taskDescription).toBeVisible();
    await expect(taskDescription).not.toContainText('Загрузка');
  });

  test('Внешний вид: Заголовок, Меню и две панели инструментов LibreOffice Colibre', async ({ page }) => {
    // 1. Заголовок
    await expect(page.locator('text=Без имени 1 — LibreOffice Writer')).toBeVisible();
    await expect(page.locator('#check-btn')).toBeVisible();

    // 2. Главное меню
    const menuItems = ['Файл', 'Правка', 'Вид', 'Вставка', 'Формат', 'Таблица', 'Сервис', 'Справка'];
    for (const item of menuItems) {
      await expect(page.locator('.lo-menu-item').filter({ hasText: new RegExp(`^${item}$`) })).toBeVisible();
    }

    // 3. Панель 1 (Стандартная)
    const stdButtons = ['#btn-new', '#btn-open', '#btn-save', '#btn-pdf', '#btn-print', '#btn-cut', '#btn-copy', '#btn-paste', '#btn-undo', '#btn-redo', '#btn-find', '#btn-nonprinting', '#btn-table', '#btn-symbol'];
    for (const btnId of stdButtons) {
      await expect(page.locator(btnId)).toBeVisible();
    }

    // 4. Панель 2 (Форматирование)
    await expect(page.locator('#select-style')).toBeVisible();
    await expect(page.locator('#select-font')).toBeVisible();
    await expect(page.locator('#select-fontsize')).toBeVisible();
    const fmtButtons = ['#btn-bold', '#btn-italic', '#btn-underline', '#btn-strikethrough', '#btn-sup', '#btn-sub', '#btn-eraser', '#btn-align-left', '#btn-align-center', '#btn-align-right', '#btn-align-justify', '#btn-ul', '#btn-ol', '#btn-outdent', '#btn-indent', '#btn-linespacing', '#btn-paraspace'];
    for (const btnId of fmtButtons) {
      await expect(page.locator(btnId)).toBeVisible();
    }

    // 5. Горизонтальная линейка
    await expect(page.locator('#lo-ruler')).toBeVisible();
    await expect(page.locator('#ruler-first-line')).toBeVisible();
  });

  test('Диалог «Абзац...»: настройка красной строки (1.0 см) и межстрочного интервала', async ({ page }) => {
    // Вводим тестовый абзац
    await page.evaluate(() => {
      // @ts-ignore
      document.querySelector('.jodit-wysiwyg').innerHTML = '<p id="test-para">Второй закон Ньютона устанавливает связь между силой и ускорением.</p>';
      document.querySelector('.jodit-wysiwyg').dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Открываем меню Формат -> Абзац...
    await page.locator('.lo-menu-item').filter({ hasText: /^Формат$/ }).click();
    await page.locator('#menu-format-paragraph').click();

    // Проверяем модалку
    const modal = page.locator('#modal-paragraph');
    await expect(modal).toBeVisible();

    // Задаем параметры абзаца по ОГЭ: первая строка 1.0 см, межстрочный 1.15, выравнивание по ширине
    await page.locator('#dialog-para-firstline').fill('1.0');
    await page.locator('#dialog-para-lineheight').selectOption('1.15');
    await page.locator('#align-radio-justify').check();

    // Нажимаем ОК
    await page.locator('#btn-apply-paragraph').click();
    await expect(modal).toBeHidden();

    // Проверяем примененные стили к абзацу
    const paraStyle = await page.evaluate(() => {
      const p = document.getElementById('test-para');
      return {
        textIndent: p?.style.textIndent,
        lineHeight: p?.style.lineHeight,
        textAlign: p?.style.textAlign
      };
    });

    expect(paraStyle.textIndent).toBe('1cm');
    expect(paraStyle.lineHeight).toBe('1.15');
    expect(paraStyle.textAlign).toBe('justify');
  });

  test('Вставка таблицы и специальных символов (ОГЭ 13.2)', async ({ page }) => {
    // 1. Вставка специальных символов
    await page.locator('#btn-symbol').click();
    const modalSym = page.locator('#modal-symbols');
    await expect(modalSym).toBeVisible();
    
    // Клик по символу градуса (°)
    await page.locator('#sym-degree').click();
    await expect(modalSym).toBeHidden();

    let html = await page.evaluate(() => document.querySelector('.jodit-wysiwyg')?.innerHTML || '');
    expect(html).toContain('°');

    // 2. Вставка таблицы
    await page.locator('#btn-table').click();
    const modalTable = page.locator('#modal-table');
    await expect(modalTable).toBeVisible();

    await page.locator('#dialog-table-cols').fill('3');
    await page.locator('#dialog-table-rows').fill('3');
    await page.locator('#btn-apply-table').click();
    await expect(modalTable).toBeHidden();

    html = await page.evaluate(() => document.querySelector('.jodit-wysiwyg')?.innerHTML || '');
    expect(html).toContain('<table');
    expect(html).toContain('<th');
    expect(html).toContain('<td');
  });

  test('Переключение непечатаемых знаков (¶) и масштабирование (Zoom)', async ({ page }) => {
    // Непечатаемые знаки
    const btnNonPrinting = page.locator('#btn-nonprinting');
    await btnNonPrinting.click();
    await expect(page.locator('#workspace-wrapper')).toHaveClass(/lo-show-nonprinting/);
    await expect(btnNonPrinting).toHaveClass(/active/);

    // Выключаем обратно
    await btnNonPrinting.click();
    await expect(page.locator('#workspace-wrapper')).not.toHaveClass(/lo-show-nonprinting/);
    await expect(btnNonPrinting).not.toHaveClass(/active/);

    // Зум
    const zoomVal = page.locator('#zoom-val');
    await expect(zoomVal).toHaveText('100%');

    await page.locator('#zoom-in').click();
    await expect(zoomVal).toHaveText('110%');

    const scale = await page.evaluate(() => {
      // @ts-ignore
      return document.querySelector('.jodit-wysiwyg')?.style.transform;
    });
    expect(scale).toContain('scale(1.1)');
  });

  test('Подсчет статистики слов и символов в статус-баре', async ({ page }) => {
    await page.evaluate(() => {
      // @ts-ignore
      document.querySelector('.jodit-wysiwyg').innerHTML = '<p>Привет мир информатики</p>';
      document.querySelector('.jodit-wysiwyg').dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Ожидаем обновления статус-бара
    await page.waitForTimeout(300);
    const wordsStatus = page.locator('#statusbar-words');
    await expect(wordsStatus).toContainText('3 слов');
    await expect(wordsStatus).toContainText('20 символов');
  });

  test('Режим по умолчанию: сброс параметров в сырое состояние (Liberation Sans, 11pt, поля 1.0 см)', async ({ page }) => {
    // Проверяем значения селекторов на панели
    const fontSelect = page.locator('#select-font');
    const sizeSelect = page.locator('#select-fontsize');
    await expect(fontSelect).toHaveValue('Liberation Sans');
    await expect(sizeSelect).toHaveValue('11pt');

    // Проверяем поля листа (padding wysiwyg: 1.0 см ~ 40px)
    const paddingLeft = await page.evaluate(() => {
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      return wysiwyg ? window.getComputedStyle(wysiwyg).paddingLeft : null;
    });
    expect(paddingLeft).toBe('40px');

    // Проверяем линейку (левое поле 40px)
    const rulerBoxWidth = await page.evaluate(() => {
      const box = document.getElementById('ruler-left-margin-box');
      return box ? box.style.width : null;
    });
    expect(rulerBoxWidth).toBe('40px');
  });

  test('Детектор костылей ОГЭ: отступ пробелами и дефис блокируют проверку с выводом протокола', async ({ page }) => {
    // Вводим текст с типичными ошибками-костылями (отступ пробелами, дефис вместо тире, прямые кавычки)
    await page.evaluate(() => {
      // @ts-ignore
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      wysiwyg.innerHTML = '<p>&nbsp;&nbsp;&nbsp;&nbsp;Флеш-память - тип твердотельной "энергонезависимой" памяти.</p>';
      wysiwyg.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Нажимаем ПРОВЕРИТЬ ДОКУМЕНТ
    await page.locator('#check-btn').click();

    // Проверяем появление модального окна протокола проверки ОГЭ 13.2
    const modalOge = page.locator('#modal-oge-report');
    await expect(modalOge).toBeVisible();

    // Проверяем статусбар и бейдж (0 / 2 баллов)
    await expect(page.locator('#oge-modal-badge')).toContainText('0 / 2 баллов');
    await expect(page.locator('#writer-status')).toContainText('Ошибка ОГЭ 13.2');

    // Проверяем, что костыли обнаружены и описаны
    const reportItems = page.locator('#oge-report-items');
    await expect(reportItems).toContainText('Красная строка пробелами');
    await expect(reportItems).toContainText('Дефис вместо тире');
    await expect(reportItems).toContainText('Прямые кавычки вместо кавычек-ёлочек');
  });

  test('Диалог «Параметры страницы...»: настройка стандартных полей ОГЭ (2.0 см)', async ({ page }) => {
    // Открываем меню Формат -> Страница...
    await page.locator('.lo-menu-item').filter({ hasText: /^Формат$/ }).click();
    await page.locator('#menu-format-page').click();

    const modalPage = page.locator('#modal-page');
    await expect(modalPage).toBeVisible();

    // Нажимаем кнопку быстрой установки стандарта ОГЭ (2.0 см)
    await page.locator('#btn-page-set-oge').click();
    await expect(page.locator('#dialog-page-left')).toHaveValue('2.0');
    await expect(page.locator('#dialog-page-right')).toHaveValue('2.0');

    // Нажимаем ОК
    await page.locator('#btn-apply-page').click();
    await expect(modalPage).toBeHidden();

    // Проверяем изменение padding на листе (~76px / 80px)
    const paddingLeft = await page.evaluate(() => {
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      return wysiwyg ? wysiwyg.style.paddingLeft : null;
    });
    expect(paddingLeft).toBe('80px');
  });

  test('Диалог «Свойства таблицы...»: выравнивание таблицы по центру и шапки', async ({ page }) => {
    // Вставляем таблицу
    await page.evaluate(() => {
      // @ts-ignore
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      wysiwyg.innerHTML = '<table><thead><tr><th>Характеристика</th><th>Значение</th></tr></thead><tbody><tr><td>Частота</td><td>3.5 ГГц</td></tr></tbody></table>';
      wysiwyg.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Открываем Таблица -> Свойства таблицы...
    await page.locator('.lo-menu-item').filter({ hasText: /^Таблица$/ }).click();
    await page.locator('#menu-table-props').click();

    const modalProps = page.locator('#modal-table-props');
    await expect(modalProps).toBeVisible();

    // Выбираем: выравнивание по центру, шапка по центру, 14пт
    await page.locator('#dialog-table-align').selectOption('center');
    await page.locator('#dialog-table-header-align').selectOption('center');
    await page.locator('#dialog-table-font-size').selectOption('14pt');

    await page.locator('#btn-apply-table-props').click();
    await expect(modalProps).toBeHidden();

    // Проверяем стили таблицы
    const tableStyles = await page.evaluate(() => {
      const tbl = document.querySelector('table');
      const th = document.querySelector('th');
      return {
        marginLeft: tbl?.style.marginLeft,
        marginRight: tbl?.style.marginRight,
        thAlign: th?.style.textAlign,
        thWeight: th?.style.fontWeight
      };
    });

    expect(tableStyles.marginLeft).toBe('auto');
    expect(tableStyles.marginRight).toBe('auto');
    expect(tableStyles.thAlign).toBe('center');
    expect(tableStyles.thWeight).toBe('bold');
  });

  test('Клик по линейке устанавливает красную строку 1.0 см', async ({ page }) => {
    await page.evaluate(() => {
      // @ts-ignore
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      wysiwyg.innerHTML = '<p id="para-ruler">Первый абзац без отступа.</p>';
      wysiwyg.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Принимаем нативный dialog
    page.on('dialog', dialog => dialog.accept());

    // Кликаем по маркеру первой строки на линейке
    await page.locator('#ruler-first-line').click();

    const indent = await page.evaluate(() => {
      const p = document.getElementById('para-ruler');
      return p?.style.textIndent;
    });
    expect(indent).toMatch(/^1(\.0)?cm$/);
  });

});
