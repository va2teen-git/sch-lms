import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Grade 8 Lesson 6 Prince of Persia Hardcore Bonus & Persian Victory Suite', () => {
  const rootDir = process.cwd();
  const lessonUrl = '/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6';

  test('1. Curriculum configuration enables princeBonusLevel 1 for 8th grade lesson 6', () => {
    const coursesPath = path.join(rootDir, 'src', 'data', 'courses.json');
    const courses = JSON.parse(fs.readFileSync(coursesPath, 'utf-8'));

    const grade8 = courses.find(c => c.slug === '8-класс');
    expect(grade8).toBeDefined();

    const lesson6 = grade8.lessons.find(l => l.id === '6');
    expect(lesson6).toBeDefined();
    expect(lesson6.topic).toContain('Системы счисления');
    expect(lesson6.princeBonusLevel).toBe(1);
  });

  test('2. Lesson page template contains Prince overlay and Persian Victory Celebration modal', () => {
    const lessonTemplatePath = path.join(rootDir, 'src', 'pages', 'lesson', '[class]', '[id].astro');
    const content = fs.readFileSync(lessonTemplatePath, 'utf-8');

    // Bonus card elements
    expect(content).toContain('id="prince-bonus-card"');
    expect(content).toContain('id="open-prince-btn"');
    expect(content).toContain('РЕТРО-АРХИВ 1989 // РАЗБЛОКИРОВАНО');
    expect(content).toContain('падишах дарует тебе ключ');

    // Overlay elements
    expect(content).toContain('id="prince-overlay"');
    expect(content).toContain('id="prince-game-iframe"');
    expect(content).toContain('/static/prince/index.html?level=${princeBonusLevel}&maxLevel=${princeBonusLevel}&skipTitle=true');

    // Persian victory modal elements
    expect(content).toContain('id="prince-victory-modal"');
    expect(content).toContain('id="prince-victory-level"');
    expect(content).toContain('ХВАЛА И СЛАВА ПОБЕДИТЕЛЮ ТЕМНИЦ ПЕРСИИ!');
    expect(content).toContain('ДАР ВЕЛИКОГО ПАДИШАХА');
    expect(content).toContain('ДАЛЬНЕЙШИЕ ЧЕРТОГИ ДВОРЦА ЗАПЕЧАТАНЫ');
    expect(content).toContain('id="prince-retry-btn"');
    expect(content).toContain('id="prince-victory-close-btn"');

    // Authentic Persian grand praise phrases
    expect(content).toContain('солнцеподобный витязь, услада очей мудрецов');
    expect(content).toContain('визиря Джаффара');
    expect(content).toContain('булатному клинку из благородной стали Исфахана');
    expect(content).toContain('лепестками дамасских роз');
    expect(content).toContain('повелитель алгоритмов и победитель Песков Времени');
  });

  test('3. E2E: Grade 8 Lesson 6 Hardcore Completion -> Unlock Level 1 -> Persian Praise -> Return', async ({ page }) => {
    // Intercept telemetry API to verify telemetry payload
    const telemetryEvents = [];
    await page.route('**/api/telemetry', async (route) => {
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

    // Pre-populate student credentials and hardcore completion state
    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Шахрияр');
      localStorage.setItem('student_lastName', 'Аль-Хорезми');
      localStorage.setItem('student_class', '8-класс');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_8-класс_6', 'true');
    });

    // 1. Navigate to Grade 8 Lesson 6
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

    // Verify restriction banner
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

    // 7. Verify telemetry event was sent
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
  });
});
