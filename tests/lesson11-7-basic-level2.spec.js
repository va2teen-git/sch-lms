import { test, expect } from '@playwright/test';

test.describe('Grade 11 Basic Lesson 7: Malware & Antivirus Level 2', () => {
  const taskUrl = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/7/level2';

  test('Zero Multiple Choice check: no radio buttons or select dropdowns', async ({ page }) => {
    await page.goto(taskUrl);
    
    // Ensure no multiple-choice input elements
    const radios = await page.locator('input[type="radio"]').count();
    expect(radios).toBe(0);

    const selects = await page.locator('select').count();
    expect(selects).toBe(0);
  });

  test('Full Walkthrough: Complete all 5 analytical phases and achieve victory', async ({ page }) => {
    await page.goto(taskUrl);

    // ================= ФАЗА 1: РАСЧЕТ РАЗРЯДНОСТИ ХЕША =================
    await expect(page.locator('#phase1')).toBeVisible();
    const hexLengthText = await page.locator('#p1-hex-length').textContent();
    const hexLen = parseInt(hexLengthText.trim(), 10);
    const expectedBits = (hexLen * 4).toString();

    await page.locator('#p1-input').fill(expectedBits);
    await page.locator('#p1-btn').click();

    // ================= ФАЗА 2: ВЫЯВЛЕНИЕ МАЛОПРИВЕТЛИВОГО PID =================
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 2 из 5');

    const rows = page.locator('#p2-process-table tr');
    const rowCount = await rows.count();
    let malwarePid = '';

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const pid = (await row.locator('td').nth(0).textContent()).trim();
      const name = (await row.locator('td').nth(1).textContent()).trim();
      const path = (await row.locator('td').nth(2).textContent()).trim();

      // Check if suspicious: typo in name or wrong directory
      const isSuspiciousName = name === 'scvhost.exe' || name === 'svch0st.exe' || name === 'csrsss.exe';
      const isSuspiciousPath = path.includes('Temp') || path.includes('ProgramData');

      if (isSuspiciousName || isSuspiciousPath) {
        malwarePid = pid;
        break;
      }
    }

    expect(malwarePid).not.toBe('');
    await page.locator('#p2-input').fill(malwarePid);
    await page.locator('#p2-btn').click();

    // ================= ФАЗА 3: ИСТИННОЕ РАСШИРЕНИЕ =================
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 3 из 5');

    const filename = (await page.locator('#p3-filename-display').textContent()).trim();
    const parts = filename.split('.');
    const realExt = parts[parts.length - 1].toLowerCase();

    await page.locator('#p3-input').fill(realExt);
    await page.locator('#p3-btn').click();

    // ================= ФАЗА 4: АВТОЗАГРУЗКА (PERSISTENCE) =================
    await expect(page.locator('#phase4')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 4 из 5');

    const regEntries = page.locator('#p4-registry-dump .font-monospace');
    const regCount = await regEntries.count();
    let suspiciousKey = '';

    for (let i = 0; i < regCount; i++) {
      const entryText = await regEntries.nth(i).textContent();
      // Check if entry points to Temp, AppData, powershell, or bat/vbs
      if (entryText.includes('Temp') || entryText.includes('powershell') || entryText.includes('ProgramData') || entryText.includes('Public') || entryText.includes('Roaming')) {
        const keyMatch = entryText.match(/"([^"]+)"\s*=/);
        if (keyMatch) {
          suspiciousKey = keyMatch[1];
          break;
        }
      }
    }

    expect(suspiciousKey).not.toBe('');
    await page.locator('#p4-input').fill(suspiciousKey);
    await page.locator('#p4-btn').click();

    // ================= ФАЗА 5: РАСЧЕТ БЭКАПА 3-2-1 =================
    await expect(page.locator('#phase5')).toBeVisible();
    await expect(page.locator('#level-badge')).toHaveText('Шаг 5 из 5');

    const sizeText = (await page.locator('#p5-data-size').textContent()).trim();
    const dataSize = parseInt(sizeText, 10);
    const expectedTotalSize = (dataSize * 3).toString();

    await page.locator('#p5-input').fill(expectedTotalSize);
    await page.locator('#p5-btn').click();

    // ================= ЭКРАН ПОБЕДЫ =================
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-errors')).toHaveText('0');
    await expect(page.locator('#level-badge')).toHaveText('Финиш');
    await expect(page.locator('#level-title')).toHaveText('Уровень 2 успешно завершен');
  });

  test('Lesson Page Integration: Level 2 tab and iframe exist with correct src', async ({ page }) => {
    await page.goto('/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/7');

    // Verify Tab 2 button exists
    const tab2 = page.locator('button[data-target="iframe-2"]');
    await expect(tab2).toBeVisible();
    await expect(tab2).toContainText('Уровень 2');

    // Verify iframe for level 2 exists in DOM with correct src
    const iframe2 = page.locator('#iframe-2');
    await expect(iframe2).toHaveCount(1);
    await expect(iframe2).toHaveAttribute('src', '/tasks/11-класс_базовый/7/level2');
  });
});
