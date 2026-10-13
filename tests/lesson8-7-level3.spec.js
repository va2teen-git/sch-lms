import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

const TARGET_MAP = {
  '«В одном килобайте ровно 1024 байта»': 'true',
  '«Монитор является устройством ввода текстовой информации»': 'false',
  '«Сколько бит содержится в половине байта?»': 'not_statement',
  '«19 ≥ 19»': 'true',
  '«45 < 20»': 'false',
  '«x > 100»': 'not_statement',
  '«101₂ = 5₁₀»': 'true',
  '«1111₂ = 12₁₀»': 'false',
  '«Переведите число 25 в шестнадцатеричную систему!»': 'not_statement',
  '«Операционная система управляет файловой структурой носителя»': 'true',
  '«Клавиатура преобразует электрический ток в звуковые волны»': 'false',
  '«Язык программирования Python гораздо приятнее, чем C++»': 'not_statement',
  '«2⁴ = 16»': 'true',
  '«Число 33 делится нацело на 5»': 'false',
  '«То, что утверждает данный сетевой пакет, является ложью»': 'not_statement',
  '«(15 > 10) И (8 является чётным числом)»': 'true',
  '«(15 > 10) И (9 является чётным числом)»': 'false',
  '«(x > 5) И (x < 15)»': 'not_statement',
  '«(5 > 10) ИЛИ (16 кратно 4)»': 'true',
  '«(5 > 10) ИЛИ (15 кратно 4)»': 'false',
  '«Не выключайте питание компьютера во время обновления системы!»': 'not_statement',
  '«Символ "A" в кодировке ASCII имеет код 65, а "B" — код 66»': 'true',
  '«Число 100 в десятичной системе записывается как 100 в двоичной»': 'false',
  '«k кратно 7 без остатка»': 'not_statement'
};

test.describe('Lesson 8-7 Level 3: WAF Arcade Interceptor (Vue 3)', () => {

  test('should complete all 8 waves successfully and save level_complete telemetry', async ({ page }) => {
    await page.goto('http://localhost:4321/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7');

    // Force show iframe-3
    await page.evaluate(() => {
      document.getElementById('iframe-1').classList.remove('block');
      document.getElementById('iframe-1').classList.add('hidden');
      const iframe3 = document.getElementById('iframe-3');
      iframe3.classList.remove('hidden');
      iframe3.classList.add('block');
      iframe3.style.position = 'relative';
      iframe3.style.height = '800px';
      iframe3.style.width = '1000px';
    });

    const frame = page.frameLocator('#iframe-3');

    // Start game
    await expect(frame.locator('#start-btn')).toBeVisible();
    await frame.locator('#start-btn').click();

    // Survive 8 waves
    for (let wave = 1; wave <= 8; wave++) {
      await expect(frame.locator('#phase-counter')).toContainText(`ВОЛНА ${wave} ИЗ 8`);

      // Read payload
      const payloadEl = frame.locator('.fs-4.text-light.fw-bold.my-2');
      await expect(payloadEl).toBeVisible();
      const payload = (await payloadEl.innerText()).trim();

      const target = TARGET_MAP[payload];
      expect(target).toBeDefined();

      if (target === 'true') {
        await frame.locator('button.btn-outline-success').click();
      } else if (target === 'false') {
        await frame.locator('button.btn-outline-danger').click();
      } else {
        await frame.locator('button.btn-outline-warning').click();
      }

      await page.waitForTimeout(150);
    }

    // Success screen
    await expect(frame.locator('h2:has-text("ШЛЮЗ WAF")')).toBeVisible();

    // Check DB for telemetry
    const db = new sqlite3('telemetry.db');
    await expect.poll(() => {
      return db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' AND mission_name LIKE '%Урок 7%Уровень 3%' ORDER BY id DESC LIMIT 1`).get();
    }, { timeout: 10000 }).toBeDefined();

    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' AND mission_name LIKE '%Урок 7%Уровень 3%' ORDER BY id DESC LIMIT 1`).get();
    expect(row.success).toBe(1);
  });

  test('should handle incorrect decision and trigger hardcore reset to wave 1', async ({ page }) => {
    await page.goto('http://localhost:4321/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7');

    await page.evaluate(() => {
      localStorage.setItem('hardcore_mode', 'true');
    });
    await page.reload();

    await page.evaluate(() => {
      document.getElementById('iframe-1').classList.remove('block');
      document.getElementById('iframe-1').classList.add('hidden');
      const iframe3 = document.getElementById('iframe-3');
      iframe3.classList.remove('hidden');
      iframe3.classList.add('block');
      iframe3.style.position = 'relative';
      iframe3.style.height = '800px';
      iframe3.style.width = '1000px';
    });

    const frame = page.frameLocator('#iframe-3');
    await expect(frame.locator('#start-btn')).toBeVisible();
    await frame.locator('#start-btn').click();

    await expect(frame.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 8');

    const db = new sqlite3('telemetry.db');
    const prevRow = db.prepare(`SELECT max(id) as maxId FROM telemetry`).get();
    const prevId = prevRow?.maxId || 0;

    // Read payload and choose OPPOSITE/WRONG target
    const payloadEl = frame.locator('.fs-4.text-light.fw-bold.my-2');
    await expect(payloadEl).toBeVisible();
    const payload = (await payloadEl.innerText()).trim();
    const correctTarget = TARGET_MAP[payload];

    // Listen for alert on parent page
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('ОШИБКА В РЕЖИМЕ ХАРДКОРА');
      await dialog.accept();
    });

    if (correctTarget === 'true') {
      await frame.locator('button.btn-outline-danger').click();
    } else {
      await frame.locator('button.btn-outline-success').click();
    }

    // Check DB for hardcore_reset
    await expect.poll(() => {
      return db.prepare(`SELECT * FROM telemetry WHERE id > ? AND action_type = 'hardcore_reset' AND mission_name LIKE '%Урок 7%Уровень 3%' ORDER BY id DESC LIMIT 1`).get(prevId);
    }, { timeout: 10000 }).toBeDefined();

    const row = db.prepare(`SELECT * FROM telemetry WHERE id > ? AND action_type = 'hardcore_reset' AND mission_name LIKE '%Урок 7%Уровень 3%' ORDER BY id DESC LIMIT 1`).get(prevId);
    expect(row.is_hardcore).toBe(1);
  });

});
