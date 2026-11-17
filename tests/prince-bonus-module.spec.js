import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Prince of Persia Bonus Module & Integration Suite', () => {
  const rootDir = process.cwd();

  test('1. Static assets and engine files exist in public/static/prince/', () => {
    const princeDir = path.join(rootDir, 'public', 'static', 'prince');
    expect(fs.existsSync(princeDir)).toBeTruthy();

    // Check main entry point and engine
    expect(fs.existsSync(path.join(princeDir, 'index.html'))).toBeTruthy();
    expect(fs.existsSync(path.join(princeDir, 'lib', 'phaser.min.js'))).toBeTruthy();
    expect(fs.existsSync(path.join(princeDir, 'LICENSE'))).toBeTruthy();

    // Check essential asset directories
    expect(fs.existsSync(path.join(princeDir, 'assets', 'gfx'))).toBeTruthy();
    expect(fs.existsSync(path.join(princeDir, 'assets', 'maps'))).toBeTruthy();
    expect(fs.existsSync(path.join(princeDir, 'assets', 'music'))).toBeTruthy();
    expect(fs.existsSync(path.join(princeDir, 'assets', 'sfx'))).toBeTruthy();

    // Check essential game sources
    expect(fs.existsSync(path.join(princeDir, 'src', 'Boot.js'))).toBeTruthy();
    expect(fs.existsSync(path.join(princeDir, 'src', 'Game.js'))).toBeTruthy();
    expect(fs.existsSync(path.join(princeDir, 'src', 'Utils.js'))).toBeTruthy();
  });

  test('2. Reusable Astro component PrinceEmulator.astro exists and defines expected props', () => {
    const componentPath = path.join(rootDir, 'src', 'components', 'PrinceEmulator.astro');
    expect(fs.existsSync(componentPath)).toBeTruthy();

    const content = fs.readFileSync(componentPath, 'utf-8');
    expect(content).toContain('export interface Props');
    expect(content).toContain('level?: number');
    expect(content).toContain('maxLevel?: number');
    expect(content).toContain('missionName?: string');
    expect(content).toContain('skipTitle?: boolean');
    expect(content).toContain('/static/prince/index.html');
    expect(content).toContain('PRINCE_EVENT');
    expect(content).toContain('prince-restart-btn');
    expect(content).toContain('prince-fs-btn');
  });

  test('3. Lesson page template [id].astro integrates princeBonusLevel reward and Level 1 lock', () => {
    const lessonPagePath = path.join(rootDir, 'src', 'pages', 'lesson', '[class]', '[id].astro');
    expect(fs.existsSync(lessonPagePath)).toBeTruthy();

    const content = fs.readFileSync(lessonPagePath, 'utf-8');
    expect(content).toContain('princeBonusLevel');
    expect(content).toContain('minLevel=${mapLevel}');
    expect(content).toContain('maxLevel=${mapLevel}');
    expect(content).toContain('prince-bonus-card');
    expect(content).toContain('prince-overlay');
    expect(content).toContain('open-prince-btn');
    expect(content).toContain('close-prince-btn');
    expect(content).toContain('prince-reload-btn');
    expect(content).toContain('prince-fullscreen-btn');
    expect(content).toContain('prince-victory-modal');
    expect(content).toContain('prince-retry-btn');
    expect(content).toContain('prince-victory-close-btn');
    expect(content).toContain('ДАЛЬНЕЙШИЕ ЧЕРТОГИ ДВОРЦА ЗАПЕЧАТАНЫ');
    expect(content).toContain('ХВАЛА И СЛАВА ПОБЕДИТЕЛЮ ТЕМНИЦ ПЕРСИИ');
    expect(content).toContain('PRINCE_EVENT');
  });

  test('4. Curriculum catalog courses.json supports princeBonusLevel on lessons', () => {
    const coursesPath = path.join(rootDir, 'src', 'data', 'courses.json');
    const courses = JSON.parse(fs.readFileSync(coursesPath, 'utf-8'));

    // Check that at least one lesson has princeBonusLevel configured
    let hasPrinceLesson = false;
    for (const course of courses) {
      for (const lesson of course.lessons) {
        if (lesson.princeBonusLevel !== undefined) {
          hasPrinceLesson = true;
          expect(typeof lesson.princeBonusLevel).toBe('number');
          expect(lesson.princeBonusLevel).toBeGreaterThanOrEqual(1);
          expect(lesson.princeBonusLevel).toBeLessThanOrEqual(14);
          break;
        }
      }
      if (hasPrinceLesson) break;
    }
    expect(hasPrinceLesson).toBeTruthy();

    // Verify specifically that 9th grade lesson 7 and 11th grade courses have princeBonusLevel === 1
    const grade9Course = courses.find(c => c.slug === '9-класс');
    expect(grade9Course).toBeDefined();
    const lesson7 = grade9Course.lessons.find(l => l.id === '7');
    expect(lesson7).toBeDefined();
    expect(lesson7.princeBonusLevel).toBe(1);

    const grade11Adv = courses.find(c => c.slug === '11-класс_углубленный');
    expect(grade11Adv).toBeDefined();
    const lesson33 = grade11Adv.lessons.find(l => l.id === '33');
    expect(lesson33).toBeDefined();
    expect(lesson33.princeBonusLevel).toBe(1);

    const grade11Base = courses.find(c => c.slug === '11-класс_базовый');
    expect(grade11Base).toBeDefined();
    const baseLesson7 = grade11Base.lessons.find(l => l.id === '7');
    expect(baseLesson7).toBeDefined();
    expect(baseLesson7.princeBonusLevel).toBe(1);
  });

  test('5. Documentation docs/components.md covers PrinceEmulator and hardcore unlock mechanism', () => {
    const docsPath = path.join(rootDir, 'docs', 'components.md');
    const content = fs.readFileSync(docsPath, 'utf-8');

    expect(content).toContain('PrinceEmulator.astro');
    expect(content).toContain('princeBonusLevel');
    expect(content).toContain('Zero-Dependency');
    expect(content).toContain('/static/prince/');
  });

  test('6. Persian Victory Celebration text adheres to oriental style and praise requirements', () => {
    const lessonPagePath = path.join(rootDir, 'src', 'pages', 'lesson', '[class]', '[id].astro');
    const content = fs.readFileSync(lessonPagePath, 'utf-8');

    expect(content).toContain('солнцеподобный витязь');
    expect(content).toContain('визиря Джаффара');
    expect(content).toContain('лепестками дамасских роз');
    expect(content).toContain('Песков Времени');
  });

  test('7. Engine enforces minLevel/maxLevel boundaries and preserves query parameters on restart', () => {
    const bootPath = path.join(rootDir, 'public/static/prince/src/Boot.js');
    const utilsPath = path.join(rootDir, 'public/static/prince/src/Utils.js');
    const gamePath = path.join(rootDir, 'public/static/prince/src/Game.js');
    const lessonPagePath = path.join(rootDir, 'src', 'pages', 'lesson', '[class]', '[id].astro');

    const bootContent = fs.readFileSync(bootPath, 'utf-8');
    expect(bootContent).toContain('PrinceJS.minLevel = null');
    expect(bootContent).toContain('PrinceJS.maxLevel = null');

    const utilsContent = fs.readFileSync(utilsPath, 'utf-8');
    expect(utilsContent).toContain('PrinceJS.maxLevel = queryMaxLevel');
    expect(utilsContent).toContain('PrinceJS.minLevel = queryMinLevel');
    expect(utilsContent).toContain('PrinceJS.currentLevel > PrinceJS.maxLevel');
    expect(utilsContent).toContain('state.maxLevel = PrinceJS.maxLevel');

    const gameContent = fs.readFileSync(gamePath, 'utf-8');
    expect(gameContent).toContain('completedLvl >= PrinceJS.maxLevel');
    expect(gameContent).toContain('if (skipped && PrinceJS.maxLevel && completedLvl >= PrinceJS.maxLevel)');
    expect(gameContent).toContain('this.game.paused = true');

    const lessonContent = fs.readFileSync(lessonPagePath, 'utf-8');
    expect(lessonContent).not.toContain('ДОСТУПЕН ТОЛЬКО УРОВЕНЬ 1');
    expect(lessonContent).not.toContain('time_spent_sec: 60');
  });

  test('8. E2E: Grade 11 Lesson 33 unlocks Prince of Persia Level 1 in hardcore mode and tracks real telemetry', async ({ page }) => {
    let telemetryPayload = null;

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

    await page.route('**/api/telemetry', async (route) => {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        if (body?.mission_name?.includes('Prince of Persia')) {
          telemetryPayload = body;
        }
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true })
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Тест');
      localStorage.setItem('student_lastName', 'Одиннадцатиклассник');
      localStorage.setItem('student_class', '11-класс_углубленный');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_11-класс_углубленный_33', 'true');
    });

    await page.goto('/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33');
    await page.waitForLoadState('domcontentloaded');

    const bonusCard = page.locator('#prince-bonus-card');
    await expect(bonusCard).toBeVisible();
    await expect(bonusCard).toContainText('УРОВЕНЬ 1');

    await page.locator('#open-prince-btn').click();
    const iframe = page.locator('#prince-game-iframe');
    await expect(iframe).toBeVisible();

    const src = await iframe.getAttribute('src');
    expect(src).toContain('level=1');
    expect(src).toContain('minLevel=1');
    expect(src).toContain('maxLevel=1');
    expect(src).toContain('skipTitle=true');

    await page.evaluate(() => {
      window.postMessage({
        type: 'PRINCE_EVENT',
        action: 'level_complete',
        completedLevel: 1,
        nextLevel: null
      }, '*');
    });

    await expect(page.locator('#prince-victory-modal')).toBeVisible();
    await expect(page.locator('#prince-victory-modal')).toContainText('ДОСТУПЕН ТОЛЬКО УРОВЕНЬ 1');
    expect(telemetryPayload).toBeTruthy();
    expect(telemetryPayload.mission_name).toContain('Prince of Persia (Уровень 1)');
    expect(telemetryPayload.time_spent_sec).toBeGreaterThanOrEqual(1);
    expect(telemetryPayload.is_hardcore).toBe(true);
  });

  test('9. E2E: PrinceJS preserves minLevel/maxLevel/skipTitle on Restart and blocks skipped completion at maxLevel', async ({ page }) => {
    await page.goto('/static/prince/index.html?level=3&minLevel=3&maxLevel=4&skipTitle=true');
    await page.waitForFunction(() => typeof PrinceJS !== 'undefined' && PrinceJS.maxLevel === 4);

    const initialState = await page.evaluate(() => ({
      currentLevel: PrinceJS.currentLevel,
      initialLevel: PrinceJS.initialLevel,
      minLevel: PrinceJS.minLevel,
      maxLevel: PrinceJS.maxLevel,
      skipTitle: PrinceJS.SKIP_TITLE
    }));

    expect(initialState).toEqual({
      currentLevel: 3,
      initialLevel: 3,
      minLevel: 3,
      maxLevel: 4,
      skipTitle: true
    });

    await page.evaluate(() => {
      PrinceJS.Utils.updateQuery();
    });
    expect(page.url()).toContain('minLevel=3');
    expect(page.url()).toContain('maxLevel=4');
    expect(page.url()).toContain('skipTitle=true');

    await page.evaluate(() => {
      PrinceJS.Restart();
    });
    expect(page.url()).toContain('level=3');
    expect(page.url()).toContain('minLevel=3');
    expect(page.url()).toContain('maxLevel=4');
    expect(page.url()).toContain('skipTitle=true');

    const afterRestart = await page.evaluate(() => ({
      currentLevel: PrinceJS.currentLevel,
      minLevel: PrinceJS.minLevel,
      maxLevel: PrinceJS.maxLevel
    }));
    expect(afterRestart).toEqual({
      currentLevel: 3,
      minLevel: 3,
      maxLevel: 4
    });

    const skippedBlocked = await page.evaluate(() => {
      PrinceJS.currentLevel = 4;
      const origNext = PrinceJS.Game.prototype.nextLevel;
      const fakeGame = {
        game: { paused: false, sound: { stopAll() {} } },
        reset() {}
      };
      origNext.call(fakeGame, 4, true, true);
      return { paused: fakeGame.game.paused, currentLevel: PrinceJS.currentLevel };
    });
    expect(skippedBlocked.paused).toBe(false);
    expect(skippedBlocked.currentLevel).toBe(4);
  });
});
