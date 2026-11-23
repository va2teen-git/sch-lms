import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona, DifficultyBenchmarker } from './student-simulator.js';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/34/level1';

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
  return `mix:${intVal}:${Math.round(fracVal * 16)}`;
}

async function solvePhase1UI(page, sim = null, useDragOnFirst = false) {
  const { digits, width, base } = await page.evaluate(() => {
    const el = document.querySelector('#p1-number-display');
    const baseNum = parseInt(el.querySelector('sub').textContent.trim(), 10);
    return {
      digits: el.firstChild.textContent.trim().split(''),
      width: baseNum === 16 ? 4 : 3,
      base: baseNum
    };
  });

  for (let i = 0; i < digits.length; i++) {
    const expectedBits = parseInt(digits[i], base).toString(2).padStart(width, '0');
    const tokenBtn = page.locator('#p1-token-pool button[data-token-id]', { hasText: `${expectedBits}₂` }).first();
    const slotBtn = page.locator(`#p1-slots-container button[data-slot-id="slot-${i}"]`);
    if (sim && useDragOnFirst && i === 0) {
      await sim.humanDragAndDrop(tokenBtn, slotBtn);
      // Fallback click if browser HTML5 drag event did not populate the slot
      const slotText = await slotBtn.innerText();
      if (!slotText.includes(expectedBits)) {
        await tokenBtn.click();
        await slotBtn.click();
      }
    } else {
      await tokenBtn.click();
      await slotBtn.click();
    }
  }
  await page.locator('#p1-submit-btn').click();
}

