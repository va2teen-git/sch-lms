import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Grade 7 Lesson 9: Information & Data Level 1', () => {
  const taskFilePath = path.join(process.cwd(), 'src/pages/tasks/7-класс/9/level1.astro');

  test('Architectural contracts: TaskLayout, zero style, zero multiple choice', async () => {
    expect(fs.existsSync(taskFilePath)).toBe(true);
    const content = fs.readFileSync(taskFilePath, 'utf-8');

    expect(content).toContain('import TaskLayout');
    expect(content).toContain('<TaskLayout level={1}');
    expect(content.includes('<style>')).toBe(false);
    expect(content.includes('<style ')).toBe(false);
    expect(content).not.toContain('type="radio"');
    expect(content).not.toContain('<select');
    expect(content).toContain('TELEMETRY_EVENT');
    expect(content).toContain('level_complete');
    expect(content).toContain('hardcore_reset');
    expect(content).toContain('Урок 9');
  });

  test('Zero Multiple Choice check: no radio buttons or select dropdowns in DOM', async ({ page }) => {
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level1');

    const radios = await page.locator('.container-fluid input[type="radio"]').count();
    expect(radios).toBe(0);

    const selects = await page.locator('.container-fluid select').count();
    expect(selects).toBe(0);
  });

  test('Phase 1: Sensory channels classification (Drag / Click to Bucket)', async ({ page }) => {
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level1');

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#p1-cards-pool')).toBeVisible();

    const verifyBtn = page.locator('#btn-phase1');
    await expect(verifyBtn).toBeDisabled();

    // Распределяем карточки по сенсорным корзинам
    const cards = page.locator('#p1-cards-pool .p1-card');
    const cardCount = await cards.count();
    expect(cardCount).toBe(6);

    for (let i = 0; i < cardCount; i++) {
      const card = page.locator('#p1-cards-pool .p1-card').first();
      const type = await card.getAttribute('data-type');
      await card.click();

      const dropzone = page.locator(`.p1-dropzone[data-bucket="${type}"]`);
      await dropzone.locator('.p1-dropzone-header').click();
    }

    await expect(verifyBtn).toBeEnabled();
    await verifyBtn.click();

    // Переход на Фазу 2
    await expect(page.locator('#phase1')).toBeHidden();
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
  });

  test('Full Walkthrough: Complete all 3 phases and verify telemetry events', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryCapturedL1', (data) => {
      telemetryEvents.push(data);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryCapturedL1(event.data);
        }
      });
    });

    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level1');

    // --- ФАЗА 1 ---
    const cards = page.locator('#p1-cards-pool .p1-card');
    const count1 = await cards.count();
    for (let i = 0; i < count1; i++) {
      const card = page.locator('#p1-cards-pool .p1-card').first();
      const type = await card.getAttribute('data-type');
      await card.click();
      await page.locator(`.p1-dropzone[data-bucket="${type}"] .p1-dropzone-header`).click();
    }
    await page.locator('#btn-phase1').click();
    await expect(page.locator('#phase2')).toBeVisible();

    // --- ФАЗА 2: Слот-пазл контекста ---
    const taskCards = page.locator('.p2-task-card');
    const taskCount = await taskCards.count();
    expect(taskCount).toBe(3);

    for (let i = 0; i < taskCount; i++) {
      const taskCard = taskCards.nth(i);
      const taskId = await taskCard.getAttribute('data-task-id');

      let targetContextId = '';
      let targetMeaningId = '';
      if (taskId === 'task_volt') {
        targetContextId = 'c_volt';
        targetMeaningId = 'm_volt';
      } else if (taskId === 'task_temp') {
        targetContextId = 'c_temp';
        targetMeaningId = 'm_temp';
      } else if (taskId === 'task_net') {
        targetContextId = 'c_net';
        targetMeaningId = 'm_net';
      }

      // Выбираем токен контекста и кликаем на слот
      const cToken = page.locator(`.p2-token[data-token-id="${targetContextId}"]`);
      await cToken.click();
      await taskCard.locator('.p2-slot[data-slot="context"]').click();

      // Выбираем токен вывода и кликаем на слот
      const mToken = page.locator(`.p2-token[data-token-id="${targetMeaningId}"]`);
      await mToken.click();
      await taskCard.locator('.p2-slot[data-slot="meaning"]').click();
    }

    const verifyBtn2 = page.locator('#btn-phase2');
    await expect(verifyBtn2).toBeEnabled();
    await verifyBtn2.click();

    await expect(page.locator('#phase2')).toBeHidden();
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');

    // --- ФАЗА 3: Экспертиза свойств информации ---
    const connections = [
      { incId: 'inc_act', targetProp: 'prop_act' },
      { incId: 'inc_und', targetProp: 'prop_und' },
      { incId: 'inc_rel', targetProp: 'prop_rel' },
      { incId: 'inc_com', targetProp: 'prop_com' }
    ];

    for (const conn of connections) {
      await page.locator(`.p3-incident-card[data-id="${conn.incId}"]`).click();
      await page.locator(`.p3-prop-card[data-id="${conn.targetProp}"]`).click();
    }

    const verifyBtn3 = page.locator('#btn-phase3');
    await expect(verifyBtn3).toBeEnabled();
    await verifyBtn3.click();

    // --- ЭКРАН УСПЕХА ---
    await expect(page.locator('#phase3')).toBeHidden();
    await expect(page.locator('#success-screen')).toBeVisible();

    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.success).toBe(true);
    expect(completeEvent.status).toBe('completed');
  });

  test('Error handling in Phase 1 triggers hardcore_reset telemetry and regenerates', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryCapturedErr', (data) => {
      telemetryEvents.push(data);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryCapturedErr(event.data);
        }
      });
    });

    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level1');

    // Нарочно кладем все карточки в зрительный канал
    const cards = page.locator('#p1-cards-pool .p1-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = page.locator('#p1-cards-pool .p1-card').first();
      await card.click();
      await page.locator('.p1-dropzone[data-bucket="visual"] .p1-dropzone-header').click();
    }

    await page.locator('#btn-phase1').click();

    // Появляется алерт ошибки
    await expect(page.locator('#error-box')).toBeVisible();
    await expect(page.locator('#error-message')).toContainText('ОШИБКА КЛАССИФИКАЦИИ');

    const resetEvent = telemetryEvents.find(e => e.action_type === 'hardcore_reset');
    expect(resetEvent).toBeDefined();
    expect(resetEvent.success).toBe(false);

    // После 1.5 секунд происходит процедурная регенерация пула
    await page.waitForTimeout(1600);
    await expect(page.locator('#p1-cards-pool .p1-card')).toHaveCount(6);
  });
});
