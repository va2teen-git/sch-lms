import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('Архивация данных (Уровень 2)', () => {

  test('Успешное прохождение уровня', async ({ page }) => {
    await page.goto('http://localhost:4321/lesson/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/5');
    
    // Принудительно показываем iframe-2 для теста
    await page.evaluate(() => {
      document.getElementById('iframe-1').classList.remove('block');
      document.getElementById('iframe-1').classList.add('hidden');
      const iframe2 = document.getElementById('iframe-2');
      iframe2.classList.remove('hidden');
      iframe2.classList.add('block');
      iframe2.style.height = '800px';
      iframe2.style.width = '1000px';
    });

    const frame = page.frameLocator('#iframe-2');
    
    // В уровне 2 у нас 5 фаз. Нужно пропарсить текст задания и заполнить инпуты
    for (let phase = 1; phase <= 5; phase++) {
      await expect(frame.locator('#current-phase')).toHaveText(phase.toString());
      
      const taskText = await frame.locator('#task-description').innerHTML();
      
      // Парсим имя архива
      const nameMatch = taskText.match(/именем <strong>(.*?)<\/strong>/);
      const name = nameMatch ? nameMatch[1] : '';
      
      // Парсим формат
      const formatMatch = taskText.match(/формат сжатия <strong>(.*?)<\/strong>/);
      const format = formatMatch ? formatMatch[1] : '';
      
      // Парсим пароль
      const pwdMatch = taskText.match(/защиты: <strong>(.*?)<\/strong>/);
      const pwd = pwdMatch ? pwdMatch[1] : '';
      
      // Парсим размер тома
      const volMatch = taskText.match(/размером <strong>(.*?)<\/strong> МБ/);
      const vol = volMatch ? volMatch[1] : '';
      
      await frame.locator('#input-archive-name').fill(name);
      await frame.locator('#input-format').fill(format);
      await frame.locator('#input-password').fill(pwd);
      await frame.locator('#input-volume').fill(vol);
      
      await frame.locator('#btn-submit').click();
    }
    
    // Проверка успешного экрана
    await page.waitForTimeout(2500); // Ожидание записи телеметрии
    
    // Проверка БД
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' AND mission_name = '7 класс Урок 5 :: Архивация (Уровень 2)' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.success).toBe(1);
    db.close();
  });

  test('Обработка ошибок в хардкор-режиме', async ({ page }) => {
    // Автоматически принимаем все алерты
    let hardcoreAlertSeen = false;
    page.on('dialog', async dialog => {
      if (dialog.message().includes('ОШИБКА В РЕЖИМЕ ХАРДКОРА')) {
        hardcoreAlertSeen = true;
      }
      await dialog.accept();
    });

    // 1. Переход на страницу и включение хардкора
    await page.goto('http://localhost:4321/lesson/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/5');
    await page.evaluate(() => { localStorage.setItem('hardcore_mode', 'true'); });
    await page.reload();
    
    // Принудительно показываем iframe-2
    await page.evaluate(() => {
      document.getElementById('iframe-1').classList.remove('block');
      document.getElementById('iframe-1').classList.add('hidden');
      const iframe2 = document.getElementById('iframe-2');
      iframe2.classList.remove('hidden');
      iframe2.classList.add('block');
      iframe2.style.height = '800px';
      iframe2.style.width = '1000px';
    });

    const frame = page.frameLocator('#iframe-2');
    
    await expect(frame.locator('#current-phase')).toHaveText('1');
    
    // Вводим неверный ответ
    await frame.locator('#input-archive-name').fill('wrong_name');
    await frame.locator('#btn-submit').click();
    
    // Проверка БД на запись hardcore_reset
    await page.waitForTimeout(2500); // ожидаем записи
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'hardcore_reset' AND mission_name = '7 класс Урок 5 :: Архивация (Уровень 2)' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    db.close();
  });
});
