import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('Comprehensive Suite: Grade 8 Lesson 6 Prince of Persia Hardcore Bonus, Persian Praise & Return Flow', () => {
  const rootDir = process.cwd();
  const lessonUrl = '/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/6';
  const scratchDir = path.join(rootDir, 'scratch');

  test.beforeAll(() => {
    if (!fs.existsSync(scratchDir)) {
      fs.mkdirSync(scratchDir, { recursive: true });
    }
  });

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

  test('2. Lesson template markup contains required Prince bonus card, overlay, and Persian modal elements', () => {
    const lessonTemplatePath = path.join(rootDir, 'src', 'pages', 'lesson', '[class]', '[id].astro');
    const content = fs.readFileSync(lessonTemplatePath, 'utf-8');

    // Bonus card elements
    expect(content).toContain('id="prince-bonus-card"');
    expect(content).toContain('id="open-prince-btn"');
    expect(content).toContain('РЕТРО-АРХИВ 1989 // РАЗБЛОКИРОВАНО');
    expect(content).toContain('УРОВЕНЬ {princeBonusLevel}');
    expect(content).toContain('падишах дарует тебе ключ');
    expect(content).toContain('PRINCE OF PERSIA (1989)');

    // Overlay elements
    expect(content).toContain('id="prince-overlay"');
    expect(content).toContain('id="prince-game-iframe"');
    expect(content).toContain('/static/prince/index.html?level=${princeBonusLevel}&maxLevel=${princeBonusLevel}&skipTitle=true');
    expect(content).toContain('id="prince-reload-btn"');
    expect(content).toContain('id="prince-fullscreen-btn"');
    expect(content).toContain('id="close-prince-btn"');

    // Persian victory modal elements
    expect(content).toContain('id="prince-victory-modal"');
    expect(content).toContain('id="prince-victory-level"');
    expect(content).toContain('ХВАЛА И СЛАВА ПОБЕДИТЕЛЮ ТЕМНИЦ ПЕРСИИ!');
    expect(content).toContain('ДАР ВЕЛИКОГО ПАДИШАХА');
    expect(content).toContain('ДАЛЬНЕЙШИЕ ЧЕРТОГИ ДВОРЦА ЗАПЕЧАТАНЫ');
    expect(content).toContain('id="prince-retry-btn"');
    expect(content).toContain('id="prince-victory-close-btn"');

    // Persian authentic grand praise phrases
    expect(content).toContain('солнцеподобный витязь, услада очей мудрецов');
    expect(content).toContain('визиря Джаффара');
    expect(content).toContain('булатному клинку из благородной стали Исфахана');
    expect(content).toContain('лепестками дамасских роз');
    expect(content).toContain('повелитель алгоритмов и победитель Песков Времени');
  });

  test('3. Bonus Card Visibility: Hidden during normal mode, visible after hardcore completion', async ({ page }) => {
    // Scenario A: Normal mode completion (hardcore NOT active)
    await page.route('**/api/progress*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          unlockedNormal: 3,
          unlockedHardcore: 1,
          isNormalCompleted: true,
          isHardcoreCompleted: false
        })
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Шахрияр');
      localStorage.setItem('student_lastName', 'Аль-Хорезми');
      localStorage.setItem('student_class', '8-класс');
      localStorage.setItem('hardcore_mode', 'false');
      sessionStorage.setItem('school_lms_hardcore_8-класс_6', 'false');
    });

    await page.goto(lessonUrl);
    await page.waitForLoadState('domcontentloaded');

    // In normal mode completion, completion screen is shown, but Prince bonus card is hidden
    const completionScreen = page.locator('#completion-screen');
    await expect(completionScreen).toBeVisible();
    const bonusCard = page.locator('#prince-bonus-card');
    await expect(bonusCard).toBeHidden();

    // Scenario B: Hardcore completed
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

    await page.evaluate(() => {
      sessionStorage.setItem('school_lms_hardcore_8-класс_6', 'true');
      localStorage.setItem('hardcore_mode', 'true');
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Now Prince bonus card must be visible!
    await expect(completionScreen).toBeVisible();
    await expect(bonusCard).toBeVisible();
    await expect(bonusCard).toContainText('РЕТРО-АРХИВ 1989 // РАЗБЛОКИРОВАНО');
    await expect(bonusCard).toContainText('УРОВЕНЬ 1');
  });

  test('4. Opening Prince Level 1: Overlay visibility, iframe parameters, and control bar', async ({ page }) => {
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
      localStorage.setItem('student_class', '8-класс');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_8-класс_6', 'true');
    });

    await page.goto(lessonUrl);
    await page.waitForLoadState('domcontentloaded');

    const openBtn = page.locator('#open-prince-btn');
    await expect(openBtn).toBeVisible();
    await openBtn.click();

    // Verify overlay appears
    const princeOverlay = page.locator('#prince-overlay');
    await expect(princeOverlay).toBeVisible();

    // Verify iframe URL parameters strictly enforce level=1 and maxLevel=1
    const princeIframe = page.locator('#prince-game-iframe');
    await expect(princeIframe).toBeVisible();
    const src = await princeIframe.getAttribute('src');
    expect(src).toContain('level=1');
    expect(src).toContain('maxLevel=1');
    expect(src).toContain('skipTitle=true');

    // Verify control header
    await expect(page.locator('#prince-reload-btn')).toBeVisible();
    await expect(page.locator('#prince-fullscreen-btn')).toBeVisible();
    await expect(page.locator('#close-prince-btn')).toBeVisible();

    // Snapshot open state
    await page.screenshot({ path: 'scratch/test_01_prince_overlay_opened.png' });
  });

  test('5. Correct Completion: Event handling, grand Persian praise, telemetry, and boundary enforcement', async ({ page }) => {
    const telemetryEvents = [];
    await page.route('**/api/telemetry', async (route) => {
      const request = route.request();
      if (request.method() === 'POST') {
        try {
          telemetryEvents.push(request.postDataJSON());
        } catch (e) {}
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

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
      localStorage.setItem('student_class', '8-класс');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_8-класс_6', 'true');
    });

    await page.goto(lessonUrl);
    await page.locator('#open-prince-btn').click();

    // Simulate completion of Level 1 dispatched from PrinceJS iframe
    await page.evaluate(() => {
      window.postMessage({
        type: 'PRINCE_EVENT',
        action: 'level_complete',
        completedLevel: 1,
        nextLevel: null
      }, '*');
    });

    // Verify Victory Modal pops up
    const victoryModal = page.locator('#prince-victory-modal');
    await expect(victoryModal).toBeVisible();

    // Verify Titles & Padishah declaration
    await expect(victoryModal).toContainText('ХВАЛА И СЛАВА ПОБЕДИТЕЛЮ ТЕМНИЦ ПЕРСИИ!');
    await expect(victoryModal).toContainText('ДАР ВЕЛИКОГО ПАДИШАХА // УРОВЕНЬ 1 ПОКОРЕН');

    // Verify grand Persian praise body
    await expect(victoryModal).toContainText('«О солнцеподобный витязь, услада очей мудрецов и непревзойденный владыка кремниевых стихий!»');
    await expect(victoryModal).toContainText('Да осыплют небеса твой путь лепестками дамасских роз');
    await expect(victoryModal).toContainText('рассекли мрак древних катакомб коварного визиря Джаффара');
    await expect(victoryModal).toContainText('булатному клинку из благородной стали Исфахана');
    await expect(victoryModal).toContainText('С грацией барса и терпением великого суфия');
    await expect(victoryModal).toContainText('повелитель алгоритмов и победитель Песков Времени');

    // Verify sealed palace banner and absence of Level 2 button
    await expect(victoryModal).toContainText('ДАЛЬНЕЙШИЕ ЧЕРТОГИ ДВОРЦА ЗАПЕЧАТАНЫ ДРЕВНЕЙ МАГИЕЙ // ДОСТУПЕН ТОЛЬКО УРОВЕНЬ 1');
    await expect(page.locator('#prince-continue-btn')).toHaveCount(0);

    // Verify telemetry dispatch
    const victoryEvent = telemetryEvents.find(e => e.mission_name && e.mission_name.includes('Prince of Persia'));
    expect(victoryEvent).toBeDefined();
    expect(victoryEvent.action_type).toBe('level_complete');
    expect(victoryEvent.status).toBe('completed');
    expect(victoryEvent.success).toBe(true);
    expect(victoryEvent.course_slug).toBe('8-класс');
    expect(victoryEvent.lesson_id).toBe('6');

    // Snapshot Persian praise modal
    await page.screenshot({ path: 'scratch/test_02_persian_victory_modal.png' });
  });

  test('6. Return to Lesson Interface: Clean transition, intact lesson state, and re-opening', async ({ page }) => {
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
      localStorage.setItem('student_class', '8-класс');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_8-класс_6', 'true');
    });

    await page.goto(lessonUrl);
    await page.locator('#open-prince-btn').click();

    // Trigger victory modal
    await page.evaluate(() => {
      window.postMessage({
        type: 'PRINCE_EVENT',
        action: 'level_complete',
        completedLevel: 1
      }, '*');
    });

    const victoryModal = page.locator('#prince-victory-modal');
    await expect(victoryModal).toBeVisible();

    // Click "Вернуться к уроку с почетом"
    const returnBtn = page.locator('#prince-victory-close-btn');
    await expect(returnBtn).toBeVisible();
    await returnBtn.click();

    // Both victory modal and prince overlay MUST be hidden
    await expect(victoryModal).toBeHidden();
    const princeOverlay = page.locator('#prince-overlay');
    await expect(princeOverlay).toBeHidden();

    // User is back on lesson completion screen with bonus card available
    const completionScreen = page.locator('#completion-screen');
    await expect(completionScreen).toBeVisible();
    const bonusCard = page.locator('#prince-bonus-card');
    await expect(bonusCard).toBeVisible();

    // Snapshot returned lesson state
    await page.screenshot({ path: 'scratch/test_03_returned_to_lesson.png' });

    // Test re-opening the game again
    await page.locator('#open-prince-btn').click();
    await expect(princeOverlay).toBeVisible();

    // Test header "✖ Свернуть" button
    const closeHeaderBtn = page.locator('#close-prince-btn');
    await expect(closeHeaderBtn).toBeVisible();
    await closeHeaderBtn.click();
    await expect(princeOverlay).toBeHidden();
    await expect(completionScreen).toBeVisible();
  });

  test('7. Replay Flow: "Пройти Уровень 1 заново" cleanly reloads game on Level 1', async ({ page }) => {
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
      localStorage.setItem('student_class', '8-класс');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_8-класс_6', 'true');
    });

    await page.goto(lessonUrl);
    await page.locator('#open-prince-btn').click();

    // Trigger victory modal
    await page.evaluate(() => {
      window.postMessage({
        type: 'PRINCE_EVENT',
        action: 'level_complete',
        completedLevel: 1
      }, '*');
    });

    const victoryModal = page.locator('#prince-victory-modal');
    await expect(victoryModal).toBeVisible();

    // Click "Пройти Уровень 1 заново"
    const retryBtn = page.locator('#prince-retry-btn');
    await expect(retryBtn).toBeVisible();
    await retryBtn.click();

    // Modal closes, overlay remains visible with game reloaded on level 1
    await expect(victoryModal).toBeHidden();
    const princeOverlay = page.locator('#prince-overlay');
    await expect(princeOverlay).toBeVisible();

    const princeIframe = page.locator('#prince-game-iframe');
    const src = await princeIframe.getAttribute('src');
    expect(src).toContain('level=1');
    expect(src).toContain('maxLevel=1');

    // Header restart button also functions
    const restartBtn = page.locator('#prince-reload-btn');
    await expect(restartBtn).toBeVisible();
    await restartBtn.click();
    await expect(princeOverlay).toBeVisible();
  });

  test('8. Responsive Layout: Persian praise renders flawlessly on Laptop (1366x768) and Desktop (1920x1080)', async ({ page }) => {
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
      localStorage.setItem('student_class', '8-класс');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_8-класс_6', 'true');
    });

    // 1. Test on Laptop resolution (1366 x 768)
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(lessonUrl);
    await page.locator('#open-prince-btn').click();
    await page.evaluate(() => {
      window.postMessage({ type: 'PRINCE_EVENT', action: 'level_complete', completedLevel: 1 }, '*');
    });

    const victoryModal = page.locator('#prince-victory-modal');
    await expect(victoryModal).toBeVisible();
    await page.screenshot({ path: 'scratch/test_04_persian_modal_1366x768.png' });

    // Verify button remains clickable and visible on laptop viewport
    const closeBtnLaptop = page.locator('#prince-victory-close-btn');
    await expect(closeBtnLaptop).toBeVisible();
    await closeBtnLaptop.click();
    await expect(victoryModal).toBeHidden();

    // 2. Test on Desktop resolution (1920 x 1080)
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.locator('#open-prince-btn').click();
    await page.evaluate(() => {
      window.postMessage({ type: 'PRINCE_EVENT', action: 'level_complete', completedLevel: 1 }, '*');
    });
    await expect(victoryModal).toBeVisible();
    await page.screenshot({ path: 'scratch/test_05_persian_modal_1920x1080.png' });

    const closeBtnDesktop = page.locator('#prince-victory-close-btn');
    await expect(closeBtnDesktop).toBeVisible();
    await closeBtnDesktop.click();
    await expect(victoryModal).toBeHidden();
  });
});
