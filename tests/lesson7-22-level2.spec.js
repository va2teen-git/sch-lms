import { test, expect } from '@playwright/test';

test.describe('7 класс - Урок 22 - Уровень 2 (Аналитический ручной ввод: 5 фаз)', () => {

  test('Полное прохождение всех 5 аналитических фаз (с использованием кнопки и клавиши Enter)', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level2');

    // === ФАЗА 1: Типографская метрология (пт и дюймы) ===
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');
    const ans1 = await page.locator('#p1-input').getAttribute('data-expected');
    await page.locator('#p1-input').fill(ans1 || '');
    await page.locator('#p1-input').press('Enter');

    // === ФАЗА 2: Геометрия полосы набора и таблиц на листе А4 ===
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');
    const ans2 = await page.locator('#p2-input').getAttribute('data-expected');
    await page.locator('#p2-input').fill(ans2 || '');
    await page.locator('#p2-btn').click();

    // === ФАЗА 3: Трассировка буфера обмена (Ctrl+C, Ctrl+X, Ctrl+V, Delete) ===
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 5');
    const ans3 = await page.locator('#p3-input').getAttribute('data-expected');
    await page.locator('#p3-input').fill(ans3 || '');
    await page.locator('#p3-input').press('Enter');

    // === ФАЗА 4: Аудит дампа непечатаемых символов (¶ vs ↵) ===
    await expect(page.locator('#phase4')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 4 из 5');
    const ans4 = await page.locator('#p4-input').getAttribute('data-expected');
    await page.locator('#p4-input').fill(ans4 || '');
    await page.locator('#p4-btn').click();

    // === ФАЗА 5: Экспертиза документа по критериям ОГЭ 13.2 (БАЛЛ:КЛАВИША) ===
    await expect(page.locator('#phase5')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 5 из 5');
    const ans5 = await page.locator('#p5-input').getAttribute('data-expected');
    await page.locator('#p5-input').fill(ans5 || '');
    await page.locator('#p5-input').press('Enter');

    await expect(page.locator('#success-screen')).toBeVisible();
  });

  test('Реакция на неверный ввод и регенерация задачи (Hardcore Feedback)', async ({ page }) => {
    await page.goto('/tasks/7-класс/22/level2');
    await expect(page.locator('#phase1')).toBeVisible();

    await page.locator('#p1-input').fill('999999');
    await page.locator('#p1-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');
  });

});
