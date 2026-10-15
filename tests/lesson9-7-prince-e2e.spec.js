import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('E2E Verification: Prince of Persia Bonus Unlock, Completion & Lesson Return Suite', () => {
  const lessonUrl = '/lesson/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7';

  test.beforeEach(async ({ page }) => {
    // Ensure scratch directory exists for visual snapshots
    const scratchDir = path.join(process.cwd(), 'scratch');
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }

    // Pre-populate student credentials and hardcore completion state in browser storage
    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Али');
      localStorage.setItem('student_lastName', 'Аль-Багдади');
      localStorage.setItem('student_class', '9-класс');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_9-класс_7', 'true');
    });
  });

  test('1. Full Lifecycle: Hardcore Completion -> Open Level 1 -> Receive Victory Praise -> Return to Lesson', async ({ page }) => {
    // Intercept telemetry API to verify telemetry payload
    const telemetryEvents = [];
    await page.route('/api/telemetry', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        try {
          const body = request.postDataJSON();
          telemetryEvents.push(body);
        } catch (e) {}
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true })
      });
    });

    // Mock progress API to simulate 100% completed hardcore mode
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

    // 1. Navigate to Grade 9 Lesson 7
    await page.goto(lessonUrl);
    await page.waitForLoadState('domcontentloaded');

    // 2. Verify completion screen is active and displays the Prince Bonus Card
    const completionScreen = page.locator('#completion-screen');
    await expect(completionScreen).toBeVisible();

    const bonusCard = page.locator('#prince-bonus-card');
    await expect(bonusCard).toBeVisible();
    await expect(bonusCard).toContainText('РЕТРО-АРХИВ 1989 // РАЗБЛОКИРОВАНО');
    await expect(bonusCard).toContainText('УРОВЕНЬ 1');
    await expect(bonusCard).toContainText('падишах дарует тебе ключ');
    await expect(bonusCard).toContainText('PRINCE OF PERSIA (1989)');

    // Visual screenshot of unlocked bonus card on lesson screen
    await page.screenshot({ path: 'scratch/01_prince_bonus_card_unlocked.png' });

    // 3. Click "ЗАПУСТИТЬ УРОВЕНЬ 1" to open the Prince of Persia overlay
    const openBtn = page.locator('#open-prince-btn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    // 4. Verify Prince overlay is visible and iframe has level=1 and maxLevel=1
    const princeOverlay = page.locator('#prince-overlay');
    await expect(princeOverlay).toBeVisible();

    const princeIframe = page.locator('#prince-game-iframe');
    await expect(princeIframe).toBeVisible();
    const iframeSrc = await princeIframe.getAttribute('src');
    expect(iframeSrc).toContain('level=1');
    expect(iframeSrc).toContain('maxLevel=1');
    expect(iframeSrc).toContain('skipTitle=true');

    // Visual screenshot of game overlay opened
    await page.screenshot({ path: 'scratch/02_prince_overlay_opened.png' });

    // 5. Simulate PrinceJS level completion event (PRINCE_EVENT)
    await page.evaluate(() => {
      window.postMessage({
        type: 'PRINCE_EVENT',
        action: 'level_complete',
        completedLevel: 1,
        nextLevel: null
      }, '*');
    });

    // 6. Verify Persian Victory Modal appears
    const victoryModal = page.locator('#prince-victory-modal');
    await expect(victoryModal).toBeVisible();

    // Verify Title & Subtitle
    await expect(victoryModal).toContainText('ХВАЛА И СЛАВА ПОБЕДИТЕЛЮ ТЕМНИЦ ПЕРСИИ!');
    await expect(victoryModal).toContainText('ДАР ВЕЛИКОГО ПАДИШАХА // УРОВЕНЬ 1 ПОКОРЕН');

    // Verify Grand Persian Praise text
    await expect(victoryModal).toContainText('солнцеподобный витязь, услада очей мудрецов');
    await expect(victoryModal).toContainText('визиря Джаффара');
    await expect(victoryModal).toContainText('булатному клинку из благородной стали Исфахана');
    await expect(victoryModal).toContainText('лепестками дамасских роз');
    await expect(victoryModal).toContainText('повелитель алгоритмов и победитель Песков Времени');

    // Verify Sealed Palace restriction banner
    await expect(victoryModal).toContainText('ДАЛЬНЕЙШИЕ ЧЕРТОГИ ДВОРЦА ЗАПЕЧАТАНЫ ДРЕВНЕЙ МАГИЕЙ // ДОСТУПЕН ТОЛЬКО УРОВЕНЬ 1');

    // Verify button to advance to level 2 DOES NOT exist
    const continueBtn = page.locator('#prince-continue-btn');
    await expect(continueBtn).toHaveCount(0);

    // Verify valid action buttons exist
    const closeVictoryBtn = page.locator('#prince-victory-close-btn');
    await expect(closeVictoryBtn).toBeVisible();
    await expect(closeVictoryBtn).toContainText('Вернуться к уроку с почетом');

    const retryBtn = page.locator('#prince-retry-btn');
    await expect(retryBtn).toBeVisible();
    await expect(retryBtn).toContainText('Пройти Уровень 1 заново');

    // Visual screenshot of Persian celebration modal
    await page.screenshot({ path: 'scratch/03_prince_persian_victory_modal.png' });

    // 7. Verify telemetry event was sent for the Prince victory
    const princeTelemetry = telemetryEvents.find(e => e.mission_name && e.mission_name.includes('Prince of Persia'));
    expect(princeTelemetry).toBeDefined();
    expect(princeTelemetry.action_type).toBe('level_complete');
    expect(princeTelemetry.status).toBe('completed');
    expect(princeTelemetry.success).toBe(true);

    // 8. Test returning to the lesson interface
    await closeVictoryBtn.click();

    // Verify victory modal and prince overlay are both closed
    await expect(victoryModal).toBeHidden();
    await expect(princeOverlay).toBeHidden();

    // Verify user is back on the lesson interface
    await expect(completionScreen).toBeVisible();
    await expect(bonusCard).toBeVisible();

    // Visual screenshot of returned lesson interface
    await page.screenshot({ path: 'scratch/04_returned_to_lesson_interface.png' });
  });

  test('2. Replay Flow: Re-opening and Clicking "Пройти Уровень 1 заново" reloads Level 1 cleanly', async ({ page }) => {
    // Mock progress API
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

    await page.goto(lessonUrl);
    await page.locator('#open-prince-btn').click();

    const princeOverlay = page.locator('#prince-overlay');
    await expect(princeOverlay).toBeVisible();

    // Simulate completion
    await page.evaluate(() => {
      window.postMessage({
        type: 'PRINCE_EVENT',
        action: 'level_complete',
        completedLevel: 1,
        nextLevel: null
      }, '*');
    });

    const victoryModal = page.locator('#prince-victory-modal');
    await expect(victoryModal).toBeVisible();

    // Click "Пройти Уровень 1 заново"
    const retryBtn = page.locator('#prince-retry-btn');
    await retryBtn.click();

    // Modal should close, overlay stays open with game reloaded on level 1
    await expect(victoryModal).toBeHidden();
    await expect(princeOverlay).toBeVisible();

    const princeIframe = page.locator('#prince-game-iframe');
    const iframeSrc = await princeIframe.getAttribute('src');
    expect(iframeSrc).toContain('level=1');
    expect(iframeSrc).toContain('maxLevel=1');

    // Click header close button "✖ Свернуть"
    const closeOverlayBtn = page.locator('#close-prince-btn');
    await expect(closeOverlayBtn).toBeVisible();
    await closeOverlayBtn.click();

    // Overlay is closed, lesson completion screen is visible
    await expect(princeOverlay).toBeHidden();
    await expect(page.locator('#completion-screen')).toBeVisible();
  });
});
