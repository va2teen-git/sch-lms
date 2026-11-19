import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const LESSON_TASK_FILE = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/33/level1.astro');
const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33/level1';

async function attachTelemetrySpy(page) {
  await page.addInitScript(() => {
    window.__sentTelemetry = [];
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'TELEMETRY_EVENT') {
        window.__sentTelemetry.push(event.data);
      }
    });
  });
}

export async function solvePhase1UI(page) {
  const slots = page.locator('#p1-slots-container > div');
  const count = await slots.count();
  expect(count).toBe(3);

  for (let idx = 0; idx < count; idx++) {
    const row = slots.nth(idx);
    const labelHtml = await row.locator('div.text-light').innerHTML();
    const match = labelHtml.match(/<strong>(\d+)<sup>(\d+)<\/sup><\/strong>[\s\S]*?<span[^>]*>([0-9A-F]+)<\/span>/i);
    expect(match, `Cannot parse Phase 1 slot HTML: ${labelHtml}`).not.toBeNull();

    const base = Number(match[1]);
    const power = Number(match[2]);
    const digitChar = match[3].trim();
    const digitVal = parseInt(digitChar, base);
    const contribution = digitVal * Math.pow(base, power);

    const matchingToken = page.locator('#p1-token-pool button[data-token-id]', {
      hasText: new RegExp(`^${contribution}$`)
    }).first();
    await matchingToken.click();
    await row.locator('button[data-slot-id]').click();
  }

  await expect(page.locator('#p1-submit-btn')).toBeEnabled();
  await page.locator('#p1-submit-btn').click();
}

export async function solvePhase2UI(page) {
  const leftButtons = page.locator('#p2-left-ports button[data-left-id]');
  const rightButtons = page.locator('#p2-right-ports button[data-right-id]');
  const leftCount = await leftButtons.count();
  const rightCount = await rightButtons.count();
  expect(leftCount).toBe(3);
  expect(rightCount).toBe(5);

  const rightHtmls = [];
  for (let r = 0; r < rightCount; r++) {
    rightHtmls.push(await rightButtons.nth(r).locator('span').nth(1).innerHTML());
  }

  for (let l = 0; l < leftCount; l++) {
    const leftBtn = leftButtons.nth(l);
    const spanHtml = (await leftBtn.locator('span').first().innerHTML()).trim();
    const match = spanHtml.match(/^([0-9A-F]+)<sub>(\d+)<\/sub>\s*(?:→|&rarr;)\s*\(\?\)<sub>(\d+)<\/sub>$/i);
    expect(match, `Cannot parse Phase 2 left port HTML: ${spanHtml}`).not.toBeNull();

    const srcStr = match[1];
    const srcBase = Number(match[2]);
    const dstBase = Number(match[3]);
    const expectedStr = parseInt(srcStr, srcBase).toString(dstBase).toUpperCase();
    const expectedFragment = `${expectedStr}<sub>${dstBase}</sub>`;

    const rIdx = rightHtmls.findIndex((rh) => rh.trim() === expectedFragment);
    expect(rIdx, `No right port matching "${expectedFragment}" in ${JSON.stringify(rightHtmls)}`).toBeGreaterThanOrEqual(0);

    await leftBtn.click();
    await rightButtons.nth(rIdx).click();
  }

  await expect(page.locator('#p2-submit-btn')).toBeEnabled();
  await page.locator('#p2-submit-btn').click();
}

export async function solvePhase3UI(page) {
  const specHtml = (await page.locator('#p3-task-spec').innerHTML()).replace(/\s+/g, ' ');
  const numMatch = specHtml.match(/([0-9A-F]+)<sub>(\d+)<\/sub>/i);
  const lenMatch = specHtml.match(/(\d+)\s*разрядов\s*\(основание\s*(\d+)\)/i);
  expect(numMatch && lenMatch, `Cannot parse Phase 3 spec HTML: ${specHtml}`).toBeTruthy();

  const srcStr = numMatch[1];
  const srcBase = Number(numMatch[2]);
  const tapeLen = Number(lenMatch[1]);
  const targetBase = Number(lenMatch[2]);

  const decVal = parseInt(srcStr, srcBase);
  const targetDigits = decVal.toString(targetBase).padStart(tapeLen, '0').split('').map(Number);

  for (let idx = 0; idx < tapeLen; idx++) {
    const clicksNeeded = targetDigits[idx];
    const cellBtn = page.locator(`#p3-tape-container button[data-tape-idx="${idx}"]`);
    for (let c = 0; c < clicksNeeded; c++) {
      await cellBtn.click();
    }
  }

  await expect(page.locator('#p3-submit-btn')).toBeEnabled();
  await page.locator('#p3-submit-btn').click();
}

