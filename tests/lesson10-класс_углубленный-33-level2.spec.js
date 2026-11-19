import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const LESSON_TASK_FILE = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/33/level2.astro');
const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33/level2';

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

export async function computePhaseAnswerDOM(page, phaseNum) {
  const condLoc = page.locator(`#p${phaseNum}-condition`);
  await expect(condLoc).toBeVisible();
  const condHtml = (await condLoc.innerHTML()).replace(/\s+/g, ' ');
  const condText = (await condLoc.innerText()).replace(/\s+/g, ' ');

  if (phaseNum === 1) {
    const match = condHtml.match(/([0-9A-F]+)<sub>(\d+)<\/sub>/i);
    expect(match, `Cannot parse Phase 1 HTML: ${condHtml}`).not.toBeNull();
    return parseInt(match[1], Number(match[2]));
  }

  if (phaseNum === 2) {
    const decMatch = condHtml.match(/([0-9]+(?:[.,][0-9]+)?)<sub>10<\/sub>/);
    const baseMatch = condText.match(/Целевое основание:\s*q\s*=\s*(\d+)/);
    expect(decMatch && baseMatch, `Cannot parse Phase 2 condition: ${condHtml}`).toBeTruthy();

    const decVal = Number(decMatch[1].replace(',', '.'));
    const q = Number(baseMatch[1]);
    const intPart = Math.floor(decVal);
    let fracPart = decVal - intPart;

    let fracStr = '';
    for (let step = 0; step < 8 && fracPart > 1e-9; step++) {
      fracPart *= q;
      const d = Math.floor(fracPart + 1e-12);
      fracStr += String(d);
      fracPart -= d;
    }
    const intStr = intPart.toString(q);
    return fracStr.length > 0 ? `${intStr}.${fracStr}` : intStr;
  }

  if (phaseNum === 3) {
    const match = condHtml.match(/([0-9A-F]+)<sub>x<\/sub>[\s\S]*?(\d+)<sub>10<\/sub>/i);
    expect(match, `Cannot parse Phase 3 HTML: ${condHtml}`).not.toBeNull();
    const srcStr = match[1];
    const decVal = Number(match[2]);
    const minBase = Math.max(...srcStr.split('').map((c) => parseInt(c, 36))) + 1;
    for (let x = minBase; x <= 36; x++) {
      if (parseInt(srcStr, x) === decVal) return x;
    }
    throw new Error(`No base x found for ${srcStr} = ${decVal}`);
  }

  if (phaseNum === 4) {
    const expMatch = condHtml.match(/(\d+)<sup>(\d+)<\/sup>\s*\+\s*(\d+)<sup>(\d+)<\/sup>\s*(?:−|-|&minus;)\s*(\d+)<sup>(\d+)<\/sup>/);
    expect(expMatch, `Cannot parse Phase 4 expression HTML: ${condHtml}`).not.toBeNull();
    const k = Number(expMatch[4]);
    const r = Number(expMatch[6]);
    return k - r;
  }

  if (phaseNum === 5) {
    const match = condHtml.match(/([0-9A-F]+),([0-9A-F]+)<sub>16<\/sub>/i);
    expect(match, `Cannot parse Phase 5 HTML: ${condHtml}`).not.toBeNull();
    const intOct = parseInt(match[1], 16).toString(8);
    const fracDigit = parseInt(match[2], 16);
    const octFrac = (fracDigit * 8) / 16;
    return `${intOct}.${octFrac}`;
  }

  throw new Error(`Unsupported phaseNum: ${phaseNum}`);
}

export async function solvePhaseDOM(page, phaseNum, formatFn = (v) => String(v)) {
  const ans = await computePhaseAnswerDOM(page, phaseNum);
  const input = page.locator(`#p${phaseNum}-input`);
  await input.fill(formatFn(ans));
  await page.locator(`#p${phaseNum}-submit-btn`).click();
  return ans;
}

test.describe('10th Grade Advanced Lesson 33: Level 2 Analytical Suite', () => {
  test('Level 2 adheres to architectural requirements (Zero Multiple Choice, text inputmode=decimal, Zero-Style, Zero-CDN)', async () => {
    expect(fs.existsSync(LESSON_TASK_FILE), 'level2.astro must exist').toBe(true);
    const code = fs.readFileSync(LESSON_TASK_FILE, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}>');
    expect(code).toContain('LMSTelemetry');
    expect(code).toContain('Урок 33');

    // Forbid <input type="number"> and Multiple Choice
    expect(code).not.toMatch(/type=["']number["']/i);
    expect(code).not.toMatch(/<select\b/i);
    expect(code).not.toMatch(/type=["']radio["']/i);
    expect(code).toContain('inputmode="decimal"');

    // Zero-Style & Zero-CDN & Prince Integrity
    expect(code).not.toMatch(/<style\b/i);
    expect(code).not.toMatch(/https?:\/\/(?:cdn|unpkg|jsdelivr)/i);
    expect(code).not.toMatch(/prince_complete|prince-campaign/);
  });

  test('Full 5-phase Sawtooth walkthrough with Russian comma formatting & telemetry verification', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible();
      await expect(page.locator('#phase-badge')).toContainText(`Шаг ${p} из 5`);
      await solvePhaseDOM(page, p, (v) => ` ${String(v).replace('.', ',')} `);
    }

    await expect(page.locator('#victory-screen')).toBeVisible();

    const events = await page.evaluate(() => window.__sentTelemetry);
    const progressEvents = events.filter((e) => e.action_type === 'in_progress');
    expect(progressEvents.length).toBe(4);
    expect(progressEvents[0].stage).toBe(2);
    expect(progressEvents[0].total_stages).toBe(5);

    const completeEvt = events.find((e) => e.action_type === 'level_complete');
    expect(completeEvt).toBeDefined();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.stage).toBe(5);
    expect(completeEvt.total_stages).toBe(5);
    expect(completeEvt.start_time).toBeTruthy();
    expect(completeEvt.time_spent_sec).toBeGreaterThanOrEqual(1);
  });

  test('Wrong numeric answer triggers #feedback-box, emits level_fail, regenerates phase condition, and stays recoverable', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    const ans1 = await computePhaseAnswerDOM(page, 1);
    await page.locator('#p1-input').fill(String(ans1 + 77));
    await page.locator('#p1-submit-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    const failEvt = await page.evaluate(() => window.__sentTelemetry.find((e) => e.success === false));
    expect(failEvt).toBeDefined();
    expect(['hardcore_reset', 'level_fail']).toContain(failEvt.action_type);
    expect(failEvt.success).toBe(false);
    expect(failEvt.stage).toBe(1);
    expect(failEvt.total_stages).toBe(5);

    await page.waitForTimeout(1450);
    await expect(page.locator('#feedback-box')).toBeHidden();

    await solvePhaseDOM(page, 1);
    await expect(page.locator('#phase2')).toBeVisible();
  });
});
