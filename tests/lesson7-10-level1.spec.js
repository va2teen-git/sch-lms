import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('Grade 7 Lesson 10: Information Processes Level 1', () => {

  test('Zero Multiple Choice & Clean Layout Check', async ({ page }) => {
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level1');
    await expect(page.locator('#phase-1-container')).toBeVisible();
    expect(await page.locator('.container-fluid input[type="radio"]').count()).toBe(0);
    expect(await page.locator('.container-fluid select').count()).toBe(0);
  });

  test('Persona: NOVICE — misclassifies a card in Phase 1, triggers hardcore_reset & regenerates, then completes Level 1', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelL1Novice', (data) => telemetryEvents.push(data));
    await page.addInitScript(() => {
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'TELEMETRY_EVENT') window.onTelL1Novice(e.data);
      });
    });

    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/10/level1');

    // До первого взаимодействия start_time отложен и телеметрии ещё нет
    expect(telemetryEvents.length).toBe(0);

    // Ошибочно кладём все карточки в корзину 'collect'
    const count = await page.locator('#p1-cards-pool .p1-card').count();
    expect(count).toBe(6);
    for (let i = 0; i < count; i++) {
      const card = page.locator('#p1-cards-pool .p1-card').first();
      await card.click();
      await page.locator('.p1-dropzone[data-bucket="collect"] .card-header').click();
    }
    await page.locator('#p1-verify-btn').click();

    await expect(page.locator('#error-box')).toBeVisible();
    expect(telemetryEvents.some(e => e.action_type === 'hardcore_reset')).toBe(true);
    await expect(page.locator('#attempts-display')).toHaveText('1');

    // Ждём перегенерацию фазы 1
    await page.waitForTimeout(1450);
    await expect(page.locator('#error-box')).toBeHidden();
    await expect(page.locator('#p1-cards-pool .p1-card')).toHaveCount(6);

    // Теперь решаем Фазу 1 правильно
    for (let i = 0; i < 6; i++) {
      const card = page.locator('#p1-cards-pool .p1-card').first();
      const bucket = await card.getAttribute('data-type');
      await card.click();
      await page.locator(`.p1-dropzone[data-bucket="${bucket}"] .card-header`).click();
    }
    await page.locator('#p1-verify-btn').click();
    await expect(page.locator('#phase-2-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');

    // Фаза 2: Слот-пазл (модель Шеннона) — игнорируем 2 дистрактора
    for (const slotName of ['source', 'encoder', 'channel', 'noise', 'receiver']) {
      await page.locator(`#p2-tokens-pool .p2-token[data-expected-slot="${slotName}"]`).click();
      await page.locator(`.p2-slot[data-slot="${slotName}"]`).click();
    }
    await page.locator('#p2-verify-btn').click();
    await expect(page.locator('#phase-3-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');

    // Фаза 3: Коммутация узлов (провода) — соединяем только валидные карточки
    const caseCards = page.locator('.p3-case-card');
    const caseCount = await caseCards.count();
    for (let i = 0; i < caseCount; i++) {
      const card = caseCards.nth(i);
      const targetId = await card.getAttribute('data-target-id');
      if (targetId && targetId !== 'trap') {
        await card.click();
        await page.locator(`.p3-port-card[data-port-id="${targetId}"]`).click();
      }
    }
    await page.locator('#p3-verify-btn').click();

    await expect(page.locator('#success-screen')).toBeVisible();
    const completeEvt = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.stage).toBe(3);
    expect(completeEvt.total_stages).toBe(3);

    sim.assertCleanSession();
  });
});
