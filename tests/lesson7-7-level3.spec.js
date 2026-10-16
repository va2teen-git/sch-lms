import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('7 класс. Урок 7. Уровень 3: Компьютерные сети. Поиск информации в сети Интернет (Аркада)', () => {
  const taskFilePath = path.join(process.cwd(), 'src/pages/tasks/7-класс/7/level3.astro');

  test('Архитектурное соответствие: TaskLayout level=3, Vue 3, Архетип 2 (Flow Router), Zero-Style, Zero-Multiple-Choice', async () => {
    expect(fs.existsSync(taskFilePath)).toBe(true);
    const content = fs.readFileSync(taskFilePath, 'utf-8');

    // 1. Использование TaskLayout с level={3}
    expect(content).toContain('import TaskLayout');
    expect(content).toContain('<TaskLayout level={3}');

    // 2. Отсутствие запрещенных тегов style
    expect(content.includes('<style>')).toBe(false);
    expect(content.includes('<style ')).toBe(false);

    // 3. Запрет Multiple Choice
    expect(content).not.toContain('type="radio"');
    expect(content).not.toContain('<select');

    // 4. Декларативный стек Vue 3
    expect(content).toContain('/static/vue.global.js');
    expect(content).toContain('createApp');

    // 5. Архетип 2: Магистральный диспетчер сетевой маршрутизации
    expect(content).toContain('PACKET FLOW ROUTER');
    expect(content).toContain('КОММУТАЦИОННАЯ МАТРИЦА');
    expect(content).toContain('SINKHOLE');

    // 6. Контракт телеметрии
    expect(content).toContain('TELEMETRY_EVENT');
    expect(content).toContain('level_complete');
    expect(content).toContain('hardcore_reset');
    expect(content).toContain('Урок 7');
  });

  test('Сквозное интерактивное прохождение всех 10 волн магистральной маршрутизации', async ({ page }) => {
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
    await page.goto(`${BASE_URL}/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level3`);

    // Стартовый экран
    const btnStart = page.locator('#btn-start');
    await expect(btnStart).toBeVisible();
    await btnStart.click();

    // Проходим все 10 волн маршрутизации
    for (let wave = 1; wave <= 10; wave++) {
      // Ожидаем появление текущей волны
      await expect(page.locator('.fs-4.fw-bold.text-danger')).toContainText(`ВОЛНА ${wave} ИЗ 10`);

      // Решаем топологический маршрут
      await page.evaluate(() => {
        window.__DEV_LEVEL3_STATE__.solveCurrentWave();
      });

      // Проверяем, что выход стал валидным (зеленый статус)
      const pathStatus = page.locator('.card strong.text-success');
      await expect(pathStatus).toBeVisible();

      // Запускаем форсаж пакета (кнопкой или пробелом)
      if (wave % 2 === 0) {
        await page.keyboard.press('Space');
      } else {
        await page.locator('#btn-dispatch').click();
      }
    }

    // Экран победы
    const successScreen = page.locator('#success-screen');
    await expect(successScreen).toBeVisible();
    await expect(successScreen.locator('h1')).toContainText('МАГИСТРАЛЬНЫЙ ТРАФИК УСПЕШНО СТАБИЛИЗИРОВАН');

    // Проверка телеметрии
    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.success).toBe(true);
    expect(completeEvent.status).toBe('completed');
  });

  test('Ошибочная маршрутизация, сигнал тревоги и тотальный хардкор-сброс на Волну 1', async ({ page }) => {
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
    await page.goto(`${BASE_URL}/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level3`);

    await page.locator('#btn-start').click();
    await expect(page.locator('.fs-4.fw-bold.text-danger')).toContainText('ВОЛНА 1 ИЗ 10');

    // Проходим первую волну корректно, чтобы оказаться на Волне 2
    await page.evaluate(() => {
      window.__DEV_LEVEL3_STATE__.solveCurrentWave();
    });
    await page.locator('#btn-dispatch').click();

    // Мы на Волне 2
    await expect(page.locator('.fs-4.fw-bold.text-danger')).toContainText('ВОЛНА 2 ИЗ 10');

    // Намеренно направляем узел в тупик (вверх с верхней строки или вниз с нижней строки)
    await page.evaluate(() => {
      // Устанавливаем в тупик
      const state = window.__DEV_LEVEL3_STATE__;
      const entry = state.currentWave.entryRow;
      state.grid[entry][0] = 'UP';
    });

    // Нажимаем форсаж с ошибочным маршрутом
    await page.locator('#btn-dispatch').click();

    // Проверяем тревожный баннер
    const alarm = page.locator('.alert-danger h4');
    await expect(alarm).toBeVisible();
    await expect(alarm).toContainText('КРИТИЧЕСКАЯ АВАРИЯ МАРШРУТИЗАЦИИ');

    // Проверяем событие телеметрии hardcore_reset
    await expect.poll(() => telemetryEvents.some(e => e.action_type === 'hardcore_reset')).toBe(true);

    // Ожидаем сброса на Волну 1 после тайм-аута сирены
    await expect(page.locator('.fs-4.fw-bold.text-danger')).toContainText('ВОЛНА 1 ИЗ 10', { timeout: 4000 });
  });

  test('Интерактивное вращение узлов сетки кликами мыши', async ({ page }) => {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
    await page.goto(`${BASE_URL}/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level3`);

    await page.locator('#btn-start').click();

    // Кликаем по узлу [0, 0] и проверяем изменение направления
    const node00 = page.locator('#node-0-0');
    await expect(node00).toBeVisible();

    const initialDir = await page.evaluate(() => window.__DEV_LEVEL3_STATE__.grid[0][0]);
    await node00.click();
    const newDir = await page.evaluate(() => window.__DEV_LEVEL3_STATE__.grid[0][0]);

    expect(newDir).not.toBe(initialDir);
  });
});
