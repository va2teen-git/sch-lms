import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const LESSON_TASK_FILE = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/31/level1.astro');
const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level1';

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

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function solvePhase1UI(page) {
  const slots = page.locator('#p1-slots-container > div');
  const count = await slots.count();
  expect(count).toBe(3);

  for (let idx = 0; idx < count; idx++) {
    const row = slots.nth(idx);
    const text = await row.innerText();
    const match = text.match(/N\s*=\s*(\d+)/);
    expect(match, `Cannot parse N from slot text: ${text}`).not.toBeNull();
    const N = Number(match[1]);
    const bits = Math.ceil(Math.log2(N));

    await page.locator(`#p1-token-pool button[data-bits="${bits}"]`).click();
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

  const rightTexts = [];
  for (let r = 0; r < rightCount; r++) {
    rightTexts.push((await rightButtons.nth(r).innerText()).trim());
  }

  for (let l = 0; l < leftCount; l++) {
    const leftBtn = leftButtons.nth(l);
    const html = await leftBtn.innerHTML();
    const text = (await leftBtn.innerText()).replace(/\s+/g, ' ').trim();

    let expectedRegex = null;
    const textMatch = text.match(/K\s*=\s*(\d+)\s*симв\.,\s*N\s*=\s*(\d+)/);
    if (textMatch) {
      const K = Number(textMatch[1]);
      const N = Number(textMatch[2]);
      const i = Math.ceil(Math.log2(N));
      const bytes = (K * i) / 8;
      const expected = bytes >= 1024 && bytes % 1024 === 0 ? `${bytes / 1024} Кбайт` : `${bytes} байт`;
      expectedRegex = new RegExp(`^${escapeRegExp(expected)}(?:а)?$`);
    } else if (html.includes('2<sup>16</sup> бит')) {
      expectedRegex = /^8 Кбайт$/;
    } else if (html.includes('2<sup>22</sup> байт')) {
      expectedRegex = /^4 МиБ$/;
    } else if (html.includes('0,5 МиБ')) {
      expectedRegex = /^512 КиБ$/;
    } else if (html.includes('2<sup>15</sup> бит')) {
      expectedRegex = /^4 Кбайт$/;
    } else {
      const netMatch = text.match(/(\d+)\s*(М|Г)бит\/с.*за\s*(\d+)\s*с/);
      expect(netMatch, `Unrecognized Phase 2 left port: ${text} | ${html}`).not.toBeNull();
      const rate = Number(netMatch[1]);
      const unit = netMatch[2];
      const sec = Number(netMatch[3]);
      const val = (rate * sec) / 8;
      const expectedUnit = unit === 'Г' ? 'ГБ' : 'МБ';
      expectedRegex = new RegExp(`^${escapeRegExp(`${val} ${expectedUnit}`)}`);
    }

    const rIdx = rightTexts.findIndex((rt) => expectedRegex.test(rt));
    expect(rIdx, `No matching right port for "${text}" (${expectedRegex}) among ${JSON.stringify(rightTexts)}`).toBeGreaterThanOrEqual(0);

    await leftBtn.click();
    await rightButtons.nth(rIdx).click();
  }

  await expect(page.locator('#p2-submit-btn')).toBeEnabled();
  await page.locator('#p2-submit-btn').click();
}

export async function solvePhase3UI(page) {
  const specText = (await page.locator('#p3-task-spec').innerText()).replace(/\s+/g, ' ');
  const mMatch = specText.match(/M\s*=\s*(\d+)/);
  const kMatch = specText.match(/K\s*=\s*(\d+)/);
  const letMatch = specText.match(/(\d+)\s*латинских букв/);
  const digMatch = specText.match(/(\d+)\s*цифр/);
  const specMatch = specText.match(/(\d+)\s*спецсимволов/);
  const extraMatch = specText.match(/отводится\s*(\d+)\s*байт/);

  expect(mMatch && kMatch && letMatch && digMatch && extraMatch, `Cannot parse Phase 3 spec: ${specText}`).toBeTruthy();

  const M = Number(mMatch[1]);
  const K = Number(kMatch[1]);
  const N = Number(letMatch[1]) + Number(digMatch[1]) + (specMatch ? Number(specMatch[1]) : 0);
  const extraBytes = Number(extraMatch[1]);

  const bits = Math.ceil(Math.log2(N));
  const recordBytes = Math.ceil((K * bits) / 8) + extraBytes;
  const totalBytes = M * recordBytes;

  await page.locator(`#p3-bit-bar button[data-bit-index="${bits}"]`).click();
  await page.locator(`#p3-byte-grid button[data-byte-index="${recordBytes}"]`).click();
  await page.locator('#p3-total-slider').fill(String(totalBytes));

  await expect(page.locator('#p3-total-badge')).toContainText(`${totalBytes} байт`);
  await expect(page.locator('#p3-submit-btn')).toBeEnabled();
  await page.locator('#p3-submit-btn').click();
}

test.describe('10th Grade Advanced Lesson 31: Level 1 Task Suite', () => {
  test('Level 1 adheres to architectural requirements (Zero-Style, Zero-CDN, Zero Multiple Choice, TaskLayout, LMSTelemetry)', async () => {
    expect(fs.existsSync(LESSON_TASK_FILE), 'level1.astro must exist').toBe(true);
    const code = fs.readFileSync(LESSON_TASK_FILE, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}>');
    expect(code).toContain('LMSTelemetry');
    expect(code).toContain('Урок 31');

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

    // Deliberately assign wrong tokens across all 3 slots
    const slots = page.locator('#p1-slots-container > div');
    for (let idx = 0; idx < 3; idx++) {
      const row = slots.nth(idx);
      const text = await row.innerText();
      const N = Number(text.match(/N\s*=\s*(\d+)/)[1]);
      const rightBits = Math.ceil(Math.log2(N));
      const poolBtns = page.locator('#p1-token-pool button[data-bits]:not([disabled])');
      const poolCount = await poolBtns.count();
      let pickedWrong = false;
      for (let b = 0; b < poolCount; b++) {
        const val = Number(await poolBtns.nth(b).getAttribute('data-bits'));
        if (val !== rightBits) {
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
