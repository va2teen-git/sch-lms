import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('8 класс — Урок 9: Определение истинности составного высказывания (Уровень 2)', () => {
  const level2File = path.join(process.cwd(), 'src/pages/tasks/8-класс/9/level2.astro');
  const taskUrl = '/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level2';

  test('Архитектурный линтинг level2.astro (TaskLayout, 5 процедурных фаз, Zero-Style-Tag, телеметрия)', async () => {
    expect(fs.existsSync(level2File)).toBe(true);
    const code = fs.readFileSync(level2File, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}>');
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="phase4"');
    expect(code).toContain('id="phase5"');
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

    const p1Input = page.locator('#p1-input');
    const expected = await p1Input.getAttribute('data-expected');
    const wrongVal = expected === '1' ? '0' : '1';

    await p1Input.fill(wrongVal);
    await page.locator('#p1-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    const events = await page.evaluate(() => window.__telemetryEvents);
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].action_type).toBe('hardcore_reset');
    expect(events[0].success).toBe(false);
  });

  test('E2E: Полное прохождение всех 5 аналитических фаз (ручной ввод) и получение level_complete', async ({ page }) => {
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

    for (let phase = 1; phase <= 5; phase++) {
      const phaseContainer = page.locator(`#phase${phase}`);
      await expect(phaseContainer).toBeVisible();

      const input = page.locator(`#p${phase}-input`);
      const expected = await input.getAttribute('data-expected');
      expect(expected).toBeTruthy();

      await input.fill(expected);
      await page.locator(`#p${phase}-btn`).click();
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
