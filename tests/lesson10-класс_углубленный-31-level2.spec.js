import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const LESSON_TASK_FILE = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/31/level2.astro');
const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level2';

async function attachTelemetrySpy(page) {
  await page.addInitScript(() => {
    window.__sentTelemetry = [];
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'TELEMETRY_EVENT') {
        window.__sentTelemetry.push(event.data);
      }
    });
  });
}

export async function computePhaseAnswerDOM(page, phaseNum) {
  await expect(page.locator(`#p${phaseNum}-condition li`).first()).toBeVisible();
  const condText = (await page.locator(`#p${phaseNum}-condition`).innerText()).replace(/\s+/g, ' ');

  if (phaseNum === 1) {
    const N = Number(condText.match(/N\s*=\s*(\d+)/)[1]);
    const pages = Number(condText.match(/Количество страниц:\s*(\d+)/)[1]);
    const lines = Number(condText.match(/Строк на каждой странице:\s*(\d+)/)[1]);
    const chars = Number(condText.match(/Символов в каждой строке:\s*(\d+)/)[1]);
    const i = Math.ceil(Math.log2(N));
    return (pages * lines * chars * i) / 8;
  }

  if (phaseNum === 2) {
    const mb = Number(condText.match(/Размер архива:\s*(\d+)\s*Мбайт/)[1]);
    const kbps = Number(condText.match(/Скорость передачи:\s*(\d+)\s*Кбит\/с/)[1]);
    const sec = (mb * 1024 * 8) / kbps;
    return Number((sec / 60).toFixed(6));
  }

  if (phaseNum === 3) {
    const dimMatch = condText.match(/(\d+)\s*стр\.\s*×\s*(\d+)\s*строк\s*×\s*(\d+)\s*символов/);
    const pages = Number(dimMatch[1]);
    const lines = Number(dimMatch[2]);
    const chars = Number(dimMatch[3]);
    const totalBytes = Number(condText.match(/не превышает\s*(\d+)\s*байт/)[1]);
    const K = pages * lines * chars;
    const i = Math.floor((totalBytes * 8) / K);
    return 1 << i;
  }

  if (phaseNum === 4) {
    const N = Number(condText.match(/N\s*=\s*(\d+)/)[1]);
    const B = Number(condText.match(/Размер кодируемого блока[^:]*:\s*(\d+)/)[1]);
    return Math.ceil(Math.log2(Math.pow(N, B)));
  }

  if (phaseNum === 5) {
    const M = Number(condText.match(/пользователей:\s*(\d+)/)[1]);
    const K = Number(condText.match(/идентификатора:\s*(\d+)/)[1]);
    const letters = Number(condText.match(/(\d+)\s*заглавных латинских букв/)[1]);
    const digits = Number(condText.match(/(\d+)\s*цифр/)[1]);
    const specMatch = condText.match(/(\d+)\s*специальных символов/);
    const specials = specMatch ? Number(specMatch[1]) : 0;
    const extraBytes = Number(condText.match(/Дополнительные сведения[^0-9]*(\d+)\s*байт/)[1]);
    const N = letters + digits + specials;
    const i = Math.ceil(Math.log2(N));
    const recBytes = Math.ceil((K * i) / 8) + extraBytes;
    return Number(((M * recBytes) / 1024).toFixed(6));
  }

  throw new Error(`Unsupported phaseNum: ${phaseNum}`);
}

export async function solvePhaseDOM(page, phaseNum, formatFn = (v) => String(v)) {
  const ans = await computePhaseAnswerDOM(page, phaseNum);
  const input = page.locator(`#p${phaseNum}-input`);
  await input.fill(formatFn(ans));
  await page.locator(`#p${phaseNum}-submit-btn`).click();
  return ans;
}

test.describe('10th Grade Advanced Lesson 31: Level 2 Analytical Suite', () => {
  test('Level 2 adheres to architectural requirements (Zero Multiple Choice, text inputmode=decimal, Zero-Style, Zero-CDN)', async () => {
    expect(fs.existsSync(LESSON_TASK_FILE), 'level2.astro must exist').toBe(true);
    const code = fs.readFileSync(LESSON_TASK_FILE, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}>');
    expect(code).toContain('LMSTelemetry');
    expect(code).toContain('Урок 31');

    // Forbid <input type="number"> and Multiple Choice
    expect(code).not.toMatch(/type=["']number["']/i);
    expect(code).not.toMatch(/<select\b/i);
    expect(code).not.toMatch(/type=["']radio["']/i);
    expect(code).toContain('inputmode="decimal"');

    // Zero-Style & Zero-CDN & Prince Integrity
    expect(code).not.toMatch(/<style\b/i);
    expect(code).not.toMatch(/https?:\/\/(?:cdn|unpkg|jsdelivr)/i);
    expect(code).not.toMatch(/prince_complete|prince-campaign/);
  });

  test('Full 5-phase Sawtooth walkthrough with Russian comma formatting & telemetry verification', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible();
      await expect(page.locator('#phase-badge')).toContainText(`Шаг ${p} из 5`);
      await solvePhaseDOM(page, p, (v) => ` ${String(v).replace('.', ',')} `);
    }

    await expect(page.locator('#victory-screen')).toBeVisible();

    const events = await page.evaluate(() => window.__sentTelemetry);
    const progressEvents = events.filter((e) => e.action_type === 'in_progress');
    expect(progressEvents.length).toBe(4);
    expect(progressEvents[0].stage).toBe(2);
    expect(progressEvents[0].total_stages).toBe(5);

    const completeEvt = events.find((e) => e.action_type === 'level_complete');
    expect(completeEvt).toBeDefined();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.stage).toBe(5);
    expect(completeEvt.total_stages).toBe(5);
    expect(completeEvt.start_time).toBeTruthy();
    expect(completeEvt.time_spent_sec).toBeGreaterThanOrEqual(1);
  });

  test('Wrong numeric answer triggers #feedback-box, emits level_fail, regenerates phase condition, and stays recoverable', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    const ans1 = await computePhaseAnswerDOM(page, 1);
    await page.locator('#p1-input').fill(String(ans1 + 77));
    await page.locator('#p1-submit-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    const failEvt = await page.evaluate(() => window.__sentTelemetry.find((e) => e.success === false));
    expect(failEvt).toBeDefined();
    expect(['hardcore_reset', 'level_fail']).toContain(failEvt.action_type);
    expect(failEvt.success).toBe(false);
    expect(failEvt.stage).toBe(1);
    expect(failEvt.total_stages).toBe(5);

    await page.waitForTimeout(1450);
    await expect(page.locator('#feedback-box')).toBeHidden();

    await solvePhaseDOM(page, 1);
    await expect(page.locator('#phase2')).toBeVisible();
  });
});
