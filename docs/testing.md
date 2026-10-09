# Правила тестирования (Testing Workflow)

Разработка уроков для School LMS требует обязательного покрытия интеграционными (e2e) тестами с использованием Playwright. Каждый новый созданный урок (тренажер) должен сопровождаться соответствующим тестовым файлом в папке `tests/`.

## 1. Общие требования к тестам
* Все тесты пишутся на базе Playwright и располагаются в папке `tests/`.
* Файлы тестов должны иметь суффикс `.spec.js` или `.spec.ts` (например, `level-1-2.spec.js`).
* Тесты должны запускаться локально через команду `npx playwright test` (настроено на запуск MS Edge в headless-режиме против `http://localhost:4321`).
* Для взаимодействия с iframe тренажера необходимо использовать `page.frameLocator('#iframe-1')`.

## 2. Обязательные сценарии тестирования
Каждый урок должен тестироваться как минимум по двум сценариям:
1. **Успешное прохождение (Normal Completion):**
   * Прохождение всех фаз (этапов) тренажера.
   * Парсинг значений из DOM (например, получение чисел для задачи).
   * Вычисление правильного ответа внутри теста и его ввод в инпуты.
   * Проверка перехода между фазами (скрытие предыдущей, появление следующей).
   * Проверка появления экрана успешного завершения.
   * Проверка записи события `level_complete` в базу данных SQLite (`telemetry.db`).

2. **Отработка ошибок и Хардкор-режим (Hardcore Reset):**
   * Включение хардкор-режима в браузере через `localStorage.setItem('hardcore_mode', 'true')` и перезагрузка страницы.
   * Ввод заведомо неверного ответа.
   * Перехват и подтверждение диалогового окна (`dialog.accept()`) с сообщением о сбросе.
   * Ожидание перезагрузки iframe и проверка того, что тренажер сгенерировал новые значения (процедурная генерация отработала снова).
   * Проверка записи события `hardcore_reset` в базу данных SQLite (`telemetry.db`).

## 3. Шаблон и пример теста
Используйте существующий файл `tests/level1.spec.js` в качестве эталонного шаблона.

Основные элементы:
```javascript
import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('Название урока', () => {

  test('Успешное прохождение уровня', async ({ page }) => {
    // 1. Переход на страницу урока
    await page.goto('http://localhost:4321/lesson/класс/номер_урока');
    const frame = page.frameLocator('#iframe-1');
    
    // 2. Прохождение фаз
    await expect(frame.locator('#phase1')).toBeVisible();
    // Парсинг значений, вычисление, заполнение и клик
    
    // 3. Проверка успешного экрана
    await expect(frame.locator('#success-screen')).toBeVisible();
    await page.waitForTimeout(1000); // Ожидание записи телеметрии
    
    // 4. Проверка БД
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.success).toBe(1);
  });

  test('Обработка ошибок в хардкор-режиме', async ({ page }) => {
    // 1. Переход на страницу и включение хардкора
    await page.goto('http://localhost:4321/lesson/класс/номер_урока');
    await page.evaluate(() => { localStorage.setItem('hardcore_mode', 'true'); });
    await page.reload();
    
    // 2. Ввод неверного ответа и перехват alert
    const frame = page.frameLocator('#iframe-1');
    await frame.locator('#input-id').fill('wrong_answer');
    
    const alertPromise = page.waitForEvent('dialog');
    await frame.locator('#btn-id').click();
    const dialog = await alertPromise;
    expect(dialog.message()).toContain('ОШИБКА В РЕЖИМЕ ХАРДКОРА');
    await dialog.accept();
    
    // 3. Проверка перезагрузки и генерации новых данных
    await expect(frame.locator('#phase1')).toBeVisible();
    // (опционально) проверка изменения значений
    
    // 4. Проверка БД на запись hardcore_reset
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'hardcore_reset' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.is_hardcore).toBe(1);
  });
});
```

## 4. Визуальное тестирование стилей (Visual/Screenshot Testing)
ИИ-агент при создании или изменении уроков **обязан** выполнять E2E-тест с созданием скриншотов через Playwright (в headless-режиме) и сопоставлять результаты с ожидаемым дизайном.
1. Это гарантирует отсутствие багов с CSS/цветами (например, нечитаемый текст в карточках).
2. Скриншоты нужно сохранять в папку `dev_scripts/` или `scratch/` для анализа перед коммитом (коммитить сами скриншоты в репозиторий не нужно, если они не требуются для документации).
3. Пример захвата скриншота в скрипте:
   ```javascript
   await page.screenshot({ path: 'dev_scripts/scr_test_end.png' });
   ```
4. Агент должен проанализировать полученный скриншот через зрение или проанализировать логи выполнения Playwright-скрипта для подтверждения видимости элементов.

## 5. Запуск и отладка при разработке
* При написании тестов используйте `npx playwright test --ui` для визуальной отладки, если вам доступен графический интерфейс (только в режиме рабочего стола пользователя, ИИ-агенты используют headless-запуск).
* При падении тестов внимательно изучите селекторы в компонентах Astro/HTML. Если тесты падают из-за таймингов, добавьте `await expect(...).toBeVisible()` для ожидания появления элементов.
* Для ИИ-агентов: Обязательно убедитесь, что тесты завершаются успешно, и проведите визуальную верификацию, прежде чем завершать работу над задачей и делать Pull Request.
