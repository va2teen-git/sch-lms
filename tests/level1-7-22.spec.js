import { test, expect } from '@playwright/test';

test.describe('7 класс - Урок 22 - Уровень 1 (Интерактивный практикум в LibreOffice Writer: 3 этапа)', () => {

  test('Полное прохождение всех 3 этапов в интерактивном редакторе LibreOffice Writer', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level1');
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');
    await expect(page.locator('.jodit-wysiwyg')).toBeVisible();

    // === ЭТАП 1: Форматирование символов (гарнитура, кегль, Ж/К/Ч, верхний и нижний индексы) ===
    const st1 = await page.evaluate(() => window.getLevel1WriterState());
    const d1 = st1.activeData;
    expect(d1).toBeTruthy();

    await page.locator('#select-font').selectOption(d1.font);
    await page.locator('#select-fontsize').selectOption(`${d1.sizePt}pt`);

    // Применяем начертания и индексы через реальные кнопки тулбара
    await page.evaluate((data) => {
      const selectStr = (substr) => {
        const w = document.querySelector('.jodit-wysiwyg');
        const walker = document.createTreeWalker(w, NodeFilter.SHOW_TEXT);
        let n;
        while ((n = walker.nextNode())) {
          const i = n.textContent.indexOf(substr);
          if (i !== -1) {
            const r = document.createRange();
            r.setStart(n, i);
            r.setEnd(n, i + substr.length);
            const s = window.getSelection();
            s.removeAllRanges();
            s.addRange(r);
            return true;
          }
        }
        return false;
      };
      window.__selectWord = selectStr;
    }, d1);

    await page.evaluate((w) => window.__selectWord(w), d1.boldWord);
    await page.locator('#btn-bold').click();

    await page.evaluate((w) => window.__selectWord(w), d1.italicWord);
    await page.locator('#btn-italic').click();

    await page.evaluate((w) => window.__selectWord(w), d1.underlineWord);
    await page.locator('#btn-underline').click();

    // Выделяем цифру степени и цифру формулы
    await page.evaluate((data) => {
      const w = document.querySelector('.jodit-wysiwyg');
      // Находим индексную цифру после 'м' или 'mv' (м3/м2/mv2), обходя все текстовые узлы
      const walker = document.createTreeWalker(w, NodeFilter.SHOW_TEXT);
      let tNode = null;
      let supIdx = -1;
      let cur;
      while ((cur = walker.nextNode())) {
        if (cur.parentElement && cur.parentElement.closest('sup, sub')) continue;
        const m = cur.textContent.match(/(?:м|mv)(\d)/i);
        if (m && m[1] === String(data.supDigit)) {
          tNode = cur;
          supIdx = m.index + m[0].length - 1;
          break;
        }
      }
      if (!tNode || supIdx === -1) {
        throw new Error(`Could not find supDigit ${data.supDigit} in text nodes: ${w.textContent}`);
      }
      const r1 = document.createRange();
      r1.setStart(tNode, supIdx);
      r1.setEnd(tNode, supIdx + 1);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r1);
    }, d1);
    await page.locator('#btn-sup').click();

    await page.evaluate((data) => {
      const w = document.querySelector('.jodit-wysiwyg');
      const walker = document.createTreeWalker(w, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        if (n.parentElement?.closest('sup')) continue;
        const m = n.textContent.match(/(?:H|CO|O)(\d)/);
        if (m) {
          const pos = n.textContent.indexOf(m[0]) + m[0].length - 1;
          const r2 = document.createRange();
          r2.setStart(n, pos);
          r2.setEnd(n, pos + 1);
          const s = window.getSelection();
          s.removeAllRanges();
          s.addRange(r2);
          break;
        }
      }
    }, d1);
    await page.locator('#btn-sub').click();

    await page.locator('#check-btn').click();

    // === ЭТАП 2: Поля страницы 2.0 см, красная строка 1.0 см, выравнивание По ширине и интервал ===
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
    const st2 = await page.evaluate(() => window.getLevel1WriterState());
    const d2 = st2.activeData;

    await page.locator('.lo-menu-item').filter({ hasText: /^Формат$/ }).click();
    await page.locator('#menu-format-page').click();
    await page.locator('#btn-page-set-oge').click();
    await page.locator('#btn-apply-page').click();

    await page.locator('.lo-menu-item').filter({ hasText: /^Формат$/ }).click();
    await page.locator('#menu-format-paragraph').click();
    await page.locator('#dialog-para-firstline').fill('1.0');
    await page.locator('#dialog-para-lineheight').selectOption(d2.lineHeight);
    await page.locator('#align-radio-justify').check();
    await page.locator('#btn-apply-paragraph').click();

    await page.locator('#check-btn').click();

    // === ЭТАП 3: Таблица по центру, шапка по центру и полужирная, вертикальное выравнивание middle ===
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');

    await page.locator('.jodit-wysiwyg td').first().click();
    await page.locator('#btn-tbl-sel-table').click();
    await page.locator('#btn-tbl-valign-middle').click();

    await page.locator('.lo-menu-item').filter({ hasText: /^Таблица$/ }).click();
    await page.locator('#menu-table-props').click();
    await page.locator('#dialog-table-align').selectOption('center');
    await page.locator('#dialog-table-header-align').selectOption('center');
    await page.locator('#dialog-table-header-bold').check();
    await page.locator('#dialog-table-valign').selectOption('middle');
    await page.locator('#btn-apply-table-props').click();

    await page.locator('#check-btn').click();
    await expect(page.locator('#success-screen')).toBeVisible();
  });

  test('Обработка ошибки при неполном оформлении на Этапе 1', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level1');
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    // Жмём проверку без выполнения требований
    await page.locator('#check-btn').click();
    await expect(page.locator('#error-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');
  });

});
