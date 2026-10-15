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
    expect(content).toContain('missionName?: string');
    expect(content).toContain('skipTitle?: boolean');
    expect(content).toContain('/static/prince/index.html');
    expect(content).toContain('PRINCE_EVENT');
    expect(content).toContain('prince-restart-btn');
    expect(content).toContain('prince-fs-btn');
  });

  test('3. Lesson page template [id].astro integrates princeBonusLevel reward', () => {
    const lessonPagePath = path.join(rootDir, 'src', 'pages', 'lesson', '[class]', '[id].astro');
    expect(fs.existsSync(lessonPagePath)).toBeTruthy();

    const content = fs.readFileSync(lessonPagePath, 'utf-8');
    expect(content).toContain('princeBonusLevel');
    expect(content).toContain('prince-bonus-card');
    expect(content).toContain('prince-overlay');
    expect(content).toContain('open-prince-btn');
    expect(content).toContain('close-prince-btn');
    expect(content).toContain('prince-reload-btn');
    expect(content).toContain('prince-fullscreen-btn');
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
  });

  test('5. Documentation docs/components.md covers PrinceEmulator and hardcore unlock mechanism', () => {
    const docsPath = path.join(rootDir, 'docs', 'components.md');
    const content = fs.readFileSync(docsPath, 'utf-8');

    expect(content).toContain('PrinceEmulator.astro');
    expect(content).toContain('princeBonusLevel');
    expect(content).toContain('Zero-Dependency');
    expect(content).toContain('/static/prince/');
  });
});
