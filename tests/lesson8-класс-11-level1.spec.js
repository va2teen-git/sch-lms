import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TASK_URL = '/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/11/level1';

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

const GATE_LABEL_MAP = {
  NOT: 'Инвертор (НЕ)',
  AND: 'Конъюнктор (И)',
  OR: 'Дизъюнктор (ИЛИ)'
};

async function solvePhase1FromDOM(page, useDragOnFirst = false) {
  const standsData = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#p1-stands-row > div'));
    return cards.map((card, idx) => {
      const slot = card.querySelector('.p1-slot-btn');
      const slotIdx = slot ? Number(slot.dataset.slotIdx) : idx;
      const lines = Array.from(card.querySelectorAll('.border-top .bg-dark'))
        .map((el) => el.textContent.trim());
      return { slotIdx, lines };
    });
  });

  for (const stand of standsData) {
    let matchedType = null;
    for (const candidate of ['NOT', 'AND', 'OR']) {
      const allMatch = stand.lines.every((line) => {
        const m1 = line.match(/^A\s*=\s*([01])\s*→\s*F\s*=\s*([01])$/);
        if (m1) {
          return candidate === 'NOT' && evalGate('NOT', Number(m1[1]), 0) === Number(m1[2]);
        }
        const m2 = line.match(/^A\s*=\s*([01]),\s*B\s*=\s*([01])\s*→\s*F\s*=\s*([01])$/);
        if (m2) {
          return candidate !== 'NOT' && evalGate(candidate, Number(m2[1]), Number(m2[2])) === Number(m2[3]);
        }
        return false;
      });
      if (allMatch) {
        matchedType = candidate;
        break;
      }
    }
    expect(matchedType).toBeTruthy();

    const targetLabel = GATE_LABEL_MAP[matchedType];
    const tokenBtn = page.locator('#p1-palette .p1-token-btn', { hasText: targetLabel });
    const slotBtn = page.locator(`#p1-stands-row .p1-slot-btn[data-slot-idx="${stand.slotIdx}"]`);

    if (useDragOnFirst && stand.slotIdx === 0) {
      await tokenBtn.dragTo(slotBtn);
    } else {
      await tokenBtn.click();
      await slotBtn.click();
    }
  }

  await expect(page.locator('#p1-submit-btn')).toBeEnabled();
  await page.locator('#p1-submit-btn').click();
}

