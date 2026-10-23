import { test, expect } from '@playwright/test';

test.describe('Grade 7 Lesson 8: Cyber Security & Internet Communications Level 1', () => {

  test('Zero Multiple Choice check: no radio buttons or select dropdowns', async ({ page }) => {
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level1');

    const radios = await page.locator('.container-fluid input[type="radio"]').count();
    expect(radios).toBe(0);

    const selects = await page.locator('.container-fluid select').count();
    expect(selects).toBe(0);
  });

  test('Phase 1: Correspondence classification (Drag-to-Bucket)', async ({ page }) => {
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level1');

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#p1-cards-pool')).toBeVisible();

    const verifyBtn = page.locator('#btn-phase1');
    await expect(verifyBtn).toBeDisabled();

    // Получаем все карточки из пула и распределяем по шлюзам через клики
    const cards = page.locator('#p1-cards-pool .p1-card');
    const cardCount = await cards.count();
    expect(cardCount).toBe(6);

    for (let i = 0; i < cardCount; i++) {
      const card = page.locator('#p1-cards-pool .p1-card').first();
      const type = await card.getAttribute('data-type');
      await card.click();

      const dropzone = page.locator(`.p1-dropzone[data-bucket="${type}"]`);
      await dropzone.click();
    }

    await expect(verifyBtn).toBeEnabled();
    await verifyBtn.click();

    // Переход на Фазу 2
    await expect(page.locator('#phase1')).toBeHidden();
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
  });

  test('Full Walkthrough: Complete all 3 phases and verify telemetry events', async ({ page }) => {
    // Перехватываем события postMessage от окна
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryCaptured', (data) => {
      telemetryEvents.push(data);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryCaptured(event.data);
        }
      });
    });

    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level1');

    // --- ФАЗА 1 ---
    const cards = page.locator('#p1-cards-pool .p1-card');
    const count1 = await cards.count();
    for (let i = 0; i < count1; i++) {
      const card = page.locator('#p1-cards-pool .p1-card').first();
      const type = await card.getAttribute('data-type');
      await card.click();
      await page.locator(`.p1-dropzone[data-bucket="${type}"]`).click();
    }
    await page.locator('#btn-phase1').click();
    await expect(page.locator('#phase2')).toBeVisible();

    // --- ФАЗА 2: Конструирование письма (Slot & Snap) ---
    // Слоты: recipient, subject, greeting, body, signature
    const slotKeys = ['recipient', 'subject', 'greeting', 'body', 'signature'];
    for (const key of slotKeys) {
      const token = page.locator(`.p2-token[data-id="p2c_${key}"]`);
      await expect(token).toBeVisible();
      await token.click();

      const slot = page.locator(`.p2-slot-card[data-slot-key="${key}"]`);
      await slot.click();
    }

    const verifyBtn2 = page.locator('#btn-phase2');
    await expect(verifyBtn2).toBeEnabled();
    await verifyBtn2.click();

    await expect(page.locator('#phase2')).toBeHidden();
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');

    // --- ФАЗА 3: Коммутация протоколов (Node Linking) ---
    const connections = [
      { src: 'src_smtps', tgt: 'tgt_465' },
      { src: 'src_pop3s', tgt: 'tgt_995' },
      { src: 'src_imaps', tgt: 'tgt_993' },
      { src: 'src_wifi', tgt: 'tgt_vpn' }
    ];

    for (const conn of connections) {
      await page.locator(`.p3-source-node[data-source-id="${conn.src}"]`).click();
      await page.locator(`.p3-target-node[data-target-id="${conn.tgt}"]`).click();
    }

    await page.locator('#btn-phase3').click();

    // --- ЭКРАН УСПЕХА ---
    await expect(page.locator('#phase3')).toBeHidden();
    await expect(page.locator('#success-screen')).toBeVisible();

    // Проверяем телеметрию
    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvent).toBeDefined();
    expect(completeEvent.success).toBe(true);
    expect(completeEvent.status).toBe('completed');
  });

  test('Error handling in Phase 1 triggers hardcore_reset telemetry and regenerates', async ({ page }) => {
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryCapturedError', (data) => {
      telemetryEvents.push(data);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryCapturedError(event.data);
        }
      });
    });

    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level1');

    // Намеренно кладем все карточки в неверный шлюз (все в 'spam')
    const cards = page.locator('#p1-cards-pool .p1-card');
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      const card = page.locator('#p1-cards-pool .p1-card').first();
      await card.click();
      await page.locator('.p1-dropzone[data-bucket="spam"]').click();
    }

    await page.locator('#btn-phase1').click();

    // Должен показаться блок ошибки
    await expect(page.locator('#error-box')).toBeVisible();

    // Проверяем отправку события hardcore_reset
    await expect.poll(() => {
      return telemetryEvents.some(e => e.action_type === 'hardcore_reset');
    }).toBe(true);
  });

});
