import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('9th Grade Lesson 8: Level 1 Task Suite (Direct Manipulation)', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/9-класс/8/level1.astro');

  test('Level 1 adheres to architectural requirements and policy contracts', async () => {
    expect(fs.existsSync(taskPath), 'level1.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}>');

    // 3 distinct phases
    expect(code).toContain('id="phase-1-workspace"');
    expect(code).toContain('id="phase-2-workspace"');
    expect(code).toContain('id="phase-3-workspace"');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 8 :: Табличные модели (Уровень 1)');

    // Zero-Style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Zero Multiple Choice Policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Direct manipulation structures
    expect(code).toContain('id="cards-pool"');
    expect(code).toContain('id="bin-os"');
    expect(code).toContain('id="bin-oo"');
    expect(code).toContain('id="matrix-tbody"');
    expect(code).toContain('id="weight-matrix-tbody"');
    expect(code).toContain('id="weight-tokens-palette"');
    expect(code).toContain('id="verify-btn"');
  });

  test('Level 1 full interactive walkthrough with telemetry verification', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryEventMock', (evt) => {
      telemetryEvents.push(evt);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryEventMock(event.data);
        }
      });
    });

    await page.goto(encodeURI('/tasks/9-класс/8/level1'));

    // --- ФАЗА 1: Классификация карточек по шлюзам ---
    await expect(page.locator('#phase-1-workspace')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    // Переносим карточки по клик-делегированию
    const poolCards = page.locator('#cards-pool .draggable-card');
    while (await poolCards.count() > 0) {
      const card = poolCards.first();
      const cardType = await card.getAttribute('data-card-type');
      await card.click();
      if (cardType === 'os') {
        await page.locator('#bin-os').click();
      } else {
        await page.locator('#bin-oo').click();
      }
      await page.waitForTimeout(50);
    }

    await page.locator('#verify-btn').click();

    // --- ФАЗА 2: Двоичная матрица смежности 4x4 ---
    await expect(page.locator('#phase-2-workspace')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');

    // Определяем ребра графа из SVG линий
    // Координаты вершин: 0: A (160, 35), 1: B (50, 110), 2: C (270, 110), 3: D (160, 185)
    const targetEdges = await page.evaluate(() => {
      const coords = [
        { x: 160, y: 35 },
        { x: 50,  y: 110 },
        { x: 270, y: 110 },
        { x: 160, y: 185 }
      ];
      function findIndex(x, y) {
        return coords.findIndex(c => Math.abs(c.x - x) < 5 && Math.abs(c.y - y) < 5);
      }
      const lines = Array.from(document.querySelectorAll('#graph-svg line'));
      const edges = [];
      lines.forEach(l => {
        const x1 = parseFloat(l.getAttribute('x1'));
        const y1 = parseFloat(l.getAttribute('y1'));
        const x2 = parseFloat(l.getAttribute('x2'));
        const y2 = parseFloat(l.getAttribute('y2'));
        const u = findIndex(x1, y1);
        const v = findIndex(x2, y2);
        if (u !== -1 && v !== -1) {
          edges.push([u, v]);
          edges.push([v, u]);
        }
      });
      return edges;
    });

    // Настраиваем ячейки матрицы кликами
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (r === c) continue;
        const shouldBeOne = targetEdges.some(([u, v]) => u === r && v === c);
        const cell = page.locator(`.matrix-cell[data-row="${r}"][data-col="${c}"]`);
        const currentText = (await cell.innerText()).trim();
        const currentVal = parseInt(currentText, 10);
        if ((shouldBeOne && currentVal === 0) || (!shouldBeOne && currentVal === 1)) {
          await cell.click();
          await page.waitForTimeout(30);
        }
      }
    }

    await page.locator('#verify-btn').click();

    // --- ФАЗА 3: Восстановление весовой матрицы (Слот-пазл) ---
    await expect(page.locator('#phase-3-workspace')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');

    // Находим целевые веса для слотов (A-B и C-D) из SVG
    // A: (50, 45), B: (270, 45) -> midY = 45 -> text y ~ 49
    // C: (50, 175), D: (270, 175) -> midY = 175 -> text y ~ 179
    const slotWeights = await page.evaluate(() => {
      const texts = Array.from(document.querySelectorAll('#weighted-graph-svg text'));
      let weightAB = null;
      let weightCD = null;
      texts.forEach(t => {
        const y = parseFloat(t.getAttribute('y'));
        const x = parseFloat(t.getAttribute('x'));
        const val = parseInt(t.textContent.trim(), 10);
        if (!isNaN(val)) {
          // A-B вес расположен около x=160, y=49
          if (Math.abs(x - 160) < 30 && Math.abs(y - 49) < 20) {
            weightAB = val;
          }
          // C-D вес расположен около x=160, y=179
          if (Math.abs(x - 160) < 30 && Math.abs(y - 179) < 20) {
            weightCD = val;
          }
        }
      });
      return { weightAB, weightCD };
    });

    expect(slotWeights.weightAB).toBeGreaterThan(0);
    expect(slotWeights.weightCD).toBeGreaterThan(0);

    // Заполняем слоты токенами
    const slotsToFill = [
      { key: '0-1', val: slotWeights.weightAB },
      { key: '1-0', val: slotWeights.weightAB },
      { key: '2-3', val: slotWeights.weightCD },
      { key: '3-2', val: slotWeights.weightCD }
    ];

    for (const slotItem of slotsToFill) {
      // Ищем свободный токен с нужным значением в палитре
      const token = page.locator(`.token-chip:has-text("${slotItem.val}")`).first();
      await token.click();
      await page.locator(`#slot-${slotItem.key}`).click();
      await page.waitForTimeout(50);
    }

    await page.locator('#verify-btn').click();

    // --- ЭКРАН ПОБЕДЫ И ТЕЛЕМЕТРИЯ ---
    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.display-5')).toHaveText('МИССИЯ ВЫПОЛНЕНА!');

    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete' && e.success === true);
    expect(completeEvent, 'Telemetry must dispatch level_complete with success=true').toBeTruthy();
    expect(completeEvent.mission_name).toContain('Урок 8 :: Табличные модели (Уровень 1)');
  });

  test('Level 1 error scenario triggers failure alert, hardcore_reset telemetry and regenerates variant', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryEventMock', (evt) => {
      telemetryEvents.push(evt);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryEventMock(event.data);
        }
      });
    });

    await page.goto(encodeURI('/tasks/9-класс/8/level1'));
    await expect(page.locator('#phase-1-workspace')).toBeVisible();

    // Намеренно делаем ошибку: все карточки отправляем в шлюз [О-С]
    const cards = page.locator('#cards-pool .draggable-card');
    const totalCards = await cards.count();
    expect(totalCards).toBe(5);

    while (await cards.count() > 0) {
      await cards.first().click();
      await page.locator('#bin-os').click();
      await page.waitForTimeout(50);
    }

    await page.locator('#verify-btn').click();

    // Проверяем отображение сбоя
    await expect(page.locator('#status-alert')).toBeVisible();
    await expect(page.locator('#status-alert')).toHaveClass(/alert-danger/);
    await expect(page.locator('#attempts-display')).toHaveText('1');

    // Проверяем событие телеметрии hardcore_reset
    const resetEvent = telemetryEvents.find(e => e.action_type === 'hardcore_reset');
    expect(resetEvent, 'Must dispatch hardcore_reset telemetry on failure').toBeTruthy();

    // Проверяем процедурный сброс карточек обратно в буфер
    await page.waitForTimeout(1500);
    await expect(page.locator('#status-alert')).toBeHidden();
    expect(await page.locator('#cards-pool .draggable-card').count()).toBe(5);
  });
});