async function solvePhase2FromDOM(page) {
  const schema = await page.evaluate(() => {
    const svg = document.querySelector('#p2-circuit-wrap svg');
    const texts = Array.from(svg.querySelectorAll('text'));
    const circles = Array.from(svg.querySelectorAll('circle'));

    const hasSplitDot = circles.some((c) => Number(c.getAttribute('cx')) === 90 && Number(c.getAttribute('cy')) === 105);
    const aText = texts.find((t) => t.textContent.trim() === 'A');
    const aY = aText ? Number(aText.getAttribute('y')) : 47;
    const template = hasSplitDot ? 'splitB' : (aY > 55 ? 'notA' : 'notC');

    const readGate = (rx, centerX, circX) => {
      const symEl = texts.find((t) => Math.abs(Number(t.getAttribute('x')) - centerX) < 3 && Math.abs(Number(t.getAttribute('y')) - (rx === 140 ? (centerX < 180 ? (rx === 140 && Number(t.getAttribute('y')) < 100 ? 66 : 158) : 66) : 112)) < 8);
      const sym = symEl ? symEl.textContent.trim() : '&';
      const inv = circles.some((c) => Math.abs(Number(c.getAttribute('cx')) - circX) < 3);
      if (sym === '&') return inv ? 'NAND' : 'AND';
      return inv ? 'NOR' : 'OR';
    };

    const g1Text = texts.find((t) => Math.abs(Number(t.getAttribute('x')) - 173) < 3 && Number(t.getAttribute('y')) < 100);
    const g2Text = texts.find((t) => Math.abs(Number(t.getAttribute('x')) - 173) < 3 && Number(t.getAttribute('y')) > 100);
    const g3Text = texts.find((t) => Math.abs(Number(t.getAttribute('x')) - 373) < 3);

    const g1Inv = circles.some((c) => Math.abs(Number(c.getAttribute('cx')) - 212) < 3 && Number(c.getAttribute('cy')) < 100);
    const g2Inv = circles.some((c) => Math.abs(Number(c.getAttribute('cx')) - 212) < 3 && Number(c.getAttribute('cy')) > 100);
    const g3Inv = circles.some((c) => Math.abs(Number(c.getAttribute('cx')) - 412) < 3);

    const decode = (txt, inv) => {
      const s = txt ? txt.textContent.trim() : '&';
      return s === '&' ? (inv ? 'NAND' : 'AND') : (inv ? 'NOR' : 'OR');
    };

    const rows = Array.from(document.querySelectorAll('#p2-probes-list > div')).map((row, rowIdx) => {
      const txt = row.textContent;
      const a = Number(txt.match(/A\s*=\s*([01])/)[1]);
      const b = Number(txt.match(/B\s*=\s*([01])/)[1]);
      const c = Number(txt.match(/C\s*=\s*([01])/)[1]);
      return { rowIdx, a, b, c };
    });

    return {
      template,
      g1: template === 'notA' ? 'NOT' : decode(g1Text, g1Inv),
      g2: template === 'notC' ? 'NOT' : decode(g2Text, g2Inv),
      g3: decode(g3Text, g3Inv),
      rows
    };
  });

  for (const r of schema.rows) {
    let f1 = 0;
    let f2 = 0;
    if (schema.template === 'splitB') {
      f1 = evalGate(schema.g1, r.a, r.b);
      f2 = evalGate(schema.g2, r.b, r.c);
    } else if (schema.template === 'notC') {
      f1 = evalGate(schema.g1, r.a, r.b);
      f2 = evalGate('NOT', r.c, 0);
    } else {
      f1 = evalGate('NOT', r.a, 0);
      f2 = evalGate(schema.g2, r.b, r.c);
    }
    const f = evalGate(schema.g3, f1, f2);

    const targets = [
      { key: 'uF1', val: f1 },
      { key: 'uF2', val: f2 },
      { key: 'uF', val: f }
    ];
    for (const t of targets) {
      const btn = page.locator(`.p2-probe-btn[data-row-idx="${r.rowIdx}"][data-probe-key="${t.key}"]`);
      const clicks = t.val === 0 ? 1 : 2;
      for (let i = 0; i < clicks; i++) {
        await btn.click();
      }
    }
  }

  await expect(page.locator('#p2-submit-btn')).toBeEnabled();
  await page.locator('#p2-submit-btn').click();
}

async function solvePhase3FromDOM(page, useDragOnFirst = false) {
  const formula = (await page.locator('#p3-formula-display').textContent()).trim();
  const innerMatch = formula.match(/\(([A-D])\s*([∧∨])\s*([A-D])\)/);
  const notMatch = formula.match(/¬([A-D])/);
  expect(innerMatch).toBeTruthy();
  expect(notMatch).toBeTruthy();

  const x = innerMatch[1];
  const op1 = innerMatch[2] === '∧' ? 'AND' : 'OR';
  const y = innerMatch[3];
  const z = notMatch[1];
  const g1Prefix = op1 === 'AND' ? 'g_and' : 'g_or';

  const links = [
    { out: x, inp: `${g1Prefix}_in1` },
    { out: y, inp: `${g1Prefix}_in2` },
    { out: z, inp: 'g_not_in1' },
    { out: `${g1Prefix}_out`, inp: 'g_out_in1' },
    { out: 'g_not_out', inp: 'g_out_in2' }
  ];

  for (let i = 0; i < links.length; i++) {
    const outPort = page.locator(`#p3-board .p3-out-port[data-out-port="${links[i].out}"]`);
    const inPort = page.locator(`#p3-board .p3-in-port[data-in-port="${links[i].inp}"]`);
    if (useDragOnFirst && i === 0) {
      await outPort.dragTo(inPort);
    } else {
      await outPort.click();
      await inPort.click();
    }
  }

  await expect(page.locator('#p3-submit-btn')).toBeEnabled();
  await page.locator('#p3-submit-btn').click();
}

