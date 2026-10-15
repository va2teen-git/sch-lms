import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Grade 9 Lesson 7 Prince of Persia Hardcore Bonus & Persian Victory Suite', () => {
  const rootDir = process.cwd();

  test('1. Curriculum configuration enables princeBonusLevel 1 for 9th grade lesson 7', () => {
    const coursesPath = path.join(rootDir, 'src', 'data', 'courses.json');
    const courses = JSON.parse(fs.readFileSync(coursesPath, 'utf-8'));

    const grade9 = courses.find(c => c.slug === '9-класс');
    expect(grade9).toBeDefined();

    const lesson7 = grade9.lessons.find(l => l.id === '7');
    expect(lesson7).toBeDefined();
    expect(lesson7.topic).toContain('Модели и моделирование');
    expect(lesson7.princeBonusLevel).toBe(1);
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

  test('3. Client-side script handles PRINCE_EVENT and manages modal state', () => {
    const lessonTemplatePath = path.join(rootDir, 'src', 'pages', 'lesson', '[class]', '[id].astro');
    const content = fs.readFileSync(lessonTemplatePath, 'utf-8');

    // Event listener checks
    expect(content).toContain("data.type === 'PRINCE_EVENT'");
    expect(content).toContain("data.action === 'level_complete'");
    expect(content).toContain("victoryModal.classList.remove('hidden')");
    expect(content).toContain("victoryModal.classList.add('flex')");

    // Interactive button listeners
    expect(content).toContain('princeRetryBtn.addEventListener');
    expect(content).toContain('princeVictoryCloseBtn.addEventListener');
    expect(content).toContain('princeReloadBtn.addEventListener');
    expect(content).toContain('closePrinceBtn.addEventListener');
  });
});
