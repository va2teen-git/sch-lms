import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('7 класс. Урок 7. Уровень 2: Компьютерные сети. Поиск информации в сети Интернет', () => {
  const taskFilePath = path.join(process.cwd(), 'src/pages/tasks/7-класс/7/level2.astro');

  test('Архитектурное соответствие: TaskLayout level=2, Zero-Style, Zero-Multiple-Choice, Anti-Paste', async () => {
    expect(fs.existsSync(taskFilePath)).toBe(true);
    const content = fs.readFileSync(taskFilePath, 'utf-8');

    // 1. Использование TaskLayout с level={2}
    expect(content).toContain('import TaskLayout');
    expect(content).toContain('<TaskLayout level={2}');

    // 2. Отсутствие запрещенных тегов style
    expect(content.includes('<style>')).toBe(false);
    expect(content.includes('<style ')).toBe(false);

    // 3. Наличие всех 5 процедурных фаз и экрана успеха
    expect(content).toContain('id="phase1"');
    expect(content).toContain('id="phase2"');
    expect(content).toContain('id="phase3"');
    expect(content).toContain('id="phase4"');
    expect(content).toContain('id="phase5"');
    expect(content).toContain('id="success-screen"');

    // 4. Zero Multiple Choice Policy: запрет радиокнопок и селектов
    expect(content).not.toContain('type="radio"');
    expect(content).not.toContain('<select');

    // 5. Защита от вставки (Anti-Paste)
    expect(content).toContain('anti-paste');
    expect(content).toContain("e.preventDefault()");

    // 6. Контракт телеметрии
    expect(content).toContain('TELEMETRY_EVENT');
    expect(content).toContain('level_complete');
    expect(content).toContain('hardcore_reset');
    expect(content).toContain('Урок 7');
  });

  test('Сквозное интерактивное прохождение всех 5 аналитических фаз Уровня 2', async ({ page }) => {
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
    await page.goto(`${BASE_URL}/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level2`);

    // --- ФАЗА 1: DNS Иерархия ---
    await expect(page.locator('#phase1')).toBeVisible();
    const p1Expected = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.expected);
    expect(p1Expected).toBeGreaterThanOrEqual(1);
    expect(p1Expected).toBeLessThanOrEqual(4);

    await page.locator('#input-p1').fill(String(p1Expected));
    await page.locator('#btn-phase1').click();

    // --- ФАЗА 2: Валидация IPv4 ---
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase1')).toBeHidden();

    const p2Expected = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.expected);
    await page.locator('#input-p2').fill(String(p2Expected));
    await page.locator('#btn-phase2').click();

    // --- ФАЗА 3: Сетевые порты и спецификация URL ---
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase2')).toBeHidden();

    const p3Expected = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.expected);
    await page.locator('#input-p3').fill(String(p3Expected));
    // Проверяем подтверждение по нажатию клавиши Enter
    await page.locator('#input-p3').press('Enter');

    // --- ФАЗА 4: Конструктор поисковых запросов ---
    await expect(page.locator('#phase4')).toBeVisible();
    await expect(page.locator('#phase3')).toBeHidden();

    const p4Expected = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.expected);
    await page.locator('#input-p4').fill(String(p4Expected));
    await page.locator('#btn-phase4').click();

    // --- ФАЗА 5: Правовые нормы и законодательство РФ ---
    await expect(page.locator('#phase5')).toBeVisible();
    await expect(page.locator('#phase4')).toBeHidden();

    const p5Expected = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.expected);
    await page.locator('#input-p5').fill(String(p5Expected));
    await page.locator('#input-p5').press('Enter');

    // --- ЭКРАН УСПЕХА ---
    await expect(page.locator('#success-screen')).toBeVisible();
    await expect(page.locator('#phase5')).toBeHidden();
    await expect(page.locator('#success-screen h1')).toContainText('СЕТЕВОЙ АНАЛИЗ УСПЕШНО ЗАВЕРШЕН');

    // Проверка телеметрии
    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.success).toBe(true);
    expect(completeEvent.status).toBe('completed');
  });

  test('Обработка ошибок, hardcore_reset и процедурная регенерация фазы', async ({ page }) => {
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
    await page.goto(`${BASE_URL}/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level2`);

    await expect(page.locator('#phase1')).toBeVisible();

    // Вводим заведомо неверное значение
    await page.locator('#input-p1').fill('99');
    await page.locator('#btn-phase1').click();

    // Проверяем отображение блока ошибки
    const errorBox = page.locator('#error-box');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText('Неверный уровень домена');

    // Проверяем отправку события hardcore_reset
    await expect.poll(() => telemetryEvents.some(e => e.action_type === 'hardcore_reset')).toBe(true);

    // Ожидаем скрытия ошибки через 1.5 сек и очистки поля
    await expect(errorBox).toBeHidden({ timeout: 4000 });
    await expect(page.locator('#input-p1')).toHaveValue('');
  });

  test('Платформенная защита от вставки из буфера обмена (Anti-Paste)', async ({ page }) => {
    const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
    await page.goto(`${BASE_URL}/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level2`);

    await expect(page.locator('#phase1')).toBeVisible();

    // Симулируем попытку вставки в поле ввода
    await page.locator('#input-p1').dispatchEvent('paste');

    // Должно появиться предупреждение о блокировке буфера обмена
    const errorBox = page.locator('#error-box');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText('Вставка из буфера обмена заблокирована');
  });
});
