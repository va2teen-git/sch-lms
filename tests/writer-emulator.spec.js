import { test, expect } from '@playwright/test';

test.describe('LibreOffice Writer Emulator Suite', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level3');
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
    // Включаем валидацию ОГЭ
    await page.evaluate(() => {
      // @ts-ignore
      if (window.setWriterOgeCheck) window.setWriterOgeCheck(true);
    });

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

  test('Issue #514: Управляемый ввод формулы H2O (посимвольный набор H -> sub -> 2 -> sub -> O)', async ({ page }) => {
    const editor = page.locator('.jodit-wysiwyg');
    await editor.click();
    
    // Очищаем и ставим курсор
    await page.evaluate(() => {
      // @ts-ignore
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      wysiwyg.innerHTML = '<p></p>';
      const p = wysiwyg.querySelector('p');
      const r = document.createRange();
      r.setStart(p, 0);
      r.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    });

    const btnSub = page.locator('#btn-sub');

    // 1. Вводим букву H
    await page.keyboard.type('H');
    await expect(btnSub).not.toHaveClass(/active/);

    // 2. Включаем нижний индекс
    await btnSub.click();
    await expect(btnSub).toHaveClass(/active/);

    // 3. Вводим индексную цифру 2
    await page.keyboard.type('2');
    await expect(btnSub).toHaveClass(/active/);

    // 4. Выключаем нижний индекс повторным кликом
    await btnSub.click();
    await expect(btnSub).not.toHaveClass(/active/);

    // 5. Вводим букву O базового начертания
    await page.keyboard.type('O');
    await expect(btnSub).not.toHaveClass(/active/);

    // Проверяем структуру DOM: буква O не должна оказаться внутри <sub>!
    const domCheck = await page.evaluate(() => {
      // @ts-ignore
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      const sub = wysiwyg.querySelector('sub');
      const cleanHtml = wysiwyg.innerHTML.replace(/[\uFEFF\u200B\u200C\u200D]/g, '');
      const subText = sub ? sub.textContent.replace(/[\uFEFF\u200B\u200C\u200D]/g, '') : null;
      return {
        cleanHtml,
        subFound: !!sub,
        subText,
        hasSub2: subText === '2',
        fullText: wysiwyg.textContent.replace(/[\uFEFF\u200B\u200C\u200D]/g, '').trim()
      };
    });

    expect(domCheck.subFound).toBe(true);
    expect(domCheck.subText).toBe('2');
    expect(domCheck.cleanHtml).toContain('<sub>2</sub>');
    expect(domCheck.cleanHtml).not.toContain('<sub>2O</sub>');
    expect(domCheck.cleanHtml).not.toContain('<sub>2o</sub>');
    expect(domCheck.fullText).toBe('H2O');
  });

  test('Issue #514: Управляемый ввод надстрочного индекса (x -> sup -> 2 -> sup -> + -> y)', async ({ page }) => {
    const editor = page.locator('.jodit-wysiwyg');
    await editor.click();

    await page.evaluate(() => {
      // @ts-ignore
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      wysiwyg.innerHTML = '<p></p>';
      const p = wysiwyg.querySelector('p');
      const r = document.createRange();
      r.setStart(p, 0);
      r.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    });

    const btnSup = page.locator('#btn-sup');

    await page.keyboard.type('x');
    await expect(btnSup).not.toHaveClass(/active/);

    await btnSup.click();
    await expect(btnSup).toHaveClass(/active/);

    await page.keyboard.type('2');
    await expect(btnSup).toHaveClass(/active/);

    await btnSup.click();
    await expect(btnSup).not.toHaveClass(/active/);

    await page.keyboard.type('+y');

    const domCheck = await page.evaluate(() => {
      // @ts-ignore
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      const sup = wysiwyg.querySelector('sup');
      const cleanHtml = wysiwyg.innerHTML.replace(/[\uFEFF\u200B\u200C\u200D]/g, '');
      const supText = sup ? sup.textContent.replace(/[\uFEFF\u200B\u200C\u200D]/g, '') : null;
      return {
        supFound: !!sup,
        supText,
        cleanHtml,
        fullText: wysiwyg.textContent.replace(/[\uFEFF\u200B\u200C\u200D]/g, '').trim()
      };
    });

    expect(domCheck.supFound).toBe(true);
    expect(domCheck.supText).toBe('2');
    expect(domCheck.cleanHtml).toContain('<sup>2</sup>');
    expect(domCheck.cleanHtml).not.toContain('<sup>2+</sup>');
    expect(domCheck.fullText).toBe('x2+y');
  });

  test('Issue #514: Инспекция кнопок тулбара (выравнивание, списки и шрифтовые кнопки при навигации)', async ({ page }) => {
    const editor = page.locator('.jodit-wysiwyg');
    await editor.click();

    // 1. По умолчанию для базового абзаца активно только левое выравнивание
    await expect(page.locator('#btn-align-left')).toHaveClass(/active/);
    await expect(page.locator('#btn-align-center')).not.toHaveClass(/active/);
    await expect(page.locator('#btn-align-right')).not.toHaveClass(/active/);
    await expect(page.locator('#btn-align-justify')).not.toHaveClass(/active/);

    // 2. Клик по центру: активно ровно центральное выравнивание
    await page.locator('#btn-align-center').click();
    await expect(page.locator('#btn-align-center')).toHaveClass(/active/);
    await expect(page.locator('#btn-align-left')).not.toHaveClass(/active/);
    await expect(page.locator('#btn-align-right')).not.toHaveClass(/active/);

    // 3. Проверка кнопок списков ul/ol
    await page.locator('#btn-ul').click();
    await expect(page.locator('#btn-ul')).toHaveClass(/active/);
    await expect(page.locator('#btn-ol')).not.toHaveClass(/active/);

    // 4. Проверка инспекции жирного начертания при навигации курсором
    await page.evaluate(() => {
      // @ts-ignore
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      wysiwyg.innerHTML = '<p id="p-bold">Обычный <b>жирный</b> текст</p>';
      const b = wysiwyg.querySelector('b');
      const r = document.createRange();
      r.setStart(b.firstChild, 2); // курсор внутри слова "жирный"
      r.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      document.dispatchEvent(new Event('selectionchange'));
    });

    await expect(page.locator('#btn-bold')).toHaveClass(/active/);

    // Перемещаем курсор в обычный текст
    await page.evaluate(() => {
      // @ts-ignore
      const wysiwyg = document.querySelector('.jodit-wysiwyg');
      const p = document.getElementById('p-bold');
      const r = document.createRange();
      r.setStart(p.lastChild, 2); // внутри слова "текст"
      r.collapse(true);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
      document.dispatchEvent(new Event('selectionchange'));
    });

    await expect(page.locator('#btn-bold')).not.toHaveClass(/active/);
  });

});