test.describe('8th Grade Lesson 11: Level 1 Logic Gates Manipulation Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/8-класс/11/level1.astro');

  test('Architectural contracts: TaskLayout 1, Zero Multiple Choice, Zero-Style/CDN, LMSTelemetry', async () => {
    expect(fs.existsSync(taskPath)).toBe(true);
    const code = fs.readFileSync(taskPath, 'utf-8');
    expect(code).toContain('import TaskLayout');
    expect(code).toMatch(/<TaskLayout[\s\S]*level=\{1\}/);
    expect(code).toContain('window.LMSTelemetry.create');
    expect(code).toContain('telemetry.advanceStage');
    expect(code).toContain('telemetry.fail');
    expect(code).toContain('telemetry.complete');
    expect(code).toContain('bindEventsOnce');
    expect(code).not.toMatch(/<style[\s>]/i);
    expect(code.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '')).not.toMatch(/https?:\/\//i);
    expect(code).not.toMatch(/<select|type=["']radio|prince_complete/i);
  });

  test('End-to-end completion across all 3 phases (Click + Drag&Drop) emits valid LMSTelemetry events', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await expect(page.locator('#phase1')).toBeVisible();
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await solvePhase1FromDOM(page, true);
    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });

    await solvePhase2FromDOM(page);
    await expect(page.locator('#phase3')).toBeVisible({ timeout: 5000 });

    await solvePhase3FromDOM(page, true);
    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    const events = await page.evaluate(() => window.__sentTelemetry);
    const completeEvt = events.find((e) => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.stage).toBe(3);
    expect(completeEvt.total_stages).toBe(3);
    expect(typeof completeEvt.start_time).toBe('string');
    expect(typeof completeEvt.time_spent_sec).toBe('number');

    const stage2Evt = events.find((e) => e.action_type === 'in_progress' && e.stage === 2);
    const stage3Evt = events.find((e) => e.action_type === 'in_progress' && e.stage === 3);
    expect(stage2Evt).toBeTruthy();
    expect(stage3Evt).toBeTruthy();
  });

  test('Wrong gate placement on Phase 1 triggers feedback banner, telemetry.fail, and regenerates variant', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    const readSignature = () => page.evaluate(() => {
      const stands = Array.from(document.querySelectorAll('#p1-stands-row > div')).map((c) => c.innerText.replace(/\s+/g, ' ').trim()).join('||');
      const palette = Array.from(document.querySelectorAll('#p1-palette .p1-token-btn')).map((b) => b.innerText.trim()).join(',');
      return `${stands}##${palette}`;
    });

    const initialSig = await readSignature();

    // Намеренно ставим дистрактор (И-НЕ или ИЛИ-НЕ) в первый слот
    const distractor = page.locator('#p1-palette .p1-token-btn', { hasText: /И-НЕ|ИЛИ-НЕ/ }).first();
    await distractor.click();
    await page.locator('#p1-stands-row .p1-slot-btn[data-slot-idx="0"]').click();

    await page.locator('#p1-palette .p1-token-btn').first().click();
    await page.locator('#p1-stands-row .p1-slot-btn[data-slot-idx="1"]').click();

    await page.locator('#p1-palette .p1-token-btn').first().click();
    await page.locator('#p1-stands-row .p1-slot-btn[data-slot-idx="2"]').click();

    await page.locator('#p1-submit-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    const failEvents = await page.evaluate(() => window.__sentTelemetry.filter((e) => !e.success));
    expect(failEvents.length).toBe(1);
    expect(failEvents[0].stage).toBe(1);
    expect(failEvents[0].total_stages).toBe(3);

    await page.waitForTimeout(1400);
    await expect(page.locator('#feedback-box')).toBeHidden();
    await expect(page.locator('#phase1')).toBeVisible();
    expect(await readSignature()).not.toBe(initialSig);
  });
});
