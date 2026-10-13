import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('7 класс. Урок 6. Уровень 3: Аркада Firewall Interceptor', () => {
  const taskFilePath = path.join(process.cwd(), 'src/pages/tasks/7-класс/6/level3.astro');

  test('Архитектурное соответствие правилам платформы и геймдизайна Уровня 3', async () => {
    expect(fs.existsSync(taskFilePath)).toBe(true);
    const content = fs.readFileSync(taskFilePath, 'utf-8');

    // 1. Использование TaskLayout с level=3
    expect(content).toContain('import TaskLayout');
    expect(content).toContain('<TaskLayout level={3}');

    // 2. Отсутствие запрещенных тегов style
    expect(content.includes('<style>')).toBe(false);
    expect(content.includes('<style ')).toBe(false);

    // 3. Использование Vue 3
    expect(content).toContain('createApp');
    expect(content).toContain('Vue');
    expect(content).toContain('/static/vue.global.js');

    // 4. Наличие локального таймера на волну
    expect(content).toMatch(/timer|timeleft|waveTimeLimit/i);

    // 5. Контракт телеметрии
    expect(content).toContain('TELEMETRY_EVENT');
    expect(content).toContain('level_complete');
    expect(content).toContain('hardcore_reset');
    expect(content).toContain('Урок 6');

    // 6. Тактические действия и экраны
    expect(content).toContain('btn-action-allow');
    expect(content).toContain('btn-action-block');
    expect(content).toContain('btn-action-quarantine');
    expect(content).toContain('btn-action-disinfect');
    expect(content).toContain('success-screen');
    expect(content).toContain('alarm-box');
  });

  test('Сквозное отражение всех 10 волн в аркадном режиме с победным экраном', async ({ page }) => {
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

    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6/level3');

    // Стартуем испытание
    const btnStart = page.locator('#btn-start');
    await expect(btnStart).toBeVisible();
    await btnStart.click();

    // Отражаем 10 волн
    for (let wave = 0; wave < 10; wave++) {
      await expect(page.locator('#target-packet-card')).toBeVisible();

      const text = await page.locator('#target-packet-card').textContent();
      
      if (text.includes('MICROSOFT') || text.includes('NOERROR') || text.includes('NO_EMBEDDED_JS') || text.includes('PLAIN_TEXT') || text.includes('CORRECT_NTP')) {
        await page.locator('#btn-action-allow').click();
      } else if (text.includes('EXPLOIT') || text.includes('MASQUERADE') || text.includes('POW_MINER') || text.includes('BRUTEFORCE') || text.includes('WINLOCK')) {
        await page.locator('#btn-action-block').click();
      } else if (text.includes('HEURISTIC:POLYMOPHIC') || text.includes('ENCRYPTED_ZIP') || text.includes('HEURISTIC:SUSPICIOUS_OBFUSCATION') || text.includes('KERNEL_HOOK')) {
        await page.locator('#btn-action-quarantine').click();
      } else if (text.includes('notepad.exe') || text.includes('Annual_Budget') || text.includes('school_main_portal') || text.includes('CURE_AVAILABLE')) {
        await page.locator('#btn-action-disinfect').click();
      } else {
        // Fallback default
        await page.locator('#btn-action-block').click();
      }
    }

    // Проверяем экран успеха
    await expect(page.locator('#success-screen')).toBeVisible();
    await expect(page.locator('#success-screen h1')).toContainText('ПЕРИМЕТР БЕЗОПАСНОСТИ УСПЕШНО ЗАЩИЩЕН');

    // Проверяем телеметрию завершения
    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.success).toBe(true);
    expect(completeEvent.status).toBe('completed');
  });

  test('Тестирование тотального хардкор-сброса на шаг 1 при ошибке', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryMessageReset', (data) => {
      telemetryEvents.push(data);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryMessageReset(event.data);
        }
      });
    });

    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6/level3');
    await page.locator('#btn-start').click();

    await expect(page.locator('#target-packet-card')).toBeVisible();
    const text = await page.locator('#target-packet-card').textContent();

    // Намеренно выбираем неверное действие
    if (text.includes('MICROSOFT') || text.includes('NOERROR')) {
      await page.locator('#btn-action-block').click(); // Легитимный блокируем
    } else {
      await page.locator('#btn-action-allow').click(); // Вредонос пропускаем
    }

    // Должна сработать тревога сброса
    await expect(page.locator('#alarm-box')).toBeVisible();

    // Проверяем событие телеметрии hardcore_reset
    const resetEvent = telemetryEvents.find(e => e.action_type === 'hardcore_reset');
    expect(resetEvent).toBeDefined();
  });
});