async function solvePhase2UI(page) {
  const portsData = await page.evaluate(() => {
    const parsePort = (btn, attr) => {
      const id = btn.getAttribute(attr);
      const base = parseInt(btn.querySelector('sub').textContent.trim(), 10);
      const fullText = btn.innerText.replace(/[●○]/g, '').trim();
      const rawVal = fullText.slice(0, fullText.length - String(base).length).trim();
      return { id, rawVal, base };
    };
    return {
      lefts: Array.from(document.querySelectorAll('#p2-left-ports button[data-left-id]')).map(b => parsePort(b, 'data-left-id')),
      rights: Array.from(document.querySelectorAll('#p2-right-ports button[data-right-id]')).map(b => parsePort(b, 'data-right-id'))
    };
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
    await page.locator(`#p2-left-ports button[data-left-id="${left.id}"]`).click();
    await page.locator(`#p2-right-ports button[data-right-id="${matchRight.id}"]`).click();
  }
  await page.locator('#p2-submit-btn').click();
}

async function solvePhase3UI(page) {
  const targetBits = await page.evaluate(() => {
    const html = document.querySelector('#p3-task-spec code').innerHTML;
    const m = html.match(/([0-7]+)<sub>8<\/sub>\s*(AND \(&amp;\)|OR \(\|\)|XOR \(\^\))\s*([0-9A-F]+)<sub>16<\/sub>/i);
    const a = parseInt(m[1], 8);
    const op = m[2];
    const mask = parseInt(m[3], 16);
    const res = op.startsWith('AND') ? ((a & mask) & 0xFF) : (op.startsWith('OR') ? ((a | mask) & 0xFF) : ((a ^ mask) & 0xFF));
    return res.toString(2).padStart(8, '0');
  });

  for (let i = 0; i < 8; i++) {
    if (targetBits[i] === '1') {
      await page.locator(`#p3-tape-container button[data-bit-index="${i}"]`).click();
    }
  }
  await page.locator('#p3-submit-btn').click();
}

test.describe('Digital Student Personas :: Lesson 34 Level 1', () => {
  test('Persona: NOVICE — falls into distractor trap on Phase 1, observes feedback, recovers cleanly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        const wrongId = await page.evaluate(() => {
          const el = document.querySelector('#p1-number-display');
          const base = parseInt(el.querySelector('sub').textContent.trim(), 10);
          const width = base === 16 ? 4 : 3;
          const expected = parseInt(el.firstChild.textContent.trim()[0], base).toString(2).padStart(width, '0') + '₂';
          const btns = Array.from(document.querySelectorAll('#p1-token-pool button[data-token-id]'));
          return btns.find(b => b.textContent.trim() !== expected).getAttribute('data-token-id');
        });
        await page.locator(`#p1-token-pool button[data-token-id="${wrongId}"]`).click();
        await page.locator('#p1-slots-container button[data-slot-id="slot-0"]').click();
        await page.locator('#p1-token-pool button[data-token-id]').first().click();
        await page.locator('#p1-slots-container button[data-slot-id="slot-1"]').click();
        await page.locator('#p1-token-pool button[data-token-id]').first().click();
        await page.locator('#p1-slots-container button[data-slot-id="slot-2"]').click();
        await page.locator('#p1-submit-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#feedback-box')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
      },
      solveCorrectlyFn: async () => {
        await page.waitForTimeout(1550);
        await expect(page.locator('#feedback-box')).toBeHidden();
        await solvePhase1UI(page);
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CARELESS — resets slots/wires/tape mid-way and recovers to finish cleanly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);

    // Phase 1: assign 1 token, then reset slots
    await page.locator('#p1-token-pool button[data-token-id]').first().click();
    await page.locator('#p1-slots-container button[data-slot-id="slot-0"]').click();
    await page.locator('#p1-reset-btn').click();
    await expect(page.locator('#p1-submit-btn')).toBeDisabled();
    await solvePhase1UI(page);

    // Phase 2: link 1 wire, reset wires, then solve
    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
    await page.locator('#p2-left-ports button[data-left-id="L0"]').click();
    await page.locator('#p2-right-ports button[data-right-id]').first().click();
    await page.locator('#p2-reset-btn').click();
    await expect(page.locator('#p2-link-counter')).toContainText('0 / 3');
    await solvePhase2UI(page);

    // Phase 3: toggle a bit, clear tape, then solve
    await expect(page.locator('#phase3')).toBeVisible({ timeout: 5000 });
    await page.locator('#p3-tape-container button[data-bit-index="0"]').click();
    await page.locator('#p3-clear-tape-btn').click();
    await expect(page.locator('#p3-preview-text')).toContainText('0000 0000');
    await solvePhase3UI(page);

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid spam clicks across pool, slots, reset, and submit produce zero crashes', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    await sim.simulateSpamClick(page.locator('#p1-token-pool button').first(), 4);
    await sim.simulateSpamClick(page.locator('#p1-slots-container button').first(), 4);
    await sim.simulateSpamClick(page.locator('#p1-reset-btn'), 4);
    await sim.simulateSpamClick(page.locator('#p1-submit-btn'), 4);

    await expect(page.locator('#phase1')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & DifficultyBenchmarker — flawless run, >=48px hitboxes & Grade Corridor compliance', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    const benchmarker = new DifficultyBenchmarker({
      courseSlug: '10-класс_углубленный',
      lessonId: 34,
      levelNumber: 1
    });

    await page.goto(TASK_URL);
    await benchmarker.auditHitboxes([
      page.locator('#p1-token-pool button'),
      page.locator('#p1-slots-container button'),
      page.locator('#p1-reset-btn'),
      page.locator('#p1-submit-btn')
    ], 48);
    benchmarker.recordPhase(1, { title: 'Slot & Snap триад и тетрад', depth: 1, memory: 2, search: 1, inversion: 0, stress: 0, scaffolding: 1 });
    await solvePhase1UI(page, sim, true);

    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
    await benchmarker.auditHitboxes([
      page.locator('#p2-left-ports button'),
      page.locator('#p2-right-ports button'),
      page.locator('#p2-reset-btn'),
      page.locator('#p2-submit-btn')
    ], 48);
    benchmarker.recordPhase(2, { title: 'Коммутация двоичного моста 2/8/16 и дробь', depth: 2, memory: 2, search: 2, inversion: 0, stress: 0, scaffolding: 1 });
    await solvePhase2UI(page);

    await expect(page.locator('#phase3')).toBeVisible({ timeout: 5000 });
    await benchmarker.auditHitboxes([
      page.locator('#p3-tape-container button'),
      page.locator('#p3-clear-tape-btn'),
      page.locator('#p3-submit-btn')
    ], 48);
    benchmarker.recordPhase(3, { title: '8-битный регистр и битовая маска AND/OR/XOR', depth: 3, memory: 3, search: 0, inversion: 1, stress: 0, scaffolding: 1 });
    await solvePhase3UI(page);

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    benchmarker.assertGradeCorridor('10-класс_углубленный');
    benchmarker.assertNoFakeDifficulty();
    benchmarker.renderReport('LESSON 34 (Level 1) :: HITBOX & COGNITIVE AUDIT');
    sim.assertCleanSession();
  });
});
