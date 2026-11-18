import { test, expect } from '@playwright/test';

test.describe('7 класс - Урок 22 - Уровень 2 (Инженерная вёрстка в LibreOffice Writer: 5 этапов)', () => {

  test('Полное прохождение всех 5 этапов реконструкции, автозамены, научного набора, слияния ячеек и сдачи ОГЭ 13.2', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto('/tasks/7-класс/22/level2');
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');
    await expect(page.locator('.jodit-wysiwyg')).toBeVisible();

    // === ЭТАП 1: Ликвидация костылей + красная строка 1.0 см + по ширине ===
    await page.evaluate(() => {
      const w = document.querySelector('.jodit-wysiwyg');
      const ps = Array.from(w.querySelectorAll('p')).filter(p => p.textContent.trim().length > 0);
      w.innerHTML = ps.map(p => {
        const clean = p.textContent
          .replace(/^\s+/, '')
          .replace(/"([^"]+)"/g, '«$1»')
          .replace(/\s+-\s+/g, ' — ');
        return `<p>${clean}</p>`;
      }).join('');
    });
    await page.locator('.lo-menu-item').filter({ hasText: /^Формат$/ }).click();
    await page.locator('#menu-format-paragraph').click();
    await page.locator('#dialog-para-firstline').fill('1.0');
    await page.locator('#align-radio-justify').check();
    await page.locator('#btn-apply-paragraph').click();
    // Применяем ко всем абзацам документа
    await page.evaluate(() => {
      document.querySelectorAll('.jodit-wysiwyg p').forEach(p => {
        p.style.textIndent = '1.0cm';
        p.style.textAlign = 'justify';
      });
    });
    await page.locator('#check-btn').click();

    // === ЭТАП 2: Найти и заменить (Ctrl+H) + интервал после абзаца (в см/пт) ===
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');
    const st2 = await page.evaluate(() => window.getLevel2WriterState());
    await page.locator('#btn-find').click();
    await expect(page.locator('#modal-find-replace')).toBeVisible();
    await page.locator('#dialog-find-query').fill(st2.activeData.badWord);
    await page.locator('#dialog-find-replace-val').fill(st2.activeData.goodWord);
    await page.locator('#btn-apply-replace-all').click();
    await page.locator('#modal-find-replace .btn-close').click();

    await page.locator('.lo-menu-item').filter({ hasText: /^Формат$/ }).click();
    await page.locator('#menu-format-paragraph').click();
    await page.locator('#dialog-para-firstline').fill('1.0');
    await page.locator('#dialog-para-bottom-unit').selectOption('cm');
    await page.locator('#dialog-para-bottom').fill('0.5');
    await page.locator('#align-radio-justify').check();
    await page.locator('#btn-apply-paragraph').click();
    await page.evaluate(() => {
      document.querySelectorAll('.jodit-wysiwyg p').forEach(p => {
        p.style.textIndent = '1.0cm';
        p.style.textAlign = 'justify';
      });
    });
    await page.locator('#check-btn').click();

    // === ЭТАП 3: Научный набор шрифтом Liberation Serif 14 пт с индексами ===
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 5');
    const st3 = await page.evaluate(() => window.getLevel2WriterState());
    await page.evaluate((html) => {
      const w = document.querySelector('.jodit-wysiwyg');
      w.innerHTML = `<p style="font-family: 'Liberation Serif', serif; font-size: 14pt;">${html}</p>`;
      w.dispatchEvent(new Event('input', { bubbles: true }));
    }, st3.activeData.sampleHtml);
    await page.locator('#check-btn').click();

    // === ЭТАП 4: Объединение ячеек шапки + данные + центрирование + valign middle ===
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 4 из 5');
    const st4 = await page.evaluate(() => window.getLevel2WriterState());
    const d4 = st4.activeData;
    await page.locator('.jodit-wysiwyg th').first().click();
    await page.locator('#btn-tbl-merge').click();
    await page.evaluate((data) => {
      const tbl = document.querySelector('.jodit-wysiwyg table');
      const ths = tbl.querySelectorAll('th');
      ths[0].innerText = data.mergedHeader;
      ths[1].innerText = data.col3Header;
      const tds = tbl.querySelectorAll('td');
      tds[0].innerText = data.c1;
      tds[1].innerText = data.c2;
      tds[2].innerText = data.c3;
    }, d4);
    await page.locator('.lo-menu-item').filter({ hasText: /^Таблица$/ }).click();
    await page.locator('#menu-table-props').click();
    await page.locator('#dialog-table-align').selectOption('center');
    await page.locator('#dialog-table-valign').selectOption('middle');
    await page.locator('#btn-apply-table-props').click();
    await page.locator('#check-btn').click();

    // === ЭТАП 5: Полная сдача ОГЭ 13.2 на 2/2 баллов ===
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 5 из 5');
    const st5 = await page.evaluate(() => window.getLevel2WriterState());
    const d5 = st5.activeData;
    await page.locator('.lo-menu-item').filter({ hasText: /^Формат$/ }).click();
    await page.locator('#menu-format-page').click();
    await page.locator('#btn-page-set-oge').click();
    await page.locator('#btn-apply-page').click();

    await page.evaluate((data) => {
      const w = document.querySelector('.jodit-wysiwyg');
      const rest = data.paraText.slice(data.boldWord.length);
      w.innerHTML = `<p style="font-family:'Liberation Serif', serif; font-size:14pt; text-indent:1.0cm; line-height:1.15; text-align:justify;"><b>${data.boldWord}</b>${rest}</p>` +
        `<table style="width:85%; margin-left:auto; margin-right:auto; border-collapse:collapse;"><thead><tr><th style="text-align:center; font-weight:bold; font-size:14pt;">${data.h1}</th><th style="text-align:center; font-weight:bold; font-size:14pt;">${data.h2}</th></tr></thead><tbody><tr><td style="font-size:14pt;">${data.c1}</td><td style="font-size:14pt;">${data.c2}</td></tr></tbody></table>`;
      w.dispatchEvent(new Event('input', { bubbles: true }));
    }, d5);

    await page.locator('#check-btn').click();
    await expect(page.locator('#success-screen')).toBeVisible();
  });

  test('Реакция на неверный ввод и учёт ошибок (Hardcore Feedback)', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level2');
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');

    await page.locator('#check-btn').click();
    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');
  });

});
