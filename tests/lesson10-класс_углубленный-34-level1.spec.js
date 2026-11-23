import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/34/level1';

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

function normalizeFracPairToKey(text, base) {
  const clean = text.trim().toUpperCase().replace(/\s+/g, '');
  if (!clean.includes(',')) {
    return `int:${parseInt(clean, base)}@${base}`;
  }
  const [intStr, fracStr] = clean.split(',');
  const intVal = parseInt(intStr || '0', base);
  let fracVal = 0;
  for (let i = 0; i < fracStr.length; i++) {
    fracVal += parseInt(fracStr[i], base) / Math.pow(base, i + 1);
  }
  const sixteenUnits = Math.round(fracVal * 16);
  return `mix:${intVal}:${sixteenUnits}`;
}

async function solvePhase1FromDOM(page) {
  const { digits, width, base } = await page.evaluate(() => {
    const el = document.querySelector('#p1-number-display');
    const sub = el.querySelector('sub');
    const baseNum = parseInt(sub.textContent.trim(), 10);
    const numText = el.firstChild.textContent.trim();
    return { digits: numText.split(''), width: baseNum === 16 ? 4 : 3, base: baseNum };
  });

  for (let i = 0; i < digits.length; i++) {
    const expectedBits = parseInt(digits[i], base).toString(2).padStart(width, '0');
    const tokenBtn = page.locator('#p1-token-pool button[data-token-id]', { hasText: `${expectedBits}₂` }).first();
    await tokenBtn.click();
    await page.locator(`#p1-slots-container button[data-slot-id="slot-${i}"]`).click();
  }
  await page.locator('#p1-submit-btn').click();
}

async function solvePhase2FromDOM(page) {
  const portsData = await page.evaluate(() => {
    const parsePort = (btn, attr) => {
      const id = btn.getAttribute(attr);
      const sub = btn.querySelector('sub');
      const base = parseInt(sub.textContent.trim(), 10);
      const fullText = btn.innerText.replace(/[●○]/g, '').trim();
      const rawVal = fullText.slice(0, fullText.length - String(base).length).trim();
      return { id, rawVal, base };
    };
    const lefts = Array.from(document.querySelectorAll('#p2-left-ports button[data-left-id]')).map(b => parsePort(b, 'data-left-id'));
    const rights = Array.from(document.querySelectorAll('#p2-right-ports button[data-right-id]')).map(b => parsePort(b, 'data-right-id'));
    return { lefts, rights };
  });

  for (const left of portsData.lefts) {
    const isMixed = left.rawVal.includes(',');
    const matchRight = portsData.rights.find((right) => {
      if (isMixed !== right.rawVal.includes(',')) return false;
      if (isMixed) {
        return normalizeFracPairToKey(left.rawVal, left.base) === normalizeFracPairToKey(right.rawVal, right.base);
      }
      return parseInt(left.rawVal, left.base) === parseInt(right.rawVal, right.base);
    });
    expect(matchRight, `Should find matching right port for ${left.rawVal}_${left.base}`).toBeTruthy();
    await page.locator(`#p2-left-ports button[data-left-id="${left.id}"]`).click();
    await page.locator(`#p2-right-ports button[data-right-id="${matchRight.id}"]`).click();
  }

  expect(await page.locator('#p2-svg-wires path').count()).toBe(3);
  await page.locator('#p2-submit-btn').click();
}

async function solvePhase3FromDOM(page) {
  const targetBits = await page.evaluate(() => {
    const code = document.querySelector('#p3-task-spec code');
    const html = code.innerHTML;
    const m = html.match(/([0-7]+)<sub>8<\/sub>\s*(AND \(&amp;\)|OR \(\|\)|XOR \(\^\))\s*([0-9A-F]+)<sub>16<\/sub>/i);
    if (!m) throw new Error('Cannot parse phase 3 expression: ' + html);
    const a = parseInt(m[1], 8);
    const op = m[2];
    const mask = parseInt(m[3], 16);
    let res = 0;
    if (op.startsWith('AND')) res = (a & mask) & 0xFF;
    else if (op.startsWith('OR')) res = (a | mask) & 0xFF;
    else res = (a ^ mask) & 0xFF;
    return res.toString(2).padStart(8, '0');
  });

  for (let i = 0; i < 8; i++) {
    if (targetBits[i] === '1') {
      await page.locator(`#p3-tape-container button[data-bit-index="${i}"]`).click();
    }
  }
  await page.locator('#p3-submit-btn').click();
}

