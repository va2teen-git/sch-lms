import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('7 класс. Урок 6. Уровень 2: Аналитика угроз и исследование инцидентов', () => {
  const taskFilePath = path.join(process.cwd(), 'src/pages/tasks/7-класс/6/level2.astro');

  test('Архитектурное соответствие правилам платформы и Zero Multiple Choice', async () => {
    expect(fs.existsSync(taskFilePath)).toBe(true);
    const content = fs.readFileSync(taskFilePath, 'utf-8');

    // 1. Использование TaskLayout
    expect(content).toContain('import TaskLayout');
    expect(content).toContain('<TaskLayout level={2}');

    // 2. Отсутствие запрещенных тегов style
    expect(content.includes('<style>')).toBe(false);
    expect(content.includes('<style ')).toBe(false);

    // 3. Ровно 5 процедурных фаз
    expect(content).toContain('id="phase1"');
    expect(content).toContain('id="phase2"');
    expect(content).toContain('id="phase3"');
    expect(content).toContain('id="phase4"');
    expect(content).toContain('id="phase5"');
    expect(content).toContain('id="success-screen"');

    // 4. Zero Multiple Choice Policy: только ввод в инпуты, запрет радиокнопок и селектов
    expect(content).not.toContain('type="radio"');
    expect(content).not.toContain('<select');
    expect(content).toContain('id="input-p1"');
    expect(content).toContain('id="input-p2"');
    expect(content).toContain('id="input-p3"');
    expect(content).toContain('id="input-p4"');
    expect(content).toContain('id="input-p5"');

    // 5. Контракт телеметрии
    expect(content).toContain('TELEMETRY_EVENT');
    expect(content).toContain('level_complete');
    expect(content).toContain('hardcore_reset');
    expect(content).toContain('Урок 6');
  });

  test('Сквозное аналитическое прохождение всех 5 фаз Уровня 2', async ({ page }) => {
    // Отслеживаем события postMessage
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

    // Переход напрямую на страницу тренажера
    const BASE_URL = process.env.BASE_URL || 'http://localhost:4321';
    await page.goto(`${BASE_URL}/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6/level2`);

    // --- ФАЗА 1: Двойные расширения ---
    await expect(page.locator('#phase1')).toBeVisible();
    const fileName = await page.locator('#p1-filename').textContent();
    const parts = fileName.trim().split('.');
    const realExt = parts[parts.length - 1]; // Последнее расширение
    await page.locator('#input-p1').fill(realExt);
    await page.locator('#btn-phase1').click();

    // --- ФАЗА 2: Анализ логов безопасности ---
    await expect(page.locator('#phase2')).toBeVisible();
    const logText = await page.locator('#p2-log-text').textContent();
    let p2Answer = 'троян';
    if (logText.includes('клавиатур')) p2Answer = 'кейлоггер';
    else if (logText.includes('сканирует адреса') || logText.includes('порт 445')) p2Answer = 'червь';
    else if (logText.includes('зашифрованы') || logText.includes('выкуп')) p2Answer = 'шифровальщик';
    else if (logText.includes('Normal.dotm') || logText.includes('макрос')) p2Answer = 'макровирус';
    else if (logText.includes('WipeDisk') || logText.includes('спящем состоянии')) p2Answer = 'логическая бомба';

    await page.locator('#input-p2').fill(p2Answer);
    await page.locator('#btn-phase2').click();

    // --- ФАЗА 3: Расчет изменения размера файла ---
    await expect(page.locator('#phase3')).toBeVisible();
    const task3Text = await page.locator('#p3-task-text').textContent();
    const numbers = task3Text.match(/\d+/g).map(Number);
    let p3Answer = 0;
    if (task3Text.includes('новый размер')) {
      p3Answer = numbers[0] + numbers[1];
    } else {
      p3Answer = Math.abs(numbers[1] - numbers[0]);
    }
    await page.locator('#input-p3').fill(p3Answer.toString());
    await page.locator('#btn-phase3').click();

    // --- ФАЗА 4: Выбор действия ---
    await expect(page.locator('#phase4')).toBeVisible();
    const verdictText = await page.locator('#p4-verdict-text').textContent();
    let p4Answer = 'карантин';
    if (verdictText.includes('полностью восстановлен') || verdictText.includes('notepad.exe')) p4Answer = 'лечить';
    else if (verdictText.includes('не содержит') || verdictText.includes('Temp') || verdictText.includes('дроппер')) p4Answer = 'удалить';
    else if (verdictText.includes('не ясен') || verdictText.includes('лаборатори')) p4Answer = 'карантин';

    await page.locator('#input-p4').fill(p4Answer);
    await page.locator('#btn-phase4').click();

    // --- ФАЗА 5: Статья УК РФ ---
    await expect(page.locator('#phase5')).toBeVisible();
    const lawText = await page.locator('#p5-law-text').textContent();
    let p5Answer = 273;
    if (lawText.includes('максимальный срок') || lawText.includes('до N лет')) {
      p5Answer = 7;
    }
    await page.locator('#input-p5').fill(p5Answer.toString());
    await page.locator('#btn-phase5').click();

    // --- ЭКРАН УСПЕХА ---
    await expect(page.locator('#success-screen')).toBeVisible();
    await expect(page.locator('#success-screen h1')).toContainText('ЭКСПЕРТНЫЙ АНАЛИЗ УСПЕШНО ЗАВЕРШЕН');

    // Проверяем событие телеметрии
    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.success).toBe(true);
    expect(completeEvent.status).toBe('completed');
  });
});
