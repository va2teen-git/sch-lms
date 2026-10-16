import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('8 класс — Урок 9: Определение истинности составного высказывания (Уровень 1)', () => {
  const level1File = path.join(process.cwd(), 'src/pages/tasks/8-класс/9/level1.astro');
  const taskUrl = '/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level1';

  test('Архитектурный линтинг level1.astro (TaskLayout, Zero-Style-Tag, 3 фазы, телеметрия)', async () => {
    expect(fs.existsSync(level1File)).toBe(true);
    const code = fs.readFileSync(level1File, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}>');
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 9');

    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('E2E: Проверка реакции на ошибку (hardcore_reset) и процедурной регенерации в Фазе 1', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(taskUrl);

    await page.evaluate(() => {
      window.__telemetryEvents = [];
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'TELEMETRY_EVENT') {
          window.__telemetryEvents.push(e.data);
        }
      });
    });

    const nodeButtons = page.locator('.p1-node-toggle');
    await expect(nodeButtons).toHaveCount(4);

    // Выставляем заведомо неверные значения во все 4 узла
    for (let i = 0; i < 4; i++) {
      const btn = nodeButtons.nth(i);
      const expected = await btn.getAttribute('data-expected');
      const wrongVal = expected === '1' ? '0' : '1';
      await btn.click(); // [?] -> [0]
      if (wrongVal === '1') {
        await btn.click(); // [0] -> [1]
      }
    }

    await page.locator('#p1-verify-btn').click();
    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    const events = await page.evaluate(() => window.__telemetryEvents);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].action_type).toBe('hardcore_reset');
    expect(events[0].success).toBe(false);
  });

  test('E2E: Полное прохождение всех 3 фаз манипуляции мышью и получение level_complete', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(taskUrl);

    await page.evaluate(() => {
      window.__telemetryEvents = [];
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'TELEMETRY_EVENT') {
          window.__telemetryEvents.push(e.data);
        }
      });
    });

    // --- ФАЗА 1: Дерево вычислений ---
    const nodeButtons = page.locator('.p1-node-toggle');
    await expect(nodeButtons).toHaveCount(4);

    for (let i = 0; i < 4; i++) {
      const btn = nodeButtons.nth(i);
      const expected = await btn.getAttribute('data-expected');
      await btn.click(); // [?] -> [0]
      if (expected === '1') {
        await btn.click(); // [0] -> [1]
      }
    }

    await page.locator('#p1-verify-btn').click();
    await expect(page.locator('#phase2')).toBeVisible();

    // --- ФАЗА 2: Сборка интервала токенами (Slot & Snap) ---
    const slots = page.locator('.p2-slot');
    await expect(slots).toHaveCount(5);

    for (let i = 0; i < 5; i++) {
      const slot = slots.nth(i);
      const expectedVal = await slot.getAttribute('data-expected');
      const token = page.locator(`.p2-token[data-val="${expectedVal}"]`).first();
      await token.click();
      await slot.click();
    }

    await page.locator('#p2-verify-btn').click();
    await expect(page.locator('#phase3')).toBeVisible();

    // --- ФАЗА 3: Сортировка карточек по шлюзам ИСТИНА / ЛОЖЬ ---
    for (let i = 0; i < 6; i++) {
      const card = page.locator(`#p3-card-${i}`);
      const expectedBucket = await card.getAttribute('data-expected-bucket');
      await card.click();
      if (expectedBucket === 'true') {
        await page.locator('#p3-bucket-true').click();
      } else {
        await page.locator('#p3-bucket-false').click();
      }
    }

    await page.locator('#p3-verify-btn').click();
    await expect(page.locator('#success-screen')).toBeVisible();

    const events = await page.evaluate(() => window.__telemetryEvents);
    const completeEvent = events.find(e => e.action_type === 'level_complete');
    expect(completeEvent).toBeTruthy();
    expect(completeEvent.status).toBe('completed');
    expect(completeEvent.success).toBe(true);
    expect(completeEvent.mission_name).toContain('Урок 9');
  });
});
