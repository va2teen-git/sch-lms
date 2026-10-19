import { test, expect } from '@playwright/test';

test.describe('7 класс - Урок 22 - Уровень 1 (Манипуляция мышью: 3 фазы)', () => {

  test('Полное прохождение всех 3 фаз (Drag-to-Bucket, Slot & Snap, Калибратор параметров)', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level1');

    // === ФАЗА 1: Классификация 6 карточек по 3 шлюзам ===
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    for (let i = 0; i < 6; i++) {
      const card = page.locator('#p1-cards-pool .p1-card').first();
      const expectedBucket = await card.getAttribute('data-expected-bucket');
      await card.click();
      await page.locator(`.p1-dropzone[data-bucket="${expectedBucket}"]`).click();
    }

    await expect(page.locator('#btn-phase1')).toBeEnabled();
    await page.locator('#btn-phase1').click();

    // === ФАЗА 2: Слот-пазл непечатаемых символов и горячих клавиш ===
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');

    const slots = page.locator('#p2-slots-container .p2-slot-box');
    const slotCount = await slots.count();
    expect(slotCount).toBe(4);

    for (let i = 0; i < slotCount; i++) {
      const slot = slots.nth(i);
      const expectedToken = await slot.getAttribute('data-expected');
      await page.locator(`#p2-tokens-palette .p2-token-btn[data-token="${expectedToken}"]`).click();
      await slot.click();
    }

    await expect(page.locator('#btn-phase2')).toBeEnabled();
    await page.locator('#btn-phase2').click();

    // === ФАЗА 3: Интерактивный калибратор параметров страницы и абзаца ===
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');

    const targetSize = await page.locator('#p3-target-size').getAttribute('data-val');
    const targetIndent = await page.locator('#p3-target-indent').getAttribute('data-val');
    const targetMargin = await page.locator('#p3-target-margin').getAttribute('data-val');
    const targetAlign = await page.locator('#p3-target-align').getAttribute('data-val');
    const targetLh = await page.locator('#p3-target-lh').getAttribute('data-val');

    await page.evaluate(({ tSize, tIndent, tMargin }) => {
      const sSize = document.getElementById('p3-slider-size');
      const sIndent = document.getElementById('p3-slider-indent');
      const sMargin = document.getElementById('p3-slider-margin');
      if (sSize) { sSize.value = String(tSize); sSize.dispatchEvent(new Event('input')); }
      if (sIndent) { sIndent.value = String(parseFloat(tIndent)); sIndent.dispatchEvent(new Event('input')); }
      if (sMargin) { sMargin.value = String(parseFloat(tMargin)); sMargin.dispatchEvent(new Event('input')); }
    }, { tSize: targetSize, tIndent: targetIndent, tMargin: targetMargin });

    for (let clicks = 0; clicks < 5; clicks++) {
      const curAlign = await page.locator('#p3-btn-align').getAttribute('data-align');
      if (curAlign === targetAlign) break;
      await page.locator('#p3-btn-align').click();
    }

    for (let clicks = 0; clicks < 5; clicks++) {
      const curLh = await page.locator('#p3-btn-lh').getAttribute('data-lh');
      if (curLh === targetLh) break;
      await page.locator('#p3-btn-lh').click();
    }

    await page.locator('#btn-phase3').click();
    await expect(page.locator('#success-screen')).toBeVisible();
  });

  test('Обработка ошибки и процедурная регенерация на Фазе 1', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level1');
    await expect(page.locator('#phase1')).toBeVisible();

    // Намеренно кладем все 6 карточек в заведомо неверную корзину
    for (let i = 0; i < 6; i++) {
      const card = page.locator('#p1-cards-pool .p1-card').first();
      const expectedBucket = await card.getAttribute('data-expected-bucket');
      const wrongBucket = expectedBucket === 'edit' ? 'char' : 'edit';
      await card.click();
      await page.locator(`.p1-dropzone[data-bucket="${wrongBucket}"]`).click();
    }

    await page.locator('#btn-phase1').click();
    await expect(page.locator('#error-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');
  });

});
