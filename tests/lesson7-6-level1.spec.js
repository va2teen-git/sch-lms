import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('7 класс. Урок 6. Уровень 1: Компьютерные вирусы и антивирусная защита', () => {
  const taskFilePath = path.join(process.cwd(), 'src/pages/tasks/7-класс/6/level1.astro');

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
    expect(content).toContain('Урок 6');
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
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6/level1');

    // --- ФАЗА 1: Drag-to-Bucket сортировка угроз ---
    await expect(page.locator('#phase1')).toBeVisible();

    // Проверяем, что в пуле есть 4 карточки
    const cards = page.locator('#p1-cards-pool .p1-card');
    await expect(cards).toHaveCount(4);

    // Раскладываем карточки по соответствующим корзинам кликами (клик по карточке -> клик по корзине)
    for (let i = 0; i < 4; i++) {
      // Всегда берем первую оставшуюся в пуле карточку
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

    // --- ФАЗА 2: Slot & Snap конструирование модулей защиты ---
    await expect(page.locator('#phase2')).toBeVisible();

    // Находим 3 слота задач
    const slots = page.locator('.p2-slot-card');
    await expect(slots).toHaveCount(3);

    for (let i = 0; i < 3; i++) {
      const slotCard = slots.nth(i);
      const expectedModuleId = await slotCard.getAttribute('data-expected');
      
      // Находим нужный токен в палитре и кликаем по нему
      const token = page.locator(`#p2-tokens-palette .p2-token[data-id="${expectedModuleId}"]`);
      await token.click();

      // Кликаем по drop-target слота
      const dropTarget = slotCard.locator('.p2-drop-target');
      await dropTarget.click();
    }

    const btnPhase2 = page.locator('#btn-phase2');
    await expect(btnPhase2).toBeEnabled();
    await btnPhase2.click();

    // --- ФАЗА 3: Управление матрицей шлюзов сети ---
    await expect(page.locator('#phase3')).toBeVisible();

    const nodes = page.locator('.p3-node-card');
    await expect(nodes).toHaveCount(4);

    // Проверяем состояние каждого узла и переключаем при необходимости
    for (let i = 0; i < 4; i++) {
      const nodeCard = nodes.nth(i);
      const badgeText = await nodeCard.locator('.badge').textContent();
      const toggleBtn = nodeCard.locator('.p3-toggle-btn');
      
      if (badgeText.includes('УГРОЗА')) {
        // Угроза: переключаем в BLOCK (красный)
        await toggleBtn.click();
        await expect(toggleBtn).toContainText('БЛОКИРОВКА');
      } else {
        // Штатный: оставляем в ALLOW (зеленый)
        await expect(toggleBtn).toContainText('ПРОПУСК');
      }
    }

    // Применяем политику безопасности
    const btnPhase3 = page.locator('#btn-phase3');
    await btnPhase3.click();

    // --- ЭКРАН УСПЕХА ---
    await expect(page.locator('#success-screen')).toBeVisible();
    await expect(page.locator('#success-screen h1')).toContainText('СИСТЕМА БЕЗОПАСНОСТИ УСПЕШНО АКТИВИРОВАНА');

    // Проверяем телеметрию
    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.success).toBe(true);
    expect(completeEvent.status).toBe('completed');
  });
});
