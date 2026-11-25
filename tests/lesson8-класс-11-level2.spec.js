import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TASK_URL = '/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/11/level2';

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

function evalGate(type, a, b) {
  if (type === 'NOT') return a ^ 1;
  if (type === 'AND') return a & b;
  if (type === 'OR') return a | b;
  if (type === 'NAND') return (a & b) ^ 1;
  if (type === 'NOR') return (a | b) ^ 1;
  return 0;
}

async function solvePhaseAnswerFromDOM(page, phase) {
  return await page.evaluate((p) => {
    const gateEval = (type, a, b) => {
      if (type === 'NOT') return a ^ 1;
      if (type === 'AND') return a & b;
      if (type === 'OR') return a | b;
      if (type === 'NAND') return (a & b) ^ 1;
      if (type === 'NOR') return (a | b) ^ 1;
      return 0;
    };

    const findRect = (svg, x, y) => Array.from(svg.querySelectorAll('rect'))
      .find((r) => Math.abs(Number(r.getAttribute('x')) - x) < 2 && Math.abs(Number(r.getAttribute('y')) - y) < 2);

    const readOp = (svg, rectX, rectY, width) => {
      const rect = findRect(svg, rectX, rectY);
      if (!rect) return null;
      const cx = rectX + width / 2;
      const cy = rectY + Number(rect.getAttribute('height')) / 2;
      const texts = Array.from(svg.querySelectorAll('text'));
      const lbl = texts.find((t) => Math.abs(Number(t.getAttribute('x')) - cx) < 3 && Number(t.getAttribute('y')) >= rectY && Number(t.getAttribute('y')) <= rectY + Number(rect.getAttribute('height')));
      const sym = lbl ? lbl.textContent.trim() : '&';
      const circX = rectX + width + 5.5;
      const circles = Array.from(svg.querySelectorAll('circle'));
      const inv = circles.some((c) => Math.abs(Number(c.getAttribute('cx')) - circX) < 3 && Math.abs(Number(c.getAttribute('cy')) - cy) < 3);
      if (sym === '&') return inv ? 'NAND' : 'AND';
      return inv ? 'NOR' : 'OR';
    };

    if (p === 1) {
      const svg = document.querySelector('#p1-svg-wrap svg');
      const invA = Boolean(findRect(svg, 100, 35));
      const invB = Boolean(findRect(svg, 100, 115));
      const invOut = Boolean(findRect(svg, 368, 75));
      const op = readOp(svg, 240, 62, 66);
      let bits = '';
      for (let a = 0; a <= 1; a++) {
        for (let b = 0; b <= 1; b++) {
          const va = invA ? (a ^ 1) : a;
          const vb = invB ? (b ^ 1) : b;
          let r = gateEval(op, va, vb);
          if (invOut) r = r ^ 1;
          bits += String(r);
        }
      }
      return bits;
    }

    if (p === 2) {
      const svg = document.querySelector('#p2-svg-wrap svg');
      const invA = Boolean(findRect(svg, 88, 19));
      const invB = Boolean(findRect(svg, 88, 75));
      const invC = Boolean(findRect(svg, 145, 143));
      const g1 = readOp(svg, 195, 32, 64);
      const g2 = readOp(svg, 345, 78, 64);
      let k = 0;
      for (let a = 0; a <= 1; a++) {
        for (let b = 0; b <= 1; b++) {
          for (let c = 0; c <= 1; c++) {
            const va = invA ? (a ^ 1) : a;
            const vb = invB ? (b ^ 1) : b;
            const vc = invC ? (c ^ 1) : c;
            if (gateEval(g2, gateEval(g1, va, vb), vc) === 1) k++;
          }
        }
      }
      return String((k / 8) * 100);
    }

    if (p === 3) {
      const svg = document.querySelector('#p3-svg-wrap svg');
      const invA = Boolean(findRect(svg, 84, 19));
      const invB = Boolean(findRect(svg, 84, 75));
      const invC = Boolean(findRect(svg, 140, 145));
      const invOut = Boolean(findRect(svg, 426, 91));
      const op = readOp(svg, 188, 32, 60);
      const targetF = document.getElementById('p3-target-badge').textContent.includes('1') ? 1 : 0;
      for (let a = 0; a <= 1; a++) {
        for (let b = 0; b <= 1; b++) {
          for (let c = 0; c <= 1; c++) {
            const va = invA ? (a ^ 1) : a;
            const vb = invB ? (b ^ 1) : b;
            const vc = invC ? (c ^ 1) : c;
            let res = gateEval(op, gateEval(op, va, vb), vc);
            if (invOut) res = res ^ 1;
            if (res === targetF) return `${a}${b}${c}`;
          }
        }
      }
      throw new Error('No unique solution found for Phase 3');
    }

    if (p === 4) {
      const cond = document.getElementById('p4-condition');
      const text = cond.textContent.replace(/\s+/g, ' ').trim();
      if (text.includes('триггеров') && text.includes('байт')) {
        const m = text.match(/(\d+)\s*байт/);
        return String(Number(m[1]) * 8);
      }
      if (text.includes('таблице истинности')) {
        const m = text.match(/ровно\s*(\d+)\s*независимых/);
        return String(Math.pow(2, Number(m[1])));
      }
      if (text.includes('транзисторов')) {
        const m = text.match(/из\s*(\d+)\s*элементов\s*И-НЕ\s*и\s*(\d+)\s*инверторов/);
        return String(Number(m[1]) * 4 + Number(m[2]) * 2);
      }
      throw new Error('Unknown Phase 4 condition: ' + text);
    }

    if (p === 5) {
      const svg = document.querySelector('#p5-svg-wrap svg');
      const g1 = readOp(svg, 145, 26, 66);
      const g2 = readOp(svg, 145, 118, 66);
      const g3 = readOp(svg, 342, 72, 66);
      const boxes = Array.from(document.querySelectorAll('#p5-packets-wrap .col-6'));
      let dec = 0;
      boxes.forEach((box, idx) => {
        const m = box.textContent.match(/A=([01]),\s*B=([01]),\s*C=([01])/);
        const a = Number(m[1]);
        const b = Number(m[2]);
        const c = Number(m[3]);
        const bit = gateEval(g3, gateEval(g1, a, b), gateEval(g2, b, c));
        dec = (dec << 1) | bit;
      });
      return String(dec);
    }

    throw new Error('Unknown phase ' + p);
  }, phase);
}

