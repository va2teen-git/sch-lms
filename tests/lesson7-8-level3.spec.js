import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Grade 7 Lesson 8: Cyber Security & Internet Communications Level 3 (Arcade)', () => {
  const taskFilePath = path.join(process.cwd(), 'src/pages/tasks/7-класс/8/level3.astro');

  test('Архитектурное соответствие правилам платформы и геймдизайна Уровня 3', async () => {
    expect(fs.existsSync(taskFilePath)).toBe(true);
    const content = fs.readFileSync(taskFilePath, 'utf-8');

    // 1. Использование TaskLayout с level=3
    expect(content).toContain('import TaskLayout');
    expect(content).toContain('<TaskLayout level={3}');

    // 2. Отсутствие запрещенных тегов style
    expect(content.includes('<style>')).toBe(false);
    expect(content.includes('<style ')).toBe(false);

    // 3. Запрет Multiple Choice
    expect(content).not.toContain('type="radio"');
    expect(content).not.toContain('<select');

    // 4. Декларативный стек Vue 3
    expect(content).toContain('createApp');
    expect(content).toContain('Vue');
    expect(content).toContain('/static/vue.global.js');

    // 5. Наличие динамического таймера
    expect(content).toMatch(/timer|timeleft|waveTimeLimit/i);

    // 6. Контракт телеметрии
    expect(content).toContain('TELEMETRY_EVENT');
    expect(content).toContain('level_complete');
    expect(content).toContain('hardcore_reset');
    expect(content).toContain('Урок 8');

    // 7. Тактические элементы шлюза брандмауэра
    expect(content).toContain('btn-action-allow');
    expect(content).toContain('btn-action-drop');
    expect(content).toContain('success-screen');
    expect(content).toContain('alarm-box');
    expect(content).toContain('target-packet-card');
  });

  test('Сквозное отражение всех 10 волн коммуникационного трафика с победным экраном', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryMessageL3', (data) => {
      telemetryEvents.push(data);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryMessageL3(event.data);
        }
      });
    });

    const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
    await page.goto(`${BASE_URL}/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level3`);

    // Стартуем миссию
    const btnStart = page.locator('#btn-start');
    await expect(btnStart).toBeVisible();
    await btnStart.click();

    // Отражаем все 10 волн
    for (let wave = 0; wave < 10; wave++) {
      const packetCard = page.locator('#target-packet-card');
      await expect(packetCard).toBeVisible();

      // Проверяем счетчик волн
      const counter = page.locator('#phase-counter');
      await expect(counter).toContainText(`ВОЛНА ${wave + 1} ИЗ 10`);

      // Получаем целевой статус пакета
      const target = await packetCard.getAttribute('data-target');
      expect(['allow', 'drop']).toContain(target);

      if (target === 'allow') {
        await page.locator('#btn-action-allow').click();
      } else {
        await page.locator('#btn-action-drop').click();
      }

      // Небольшая пауза для реактивного обновления Vue
      await page.waitForTimeout(60);
    }

    // Проверяем экран победы
    const successScreen = page.locator('#success-screen');
    await expect(successScreen).toBeVisible();
    await expect(successScreen.locator('h1')).toContainText('ПЕРИМЕТР БЕЗОПАСНОСТИ УСПЕШНО ОТРАЗИЛ АТАКУ');

    // Проверяем телеметрию завершения
    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.success).toBe(true);
    expect(completeEvent.status).toBe('completed');
  });

  test('Тестирование тотального хардкор-сброса на шаг 1 при ошибке аудита трафика', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryMessageResetL3', (data) => {
      telemetryEvents.push(data);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryMessageResetL3(event.data);
        }
      });
    });

    const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
    await page.goto(`${BASE_URL}/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level3`);

    // Стартуем испытание
    await page.locator('#btn-start').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    // Намеренно делаем ошибку классификации
    const packetCard = page.locator('#target-packet-card');
    await expect(packetCard).toBeVisible();
    const target = await packetCard.getAttribute('data-target');

    if (target === 'allow') {
      await page.locator('#btn-action-drop').click();
    } else {
      await page.locator('#btn-action-allow').click();
    }

    // Должна появиться аварийная сирена
    const alarmBox = page.locator('#alarm-box');
    await expect(alarmBox).toBeVisible();
    await expect(alarmBox).toContainText('[СИСТЕМНАЯ СИРЕНА // АВАРИЙНЫЙ СБРОС]');

    // Проверяем отправку события hardcore_reset в телеметрию
    const resetEvent = telemetryEvents.find(e => e.action_type === 'hardcore_reset');
    expect(resetEvent).toBeDefined();
    expect(resetEvent.success).toBe(false);

    // Ожидаем автоматического сброса на Волну 1 (таймаут 2.2 с)
    await page.waitForTimeout(2500);

    // Игра вернулась на Волну 1
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');
    await expect(page.locator('#alarm-box')).not.toBeVisible();
    await expect(page.locator('#target-packet-card')).toBeVisible();
  });

  test('Управление с клавиатуры: клавиша Enter для старта и горячие клавиши A / D и 1 / 0', async ({ page }) => {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
    await page.goto(`${BASE_URL}/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level3`);

    // Запуск через Enter
    await page.keyboard.press('Enter');
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    const packetCard = page.locator('#target-packet-card');
    await expect(packetCard).toBeVisible();
    const target = await packetCard.getAttribute('data-target');

    if (target === 'allow') {
      await page.keyboard.press('1');
    } else {
      await page.keyboard.press('0');
    }

    // Переход на Волну 2
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 10');

    // На волне 2 проверяем буквенные хоткеи (A / D)
    const packetCard2 = page.locator('#target-packet-card');
    const target2 = await packetCard2.getAttribute('data-target');
    if (target2 === 'allow') {
      await page.keyboard.press('a');
    } else {
      await page.keyboard.press('d');
    }

    // Переход на Волну 3
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 3 ИЗ 10');
  });

  test('Интеграция с iframe-3 на главной странице урока 7-8', async ({ page }) => {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
    await page.goto(`${BASE_URL}/lesson/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8`);

    // Переключаем отображение на iframe-3
    await page.evaluate(() => {
      const iframe1 = document.getElementById('iframe-1');
      if (iframe1) iframe1.classList.add('hidden');
      const iframe3 = document.getElementById('iframe-3');
      if (iframe3) {
        iframe3.classList.remove('hidden');
        iframe3.classList.add('block');
        iframe3.style.position = 'relative';
        iframe3.style.height = '800px';
        iframe3.style.width = '1000px';
      }
    });

    const frame = page.frameLocator('#iframe-3');
    await expect(frame.locator('#btn-start')).toBeVisible();
  });
});
