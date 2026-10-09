import { test, expect } from '@playwright/test';

const LEVEL_URL = 'http://localhost:4321/tasks/9-класс/6/level3';

const correctAnswers = [
  "protocol = 'HTTP'",
  "suspicious = 1",
  "status = 404 OR status = 403",
  "protocol = 'FTP' AND suspicious = 1",
  "protocol != 'HTTPS'",
  "suspicious = 1 AND protocol = 'HTTP' AND status != 200",
  "domain = 'vk.com' AND (status = 403 OR status = 404)",
  "protocol != 'HTTPS' AND (status = 200 OR status = 404) AND suspicious = 1"
];

test.describe('Баг-тесты (выявление уязвимостей)', () => {
    test('Неверный синтаксис запроса приводит к ACCESS DENIED и сбросу (hardcore_reset)', async ({ page }) => {
        await page.goto(LEVEL_URL);
        // Wait for DB loading to finish
        await expect(page.locator('text=Инициализировать соединение')).toBeVisible({ timeout: 10000 });
        await page.click('button:has-text("Инициализировать соединение")');
        await expect(page.locator('text=УГРОЗА: 1 / 8')).toBeVisible();
        
        // Вводим неверный синтаксис
        await page.fill('input[type="text"]', "wrong syntax((");
        await page.click('button:has-text("Выполнить запрос")');
        
        // Должен появиться экран ACCESS DENIED
        await expect(page.locator('text=ACCESS DENIED')).toBeVisible();
        await expect(page.locator('text=Синтаксическая ошибка SQL:')).toBeVisible();
        
        // Через 3 секунды должен быть рестарт на первую фазу
        await page.waitForTimeout(3500);
        await expect(page.locator('text=УГРОЗА: 1 / 8')).toBeVisible();
    });

    test('Отправка пустого запроса игнорируется (не сбрасывает таймер)', async ({ page }) => {
        await page.goto(LEVEL_URL);
        await expect(page.locator('text=Инициализировать соединение')).toBeVisible({ timeout: 10000 });
        await page.click('button:has-text("Инициализировать соединение")');
        await expect(page.locator('text=УГРОЗА: 1 / 8')).toBeVisible();
        
        await page.fill('input[type="text"]', "   ");
        await page.click('button:has-text("Выполнить запрос")');
        
        // Всё еще на первой фазе, не сбросилось
        await expect(page.locator('text=УГРОЗА: 1 / 8')).toBeVisible();
        await expect(page.locator('text=ACCESS DENIED')).not.toBeVisible();
    });

    test('Истечение таймера вызывает ACCESS DENIED', async ({ page }) => {
        test.setTimeout(60000); 
        await page.goto(LEVEL_URL);
        await expect(page.locator('text=Инициализировать соединение')).toBeVisible({ timeout: 10000 });
        await page.click('button:has-text("Инициализировать соединение")');
        
        // Таймер первой фазы 40 секунд. Ждем 41 сек.
        await page.waitForTimeout(41000);
        
        await expect(page.locator('text=ACCESS DENIED')).toBeVisible();
        await expect(page.locator('text=ВРЕМЯ ИСТЕКЛО!')).toBeVisible();
    });

    test('Логически неверный фильтр (ошибочный WHERE) приводит к ACCESS DENIED', async ({ page }) => {
        await page.goto(LEVEL_URL);
        await expect(page.locator('text=Инициализировать соединение')).toBeVisible({ timeout: 10000 });
        await page.click('button:has-text("Инициализировать соединение")');
        await expect(page.locator('text=УГРОЗА: 1 / 8')).toBeVisible();
        
        // На первой фазе ожидается protocol='HTTP', введем protocol='FTP'
        await page.fill('input[type="text"]', "protocol = 'FTP'");
        await page.click('button:has-text("Выполнить запрос")');
        
        await expect(page.locator('text=ACCESS DENIED')).toBeVisible();
        await expect(page.locator('text=Неверный результат')).toBeVisible();
    });
});

test.describe('Тесты полного прохождения (10 прогонов для проверки вариативности)', () => {
    for (let i = 1; i <= 10; i++) {
        test(`Прогон ${i}: Успешное прохождение 8 фаз (решаемость гарантирована)`, async ({ page }) => {
            await page.goto(LEVEL_URL);
            await expect(page.locator('text=Инициализировать соединение')).toBeVisible({ timeout: 10000 });
            await page.click('button:has-text("Инициализировать соединение")');
            
            for (let phase = 0; phase < 8; phase++) {
                await expect(page.locator(`text=УГРОЗА: ${phase + 1} / 8`)).toBeVisible();
                await page.fill('input[type="text"]', correctAnswers[phase]);
                await page.click('button:has-text("Выполнить запрос")');
                // Подождем немного, чтобы UI обновился
                await page.waitForTimeout(100);
            }
            
            // Финальный экран
            await expect(page.locator('text=УГРОЗА УСТРАНЕНА')).toBeVisible();
            await expect(page.locator('text=ЗАДАНИЕ ВЫПОЛНЕНО')).toBeVisible();
        });
    }
});
