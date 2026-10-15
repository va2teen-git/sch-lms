import { test, expect } from '@playwright/test';

test.describe('Grade 11 Basic Lesson 7: Malware & Antivirus Level 3 (Archetype 7 ICE Node Race)', () => {
  const taskUrl = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/7/level3';

  test('Zero Multiple Choice check: no radio buttons or select dropdowns', async ({ page }) => {
    await page.goto(taskUrl);
    
    // Ensure no multiple-choice input elements
    const radios = await page.locator('input[type="radio"]').count();
    expect(radios).toBe(0);

    const selects = await page.locator('select').count();
    expect(selects).toBe(0);
  });

  test('Briefing screen and Hardcore Reset on open breach', async ({ page }) => {
    await page.goto(taskUrl);

    // 1. Briefing is visible
    const startBtn = page.locator('#start-btn');
    await expect(startBtn).toBeVisible();

    // 2. Start game
    await startBtn.click();
    await expect(page.locator('#wave-counter')).toContainText('ВОЛНА 1 ИЗ 8');

    // 3. Trigger premature containment without isolation -> should trigger Hardcore Reset
    const containBtn = page.locator('#contain-btn');
    await containBtn.click();

    // Check crash message appears
    await expect(page.locator('.h3:has-text("СБОЙ КИБЕРЗАЩИТЫ")')).toBeVisible();

    // After reset delay, returns to Wave 1 with incremented attempts
    await expect(page.locator('#attempts-display')).toHaveText('2', { timeout: 3500 });
    await expect(page.locator('#wave-counter')).toContainText('ВОЛНА 1 ИЗ 8');
  });

  test('Full Walkthrough: Complete all 8 waves of network worm containment', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    await page.goto(taskUrl);
    await page.locator('#start-btn').click();

    // ================= ВОЛНА 1: ЛИНЕЙНЫЙ ВЕКТОР =================
    await expect(page.locator('#wave-counter')).toContainText('ВОЛНА 1 ИЗ 8');
    // Разрываем ребро e2 (коммутатор - шлюз)
    await page.locator('#btn-edge-e2').click();
    await expect(page.locator('#contain-btn')).toContainText('ОЧАГ ИЗОЛИРОВАН');
    await page.locator('#contain-btn').click();

    // ================= ВОЛНА 2: ТОПОЛОГИЯ ЗВЕЗДА =================
    await expect(page.locator('#wave-counter')).toContainText('ВОЛНА 2 ИЗ 8');
    // Разрываем ребро e1 (источник заражения - свитч)
    await page.locator('#btn-edge-e1').click();
    await expect(page.locator('#contain-btn')).toContainText('ОЧАГ ИЗОЛИРОВАН');
    await page.locator('#contain-btn').click();

    // ================= ВОЛНА 3: ДВОЙНОЙ ВЕКТОР ОБХОДА =================
    await expect(page.locator('#wave-counter')).toContainText('ВОЛНА 3 ИЗ 8');
    // Разрываем магистраль к целевому хранилищу e5
    await page.locator('#btn-edge-e5').click();
    await expect(page.locator('#contain-btn')).toContainText('ОЧАГ ИЗОЛИРОВАН');
    await page.locator('#contain-btn').click();

    // ================= ВОЛНА 4: СЕГМЕНТАЦИЯ МОСТА =================
    await expect(page.locator('#wave-counter')).toContainText('ВОЛНА 4 ИЗ 8');
    // Разрываем ребро e5 (к целевому хранилищу)
    await page.locator('#btn-edge-e5').click();
    await expect(page.locator('#contain-btn')).toContainText('ОЧАГ ИЗОЛИРОВАН');
    await page.locator('#contain-btn').click();

    // ================= ВОЛНА 5: RANSOMWARE В MESH-СЕТИ =================
    await expect(page.locator('#wave-counter')).toContainText('ВОЛНА 5 ИЗ 8');
    // Выбираем целевой узел 3-2-1 и активируем Air-Gap Lock
    await page.locator('#node-target').click();
    await page.locator('#btn-airgap-target').click();
    await expect(page.locator('#contain-btn')).toContainText('ОЧАГ ИЗОЛИРОВАН');
    await page.locator('#contain-btn').click();

    // ================= ВОЛНА 6: ДВА НЕЗАВИСИМЫХ ОЧАГА =================
    await expect(page.locator('#wave-counter')).toContainText('ВОЛНА 6 ИЗ 8');
    // Разрываем ребро e7 (вход в целевое хранилище из firewall)
    await page.locator('#btn-edge-e7').click();
    await expect(page.locator('#contain-btn')).toContainText('ОЧАГ ИЗОЛИРОВАН');
    await page.locator('#contain-btn').click();

    // ================= ВОЛНА 7: WORM OVERDRIVE (SMB/RDP) =================
    await expect(page.locator('#wave-counter')).toContainText('ВОЛНА 7 ИЗ 8');
    // Разрываем ребро e9 (к целевому хранилищу)
    await page.locator('#btn-edge-e9').click();
    await expect(page.locator('#contain-btn')).toContainText('ОЧАГ ИЗОЛИРОВАН');
    await page.locator('#contain-btn').click();

    // ================= ВОЛНА 8: ФИНАЛЬНЫЙ БОСС: STUXNET-OMEGA =================
    await expect(page.locator('#wave-counter')).toContainText('ВОЛНА 8 ИЗ 8');
    // Разрываем ребро e7 (к целевому хранилищу)
    await page.locator('#btn-edge-e7').click();
    await expect(page.locator('#contain-btn')).toContainText('ОЧАГ ИЗОЛИРОВАН');
    await page.locator('#contain-btn').click();

    // ================= ПОБЕДА =================
    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#victory-screen')).toContainText('ПЕРИМЕТР СЕТИ СПАСЕН');
    await expect(page.locator('#victory-screen')).toContainText('8 ИЗ 8 (100%)');
  });

  test('Lesson Page Integration: Level 3 tab and iframe exist with correct src', async ({ page }) => {
    await page.goto('/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/7');

    // Tab for Level 3 exists
    const tab3 = page.locator('button[data-target="iframe-3"]');
    await expect(tab3).toBeVisible();
    await expect(tab3).toContainText('Уровень 3');

    // Iframe for Level 3 exists with correct source
    const iframe3 = page.locator('#iframe-3');
    await expect(iframe3).toHaveCount(1);
    await expect(iframe3).toHaveAttribute('src', '/tasks/11-класс_базовый/7/level3');
  });
});
