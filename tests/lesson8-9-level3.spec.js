import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('8 класс — Урок 9: Определение истинности составного высказывания (Уровень 3 — Аркада)', () => {
  const level3File = path.join(process.cwd(), 'src/pages/tasks/8-класс/9/level3.astro');
  const taskUrl = '/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level3';

  test('Архитектурный линтинг level3.astro (TaskLayout, Vue 3, локальный таймер, Zero-Style-Tag, телеметрия)', async () => {
    expect(fs.existsSync(level3File)).toBe(true);
    const code = fs.readFileSync(level3File, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={3}>');
    expect(code).toContain('createApp');
    expect(code).toContain('Vue');
    expect(code).toMatch(/timer|timeleft|phaseTimeLeft/i);
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 9');

    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('E2E: Проверка тотального сброса на Волну 1 (hardcore_reset) при ошибке коммутации на 2-й волне', async ({ page }) => {
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

    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-indicator')).toContainText('1 / 10');

    // Проходим Волну 1 верно
    const expP1 = await page.locator('#gate-node-p').getAttribute('data-expected-p');
    const expQ1 = await page.locator('#gate-node-q').getAttribute('data-expected-q');
    const expF1 = await page.locator('#gate-node-f').getAttribute('data-expected-f');

    if (expP1 === '1') await page.locator('#gate-node-p').click();
    if (expQ1 === '1') await page.locator('#gate-node-q').click();
    if (expF1 === '1') await page.locator('#gate-node-f').click();
    await page.locator('#btn-boost').click();

    // Убеждаемся, что перешли на Волну 2
    await expect(page.locator('#wave-indicator')).toContainText('2 / 10');

    // На Волне 2 намеренно инвертируем выход F от ожидаемого
    const expF2 = await page.locator('#gate-node-f').getAttribute('data-expected-f');
    if (expF2 === '0') {
      await page.locator('#gate-node-f').click(); // ставим 1 вместо 0
    }
    await page.locator('#btn-boost').click();

    // Должна сработать сирена и телеметрия hardcore_reset
    await expect(page.locator('#alarm-box')).toBeVisible();
    const events = await page.evaluate(() => window.__telemetryEvents);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].action_type).toBe('hardcore_reset');
    expect(events[0].success).toBe(false);

    // После окончания сирены прогресс обязан сброситься на Волну 1 / 10
    await expect(page.locator('#wave-indicator')).toContainText('1 / 10', { timeout: 3000 });
  });

  test('E2E: Сквозное прохождение всех 10 волн аркады (Logic Pulse Runner) и получение level_complete', async ({ page }) => {
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

    await page.locator('#start-btn').click();

    for (let wave = 1; wave <= 10; wave++) {
      await expect(page.locator('#wave-indicator')).toContainText(`${wave} / 10`);

      const gateP = page.locator('#gate-node-p');
      const gateQ = page.locator('#gate-node-q');
      const gateF = page.locator('#gate-node-f');

      const expP = await gateP.getAttribute('data-expected-p');
      const expQ = await gateQ.getAttribute('data-expected-q');
      const expF = await gateF.getAttribute('data-expected-f');

      if (expP === '1') await gateP.click();
      if (expQ === '1') await gateQ.click();
      if (expF === '1') await gateF.click();

      await page.locator('#btn-boost').click();
    }

    await expect(page.locator('#success-screen')).toBeVisible();

    const events = await page.evaluate(() => window.__telemetryEvents);
    const completeEvent = events.find(e => e.action_type === 'level_complete');
    expect(completeEvent).toBeTruthy();
    expect(completeEvent.status).toBe('completed');
    expect(completeEvent.success).toBe(true);
    expect(completeEvent.mission_name).toContain('Урок 9');
  });
});
