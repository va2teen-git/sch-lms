import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/9/level2';
const LESSON_URL = '/lesson/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/9';

async function attachTelemetrySpy(page) {
  await page.addInitScript(() => {
    window.__sentTelemetry = [];
    const orig = window.postMessage.bind(window);
    window.postMessage = (msg, targetOrigin) => {
      if (msg && msg.type === 'TELEMETRY_EVENT') {
        window.__sentTelemetry.push(msg);
      }
      return orig(msg, targetOrigin);
    };
  });
}

async function computePhaseAnswerFromDOM(page, phase) {
  if (phase === 1) {
    const v = parseInt(await page.locator('#p1-v-val').innerText(), 10);
    const t = parseInt(await page.locator('#p1-t-val').innerText(), 10);
    return v * t;
  }
  if (phase === 2) {
    const sizeMB = parseInt(await page.locator('#p2-size-val').innerText(), 10);
    const speedMbps = parseInt(await page.locator('#p2-speed-val').innerText(), 10);
    return (sizeMB * 8) / (speedMbps * 60);
  }
  if (phase === 3) {
    const sizeKB = parseInt(await page.locator('#p3-size-val').innerText(), 10);
    const min = parseInt(await page.locator('#p3-min-val').innerText(), 10);
    return (sizeKB * 8 * 1.25) / (min * 60);
  }
  if (phase === 4) {
    const proj = parseInt(await page.locator('#p4-proj-val').innerText(), 10);
    const gb = parseInt(await page.locator('#p4-gb-val').innerText(), 10);
    return proj * gb * 2;
  }
  const kb = parseInt(await page.locator('#p5-kb-val').innerText(), 10);
  const payload = parseInt(await page.locator('#p5-payload-val').innerText(), 10);
  const header = parseInt(await page.locator('#p5-header-val').innerText(), 10);
  const fileBytes = kb * 1024;
  const packets = Math.ceil(fileBytes / payload);
  return fileBytes + packets * header;
}

test.describe('Grade 10 Basic Lesson 9: Information Processes Level 2', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_базовый/9/level2.astro');

  test('Level 2 adheres to architectural requirements (5 phases, Sawtooth, Anti-Paste, LMSTelemetry)', async ({ page }) => {
    expect(fs.existsSync(taskPath), 'level2.astro must exist').toBe(true);
    const code = fs.readFileSync(taskPath, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}');
    expect(code).toContain('LMSTelemetry');
    expect(code).toContain('totalStages: 5');
    expect(code).toContain('addEventListener(\'paste\'');
    expect(code).toContain('ПИК 1');
    expect(code).toContain('ДОЛИНА КОНСОЛИДАЦИИ');
    expect(code).toContain('КУЛЬМИНАЦИЯ');

    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);
    expect(/https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/i.test(code)).toBe(false);

    await page.goto(TASK_URL);
    expect(await page.locator('#game-container input[type="radio"]').count()).toBe(0);
    expect(await page.locator('#game-container select').count()).toBe(0);
    expect(await page.locator('#game-container input[type="text"]').count()).toBeGreaterThanOrEqual(5);
  });

  test('Full 5-phase analytical walkthrough with telemetry verification', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    // Deferred start_time: zero events before user interaction
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    const expectedBadges = [
      'Шаг 1 из 5',
      'Шаг 2 из 5',
      'Шаг 3 из 5',
      'Шаг 4 из 5',
      'Шаг 5 из 5'
    ];

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible();
      await expect(page.locator('#phase-badge')).toHaveText(expectedBadges[p - 1]);

      const domAns = await computePhaseAnswerFromDOM(page, p);
      const devAns = await page.evaluate(() => window.__DEV_LEVEL2_STATE__.getExpected());
      expect(domAns).toBe(devAns);

      await page.locator(`#p${p}-input`).fill(String(domAns));
      await page.locator(`#p${p}-btn`).click();
    }

    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Пройдено');

    const events = await page.evaluate(() => window.__sentTelemetry);
    for (let s = 2; s <= 5; s++) {
      const evt = events.find(e => e.action_type === 'in_progress' && e.stage === s);
      expect(evt).toBeTruthy();
      expect(evt.total_stages).toBe(5);
      expect(evt.start_time).toBeTruthy();
    }

    const completeEvt = events.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.stage).toBe(5);
    expect(completeEvt.total_stages).toBe(5);
    expect(completeEvt.start_time).toBeTruthy();
    expect(typeof completeEvt.time_spent_sec).toBe('number');
    expect(completeEvt.time_spent_sec).toBeGreaterThanOrEqual(0);
  });

  test('Wrong calculation shows feedback, emits fail telemetry, regenerates parameters, and hardcore reset blocks Prince bonus', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await page.locator('#p1-input').fill('9999999');
    await page.locator('#p1-btn').click();

    await expect(page.locator('#p1-feedback')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    const failEvents = await page.evaluate(() => window.__sentTelemetry.filter(e => !e.success));
    expect(failEvents.length).toBe(1);
    expect(failEvents[0].action_type).toBe('hardcore_reset');
    expect(failEvents[0].stage).toBe(1);
    expect(failEvents[0].total_stages).toBe(5);
    expect(failEvents[0].start_time).toBeTruthy();

    await page.waitForTimeout(1450);
    await expect(page.locator('#p1-feedback')).toBeHidden();
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#p1-input')).toHaveValue('');

    // Hardcore bonus gate verification on lesson page
    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Тест');
      localStorage.setItem('student_lastName', 'Гуманитарий');
      localStorage.setItem('student_class', '10-класс_базовый');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_10-класс_базовый_9', 'true');
    });
    page.on('dialog', (dialog) => dialog.accept());

    await page.goto(LESSON_URL);
    await page.evaluate(() => {
      window.postMessage({
        type: 'TELEMETRY_EVENT',
        action_type: 'level_fail',
        mission_name: 'Урок 9 :: Информационные процессы. Передача и хранение информации (Уровень 2)',
        level: 2,
        stage: 3,
        total_stages: 5,
        success: false,
        start_time: new Date().toISOString(),
        time_spent_sec: 12
      }, '*');
    });

    await expect(page.locator('#prince-bonus-card')).toBeHidden();
    await expect(page.locator('#completion-screen')).toBeHidden();
  });
});
