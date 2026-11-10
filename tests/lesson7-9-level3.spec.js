import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Grade 7 Lesson 9: Information & Data Level 3 (Arcade Stream Analyzer)', () => {
  const taskFilePath = path.join(process.cwd(), 'src/pages/tasks/7-класс/9/level3.astro');

  test('Architectural contracts: TaskLayout, zero style, zero multiple choice, Vue 3', async () => {
    expect(fs.existsSync(taskFilePath)).toBe(true);
    const content = fs.readFileSync(taskFilePath, 'utf-8');

    expect(content).toContain('import TaskLayout');
    expect(content).toContain('<TaskLayout level={3}');
    expect(content.includes('<style>')).toBe(false);
    expect(content.includes('<style ')).toBe(false);
    expect(content).not.toContain('type="radio"');
    expect(content).not.toContain('<select');
    expect(content).toContain('createApp');
    expect(content).toContain('Vue');
    expect(content).toContain('/static/vue.global.js');
    expect(content).toContain('TELEMETRY_EVENT');
    expect(content).toContain('level_complete');
    expect(content).toContain('hardcore_reset');
    expect(content).toContain('Урок 9');
  });

  test('Full Walkthrough: Complete all 10 waves of Data Stream Analyzer with keyboard hotkeys & buttons', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryCapturedL3', (data) => {
      telemetryEvents.push(data);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryCapturedL3(event.data);
        }
      });
    });

    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level3');

    // Нажатие на кнопку старта
    const startBtn = page.locator('#start-game-btn');
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // Проходим все 10 волн
    for (let wave = 0; wave < 10; wave++) {
      await page.waitForTimeout(100);
      const text = await page.locator('.card.border-danger').innerText();

      // Определяем: валидный или ложный пакет
      const isInvalid = text.includes('-350') ||
                        text.includes('не указан') ||
                        text.includes('2017') ||
                        text.includes('ОТСУТСТВУЕТ (сырые') ||
                        text.includes('Белый шум') ||
                        text.includes('отвратительная') ||
                        text.includes('%#@!&*') ||
                        text.includes('КРИТИЧЕСКАЯ АНОМАЛИЯ') ||
                        text.includes('УСТАРЕВШИЕ ДАННЫЕ') ||
                        text.includes('ЭЛЕКТРОМАГНИТНЫЙ ШУМ') ||
                        text.includes('СУБЪЕКТИВНАЯ ОЦЕНКА') ||
                        text.includes('НЕПОНЯТНАЯ ИНФОРМАЦИЯ');

      if (isInvalid) {
        // Чередуем клик и хоткей
        if (wave % 2 === 0) {
          await page.locator('#btn-drop').click();
        } else {
          await page.keyboard.press('d');
        }
      } else {
        if (wave % 2 === 0) {
          await page.locator('#btn-accept').click();
        } else {
          await page.keyboard.press('a');
        }
      }
    }

    // Проверяем экран триумфа
    await expect(page.locator('h2:has-text("ФИНАЛЬНЫЙ БОСС ПОВЕРЖЕН!")')).toBeVisible({ timeout: 5000 });

    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.success).toBe(true);
  });

  test('Hardcore fail on incorrect action triggers reset to wave 1 and telemetry', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryCapturedErrL3', (data) => {
      telemetryEvents.push(data);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryCapturedErrL3(event.data);
        }
      });
    });

    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level3');
    await page.locator('#start-game-btn').click();

    // Проверяем текст и делаем намеренно противоположное действие
    const text = await page.locator('.card.border-danger').innerText();
    const isInvalid = text.includes('-350') ||
                      text.includes('не указан') ||
                      text.includes('2017') ||
                      text.includes('ОТСУТСТВУЕТ (сырые') ||
                      text.includes('Белый шум') ||
                      text.includes('отвратительная') ||
                      text.includes('%#@!&*') ||
                      text.includes('КРИТИЧЕСКАЯ АНОМАЛИЯ') ||
                      text.includes('УСТАРЕВШИЕ ДАННЫЕ') ||
                      text.includes('ЭЛЕКТРОМАГНИТНЫЙ ШУМ') ||
                      text.includes('СУБЪЕКТИВНАЯ ОЦЕНКА') ||
                      text.includes('НЕПОНЯТНАЯ ИНФОРМАЦИЯ');

    if (isInvalid) {
      await page.locator('#btn-accept').click();
    } else {
      await page.locator('#btn-drop').click();
    }

    // Появляется аварийный оверлей
    await expect(page.locator('.alert-danger:has-text("ХАРДКОР-СБРОС НА ВОЛНУ 1")')).toBeVisible();

    const resetEvent = telemetryEvents.find(e => e.action_type === 'hardcore_reset');
    expect(resetEvent).toBeDefined();
    expect(resetEvent.success).toBe(false);

    // После 2 секунд восстанавливается волна 1
    await page.waitForTimeout(2200);
    await expect(page.locator('.badge:has-text("ВОЛНА 1 / 10")')).toBeVisible();
  });
});
