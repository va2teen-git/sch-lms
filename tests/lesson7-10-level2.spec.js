import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

function solvePhaseText(phaseNum, text) {
  const nums = text.match(/\d+/g).map(Number);
  if (phaseNum === 1) {
    // v * t
    return nums[0] * nums[1];
  }
  if (phaseNum === 2) {
    // (bps / 8) * t
    return (nums[0] / 8) * nums[1];
  }
  if (phaseNum === 3) {
    // (kb * 1024) / t
    return (nums[0] * 1024) / nums[1];
  }
  if (phaseNum === 4) {
    // (files * sizeKb / ratio) * copies
    return ((nums[0] * nums[1]) / nums[2]) * nums[3];
  }
  if (phaseNum === 5) {
    // ceil(totalBytes / packSize) + retries
    return Math.ceil(nums[0] / nums[1]) + nums[2];
  }
  throw new Error('Unknown phase ' + phaseNum);
}

test.describe('Grade 7 Lesson 10: Information Processes Level 2 (Personas & Difficulty)', () => {

  test('Level 2 — Cognitive Difficulty Calibration & Sawtooth 2-1-2 Audit', async () => {
    const sim = new StudentSimulator(null, {
      persona: LearnerPersona.DILIGENT,
      courseSlug: '7-класс',
      lessonId: 10,
      levelNumber: 2
    });

    sim.recordPhaseDifficulty(1, { title: 'Прямой расчёт I = v × t', depth: 1, memory: 2, scaffolding: 1 });
    sim.recordPhaseDifficulty(2, { title: 'Конвертация бит/с в байт/с', depth: 2, memory: 2, scaffolding: 1 });
    sim.recordPhaseDifficulty(3, { title: 'Инверсия: поиск скорости канала (Пик 1)', depth: 2, memory: 2, inversion: 1 });
    sim.recordPhaseDifficulty(4, { title: 'Сжатие и резервное копирование (Долина)', depth: 2, memory: 2, scaffolding: 1 });
    sim.recordPhaseDifficulty(5, { title: 'Пакетная передача и шум (Кульминация)', depth: 2, memory: 2, inversion: 1 });

    sim.assertDifficultyCompliance({
      sawtooth: true,
      corridor: true,
      noFakeDifficulty: true,
      renderReport: true
    });
  });

  test('Personas: NOVICE (error + regeneration), CARELESS (spaces/comma/units), CHAOS (empty/NaN), DILIGENT (full pass)', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelL2', (data) => telemetryEvents.push(data));
    await page.addInitScript(() => {
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'TELEMETRY_EVENT') window.onTelL2(e.data);
      });
    });

    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level2');

    // Проверка, что input type != number (чтобы не блокировались пробелы и запятые)
    for (let p = 1; p <= 5; p++) {
      const inputType = await page.locator(`#p${p}-input`).getAttribute('type');
      expect(inputType).toBe('text');
    }

    // CHAOS: пустой ввод на Фазе 1 вызывает предупреждение, но не крашит страницу
    await page.locator('#p1-btn').click();
    await expect(page.locator('#error-box')).toBeVisible();
    await page.waitForTimeout(1400);
    await expect(page.locator('#error-box')).toBeHidden();

    // NOVICE: неверный ответ на Фазе 1 -> hardcore_reset и перегенерация
    await page.locator('#p1-input').fill('999999');
    await page.locator('#p1-btn').click();
    await expect(page.locator('#error-box')).toBeVisible();
    await page.waitForTimeout(1400);
    await expect(page.locator('#error-box')).toBeHidden();

    // CARELESS + DILIGENT прохождение всех 5 фаз с пробелами/запятыми/единицами и Enter
    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible();
      const descText = await page.locator(`#p${p}-desc`).innerText();
      const ans = solvePhaseText(p, descText);

      let inputVal = String(ans);
      if (p === 1) inputVal = `  ${ans},0  `;
      if (p === 2) inputVal = ` ${ans} байт `;
      if (p === 4) inputVal = `  ${ans} Кбайт`;

      await page.locator(`#p${p}-input`).fill(inputVal);
      if (p % 2 === 1) {
        await page.locator(`#p${p}-input`).press('Enter');
      } else {
        await page.locator(`#p${p}-btn`).click();
      }
    }

    await expect(page.locator('#success-screen')).toBeVisible();
    const completeEvt = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.stage).toBe(5);
    expect(completeEvt.total_stages).toBe(5);
    expect(telemetryEvents.some(e => e.action_type === 'hardcore_reset')).toBe(true);

    sim.assertCleanSession();
  });
});
