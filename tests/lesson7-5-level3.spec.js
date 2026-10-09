import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('Урок 7 класс - Архивация (Уровень 3)', () => {

  test('Успешное прохождение аркады (Level 3)', async ({ page }) => {
    // 1. Переход на страницу урока
    await page.goto('http://localhost:4321/lesson/7-класс/5');
    
    // Принудительно показываем iframe-3 для теста
    await page.evaluate(() => {
      document.getElementById('iframe-1').classList.remove('block');
      document.getElementById('iframe-1').classList.add('hidden');
      const iframe3 = document.getElementById('iframe-3');
      iframe3.classList.remove('hidden');
      iframe3.classList.add('block');
      iframe3.style.height = '800px';
      iframe3.style.width = '1000px';
    });

    const frame = page.frameLocator('#iframe-3');
    
    // Начинаем игру
    await frame.locator('button:has-text("НАЧАТЬ ВЗЛОМ")').click();

    // Фаза 1: EXTRACT
    await expect(frame.locator('button:has-text("EXTRACT")')).toBeVisible();
    await frame.locator('button:has-text("EXTRACT")').click();

    // Фаза 2: data.part1.rar
    await expect(frame.locator('button:has-text("data.part1.rar")').first()).toBeVisible();
    await frame.locator('button:has-text("data.part1.rar")').first().click();

    // Фаза 3: Пароль 16
    await expect(frame.locator('input[type="text"]')).toBeVisible();
    await frame.locator('input[type="text"]').fill('16');
    await frame.locator('button:has-text("ВВОД")').click();

    // Фаза 4: 7z
    await expect(frame.locator('button:has-text("7z")')).toBeVisible();
    await frame.locator('button:has-text("7z")').click();

    // Фаза 5: Многотомный
    await expect(frame.locator('button:has-text("Многотомный")').first()).toBeVisible();
    await frame.locator('button:has-text("Многотомный")').first().click();

    // Фаза 6: JPEG
    await expect(frame.locator('button:has-text("уже является сжатым")')).toBeVisible();
    await frame.locator('button:has-text("уже является сжатым")').click();

    // Фаза 7: Обфускация
    await expect(frame.locator('button:has-text("обфускация")')).toBeVisible();
    await frame.locator('button:has-text("обфускация")').click();

    // Фаза 8: ОТПРАВИТЬ ДАННЫЕ
    await expect(frame.locator('button:has-text("ОТПРАВИТЬ ДАННЫЕ")')).toBeVisible();
    await frame.locator('button:has-text("ОТПРАВИТЬ ДАННЫЕ")').click();

    // Экран успеха
    await expect(frame.locator('h2:has-text("ДАННЫЕ УСПЕШНО ПЕРЕДАНЫ")')).toBeVisible();
    
    // Ждем отправки телеметрии
    await page.waitForTimeout(1000);

    // 4. Проверка БД
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' AND mission_name LIKE '%Уровень 3%' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.success).toBe(1);
    db.close();
  });

  test('Обработка ошибок в хардкор-режиме (Level 3)', async ({ page }) => {
    // Автоматически принимаем все алерты
    let hardcoreAlertSeen = false;
    page.on('dialog', async dialog => {
      if (dialog.message().includes('ОШИБКА В РЕЖИМЕ ХАРДКОРА')) {
        hardcoreAlertSeen = true;
      }
      await dialog.accept();
    });

    // 1. Переход на страницу и включение хардкора
    await page.goto('http://localhost:4321/lesson/7-класс/5');
    await page.evaluate(() => { localStorage.setItem('hardcore_mode', 'true'); });
    await page.reload();
    
    // Принудительно показываем iframe-3
    await page.evaluate(() => {
      document.getElementById('iframe-1').classList.remove('block');
      document.getElementById('iframe-1').classList.add('hidden');
      const iframe3 = document.getElementById('iframe-3');
      iframe3.classList.remove('hidden');
      iframe3.classList.add('block');
      iframe3.style.height = '800px';
      iframe3.style.width = '1000px';
    });

    const frame = page.frameLocator('#iframe-3');
    
    // Начинаем игру
    await frame.locator('button:has-text("НАЧАТЬ ВЗЛОМ")').click();

    // Выбираем НЕВЕРНЫЙ ответ на первой фазе (например, MOUNT)
    await expect(frame.locator('button:has-text("MOUNT")')).toBeVisible();
    
    await frame.locator('button:has-text("MOUNT")').click();
    
    // Проверка перезагрузки (появление начального экрана в iframe 1, так как хардкор сбрасывает табы на 1)
    await expect(page.frameLocator('#iframe-1').locator('h2').first()).toBeVisible();
    
    expect(hardcoreAlertSeen).toBe(true);

    // Ждем отправки телеметрии
    await page.waitForTimeout(1000);

    // 4. Проверка БД на запись hardcore_reset
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'hardcore_reset' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.is_hardcore).toBe(1);
    db.close();
  });
});
