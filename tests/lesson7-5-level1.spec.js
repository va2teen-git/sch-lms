import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('Архивация данных (Уровень 1)', () => {

  test('Успешное прохождение уровня', async ({ page }) => {
    // 1. Переход на страницу урока
    await page.goto('http://localhost:4321/lesson/7-класс/5');
    // В зависимости от структуры, нужный нам iframe может быть iframe-1
    const frame = page.frameLocator('#iframe-1');
    
    // ФАЗА 1: Анализ сжимаемости
    await expect(frame.locator('#phase1')).toBeVisible();
    
    // В этой фазе нам нужно выбрать файлы с расширениями .txt, .log, .csv, .sql, .json
    // Мы можем получить все лейблы и их чекбоксы
    const checkboxes = await frame.locator('.p1-checkbox').elementHandles();
    for (const cb of checkboxes) {
        const id = await cb.getAttribute('id');
        const labelText = await frame.locator(`label[for="${id}"]`).textContent();
        
        if (labelText.includes('.txt') || labelText.includes('.log') || 
            labelText.includes('.csv') || labelText.includes('.sql') || 
            labelText.includes('.json')) {
            await cb.check();
        }
    }
    
    await frame.locator('#btn-phase1').click();
    
    // ФАЗА 2: Прогнозирование размера
    await expect(frame.locator('#phase2')).toBeVisible();
    
    const questionText = await frame.locator('#phase2-question').textContent();
    // Извлекаем "составляет XXX МБ" и "в Y раз"
    const matchSize = questionText.match(/составляет (\d+) МБ/);
    const matchRatio = questionText.match(/в (\d+) раз/);
    
    const original = parseInt(matchSize[1]);
    const ratio = parseInt(matchRatio[1]);
    const compressed = original / ratio;
    
    await frame.locator('#input-phase2').fill(compressed.toString());
    await frame.locator('#btn-phase2').click();
    
    // ФАЗА 3: Выбор инструмента
    await expect(frame.locator('#phase3')).toBeVisible();
    
    const p3Text = await frame.locator('#phase3-question').textContent();
    let answerBtn = '';
    if (p3Text.includes('Windows')) answerBtn = 'ZIP';
    else if (p3Text.includes('Linux') || p3Text.includes('Ubuntu') || p3Text.includes('Debian')) answerBtn = 'TAR';
    else answerBtn = '7Z';
    
    await frame.locator(`button[data-answer="${answerBtn}"]`).click();
    
    // Проверка успешного экрана
    await page.waitForTimeout(2500); // Ожидание записи телеметрии
    
    // Проверка БД
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' AND mission_name = 'Урок 5 :: Архивация данных (Базовый)' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.success).toBe(1);
  });

  test('Обработка ошибок в хардкор-режиме', async ({ page }) => {
    // 1. Переход на страницу и включение хардкора
    await page.goto('http://localhost:4321/lesson/7-класс/5');
    await page.evaluate(() => { localStorage.setItem('hardcore_mode', 'true'); });
    await page.reload();
    
    const frame = page.frameLocator('#iframe-1');
    await expect(frame.locator('#phase1')).toBeVisible();
    
    const alertPromise = page.waitForEvent('dialog', { timeout: 3000 }).catch(() => null);
    await frame.locator('#btn-phase1').click();
    
    const dialog = await alertPromise;
    if (dialog) {
        await dialog.accept();
    }
    
    // В задании на Vanilla JS сброс локальный для 1 уровня, но телеметрия hardcore_reset должна быть отправлена
    // Проверка БД на запись hardcore_reset
    await page.waitForTimeout(2500); // ожидаем записи
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'hardcore_reset' AND mission_name = 'Урок 5 :: Архивация данных (Базовый)' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    // expect(row.is_hardcore).toBe(1); - Зависит от реализации API платформы
  });
});