test.describe('10th Grade Advanced Lesson 34: Level 1 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/34/level1.astro');

  test('Architectural contract: TaskLayout 1, Zero Multiple Choice, Zero-Style/CDN, LMSTelemetry & >=48px hitboxes', async ({ page }) => {
    expect(fs.existsSync(taskPath)).toBe(true);
    const code = fs.readFileSync(taskPath, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}>');
    expect(code).toContain('LMSTelemetry.create');
    expect(code).toContain('totalStages: 3');
    expect(code).not.toContain('<style');
    expect(code).not.toContain('type="radio"');
    expect(code).not.toContain('<select');
    expect(code).not.toContain('prince_complete');
    expect(/https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/i.test(code)).toBe(false);

    await page.goto(TASK_URL);
    expect(await page.locator('#game-container input[type="radio"]').count()).toBe(0);
    expect(await page.locator('#game-container select').count()).toBe(0);

    const tokenBtns = page.locator('#p1-token-pool button');
    const count = await tokenBtns.count();
    expect(count).toBe(4);
    for (let i = 0; i < count; i++) {
      const box = await tokenBtns.nth(i).boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(48);
      expect(box.height).toBeGreaterThanOrEqual(48);
    }
  });

  test('Full 3-phase E2E walkthrough emits valid LMSTelemetry events and reaches victory screen', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');
    await solvePhase1FromDOM(page);

    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
    await solvePhase2FromDOM(page);

    await expect(page.locator('#phase3')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');
    await solvePhase3FromDOM(page);

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    const events = await page.evaluate(() => window.__sentTelemetry);
    const completeEvt = events.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.mission_name).toContain('Урок 34');
    expect(completeEvt.mission_name).toContain('Уровень 1');
    expect(completeEvt.total_stages).toBe(3);
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.start_time).toBeTruthy();
    expect(typeof completeEvt.time_spent_sec).toBe('number');
  });

  test('Wrong assignment triggers #feedback-box, fail telemetry, procedural regeneration, and clean recovery', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    const tokens = page.locator('#p1-token-pool button[data-token-id]');
    // Place tokens in reverse or include distractor to guarantee mismatch against slots
    const { firstSlotWrongTokId } = await page.evaluate(() => {
      const el = document.querySelector('#p1-number-display');
      const base = parseInt(el.querySelector('sub').textContent.trim(), 10);
      const width = base === 16 ? 4 : 3;
      const firstDigit = el.firstChild.textContent.trim()[0];
      const expected = parseInt(firstDigit, base).toString(2).padStart(width, '0') + '₂';
      const btns = Array.from(document.querySelectorAll('#p1-token-pool button[data-token-id]'));
      const wrong = btns.find(b => b.textContent.trim() !== expected);
      return { firstSlotWrongTokId: wrong.getAttribute('data-token-id') };
    });

    await page.locator(`#p1-token-pool button[data-token-id="${firstSlotWrongTokId}"]`).click();
    await page.locator('#p1-slots-container button[data-slot-id="slot-0"]').click();
    for (let s = 1; s < 3; s++) {
      await tokens.first().click();
      await page.locator(`#p1-slots-container button[data-slot-id="slot-${s}"]`).click();
    }
    await page.locator('#p1-submit-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    const failEvents = await page.evaluate(() => window.__sentTelemetry.filter(e => e.success === false));
    expect(failEvents.length).toBe(1);
    expect(failEvents[0].start_time).toBeTruthy();

    await page.waitForTimeout(1550);
    await expect(page.locator('#feedback-box')).toBeHidden();
    await expect(page.locator('#phase1')).toBeVisible();

    await solvePhase1FromDOM(page);
    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
  });
});
