import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

// Видимый решатель сетки труб (читает только публичные data-* атрибуты и текст на экране)
function findRotationsToSolve(grid, inRow, targetOutRow, decoyOutRow) {
  const size = grid.length;
  const DR = [-1, 0, 1, 0];
  const DC = [0, 1, 0, -1];

  function getPorts(kind, rot) {
    let base = [];
    if (kind === 'straight') base = [1, 3];
    else if (kind === 'elbow') base = [0, 1];
    else if (kind === 'tee') base = [0, 1, 3];
    else return [];
    return base.map(d => (d + rot) % 4);
  }

  // Находим простой путь без шума и блоков от (inRow, 0) до (targetOutRow, size - 1)
  const visited = Array.from({ length: size }, () => Array(size).fill(false));
  const path = [];

  function dfs(r, c, inDir) {
    const cell = grid[r][c];
    if (cell.kind === 'noise' || cell.kind === 'block' || cell.kind === 'tee') return false;
    visited[r][c] = true;
    path.push({ r, c, inDir });

    if (r === targetOutRow && c === size - 1) {
      // Проверяем, можно ли повернуть конечный узел так, чтобы соединить inDir и RIGHT(1)
      const isValidEnd = [0, 1, 2, 3].some(rot => {
        const ports = getPorts(cell.kind, rot);
        return ports.includes(inDir) && ports.includes(1);
      });
      if (isValidEnd) return true;
    }

    for (let d = 0; d < 4; d++) {
      const nr = r + DR[d];
      const nc = c + DC[d];
      if (nr < 0 || nr >= size || nc < 0 || nc >= size || visited[nr][nc]) continue;
      // Проверяем, что текущая клетка имеет форму, способную соединить inDir и d
      const canBridge = [0, 1, 2, 3].some(rot => {
        const ports = getPorts(cell.kind, rot);
        return ports.includes(inDir) && ports.includes(d);
      });
      if (!canBridge) continue;
      if (dfs(nr, nc, (d + 2) % 4)) return true;
    }

    path.pop();
    visited[r][c] = false;
    return false;
  }

  dfs(inRow, 0, 3);

  const clicks = [];
  for (let i = 0; i < path.length; i++) {
    const { r, c, inDir } = path[i];
    const outDir = i < path.length - 1
      ? [0, 1, 2, 3].find(d => r + DR[d] === path[i + 1].r && c + DC[d] === path[i + 1].c)
      : 1;
    const cell = grid[r][c];

    let targetRot = cell.rot;
    for (let rot = 0; rot < 4; rot++) {
      const ports = getPorts(cell.kind, rot);
      if (ports.includes(inDir) && ports.includes(outDir)) {
        // Если это tee, стараемся не задеть шум или decoyOutRow
        if (cell.kind === 'tee') {
          const touchesHazard = ports.some(d => {
            const nr = r + DR[d];
            const nc = c + DC[d];
            if (nc === size && d === 1 && r === decoyOutRow) return true;
            if (nr >= 0 && nr < size && nc >= 0 && nc < size && grid[nr][nc].kind === 'noise') return true;
            return false;
          });
          if (touchesHazard) continue;
        }
        targetRot = rot;
        break;
      }
    }
    const delta = (targetRot - cell.rot + 4) % 4;
    if (delta > 0) clicks.push({ r, c, times: delta });
  }
  return clicks;
}

test.describe('Grade 7 Lesson 10: Information Processes Level 3 & Full Integration', () => {

  test('Lesson page renders theory, Logo-Storm terms, Additional Info, and 3 level tabs', async ({ page }) => {
    await page.goto('/lesson/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10');
    await expect(page.locator('header h1')).toContainText('Информационные процессы');

    const theoryContent = page.locator('.prose');
    await expect(theoryContent).toBeVisible();
    await expect(theoryContent).toContainText('Дополнительная информация');
    await expect(page.locator('.tab-btn')).toHaveCount(3);
  });

  test('Level 3 Intro blocks premature telemetry; NOVICE triggers hardcore reset; DILIGENT passes all 10 waves', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelL3', (data) => telemetryEvents.push(data));
    await page.addInitScript(() => {
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'TELEMETRY_EVENT') window.onTelL3(e.data);
      });
    });

    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level3');

    // Интро блокирует раннюю телеметрию
    await expect(page.locator('#start-btn')).toBeVisible();
    await page.waitForTimeout(300);
    expect(telemetryEvents.length).toBe(0);

    await page.locator('#start-btn').click();
    await expect(page.locator('#arcade-arena')).toBeVisible();

    // NOVICE: преждевременный пуск без сборки цепи вызывает hardcore_reset
    await page.locator('#launch-btn').click();
    await expect(page.locator('.alert-danger:has-text("АВАРИЙНЫЙ СБРОС")')).toBeVisible();
    expect(telemetryEvents.some(e => e.action_type === 'hardcore_reset')).toBe(true);

    // Ждём откат на Волну 1
    await page.waitForTimeout(1750);
    await expect(page.locator('.badge:has-text("Волна 1 из 10")')).toBeVisible();

    // DILIGENT: решаем все 10 волн через видимый DOM + SPACE
    for (let w = 0; w < 10; w++) {
      await expect(page.locator(`.badge:has-text("Волна ${w + 1} из 10")`)).toBeVisible({ timeout: 3000 });

      const state = await page.evaluate(() => {
        const packetText = document.querySelector('#arcade-arena .text-info')?.textContent || '';
        const buttons = Array.from(document.querySelectorAll('button[data-row][data-col]'));
        const maxRow = Math.max(...buttons.map(b => Number(b.dataset.row)));
        const size = maxRow + 1;
        const grid = Array.from({ length: size }, () => Array(size).fill(null));
        buttons.forEach(b => {
          grid[Number(b.dataset.row)][Number(b.dataset.col)] = {
            kind: b.dataset.kind,
            rot: Number(b.dataset.rot)
          };
        });

        const inCells = Array.from(document.querySelectorAll('#arcade-arena .border-info'));
        let inRow = 0;
        const leftCol = document.querySelectorAll('#arcade-arena .d-flex.flex-column.justify-content-between.gap-2')[0];
        if (leftCol) {
          Array.from(leftCol.children).forEach((el, idx) => {
            if (el.textContent.includes('ВХОД IN')) inRow = idx;
          });
        }

        const outBtns = Array.from(document.querySelectorAll('button[data-out-row]'));
        let targetOutRow = 0;
        let decoyOutRow = 1;
        outBtns.forEach(b => {
          const lbl = b.dataset.outLabel || '';
          if (lbl && packetText.includes(lbl)) {
            targetOutRow = Number(b.dataset.outRow);
          } else if (lbl) {
            decoyOutRow = Number(b.dataset.outRow);
          }
        });

        return { grid, inRow, targetOutRow, decoyOutRow };
      });

      const clicks = findRotationsToSolve(state.grid, state.inRow, state.targetOutRow, state.decoyOutRow);
      for (const { r, c, times } of clicks) {
        const cellBtn = page.locator(`button[data-row="${r}"][data-col="${c}"]`);
        for (let t = 0; t < times; t++) {
          await cellBtn.click();
        }
      }

      // Проверяем, что статус показывает готовность, и запускаем через SPACE
      await page.keyboard.press('Space');
      await page.waitForTimeout(350);
    }

    await expect(page.locator('#success-screen')).toBeVisible({ timeout: 5000 });
    const completeEvt = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.wave).toBe(10);

    sim.assertCleanSession();
  });
});
