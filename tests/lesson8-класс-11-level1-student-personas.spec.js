import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona, DifficultyBenchmarker } from './student-simulator.js';

const TASK_URL = '/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/11/level1';

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

async function solvePhase1UI(page, useDragOnFirst = false) {
  const standsData = await page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#p1-stands-row > div'));
    return cards.map((card, idx) => {
      const slot = card.querySelector('.p1-slot-btn');
      const slotIdx = slot ? Number(slot.dataset.slotIdx) : idx;
      const lines = Array.from(card.querySelectorAll('.border-top .bg-dark')).map((el) => el.textContent.trim());
      return { slotIdx, lines };
    });
  });

  for (const stand of standsData) {
    let matchedType = null;
    for (const candidate of ['NOT', 'AND', 'OR']) {
      const ok = stand.lines.every((line) => {
        const m1 = line.match(/^A\s*=\s*([01])\s*→\s*F\s*=\s*([01])$/);
        if (m1) return candidate === 'NOT' && evalGate('NOT', Number(m1[1]), 0) === Number(m1[2]);
        const m2 = line.match(/^A\s*=\s*([01]),\s*B\s*=\s*([01])\s*→\s*F\s*=\s*([01])$/);
        if (m2) return candidate !== 'NOT' && evalGate(candidate, Number(m2[1]), Number(m2[2])) === Number(m2[3]);
        return false;
      });
      if (ok) {
        matchedType = candidate;
        break;
      }
    }
    const tokenBtn = page.locator('#p1-palette .p1-token-btn', { hasText: GATE_LABEL_MAP[matchedType] });
    const slotBtn = page.locator(`#p1-stands-row .p1-slot-btn[data-slot-idx="${stand.slotIdx}"]`);
    if (useDragOnFirst && stand.slotIdx === 0) {
      await tokenBtn.dragTo(slotBtn);
    } else {
      await tokenBtn.click();
      await slotBtn.click();
    }
  }
  await page.locator('#p1-submit-btn').click();
}

