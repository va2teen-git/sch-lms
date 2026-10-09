import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('7 класс - Урок 22', () => {

  test('Успешное форматирование текста (3 фазы)', async ({ page }) => {
    // В данном случае мы можем тестировать сам iframe / саму страницу напрямую, так как мы разрабатывали только ее
    await page.goto('http://localhost:4321/tasks/7-класс/22/level1');
    
    for (let phase = 1; phase <= 3; phase++) {
      // Ждем загрузки задачи
      const taskDescription = page.locator('#task-description');
      await expect(taskDescription).toBeVisible();
      
      const text = await taskDescription.innerText();
      // Пример текста: "Напишите предложение, содержащее слово Процессор, и выделите это слово жирным шрифтом."
      const wordMatch = text.match(/слово\s+([А-Яа-яA-Za-z]+),/);
      const actionMatch = text.match(/выделите это слово\s+([А-Яа-яA-Za-z]+)\s+шрифтом/);
      
      const targetWord = wordMatch ? wordMatch[1] : 'Процессор';
      const action = actionMatch ? actionMatch[1] : 'жирным';
      
      // Взаимодействуем с Jodit editor
      const editor = page.locator('.jodit-wysiwyg');
      if (phase === 1) await editor.click();
      
      let html = `Вот мой ${targetWord} и он работает фаза ${phase}`;
      if (action === 'жирным') html = `Вот мой <strong>${targetWord}</strong> и он работает фаза ${phase}`;
      else if (action === 'курсивом') html = `Вот мой <em>${targetWord}</em> и он работает фаза ${phase}`;
      else if (action === 'подчеркнутым') html = `Вот мой <u>${targetWord}</u> и он работает фаза ${phase}`;
      
      // Устанавливаем HTML напрямую через evaluate
      await page.evaluate((htmlContent) => {
        // @ts-ignore
        document.querySelector('.jodit-wysiwyg').innerHTML = htmlContent;
        // вызываем событие input чтобы Jodit обновил свой внутренний стейт если нужно
        document.querySelector('.jodit-wysiwyg').dispatchEvent(new Event('input', { bubbles: true }));
      }, html);

      if (phase === 3) {
        await page.screenshot({ path: 'dev_scripts/scr_7_22_before_check.png' });
      }
      
      // Нажимаем кнопку ПРОВЕРИТЬ ДОКУМЕНТ
      await page.locator('#check-btn').click();
      
      // Проверяем статус
      const status = page.locator('#writer-status');
      if (phase < 3) {
        await expect(status).toContainText(`Фаза ${phase} пройдена!`);
        // Ожидаем очистки статуса и генерации нового задания (1500мс в коде, подождем 2 сек)
        await page.waitForTimeout(2000);
      } else {
        await expect(status).toContainText('Отлично! Уровень полностью пройден.');
      }
    }

    // Скриншот после
    await page.screenshot({ path: 'dev_scripts/scr_7_22_after_check.png' });
  });

  test('Обработка ошибок в хардкор-режиме', async ({ page }) => {
    // Переход на страницу и включение хардкора
    await page.goto('http://localhost:4321/tasks/7-класс/22/level1');
    await page.evaluate(() => { localStorage.setItem('hardcore_mode', 'true'); });
    await page.reload();
    
    // Запоминаем текущее задание
    const taskDescription = page.locator('#task-description');
    await expect(taskDescription).toBeVisible();
    const originalText = await taskDescription.innerText();
    
    // Ошибаемся (отправляем пустой текст)
    const checkBtn = page.locator('#check-btn');
    await checkBtn.click();
    
    // В Astro/iframe платформы обычно перехватывается alert или dialog, но у нас локальная страница,
    // если не отправляется alert, то просто проверим, что текст задания изменился (процедурная генерация сработала)
    // Ждем полторы секунды (в коде setTimeout на 1500)
    await page.waitForTimeout(2000);
    
    const newText = await taskDescription.innerText();
    expect(newText).not.toEqual(originalText);
    
    // Проверка БД на запись hardcore_reset
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'hardcore_reset' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
  });
});
