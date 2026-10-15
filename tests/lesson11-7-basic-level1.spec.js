import { test, expect } from '@playwright/test';

test.describe('Grade 11 Basic Lesson 7: Malware & Antivirus Level 1', () => {
  const taskUrl = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/7/level1';

  test('Zero Multiple Choice check: no radio buttons or select dropdowns', async ({ page }) => {
    await page.goto(taskUrl);
    
    // Ensure no multiple-choice input elements
    const radios = await page.locator('input[type="radio"]').count();
    expect(radios).toBe(0);

    const selects = await page.locator('select').count();
    expect(selects).toBe(0);
  });

  test('Phase 1: Bucket sorting of incidents by Polyakov malware taxonomy', async ({ page }) => {
    await page.goto(taskUrl);
    
    await expect(page.locator('#phase-1-container')).toBeVisible();
    await expect(page.locator('#p1-cards-pool')).toBeVisible();

    // Check 4 incident cards are generated in pool
    const cards = page.locator('#p1-cards-pool .incident-card');
    await expect(cards).toHaveCount(4);

    // Place each card into its correct taxonomy bucket
    for (let i = 0; i < 4; i++) {
      // Pick the first card currently in the pool
      const card = page.locator('#p1-cards-pool .incident-card').first();
      const cardType = await card.getAttribute('data-type');
      expect(['virus', 'worm', 'trojan']).toContain(cardType);

      // Click card to select
      await card.click();

      // Click target bucket dropzone
      const dropzone = page.locator(`.bucket-container[data-bucket="${cardType}"] .bucket-dropzone`);
      await dropzone.click();
    }

    // Verify button should now be enabled
    const verifyBtn = page.locator('#p1-verify-btn');
    await expect(verifyBtn).toBeEnabled();
    await verifyBtn.click();

    // Should advance to Phase 2
    await expect(page.locator('#phase-1-container')).toBeHidden();
    await expect(page.locator('#phase-2-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
  });

  test('Full Walkthrough: Complete all 3 phases and achieve victory with telemetry', async ({ page }) => {
    // Intercept postMessage telemetry
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryEvent', (event) => {
      telemetryEvents.push(event);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryEvent(e.data);
        }
      });
    });

    await page.goto(taskUrl);

    // --- ФАЗА 1 ---
    await expect(page.locator('#phase-1-container')).toBeVisible();
    for (let i = 0; i < 4; i++) {
      const card = page.locator('#p1-cards-pool .incident-card').first();
      const cardType = await card.getAttribute('data-type');
      await card.click();
      await page.locator(`.bucket-container[data-bucket="${cardType}"] .bucket-dropzone`).click();
    }
    await page.locator('#p1-verify-btn').click();

    // --- ФАЗА 2 ---
    await expect(page.locator('#phase-2-container')).toBeVisible();
    const expectedSlots = ['сигнатурный', 'хеш', 'эвристический', 'эмуляция', 'поведенческий', 'шифрование'];

    for (const matchType of expectedSlots) {
      const token = page.locator(`.puzzle-token[data-match="${matchType}"]`);
      await expect(token).toBeVisible();
      await token.click();

      const slot = page.locator(`.slot-target[data-expected="${matchType}"]`);
      await slot.click();
    }

    const p2VerifyBtn = page.locator('#p2-verify-btn');
    await expect(p2VerifyBtn).toBeEnabled();
    await p2VerifyBtn.click();

    // --- ФАЗА 3 ---
    await expect(page.locator('#phase-3-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');

    // 1. Установить ползунки правила 3-2-1
    await page.locator('#slider-copies').fill('3');
    await page.locator('#slider-copies').dispatchEvent('input');
    await expect(page.locator('#val-copies')).toHaveText('3');

    await page.locator('#slider-media').fill('2');
    await page.locator('#slider-media').dispatchEvent('input');
    await expect(page.locator('#val-media')).toHaveText('2');

    await page.locator('#slider-offline').fill('1');
    await page.locator('#slider-offline').dispatchEvent('input');
    await expect(page.locator('#val-offline')).toHaveText('1');

    // 2. Настроить тумблеры безопасности
    const accountBtn = page.locator('#toggle-account-btn');
    const accountState = await accountBtn.getAttribute('data-state');
    if (accountState === 'admin') {
      await accountBtn.click();
    }
    await expect(accountBtn).toHaveAttribute('data-state', 'user');

    const autorunBtn = page.locator('#toggle-autorun-btn');
    const autorunState = await autorunBtn.getAttribute('data-state');
    if (autorunState === 'enabled') {
      await autorunBtn.click();
    }
    await expect(autorunBtn).toHaveAttribute('data-state', 'disabled');

    // Нажать кнопку активации защиты
    await page.locator('#p3-verify-btn').click();

    // Экран победы должен появиться
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-errors')).toHaveText('0');
    await expect(page.locator('#phase-badge')).toHaveText('Финиш');
    await expect(page.locator('#phase-title')).toHaveText('Уровень 1 успешно завершен');
  });

  test('Lesson Page Integration: Theory and Level 1 iframe are displayed', async ({ page }) => {
    await page.goto('/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/7');

    // Verify Lesson Header
    await expect(page.locator('header h1')).toContainText('Вредоносное программное обеспечение');

    // Verify Theory Content is rendered
    const theorySection = page.locator('section').first();
    await expect(theorySection).toBeVisible();
    await expect(theorySection).toContainText('Вредоносное программное обеспечение и способы борьбы с ним');
    await expect(theorySection).toContainText('статьей 273 Уголовного кодекса РФ');
    await expect(theorySection).toContainText('Компьютерные вирусы');
    await expect(theorySection).toContainText('Сетевые черви');
    await expect(theorySection).toContainText('Троянские программы');

    // Verify iframe for level 1 exists and loads
    const iframe = page.locator('#iframe-1');
    await expect(iframe).toBeVisible();
    const frame = page.frameLocator('#iframe-1');
    await expect(frame.locator('#phase-1-container')).toBeVisible();
    await expect(frame.locator('#phase-badge')).toHaveText('Шаг 1 из 3');
  });
});