test.describe('8th Grade Lesson 11: Level 2 Analytical Input Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/8-класс/11/level2.astro');

  test('Architectural contracts: TaskLayout 2, 5x inputmode="decimal", no <input type="number">, Zero-Style/CDN', async () => {
    expect(fs.existsSync(taskPath)).toBe(true);
    const code = fs.readFileSync(taskPath, 'utf-8');
    expect(code).toContain('import TaskLayout');
    expect(code).toMatch(/<TaskLayout[\s\S]*level=\{2\}/);
    expect(code.match(/inputmode="decimal"/g)?.length).toBe(5);
    expect(code).toContain('window.LMSTelemetry.create');
    expect(code).not.toMatch(/type=["']number["']/i);
    expect(code).not.toMatch(/<style[\s>]/i);
    expect(code.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')).not.toMatch(/https?:\/\//i);
    expect(code).not.toMatch(/<select|type=["']radio|prince_complete/i);
  });

  test('End-to-end completion of all 5 Sawtooth phases with Russian comma & % normalization and telemetry', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    for (let p = 1; p <= 5; p++) {
      await expect(page.locator(`#phase${p}`)).toBeVisible({ timeout: 5000 });
      const ans = await solvePhaseAnswerFromDOM(page, p);
      let dirty = `  ${ans}  `;
      if (p === 2) {
        dirty = `  ${ans.replace('.', ',')}%  `;
      }
      await page.locator(`#p${p}-input`).fill(dirty);
      await page.locator(`#p${p}-submit-btn`).click();
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    const events = await page.evaluate(() => window.__sentTelemetry);
    const completeEvt = events.find((e) => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.stage).toBe(5);
    expect(completeEvt.total_stages).toBe(5);
    expect(typeof completeEvt.start_time).toBe('string');
    expect(typeof completeEvt.time_spent_sec).toBe('number');
  });

  test('Wrong answer on Phase 1 triggers feedback banner, telemetry.fail, and regenerates variant', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await page.locator('#p1-input').fill('9999');
    await page.locator('#p1-submit-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    const fails = await page.evaluate(() => window.__sentTelemetry.filter((e) => !e.success));
    expect(fails.length).toBe(1);
    expect(fails[0].stage).toBe(1);
    expect(fails[0].total_stages).toBe(5);

    await page.waitForTimeout(1400);
    await expect(page.locator('#feedback-box')).toBeHidden();
    await expect(page.locator('#phase1')).toBeVisible();
    expect(await page.locator('#p1-input').inputValue()).toBe('');
  });
});
