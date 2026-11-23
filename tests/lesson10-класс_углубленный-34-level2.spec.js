import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/34/level2';

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

async function solvePhaseAnswerFromDOM(page, phase) {
  return page.evaluate((p) => {
    if (p === 1) {
      const cond = document.querySelector('#p1-condition');
      const binStr = cond.querySelector('strong.text-warning').firstChild.textContent.trim();
      const targetBase = cond.querySelector('strong.text-info').textContent.includes('16') ? 16 : 8;
      return parseInt(binStr, 2).toString(targetBase).toUpperCase();
    }
    if (p === 2) {
      const cond = document.querySelector('#p2-condition');
      const subs = cond.querySelectorAll('sub');
      const srcBase = parseInt(subs[0].textContent.trim(), 10);
      const targetBase = parseInt(subs[1].textContent.trim(), 10);
      const srcStr = cond.querySelector('strong.text-warning').firstChild.textContent.trim();
      return parseInt(srcStr, srcBase).toString(targetBase).toUpperCase();
    }
    if (p === 3) {
      const html = document.querySelector('#p3-condition strong.text-warning').innerHTML;
      const m = html.match(/([0-7]+)<sub>8<\/sub>\s*\+\s*X<sub>16<\/sub>\s*=\s*([01]+)<sub>2<\/sub>/);
      if (!m) throw new Error('Cannot parse phase 3 equation: ' + html);
      return (parseInt(m[2], 2) - parseInt(m[1], 8)).toString(16).toUpperCase();
    }
    if (p === 4) {
      const cond = document.querySelector('#p4-condition');
      const sups = cond.querySelectorAll('strong.text-warning sup');
      const a = BigInt(sups[0].textContent.trim());
      const b = BigInt(sups[1].textContent.trim());
      const c = BigInt(sups[2].textContent.trim());
      const askText = cond.querySelector('strong.text-info').textContent;
      const targetDigit = askText.includes('0') ? '0' : '1';
      const val = (1n << (4n * a)) + (1n << (3n * b)) - (1n << c);
      const bin = val.toString(2);
      let cnt = 0;
      for (const ch of bin) {
        if (ch === targetDigit) cnt++;
      }
      return String(cnt);
    }
    if (p === 5) {
      const cond = document.querySelector('#p5-condition');
      const subs = cond.querySelectorAll('sub');
      const srcBase = parseInt(subs[0].textContent.trim(), 10);
      const targetBase = parseInt(subs[1].textContent.trim(), 10);
      const mixedStr = cond.querySelector('strong.text-warning').firstChild.textContent.trim();
      const [intPart, fracPart] = mixedStr.split(',');
      const srcW = srcBase === 16 ? 4 : 3;
      const dstW = targetBase === 16 ? 4 : 3;

      const intBin = parseInt(intPart, srcBase).toString(2);
      let fracBin = '';
      for (const ch of fracPart) {
        fracBin += parseInt(ch, srcBase).toString(2).padStart(srcW, '0');
      }
      fracBin = fracBin.replace(/0+$/, '');

      const paddedInt = intBin.padStart(Math.ceil(intBin.length / dstW) * dstW, '0');
      let intRes = '';
      for (let i = 0; i < paddedInt.length; i += dstW) {
        intRes += parseInt(paddedInt.slice(i, i + dstW), 2).toString(targetBase).toUpperCase();
      }
      intRes = intRes.replace(/^0+([0-9A-F])/, '$1') || '0';

      if (!fracBin) return intRes;
      const paddedFrac = fracBin.padEnd(Math.ceil(fracBin.length / dstW) * dstW, '0');
      let fracRes = '';
      for (let i = 0; i < paddedFrac.length; i += dstW) {
        fracRes += parseInt(paddedFrac.slice(i, i + dstW), 2).toString(targetBase).toUpperCase();
      }
      fracRes = fracRes.replace(/0+$/, '');
      return fracRes ? `${intRes},${fracRes}` : intRes;
    }
    return '';
  }, phase);
}

test.describe('10th Grade Advanced Lesson 34: Level 2 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/34/level2.astro');

  test('Architectural contract: TaskLayout 2, manual inputmode="decimal", zero number/radio/select, zero Style/CDN', async ({ page }) => {
    expect(fs.existsSync(taskPath)).toBe(true);
    const code = fs.readFileSync(taskPath, 'utf-8');

    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}>');
    expect(code).toContain('LMSTelemetry.create');
    expect(code).toContain('totalStages: 5');
    expect(code).toContain('inputmode="decimal"');
    expect(code).not.toContain('type="number"');
    expect(code).not.toContain('<style');
    expect(code).not.toContain('type="radio"');
    expect(code).not.toContain('<select');
    expect(code).not.toContain('prince_complete');
    expect(/https?:\/\/(?:cdn\.|unpkg\.com|cdnjs\.cloudflare\.com|fonts\.googleapis\.com)/i.test(code)).toBe(false);

    await page.goto(TASK_URL);
    expect(await page.locator('#game-container input[type="number"]').count()).toBe(0);
    expect(await page.locator('#game-container input[type="radio"]').count()).toBe(0);
    expect(await page.locator('#game-container select').count()).toBe(0);
    expect(await page.locator('#game-container input[inputmode="decimal"]').count()).toBe(5);
  });

  test('Full 5-phase walkthrough emits valid LMSTelemetry events and reaches victory screen', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible({ timeout: 5000 });
      await expect(page.locator('#phase-badge')).toHaveText(`Шаг ${p} из 5`);
      const ans = await solvePhaseAnswerFromDOM(page, p);
      await page.locator(`#p${p}-input`).fill(ans);
      await page.locator(`#p${p}-submit-btn`).click();
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    const events = await page.evaluate(() => window.__sentTelemetry);
    const completeEvt = events.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.mission_name).toContain('Урок 34');
    expect(completeEvt.mission_name).toContain('Уровень 2');
    expect(completeEvt.total_stages).toBe(5);
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.start_time).toBeTruthy();
    expect(typeof completeEvt.time_spent_sec).toBe('number');
  });

  test('Wrong calculation triggers #feedback-box + procedural regeneration; whitespace, lowercase, % and comma accepted', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await page.locator('#p1-input').fill('ZZ99');
    await page.locator('#p1-submit-btn').click();
    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    const failEvents = await page.evaluate(() => window.__sentTelemetry.filter(e => e.success === false));
    expect(failEvents.length).toBe(1);

    await page.waitForTimeout(1450);
    await expect(page.locator('#feedback-box')).toBeHidden();

    // Lowercase, surrounding spaces and % sign on Phase 1
    const p1Ans = await solvePhaseAnswerFromDOM(page, 1);
    await page.locator('#p1-input').fill(`  ${p1Ans.toLowerCase()}%  `);
    await page.locator('#p1-submit-btn').click();
    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });

    // Progress through Phases 2-4 and test Russian comma on Phase 5
    for (let p = 2; p <= 4; p++) {
      const ans = await solvePhaseAnswerFromDOM(page, p);
      await page.locator(`#p${p}-input`).fill(ans);
      await page.locator(`#p${p}-submit-btn`).click();
      await expect(page.locator(`#phase${p + 1}`)).toBeVisible({ timeout: 5000 });
    }

    const p5Ans = await solvePhaseAnswerFromDOM(page, 5);
    await page.locator('#p5-input').fill(` ${p5Ans} `);
    await page.locator('#p5-submit-btn').click();
    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
  });
});
