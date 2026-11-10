import { test, expect } from '@playwright/test';

test.describe('Grade 7 Lesson 9: Full Integration & Prince of Persia Hardcore Bonus', () => {

  test('Lesson container loads theory, task tabs, and configures Prince of Persia bonus', async ({ page }) => {
    await page.goto('/lesson/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9');

    // Проверка заголовка и темы
    await expect(page.locator('header h1')).toContainText('Информация и данные');

    // Проверка рендеринга теории
    const theoryContent = page.locator('.prose');
    await expect(theoryContent).toBeVisible();
    await expect(theoryContent).toContainText('Понятия информации и данных');
    await expect(theoryContent).toContainText('Дополнительная информация');

    // Проверка вкладок уровней
    const tabs = page.locator('.tab-btn');
    await expect(tabs).toHaveCount(3); // Ур 1 + Ур 2 + Ур 3

    // Проверка наличия элементов Prince of Persia в DOM
    const princeCard = page.locator('#prince-bonus-card');
    await expect(princeCard).toBeAttached();
    await expect(princeCard).toContainText('PRINCE OF PERSIA (1989)');
    await expect(princeCard).toContainText('УРОВЕНЬ 1');
  });

  test('Hardcore completion reveals Prince of Persia bonus card and launches emulator', async ({ page }) => {
    await page.route('**/api/progress*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          unlockedNormal: 3,
          unlockedHardcore: 4,
          isNormalCompleted: true,
          isHardcoreCompleted: true
        })
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Шахрияр');
      localStorage.setItem('student_lastName', 'Аль-Хорезми');
      localStorage.setItem('student_class', '7-класс');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_7-класс_9', 'true');
    });
    await page.goto('/lesson/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9');
    await page.waitForLoadState('domcontentloaded');

    // Экран завершения с хардкор-победой и карточкой Prince of Persia
    await expect(page.locator('#completion-screen')).toBeVisible();
    await expect(page.locator('#completion-title')).toContainText('Хардкор');

    const princeBonusCard = page.locator('#prince-bonus-card');
    await expect(princeBonusCard).toBeVisible();
    await expect(princeBonusCard).toContainText('PRINCE OF PERSIA (1989)');
    await expect(princeBonusCard).toContainText('УРОВЕНЬ 1');

    // Проверяем открытие оверлея Prince of Persia по кнопке
    const openBtn = page.locator('#open-prince-btn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    await expect(page.locator('#prince-overlay')).toBeVisible();
    const princeIframe = page.locator('#prince-game-iframe');
    await expect(princeIframe).toBeVisible();

    const src = await princeIframe.getAttribute('src');
    expect(src).toContain('level=1');
    expect(src).toContain('maxLevel=1');
    expect(src).toContain('skipTitle=true');

    // Проверяем кнопки оверлея
    await expect(page.locator('#prince-reload-btn')).toBeVisible();
    await expect(page.locator('#prince-fullscreen-btn')).toBeVisible();
    await expect(page.locator('#close-prince-btn')).toBeVisible();
  });
});
