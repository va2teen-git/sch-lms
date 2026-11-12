import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('9th Grade Lesson 8: Level 2 Task Suite (Analytical Calculations)', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/9-класс/8/level2.astro');

  test('Level 2 adheres to architectural and cognitive complexity requirements', async () => {
    expect(fs.existsSync(taskPath), 'level2.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}>');

    // 5 distinct phases following Sawtooth 2-1-2
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="phase4"');
    expect(code).toContain('id="phase5"');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 8 :: Табличные модели (Уровень 2)');

    // Zero-Style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Zero Multiple Choice Policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Anti-Paste protection
    expect(code).toContain('onpaste="return false;"');
  });

  test('Level 2 full 5-phase algorithmic walkthrough with telemetry verification', async ({ page }) => {
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

    await page.goto(encodeURI('/tasks/9-класс/8/level2'));

    // --- ФАЗА 1: Подсчет ребер неориентированного графа (5x5) ---
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');

    const p1Answer = await page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('#p1-matrix-tbody td'));
      let ones = 0;
      cells.forEach(td => {
        if (td.textContent.trim() === '1') ones++;
      });
      return ones / 2;
    });

    await page.locator('#p1-input').fill(String(p1Answer));
    await page.locator('#p1-btn').click();

    // --- ФАЗА 2: Кратчайший путь A → D по матрице 4×4 ---
    await expect(page.locator('#phase2')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');

    const p2Answer = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#p2-matrix-tbody tr'));
      const matrix = rows.map(tr => {
        const tds = Array.from(tr.querySelectorAll('td'));
        return tds.map(td => {
          const txt = td.textContent.trim();
          return (txt === '—' || txt === '·' || txt === '') ? null : parseInt(txt, 10);
        });
      });

      const wAB = matrix[0][1];
      const wAC = matrix[0][2];
      const wAD = matrix[0][3];
      const wBC = matrix[1][2];
      const wBD = matrix[1][3];
      const wCD = matrix[2][3];

      const pDirect = wAD;
      const pABD = wAB + wBD;
      const pACD = wAC + wCD;
      const pABCD = wAB + wBC + wCD;

      return Math.min(pDirect, pABD, pACD, pABCD);
    });

    await page.locator('#p2-input').fill(String(p2Answer));
    await page.locator('#p2-btn').click();

    // --- ФАЗА 3: Обратная задача — Восстановление скрытой переменной X ---
    await expect(page.locator('#phase3')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 5');

    const p3Answer = await page.evaluate(() => {
      const condText = document.getElementById('p3-condition-text').innerText;
      const match = condText.match(/(\d+)\s*км/);
      const totalL = parseInt(match[1], 10);

      // B-D находится в строке 1, столбце 3 матрицы 4x4
      const rows = Array.from(document.querySelectorAll('#p3-matrix-tbody tr'));
      const wBD = parseInt(rows[1].querySelectorAll('td')[3].textContent.trim(), 10);

      return totalL - wBD;
    });

    await page.locator('#p3-input').fill(String(p3Answer));
    await page.locator('#p3-btn').click();

    // --- ФАЗА 4: Логический анализ реляционной таблицы ---
    await expect(page.locator('#phase4')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 4 из 5');

    const p4Answer = await page.evaluate(() => {
      const condText = document.getElementById('p4-condition-box').innerText;
      if (condText.includes('NVMe')) {
        return 2; // SRV-01, SRV-03
      } else if (condText.includes('ARM') && condText.includes('НЕ')) {
        return 3; // SRV-01, SRV-03, SRV-06
      } else {
        return 2; // SRV-02, SRV-05
      }
    });

    await page.locator('#p4-input').fill(String(p4Answer));
    await page.locator('#p4-btn').click();

    // --- ФАЗА 5: Кульминационный пик — ОГЭ Задание 4 с ограничением ---
    await expect(page.locator('#phase5')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 5 из 5');

    const p5Answer = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('#p5-matrix-tbody tr'));
      const matrix = rows.map(tr => {
        const tds = Array.from(tr.querySelectorAll('td'));
        return tds.map(td => {
          const txt = td.textContent.trim();
          return (txt === '—' || txt === '·' || txt === '') ? null : parseInt(txt, 10);
        });
      });

      const wAC_direct = matrix[0][2];
      const wAB = matrix[0][1];
      const wBC = matrix[1][2];
      const minAC = Math.min(wAC_direct, wAB + wBC);

      const wCE_direct = matrix[2][4];
      const wCD = matrix[2][3];
      const wDE = matrix[3][4];
      const minCE = Math.min(wCE_direct, wCD + wDE);

      return minAC + minCE;
    });

    await page.locator('#p5-input').fill(String(p5Answer));
    await page.locator('#p5-btn').click();

    // --- ЭКРАН ПОБЕДЫ И ТЕЛЕМЕТРИЯ ---
    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.display-5')).toHaveText('УРОВЕНЬ 2 ПРОЙДЕН!');

    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete' && e.success === true);
    expect(completeEvent, 'Telemetry must dispatch level_complete with success=true').toBeTruthy();
    expect(completeEvent.mission_name).toContain('Урок 8 :: Табличные модели (Уровень 2)');
  });

  test('Level 2 error scenario triggers failure alert, hardcore_reset telemetry and clears input', async ({ page }) => {
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

    await page.goto(encodeURI('/tasks/9-класс/8/level2'));
    await expect(page.locator('#phase1')).toBeVisible();

    // Вводим заведомо неверный ответ
    await page.locator('#p1-input').fill('999');
    await page.locator('#p1-btn').click();

    // Проверяем отображение сбоя
    await expect(page.locator('#status-alert')).toBeVisible();
    await expect(page.locator('#status-alert')).toHaveClass(/alert-danger/);
    await expect(page.locator('#attempts-display')).toHaveText('1');

    // Проверяем событие телеметрии hardcore_reset
    const resetEvent = telemetryEvents.find(e => e.action_type === 'hardcore_reset');
    expect(resetEvent, 'Must dispatch hardcore_reset telemetry on failure').toBeTruthy();

    // Проверяем восстановление поля ввода
    await page.waitForTimeout(1400);
    await expect(page.locator('#status-alert')).toBeHidden();
    expect(await page.locator('#p1-input').inputValue()).toBe('');
  });
});
