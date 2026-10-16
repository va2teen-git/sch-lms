import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('7 класс. Урок 7. Уровень 1: Компьютерные сети. Поиск информации в сети Интернет', () => {
  const taskFilePath = path.join(process.cwd(), 'src/pages/tasks/7-класс/7/level1.astro');

  test('Архитектурное соответствие правилам платформы и Zero Multiple Choice', async () => {
    expect(fs.existsSync(taskFilePath)).toBe(true);
    const content = fs.readFileSync(taskFilePath, 'utf-8');

    // 1. Использование TaskLayout
    expect(content).toContain('import TaskLayout');
    expect(content).toContain('<TaskLayout level={1}');

    // 2. Отсутствие запрещенных тегов style
    expect(content.includes('<style>')).toBe(false);
    expect(content.includes('<style ')).toBe(false);

    // 3. Наличие 3 процедурных фаз
    expect(content).toContain('id="phase1"');
    expect(content).toContain('id="phase2"');
    expect(content).toContain('id="phase3"');
    expect(content).toContain('id="success-screen"');

    // 4. Zero Multiple Choice Policy: запрет радиокнопок и селектов
    expect(content).not.toContain('type="radio"');
    expect(content).not.toContain('<select');

    // 5. Контракт телеметрии
    expect(content).toContain('TELEMETRY_EVENT');
    expect(content).toContain('level_complete');
    expect(content).toContain('hardcore_reset');
    expect(content).toContain('Урок 7');
  });

  test('Сквозное интерактивное прохождение всех 3 фаз Уровня 1', async ({ page }) => {
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
    await page.goto(`${BASE_URL}/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level1`);

    // --- ФАЗА 1: Drag-to-Bucket классификация доменов ---
    await expect(page.locator('#phase1')).toBeVisible();

    // Проверяем, что в пуле есть 5 карточек доменов
    const cards = page.locator('#p1-cards-pool .p1-card');
    await expect(cards).toHaveCount(5);

    // Раскладываем карточки по корзинам кликами (клик по карточке -> клик по корзине)
    for (let i = 0; i < 5; i++) {
      const currentCard = page.locator('#p1-cards-pool .p1-card').first();
      const expectedBucket = await currentCard.getAttribute('data-expected');
      await currentCard.click();

      // Кликаем по целевой корзине
      const targetZone = page.locator(`.p1-dropzone[data-bucket="${expectedBucket}"]`);
      await targetZone.click();
    }

    // Проверяем, что пул опустел и кнопка проверки активировалась
    await expect(page.locator('#p1-cards-pool .p1-card')).toHaveCount(0);
    const btnPhase1 = page.locator('#btn-phase1');
    await expect(btnPhase1).toBeEnabled();
    await btnPhase1.click();

    // --- ФАЗА 2: Slot & Snap конструирование URL-адреса ---
    await expect(page.locator('#phase2')).toBeVisible();

    // Находим 4 слота структуры URL
    const slots = page.locator('.p2-slot-card');
    await expect(slots).toHaveCount(4);

    for (let i = 0; i < 4; i++) {
      const slotCard = slots.nth(i);
      const expectedText = await slotCard.getAttribute('data-expected');

      // Находим нужный токен в палитре по значению
      const token = page.locator(`#p2-tokens-palette .p2-token[data-val="${expectedText}"]`);
      await token.click();

      // Кликаем по drop-target слота
      const dropTarget = slotCard.locator('.p2-drop-target');
      await dropTarget.click();
    }

    // Проверяем предварительный просмотр и кнопку проверки
    const btnPhase2 = page.locator('#btn-phase2');
    await expect(btnPhase2).toBeEnabled();
    await btnPhase2.click();

    // --- ФАЗА 3: Коммутация оборудования сети ---
    await expect(page.locator('#phase3')).toBeVisible();

    const nodes = page.locator('.p3-node-card');
    await expect(nodes).toHaveCount(4);

    // Целевые соответствия:
    // node1: twisted (1 клик)
    // node2: twisted (1 клик)
    // node3: wifi (3 клика)
    // node4: fiber (2 клика)
    const expectedTargets = {
      node1: 'ВИТАЯ ПАРА',
      node2: 'ВИТАЯ ПАРА',
      node3: 'WI-FI',
      node4: 'ОПТОВОЛОКНО'
    };

    for (let i = 0; i < 4; i++) {
      const nodeCard = nodes.nth(i);
      const nodeId = await nodeCard.getAttribute('data-id');
      const targetSubstring = expectedTargets[nodeId];
      const toggleBtn = nodeCard.locator('.p3-toggle-btn');
      const badge = nodeCard.locator('.p3-status-badge');

      // Кликаем, пока бейдж не будет содержать нужное имя
      while (!(await badge.textContent()).includes(targetSubstring)) {
        await toggleBtn.click();
      }
    }

    // Применяем сетевую конфигурацию
    const btnPhase3 = page.locator('#btn-phase3');
    await btnPhase3.click();

    // --- ЭКРАН УСПЕХА ---
    await expect(page.locator('#success-screen')).toBeVisible();
    await expect(page.locator('#success-screen h1')).toContainText('СЕТЕВОЙ ЦЕНТР УСПЕШНО АКТИВИРОВАН');

    // Проверяем телеметрию
    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.success).toBe(true);
    expect(completeEvent.status).toBe('completed');
  });

  test('Обработка ошибок и процедурный сброс при неверном действии', async ({ page }) => {
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
    await page.goto(`${BASE_URL}/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level1`);

    await expect(page.locator('#phase1')).toBeVisible();

    // Намеренно складываем ВСЕ карточки в НЕПРАВИЛЬНУЮ корзину
    for (let i = 0; i < 5; i++) {
      const currentCard = page.locator('#p1-cards-pool .p1-card').first();
      const expectedBucket = await currentCard.getAttribute('data-expected');
      // Складываем в противоположную корзину!
      const wrongBucket = expectedBucket === 'geo' ? 'generic' : 'geo';
      await currentCard.click();

      const wrongZone = page.locator(`.p1-dropzone[data-bucket="${wrongBucket}"]`);
      await wrongZone.click();
    }

    // Нажимаем проверить
    const btnPhase1 = page.locator('#btn-phase1');
    await expect(btnPhase1).toBeEnabled();
    await btnPhase1.click();

    // Проверяем отображение блока ошибки
    const errorBox = page.locator('#error-box');
    await expect(errorBox).toBeVisible();
    await expect(errorBox).toContainText('ОШИБКА МАРШРУТИЗАЦИИ');

    // Проверяем событие телеметрии hardcore_reset
    await expect.poll(() => telemetryEvents.some(e => e.action_type === 'hardcore_reset')).toBe(true);

    // Ждем процедурной перегенерации (через 1.5 сек ошибка скроется и карточки появятся снова)
    await expect(errorBox).toBeHidden({ timeout: 4000 });
    await expect(page.locator('#p1-cards-pool .p1-card')).toHaveCount(5);
  });
});