async function solvePhase2UI(page) {
  const schema = await page.evaluate(() => {
    const svg = document.querySelector('#p2-circuit-wrap svg');
    const texts = Array.from(svg.querySelectorAll('text'));
    const circles = Array.from(svg.querySelectorAll('circle'));

    const hasSplitDot = circles.some((c) => Number(c.getAttribute('cx')) === 90 && Number(c.getAttribute('cy')) === 105);
    const aText = texts.find((t) => t.textContent.trim() === 'A');
    const aY = aText ? Number(aText.getAttribute('y')) : 47;
    const template = hasSplitDot ? 'splitB' : (aY > 55 ? 'notA' : 'notC');

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
      return {
        rowIdx,
        a: Number(txt.match(/A\s*=\s*([01])/)[1]),
        b: Number(txt.match(/B\s*=\s*([01])/)[1]),
        c: Number(txt.match(/C\s*=\s*([01])/)[1])
      };
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
    for (const [key, val] of [['uF1', f1], ['uF2', f2], ['uF', f]]) {
      const btn = page.locator(`.p2-probe-btn[data-row-idx="${r.rowIdx}"][data-probe-key="${key}"]`);
      const clicks = val === 0 ? 1 : 2;
      for (let i = 0; i < clicks; i++) await btn.click();
    }
  }
  await page.locator('#p2-submit-btn').click();
}

async function solvePhase3UI(page, useDragOnFirst = false) {
  const formula = (await page.locator('#p3-formula-display').textContent()).trim();
  const innerMatch = formula.match(/\(([A-D])\s*([∧∨])\s*([A-D])\)/);
  const notMatch = formula.match(/¬([A-D])/);
  const g1Prefix = innerMatch[2] === '∧' ? 'g_and' : 'g_or';
  const links = [
    { out: innerMatch[1], inp: `${g1Prefix}_in1` },
    { out: innerMatch[3], inp: `${g1Prefix}_in2` },
    { out: notMatch[1], inp: 'g_not_in1' },
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
  await page.locator('#p3-submit-btn').click();
}

test.describe('8th Grade Lesson 11 (Level 1) :: Student Personas', () => {
  test('Persona: NOVICE — places distractor on Phase 1, sees #feedback-box & regeneration, recovers and finishes', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await sim.cognitivePause(120);
    await page.locator('#p1-palette .p1-token-btn', { hasText: /И-НЕ|ИЛИ-НЕ/ }).first().click();
    await page.locator('#p1-stands-row .p1-slot-btn[data-slot-idx="0"]').click();
    await page.locator('#p1-palette .p1-token-btn').first().click();
    await page.locator('#p1-stands-row .p1-slot-btn[data-slot-idx="1"]').click();
    await page.locator('#p1-palette .p1-token-btn').first().click();
    await page.locator('#p1-stands-row .p1-slot-btn[data-slot-idx="2"]').click();
    await page.locator('#p1-submit-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');
    await page.waitForTimeout(1400);
    await expect(page.locator('#feedback-box')).toBeHidden();

    await solvePhase1UI(page);
    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
    await solvePhase2UI(page);
    await expect(page.locator('#phase3')).toBeVisible({ timeout: 5000 });
    await solvePhase3UI(page);

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('1');
    sim.assertCleanSession();
  });

  test('Persona: CARELESS — triggers reset buttons mid-way across all 3 phases and recovers cleanly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);

    await page.locator('#p1-palette .p1-token-btn').first().click();
    await page.locator('#p1-stands-row .p1-slot-btn[data-slot-idx="0"]').click();
    await page.locator('#p1-reset-btn').click();
    await expect(page.locator('#p1-counter')).toContainText('0 / 3');
    await solvePhase1UI(page);

    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
    await page.locator('#p2-probes-list .p2-probe-btn').first().click();
    await page.locator('#p2-reset-btn').click();
    await expect(page.locator('#p2-counter')).toContainText('0 / 6');
    await solvePhase2UI(page);

    await expect(page.locator('#phase3')).toBeVisible({ timeout: 5000 });
    await page.locator('#p3-board .p3-out-port[data-out-port="A"]').click();
    await page.locator('#p3-board .p3-in-port[data-in-port="g_and_in1"]').click();
    await page.locator('#p3-reset-btn').click();
    await expect(page.locator('#p3-counter')).toContainText('Выходной каскад: 0 / 2');
    await solvePhase3UI(page);

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid spam clicks across palette, slots, reset, and submit produce zero DOM freezes/errors', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    await sim.simulateSpamClick(page.locator('#p1-palette .p1-token-btn').first(), 4);
    await sim.simulateSpamClick(page.locator('#p1-stands-row .p1-slot-btn').first(), 4);
    await sim.simulateSpamClick(page.locator('#p1-reset-btn'), 4);
    await sim.simulateSpamClick(page.locator('#p1-submit-btn'), 3);

    await expect(page.locator('#phase1')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & DifficultyBenchmarker — flawless run, >=48px hitboxes & 8th-grade corridor', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    const benchmarker = new DifficultyBenchmarker({
      courseSlug: '8-класс',
      lessonId: 11,
      levelNumber: 1
    });

    await page.goto(TASK_URL);
    await benchmarker.auditHitboxes([
      page.locator('#p1-palette .p1-token-btn'),
      page.locator('#p1-stands-row .p1-slot-btn'),
      page.locator('#p1-reset-btn'),
      page.locator('#p1-submit-btn')
    ], 48);
    benchmarker.recordPhase(1, { title: 'Стендовая идентификация базовых вентилей ГОСТ (Slot & Snap)', depth: 2, memory: 2, search: 1, inversion: 0, stress: 0, scaffolding: 2 });
    await solvePhase1UI(page, true);

    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
    await benchmarker.auditHitboxes([
      page.locator('#p2-probes-list .p2-probe-btn'),
      page.locator('#p2-reset-btn'),
      page.locator('#p2-submit-btn')
    ], 48);
    benchmarker.recordPhase(2, { title: 'Трассировка щупов F₁, F₂, F на 2-каскадной схеме', depth: 3, memory: 2, search: 0, inversion: 0, stress: 0, scaffolding: 1 });
    await solvePhase2UI(page);

    await expect(page.locator('#phase3')).toBeVisible({ timeout: 5000 });
    await benchmarker.auditHitboxes([
      page.locator('#p3-board .p3-out-port'),
      page.locator('#p3-board .p3-in-port'),
      page.locator('#p3-reset-btn'),
      page.locator('#p3-submit-btn')
    ], 48);
    benchmarker.recordPhase(3, { title: 'Коммутация схемы по формуле (Wire Patching)', depth: 3, memory: 3, search: 1, inversion: 0, stress: 0, scaffolding: 2 });
    await solvePhase3UI(page, true);

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    benchmarker.assertGradeCorridor('8-класс');
    benchmarker.assertNoFakeDifficulty();
    benchmarker.renderReport('8th GRADE LESSON 11 (Level 1) :: HITBOX & COGNITIVE AUDIT');
    sim.assertCleanSession();
  });
});
