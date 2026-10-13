import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('8 класс. Урок 8. Уровень 3: Аркада Short-Circuit WAF Interceptor', () => {
  const taskFilePath = path.join(process.cwd(), 'src/pages/tasks/8-класс/8/level3.astro');

  test('Архитектурное соответствие правилам платформы и геймдизайна Уровня 3', async () => {
    expect(fs.existsSync(taskFilePath)).toBe(true);
    const content = fs.readFileSync(taskFilePath, 'utf-8');

    // 1. Использование TaskLayout с level=3
    expect(content).toContain('import TaskLayout');
    expect(content).toContain('<TaskLayout level={3}');

    // 2. Отсутствие запрещенных тегов style
    expect(content.includes('<style>')).toBe(false);
    expect(content.includes('<style ')).toBe(false);

    // 3. Использование Vue 3
    expect(content).toContain('createApp');
    expect(content).toContain('Vue');
    expect(content).toContain('/static/vue.global.js');

    // 4. Наличие локального динамического таймера на волну
    expect(content).toMatch(/timer|timeleft|waveTimeLimit/i);

    // 5. Контракт телеметрии
    expect(content).toContain('TELEMETRY_EVENT');
    expect(content).toContain('level_complete');
    expect(content).toContain('hardcore_reset');
    expect(content).toContain('Урок 8');

    // 6. Тактические действия и экраны
    expect(content).toContain('btn-action-allow');
    expect(content).toContain('btn-action-drop');
    expect(content).toContain('success-screen');
    expect(content).toContain('alarm-box');
    expect(content).toContain('target-packet-card');
  });

  test('Сквозное отражение всех 10 волн в аркадном режиме с победным экраном', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryMessage', (data) => {
      telemetryEvents.push(data);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryMessage(event.data);
        }
      });
    });

    const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
    await page.goto(`${BASE_URL}/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level3`);

    // Стартуем испытание
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

      // Небольшая пауза для обновления реактивного стейта Vue
      await page.waitForTimeout(60);
    }

    // Проверяем экран успеха
    const successScreen = page.locator('#success-screen');
    await expect(successScreen).toBeVisible();
    await expect(successScreen.locator('h1')).toContainText('ПЕРИМЕТР БЕЗОПАСНОСТИ УСПЕШНО ОТРАЗИЛ АТАКУ');

    // Проверяем телеметрию завершения
    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.success).toBe(true);
    expect(completeEvent.status).toBe('completed');
  });

  test('Тестирование тотального хардкор-сброса на шаг 1 при ошибке аудита', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryMessageReset', (data) => {
      telemetryEvents.push(data);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryMessageReset(event.data);
        }
      });
    });

    const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
    await page.goto(`${BASE_URL}/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level3`);

    // Стартуем игру
    await page.locator('#btn-start').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    // Намеренно делаем ошибку: смотрим целевой статус и нажимаем противоположную кнопку
    const packetCard = page.locator('#target-packet-card');
    await expect(packetCard).toBeVisible();
    const target = await packetCard.getAttribute('data-target');

    if (target === 'allow') {
      await page.locator('#btn-action-drop').click();
    } else {
      await page.locator('#btn-action-allow').click();
    }

    // Должна появиться тревожная сирена
    const alarmBox = page.locator('#alarm-box');
    await expect(alarmBox).toBeVisible();
    await expect(alarmBox).toContainText('[СИСТЕМНАЯ СИРЕНА // АВАРИЙНЫЙ СБРОС]');

    // Проверяем, что событие hardcore_reset отправлено в телеметрию
    const resetEvent = telemetryEvents.find(e => e.action_type === 'hardcore_reset');
    expect(resetEvent).toBeDefined();
    expect(resetEvent.success).toBe(false);

    // Ждем автоматического сброса на Волну 1 (таймаут 2.2 секунды)
    await page.waitForTimeout(2500);

    // Игра должна вернуться на Волну 1
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');
    await expect(page.locator('#alarm-box')).not.toBeVisible();
    await expect(page.locator('#target-packet-card')).toBeVisible();
  });

  test('Управление с клавиатуры: клавиша Enter для старта и горячие клавиши 1 / 0', async ({ page }) => {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
    await page.goto(`${BASE_URL}/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level3`);

    // Запуск по клавише Enter
    await page.keyboard.press('Enter');
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    // Проверяем горячую клавишу 1 или 0
    const packetCard = page.locator('#target-packet-card');
    await expect(packetCard).toBeVisible();
    const target = await packetCard.getAttribute('data-target');

    if (target === 'allow') {
      await page.keyboard.press('1');
    } else {
      await page.keyboard.press('0');
    }

    // Должна начаться Волна 2
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 10');
  });

  test('Интеграция с iframe-3 на главной странице урока 8-8', async ({ page }) => {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
    await page.goto(`${BASE_URL}/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8`);

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
