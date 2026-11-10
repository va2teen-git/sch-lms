import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Grade 7 Lesson 9: Information & Data Level 2', () => {
  const taskFilePath = path.join(process.cwd(), 'src/pages/tasks/7-класс/9/level2.astro');

  test('Architectural contracts: TaskLayout, zero style, zero multiple choice', async () => {
    expect(fs.existsSync(taskFilePath)).toBe(true);
    const content = fs.readFileSync(taskFilePath, 'utf-8');

    expect(content).toContain('import TaskLayout');
    expect(content).toContain('<TaskLayout level={2}');
    expect(content.includes('<style>')).toBe(false);
    expect(content.includes('<style ')).toBe(false);
    expect(content).not.toContain('type="radio"');
    expect(content).not.toContain('<select');
    expect(content).toContain('TELEMETRY_EVENT');
    expect(content).toContain('level_complete');
    expect(content).toContain('hardcore_reset');
    expect(content).toContain('Урок 9');
  });

  test('Zero Multiple Choice & Anti-Paste check', async ({ page }) => {
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level2');

    const radios = await page.locator('.container-fluid input[type="radio"]').count();
    expect(radios).toBe(0);

    const selects = await page.locator('.container-fluid select').count();
    expect(selects).toBe(0);

    const inputs = await page.locator('.container-fluid input').count();
    expect(inputs).toBeGreaterThanOrEqual(1);

    // Тест блокировки paste
    const input = page.locator('#p1-input');
    await input.focus();
    await input.evaluate(el => {
      const pasteEvent = new Event('paste', { bubbles: true, cancelable: true });
      el.dispatchEvent(pasteEvent);
    });

    await expect(page.locator('#paste-notice')).toBeVisible();
  });

  test('Full Walkthrough: Complete all 5 phases with dynamic formula calculations', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryCapturedL2', (data) => {
      telemetryEvents.push(data);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryCapturedL2(event.data);
        }
      });
    });

    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level2');

    // --- ФАЗА 1 ---
    await expect(page.locator('#phase1')).toBeVisible();
    const p1Text = await page.locator('#p1-task-desc').innerText();
    const p1VolMatch = p1Text.match(/(\d+)\s*Кбайт/);
    const p1PctMatch = p1Text.match(/(\d+)%/);
    const v = parseInt(p1VolMatch[1], 10);
    const p = parseInt(p1PctMatch[1], 10);
    const p1Ans = Math.round(v * (p / 100));

    await page.locator('#p1-input').fill(String(p1Ans));
    await page.locator('#p1-btn').click();

    // --- ФАЗА 2 ---
    await expect(page.locator('#phase2')).toBeVisible();
    const p2Text = await page.locator('#p2-task-desc').innerText();
    const p2SecMatch = p2Text.match(/каждые\s*(\d+)\s*с/);
    const p2MinMatch = p2Text.match(/(\d+)\s*мин/);
    const p2BytesMatch = p2Text.match(/(\d+)\s*байт/);
    const s = parseInt(p2SecMatch[1], 10);
    const m = parseInt(p2MinMatch[1], 10);
    const b = parseInt(p2BytesMatch[1], 10);
    const p2Ans = Math.floor((m * 60) / s) * b;

    await page.locator('#p2-input').fill(String(p2Ans));
    await page.locator('#p2-btn').click();

    // --- ФАЗА 3 ---
    await expect(page.locator('#phase3')).toBeVisible();
    const p3Text = await page.locator('#p3-task-desc').innerText();
    const p3SecMatch = p3Text.match(/(\d+)\s*с/);
    const p3BytesMatch = p3Text.match(/([\d\s]+)\s*байт/);
    const t = parseInt(p3SecMatch[1], 10);
    const totalBytes = parseInt(p3BytesMatch[1].replace(/\s+/g, ''), 10);
    // 16 бит = 2 байта
    const p3Ans = Math.round(totalBytes / 2 / t);

    await page.locator('#p3-input').fill(String(p3Ans));
    await page.locator('#p3-btn').click();

    // --- ФАЗА 4 ---
    await expect(page.locator('#phase4')).toBeVisible();
    const p4Text = await page.locator('#p4-task-desc').innerText();
    const p4Matches = [...p4Text.matchAll(/(\d+)\s*пакетов/g)];
    const totalPkts = parseInt(p4Matches[0][1], 10);
    const noisePkts = parseInt(p4Matches[1][1], 10);
    const dupPkts = parseInt(p4Matches[2][1], 10);
    const p4Ans = totalPkts - noisePkts - dupPkts;

    await page.locator('#p4-input').fill(String(p4Ans));
    await page.locator('#p4-btn').click();

    // --- ФАЗА 5 ---
    await expect(page.locator('#phase5')).toBeVisible();
    const p5Text = await page.locator('#p5-task-desc').innerText();
    const p5CmdMatch = p5Text.match(/(\d+)\s*различных команд/);
    const n = parseInt(p5CmdMatch[1], 10);
    let pow = 1;
    while (pow < n) {
      pow *= 2;
    }
    const p5Ans = pow - n;

    await page.locator('#p5-input').fill(String(p5Ans));
    await page.locator('#p5-btn').click();

    // --- ЭКРАН УСПЕХА ---
    await expect(page.locator('#phase5')).toBeHidden();
    await expect(page.locator('#success-screen')).toBeVisible();

    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.success).toBe(true);
    expect(completeEvent.status).toBe('completed');
  });

  test('Error handling in Phase 1 triggers hardcore_reset telemetry and regenerates', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryCapturedErrL2', (data) => {
      telemetryEvents.push(data);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryCapturedErrL2(event.data);
        }
      });
    });

    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level2');

    // Вводим заведомо неверное число
    await page.locator('#p1-input').fill('999999');
    await page.locator('#p1-btn').click();

    await expect(page.locator('#error-box')).toBeVisible();
    await expect(page.locator('#error-message')).toContainText('ОШИБКА РАСЧЕТА');

    const resetEvent = telemetryEvents.find(e => e.action_type === 'hardcore_reset');
    expect(resetEvent).toBeDefined();
    expect(resetEvent.success).toBe(false);

    await page.waitForTimeout(1600);
    await expect(page.locator('#p1-input')).toHaveValue('');
  });
});