test.describe('10th Grade Advanced Lesson 33: Level 1 Task Suite', () => {
  test('Level 1 adheres to architectural requirements (Zero-Style, Zero-CDN, Zero Multiple Choice, TaskLayout, LMSTelemetry)', async () => {
    expect(fs.existsSync(LESSON_TASK_FILE), 'level1.astro must exist').toBe(true);
    const code = fs.readFileSync(LESSON_TASK_FILE, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}>');
    expect(code).toContain('LMSTelemetry');
    expect(code).toContain('Урок 33');

    // Zero Multiple Choice
    expect(code).not.toMatch(/<select\b/i);
    expect(code).not.toMatch(/type=["']radio["']/i);

    // Zero-Style & Zero-CDN
    expect(code).not.toMatch(/<style\b/i);
    expect(code).not.toMatch(/https?:\/\/(?:cdn|unpkg|jsdelivr)/i);

    // Must not tamper with Prince of Persia flags directly
    expect(code).not.toMatch(/prince_complete|prince-campaign/);
  });

  test('Full 3-phase interactive walkthrough via mouse clicks and telemetry contract check', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await expect(page.locator('#phase-badge')).toContainText('Шаг 1 из 3');
    await solvePhase1UI(page);

    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toContainText('Шаг 2 из 3');
    await solvePhase2UI(page);

    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toContainText('Шаг 3 из 3');
    await solvePhase3UI(page);

    await expect(page.locator('#victory-screen')).toBeVisible();

    const events = await page.evaluate(() => window.__sentTelemetry);
    const progressEvents = events.filter((e) => e.action_type === 'in_progress');
    expect(progressEvents.length).toBeGreaterThanOrEqual(2);
    expect(progressEvents[0].total_stages).toBe(3);

    const completeEvt = events.find((e) => e.action_type === 'level_complete');
    expect(completeEvt).toBeDefined();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.stage).toBe(3);
    expect(completeEvt.total_stages).toBe(3);
    expect(completeEvt.start_time).toBeTruthy();
    expect(completeEvt.time_spent_sec).toBeGreaterThanOrEqual(1);
  });

  test('Wrong configuration shows feedback, logs level_fail telemetry, and regenerates phase cleanly', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    const slots = page.locator('#p1-slots-container > div');
    for (let idx = 0; idx < 3; idx++) {
      const row = slots.nth(idx);
      const labelHtml = await row.locator('div.text-light').innerHTML();
      const match = labelHtml.match(/<strong>(\d+)<sup>(\d+)<\/sup><\/strong>[\s\S]*?<span[^>]*>([0-9A-F]+)<\/span>/i);
      const base = Number(match[1]);
      const power = Number(match[2]);
      const correctVal = parseInt(match[3].trim(), base) * Math.pow(base, power);

      const poolBtns = page.locator('#p1-token-pool button[data-token-id]');
      const poolCount = await poolBtns.count();
      let pickedWrong = false;
      for (let b = 0; b < poolCount; b++) {
        const val = Number((await poolBtns.nth(b).innerText()).trim());
        if (val !== correctVal) {
          await poolBtns.nth(b).click();
          pickedWrong = true;
          break;
        }
      }
      if (!pickedWrong) await poolBtns.first().click();
      await row.locator('button[data-slot-id]').click();
    }

    await page.locator('#p1-submit-btn').click();
    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    const failEvt = await page.evaluate(() => window.__sentTelemetry.find((e) => e.success === false));
    expect(failEvt).toBeDefined();
    expect(['hardcore_reset', 'level_fail']).toContain(failEvt.action_type);
    expect(failEvt.success).toBe(false);
    expect(failEvt.stage).toBe(1);
    expect(failEvt.total_stages).toBe(3);

    await page.waitForTimeout(1400);
    await expect(page.locator('#feedback-box')).toBeHidden();
    await solvePhase1UI(page);
    await expect(page.locator('#phase2')).toBeVisible();
  });
});
