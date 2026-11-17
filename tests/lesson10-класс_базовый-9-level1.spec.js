import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/9/level1';
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

async function solvePhase1UI(page) {
  const categories = ['transfer', 'storage', 'protection'];
  for (const cat of categories) {
    const cards = page.locator(`#p1-cards-pool .p1-card[data-category="${cat}"]`);
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await page.locator(`#p1-cards-pool .p1-card[data-category="${cat}"]`).first().click();
      await page.locator(`#bucket-${cat} .bucket-slot`).click();
    }
  }
  await expect(page.locator('#p1-submit-btn')).toBeEnabled();
  await page.locator('#p1-submit-btn').click();
}

async function solvePhase2UI(page) {
  const roles = ['source', 'encoder', 'channel', 'noise', 'decoder', 'receiver'];
  for (const role of roles) {
    await page.locator(`#p2-tokens-pool .p2-token[data-role="${role}"]`).first().click();
    await page.locator(`#slot-p2-${role}`).click();
  }
  await expect(page.locator('#p2-submit-btn')).toBeEnabled();
  await page.locator('#p2-submit-btn').click();
}

async function solvePhase3UI(page) {
  const sizeText = await page.locator('#p3-param-size').innerText();
  const speedText = await page.locator('#p3-param-speed').innerText();
  const sizeMB = parseInt(sizeText, 10);
  const speedMbps = parseInt(speedText, 10);
  const expectedTime = (sizeMB * 8) / speedMbps;

  await page.locator('#p3-time-slider').evaluate((el, val) => {
    el.value = String(val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, expectedTime);
  await expect(page.locator('#p3-slider-val')).toHaveText(String(expectedTime));

  await page.locator('#p3-tokens-pool .p3-token[data-role="storage"]').first().click();
  await page.locator('#slot-p3-storage').click();

  await page.locator('#p3-tokens-pool .p3-token[data-role="protection"]').first().click();
  await page.locator('#slot-p3-protection').click();

  await expect(page.locator('#p3-submit-btn')).toBeEnabled();
  await page.locator('#p3-submit-btn').click();
}

test.describe('Grade 10 Basic Lesson 9: Information Processes Level 1', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_базовый/9/level1.astro');

  test('Level 1 adheres to architectural requirements (Zero-Style, Zero-CDN, Zero Multiple Choice, LMSTelemetry)', async ({ page }) => {
    expect(fs.existsSync(taskPath), 'level1.astro must exist').toBe(true);
    const code = fs.readFileSync(taskPath, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}');
    expect(code).toContain('LMSTelemetry');
    expect(code).toContain('.advanceStage(');
    expect(code).toContain('.fail(');
    expect(code).toContain('.complete(');
    expect(code).toContain('totalStages: 3');

    // Zero <style> and Zero external CDN
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
    expect(/https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/i.test(code)).toBe(false);

    // Zero Multiple Choice in code and DOM
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    await page.goto(TASK_URL);
    expect(await page.locator('#game-container input[type="radio"]').count()).toBe(0);
    expect(await page.locator('#game-container select').count()).toBe(0);
  });

  test('Full 3-phase walkthrough via mouse clicks with telemetry contract verification', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    // Deferred start_time: zero events before interaction
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    // Phase 1
    await expect(page.locator('#phase1-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');
    await expect(page.locator('#p1-cards-pool .p1-card')).toHaveCount(7);
    await solvePhase1UI(page);

    // Phase 2
    await expect(page.locator('#phase2-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
    await expect(page.locator('#p2-tokens-pool .p2-token')).toHaveCount(8);
    await solvePhase2UI(page);

    // Phase 3
    await expect(page.locator('#phase3-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');
    await solvePhase3UI(page);

    // Victory screen
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Пройдено');

    const events = await page.evaluate(() => window.__sentTelemetry);
    const stage2Evt = events.find(e => e.action_type === 'in_progress' && e.stage === 2);
    const stage3Evt = events.find(e => e.action_type === 'in_progress' && e.stage === 3);
    const completeEvt = events.find(e => e.action_type === 'level_complete');

    expect(stage2Evt).toBeTruthy();
    expect(stage2Evt.total_stages).toBe(3);
    expect(stage2Evt.start_time).toBeTruthy();

    expect(stage3Evt).toBeTruthy();
    expect(stage3Evt.total_stages).toBe(3);

    expect(completeEvt).toBeTruthy();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.stage).toBe(3);
    expect(completeEvt.total_stages).toBe(3);
    expect(completeEvt.start_time).toBeTruthy();
    expect(typeof completeEvt.time_spent_sec).toBe('number');
    expect(completeEvt.time_spent_sec).toBeGreaterThanOrEqual(0);
  });

  test('Error handling emits fail telemetry, recalibrates phase without full reset, and hardcore gate never unlocks Prince bonus on reset', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    // Place distractor into bucket-transfer + 5 valid cards to enable submit
    await page.locator('#p1-cards-pool .p1-card[data-category="distractor"]').first().click();
    await page.locator('#bucket-transfer .bucket-slot').click();

    await page.locator('#p1-cards-pool .p1-card[data-category="transfer"]').first().click();
    await page.locator('#bucket-transfer .bucket-slot').click();

    for (const cat of ['storage', 'protection']) {
      const cards = page.locator(`#p1-cards-pool .p1-card[data-category="${cat}"]`);
      const count = await cards.count();
      for (let i = 0; i < count; i++) {
        await page.locator(`#p1-cards-pool .p1-card[data-category="${cat}"]`).first().click();
        await page.locator(`#bucket-${cat} .bucket-slot`).click();
      }
    }

    await expect(page.locator('#p1-submit-btn')).toBeEnabled();
    await page.locator('#p1-submit-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    const failEvents = await page.evaluate(() => window.__sentTelemetry.filter(e => !e.success));
    expect(failEvents.length).toBe(1);
    expect(failEvents[0].action_type).toBe('hardcore_reset');
    expect(failEvents[0].stage).toBe(1);
    expect(failEvents[0].total_stages).toBe(3);
    expect(failEvents[0].start_time).toBeTruthy();

    // Procedural recalibration restores 7 fresh cards in pool and keeps Phase 1 active
    await page.waitForTimeout(1450);
    await expect(page.locator('#feedback-box')).toBeHidden();
    await expect(page.locator('#phase1-container')).toBeVisible();
    await expect(page.locator('#p1-cards-pool .p1-card')).toHaveCount(7);

    // Hardcore Gate on lesson page: reset/fail keeps Prince of Persia bonus sealed
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
        action_type: 'hardcore_reset',
        mission_name: 'Урок 9 :: Информационные процессы. Передача и хранение информации (Уровень 1)',
        level: 1,
        stage: 1,
        total_stages: 3,
        success: false,
        start_time: new Date().toISOString(),
        time_spent_sec: 5
      }, '*');
    });

    await expect(page.locator('#prince-bonus-card')).toBeHidden();
    await expect(page.locator('#completion-screen')).toBeHidden();
  });
});
