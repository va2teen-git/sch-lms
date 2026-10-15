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
    expect(content).toContain('maxLevel=${princeBonusLevel}');
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

    // Verify specifically that 9th grade lesson 7 has princeBonusLevel === 1
    const grade9Course = courses.find(c => c.slug === '9-класс');
    expect(grade9Course).toBeDefined();
    const lesson7 = grade9Course.lessons.find(l => l.id === '7');
    expect(lesson7).toBeDefined();
    expect(lesson7.princeBonusLevel).toBe(1);
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

  test('7. Engine enforces maxLevel boundary preventing progression past level 1', () => {
    const utilsPath = path.join(rootDir, 'public/static/prince/src/Utils.js');
    const gamePath = path.join(rootDir, 'public/static/prince/src/Game.js');

    const utilsContent = fs.readFileSync(utilsPath, 'utf-8');
    expect(utilsContent).toContain('PrinceJS.maxLevel = queryMaxLevel');
    expect(utilsContent).toContain('PrinceJS.currentLevel > PrinceJS.maxLevel');

    const gameContent = fs.readFileSync(gamePath, 'utf-8');
    expect(gameContent).toContain('completedLvl >= PrinceJS.maxLevel');
    expect(gameContent).toContain('this.game.paused = true');
  });
});
