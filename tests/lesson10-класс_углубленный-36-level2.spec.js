import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/36/level2';

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
      const binStr = cond.querySelector('strong.text-warning span').firstChild.textContent.trim();
      const targetBase = cond.querySelector('strong.text-light').textContent.includes('16') ? 16 : 8;
      return parseInt(binStr, 2).toString(targetBase).toUpperCase();
    }
    if (p === 2) {
      const cond = document.querySelector('#p2-condition');
      const binMixed = cond.querySelector('strong.text-warning span').firstChild.textContent.trim();
      const targetBase = cond.querySelector('strong.text-light').textContent.includes('16') ? 16 : 8;
      const [intBin, fracBin] = binMixed.split(',');
      const w = targetBase === 16 ? 4 : 3;
      const intRes = parseInt(intBin, 2).toString(targetBase).toUpperCase();
      const paddedFrac = fracBin.padEnd(Math.ceil(fracBin.length / w) * w, '0');
      let fracRes = '';
      for (let i = 0; i < paddedFrac.length; i += w) {
        fracRes += parseInt(paddedFrac.slice(i, i + w), 2).toString(targetBase).toUpperCase();
      }
      fracRes = fracRes.replace(/0+$/, '');
      return fracRes ? `${intRes},${fracRes}` : intRes;
    }
    if (p === 3) {
      const cond = document.querySelector('#p3-condition');
      const html = cond.innerHTML;
      const sub = cond.querySelector('strong sub');
      const srcBase = parseInt(sub.textContent.trim(), 10);
      const rText = cond.querySelector('.fs-5 strong span').firstChild.textContent.trim();
      const rVal = parseInt(rText, srcBase);
      const shiftBits = html.includes('&lt;&lt; 3') || html.includes('<< 3') ? 3 : 4;
      return (rVal >> shiftBits).toString(16).toUpperCase();
    }
    if (p === 4) {
      const cond = document.querySelector('#p4-condition');
      const strong = cond.querySelector('.fs-5 strong');
      const subs = strong.querySelectorAll('sub');
      if (subs.length === 2) {
        const m = strong.innerHTML.replace(/<\/?span>/gi, '').match(/([0-9A-F]+)<sub>16<\/sub>\s*&lt;\s*x\s*&lt;\s*([0-7]+)<sub>8<\/sub>/i);
        return String(parseInt(m[2], 8) - parseInt(m[1], 16) - 1);
      }
      const hexOctets = strong.textContent.trim().split('.');
      let ones = 0;
      for (const oct of hexOctets) {
        for (const ch of parseInt(oct, 16).toString(2)) {
          if (ch === '1') ones++;
        }
      }
      return String(ones);
    }
    if (p === 5) {
      const cond = document.querySelector('#p5-condition');
      const base = BigInt(cond.querySelector('strong.text-light').textContent.trim());
      const sups = cond.querySelectorAll('.fs-4 strong sup');
      const a = BigInt(sups[0].textContent.trim());
      const p2 = BigInt(sups[1].textContent.trim());
      const p3 = BigInt(sups[2].textContent.trim());
      const b = base === 16n ? p2 / 2n : p2 / 3n;
      const c = base === 16n ? (p3 * 3n) / 4n : (p3 * 2n) / 3n;
      const digitText = cond.querySelector('.text-secondary strong:last-of-type').textContent.trim();
      if (digitText === '0') {
        return String((a - b) + c);
      }
      return String(b - c);
    }
    throw new Error('Unknown phase ' + p);
  }, phase);
}

test.describe('10th Grade Advanced Lesson 36: Level 2 Analytical Input Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/36/level2.astro');

  test('Architectural contracts: TaskLayout 2, 5x inputmode="decimal", no <input type="number">, Zero-Style/CDN', async () => {
    expect(fs.existsSync(taskPath)).toBe(true);
    const code = fs.readFileSync(taskPath, 'utf-8');
    expect(code).toContain('import TaskLayout');
    expect(code).toMatch(/<TaskLayout[\s\S]*level=\{2\}/);
    expect(code.match(/inputmode="decimal"/g)?.length).toBe(5);
    expect(code).toContain('window.LMSTelemetry.create');
    expect(code).not.toMatch(/type=["']number["']/i);
    expect(code).not.toMatch(/<style[\s>]/i);
    expect(code).not.toMatch(/https?:\/\//i);
    expect(code).not.toMatch(/<select|type=["']radio|prince_complete/i);
  });

  test('End-to-end completion of all 5 Sawtooth phases with Russian comma normalization and telemetry', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible({ timeout: 5000 });
      const ans = await solvePhaseAnswerFromDOM(page, p);
      // Проверяем толерантность к пробелам, нижнему регистру, русской запятой и знаку %
      const dirty = p === 2 ? `  ${ans.toLowerCase()}  ` : (p === 4 ? ` /${ans}% ` : `  ${ans.toLowerCase()}  `);
      await page.locator(`#p${p}-input`).fill(dirty);
      await page.locator(`#p${p}-submit-btn`).click();
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    const events = await page.evaluate(() => window.__sentTelemetry);
    const completeEvt = events.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.stage).toBe(5);
    expect(completeEvt.total_stages).toBe(5);
    expect(typeof completeEvt.start_time).toBe('string');
    expect(typeof completeEvt.time_spent_sec).toBe('number');
  });

  test('Wrong answer on Phase 1 triggers feedback banner, telemetry.fail, and regenerates new variant', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    const beforeCond = await page.locator('#p1-condition').textContent();
    await page.locator('#p1-input').fill('ZZZ');
    await page.locator('#p1-submit-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    const fails = await page.evaluate(() => window.__sentTelemetry.filter(e => !e.success));
    expect(fails.length).toBe(1);
    expect(fails[0].stage).toBe(1);
    expect(fails[0].total_stages).toBe(5);

    await page.waitForTimeout(1450);
    await expect(page.locator('#feedback-box')).toBeHidden();
    await expect(page.locator('#phase1')).toBeVisible();
    expect(await page.locator('#p1-condition').textContent()).not.toBe(beforeCond);
  });
});
