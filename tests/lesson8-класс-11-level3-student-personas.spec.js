import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona, DifficultyBenchmarker } from './student-simulator.js';

const TASK_URL = '/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/11/level3';

async function readVisibleCircuitState(page) {
  return page.evaluate(() => {
    const inputs = {};
    document.querySelectorAll('#circuit-svg [data-input-pin]').forEach((el) => {
      const id = el.getAttribute('data-input-pin');
      const ticks = (el.getAttribute('data-ticks') || '').split(',').map(Number);
      inputs[id] = ticks;
    });

    const fixedInverters = {};
    document.querySelectorAll('#circuit-svg [data-fix-inverter="true"]').forEach((el) => {
      const src = el.getAttribute('data-source');
      const ticks = (el.getAttribute('data-ticks') || '').split(',').map(Number);
      fixedInverters[`FIX_${src}`] = ticks;
    });

    const gates = Array.from(document.querySelectorAll('#circuit-svg [data-gate-id]')).map((el) => ({
      id: parseInt(el.getAttribute('data-gate-id'), 10),
      arity: parseInt(el.getAttribute('data-arity'), 10),
      base: el.getAttribute('data-base'),
      inv: el.getAttribute('data-inv') === '1',
      op: el.getAttribute('data-op'),
      inputs: (el.getAttribute('data-inputs') || '').split(',').filter(Boolean),
      isCursor: el.getAttribute('data-cursor') === 'true'
    })).sort((a, b) => a.id - b.id);

    const sensorsByGate = {};
    document.querySelectorAll('#circuit-svg [data-sensor-id]').forEach((el) => {
      const sg = parseInt(el.getAttribute('data-source-gate'), 10);
      const target = (el.getAttribute('data-target') || '').split(',').map(Number);
      sensorsByGate[sg] = target;
    });

    const cursorGate = gates.find((g) => g.isCursor);
    const waveBadge = document.querySelector('#wave-badge')?.textContent?.trim() || '';
    const modeTag = document.querySelector('#playing-screen .badge.bg-warning')?.textContent?.trim() || '';

    return {
      waveBadge,
      modeTag,
      inputs,
      fixedInverters,
      gates,
      sensorsByGate,
      cursorGateId: cursorGate ? cursorGate.id : 1
    };
  });
}

function evalGateTicks(arity, base, inv, in1, in2) {
  if (arity === 1) {
    return inv ? [1 - in1[0], 1 - in1[1]] : [in1[0], in1[1]];
  }
  const raw = base === 'AND'
    ? [in1[0] & in2[0], in1[1] & in2[1]]
    : [in1[0] | in2[0], in1[1] | in2[1]];
  return inv ? [1 - raw[0], 1 - raw[1]] : raw;
}

function solveCircuitTargetsFromVisibleDOM(state) {
  const signalMap = { ...state.inputs, ...state.fixedInverters };
  const preferInv = state.modeTag.includes('ИНВЕРСНЫЙ БАЗИС');
  const desired = {};

  for (const g of state.gates) {
    const target = state.sensorsByGate[g.id];
    const in1 = signalMap[g.inputs[0]];
    const in2 = g.arity === 2 ? signalMap[g.inputs[1]] : null;

    let candidates;
    if (g.arity === 1) {
      candidates = [
        { base: 'BUF', inv: false },
        { base: 'BUF', inv: true }
      ];
    } else {
      candidates = preferInv
        ? [
            { base: 'AND', inv: true },
            { base: 'OR', inv: true },
            { base: 'AND', inv: false },
            { base: 'OR', inv: false }
          ]
        : [
            { base: 'AND', inv: false },
            { base: 'OR', inv: false },
            { base: 'AND', inv: true },
            { base: 'OR', inv: true }
          ];
    }

    const match = candidates.find((c) => {
      const out = evalGateTicks(g.arity, c.base, c.inv, in1, in2);
      return out[0] === target[0] && out[1] === target[1];
    });

    if (!match) {
      throw new Error(`No gate configuration found for G${g.id} with inputs ${JSON.stringify([in1, in2])} -> ${JSON.stringify(target)}`);
    }

    desired[g.id] = match;
    // Целевое значение датчика G_i одновременно служит входом для следующих каскадов
    signalMap[`G${g.id}`] = target;
  }

  return desired;
}

test.describe('8th Grade Lesson 11 (Level 3) :: Keyboard-Only & Strict Black-Box Personas', () => {
  test('Keyboard-Only policy: mouse clicks in arena are blocked (pointer-events: none) and RU/EN e.code works without page scroll', async ({ page }) => {
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-badge')).toContainText('Волна 1 / 10');

    const pointerEvents = await page.evaluate(() => getComputedStyle(document.querySelector('#arcade-field')).pointerEvents);
    expect(pointerEvents).toBe('none');

    const before = await readVisibleCircuitState(page);
    await page.locator('[data-gate-id="2"]').click({ force: true });
    await page.locator('#circuit-svg').click({ force: true });
    const afterClick = await readVisibleCircuitState(page);
    expect(afterClick.cursorGateId).toBe(before.cursorGateId);
    expect(afterClick.gates.map(g => g.op)).toEqual(before.gates.map(g => g.op));

    // Проверка RU-раскладки: физические коды KeyD (вправо), KeyW (ядро), ShiftLeft (инверсия)
    const gate2Before = before.gates.find(g => g.id === 2);
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'в', code: 'KeyD', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ц', code: 'KeyW', bubbles: true }));
    });
    await page.keyboard.press('ShiftLeft');

    const afterRu = await readVisibleCircuitState(page);
    expect(afterRu.cursorGateId).toBe(2);
    const gate2After = afterRu.gates.find(g => g.id === 2);
    expect(gate2After.base).not.toBe(gate2Before.base);
    expect(gate2After.inv).toBe(!gate2Before.inv);

    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  });

  test('Persona: NOVICE — sends faulty pulse via Space on Wave 1, observes #alarm-box & reset to Wave 1', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);
    await page.keyboard.press('Space');
    await expect(page.locator('#wave-badge')).toContainText('Волна 1 / 10');

    await sim.cognitivePause(150);
    // В Волне 1 исходные вентили намеренно неверные — новичок жмет Space сразу
    await page.keyboard.press('Space');

    await expect(page.locator('#alarm-box')).toBeVisible();
    await expect(page.locator('#alarm-count')).toHaveText('1');
    await page.waitForTimeout(1700);
    await expect(page.locator('#alarm-box')).toBeHidden();
    await expect(page.locator('#wave-badge')).toContainText('Волна 1 / 10');
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — spams unmapped keys (Q/E/R/Z/Enter/Backspace) and arena clicks without side effects or errors', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);
    await page.keyboard.press('Space');
    await expect(page.locator('#wave-badge')).toContainText('Волна 1 / 10');

    const before = await readVisibleCircuitState(page);
    const scrollBefore = await page.evaluate(() => window.scrollY);

    await sim.simulateSpamClick(page.locator('#circuit-svg'), 4);
    for (const k of ['KeyQ', 'KeyE', 'KeyR', 'KeyZ', 'Enter', 'Backspace', 'Escape']) {
      await page.keyboard.press(k);
    }

    const after = await readVisibleCircuitState(page);
    expect(after.cursorGateId).toBe(before.cursorGateId);
    expect(after.gates.map(g => g.op)).toEqual(before.gates.map(g => g.op));
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT (Strict Black-Box) — completes all 10 waves via keyboard only without __DEV_LEVEL3_STATE__', async ({ page }) => {
    test.setTimeout(60000);
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    const benchmarker = new DifficultyBenchmarker({
      courseSlug: '8-класс',
      lessonId: 11,
      levelNumber: 3
    });

    await page.goto(TASK_URL);
    await expect(page.locator('#start-btn')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.locator('#wave-badge')).toContainText('Волна 1 / 10');

    const scrollBefore = await page.evaluate(() => window.scrollY);

    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('#wave-badge')).toContainText(`Волна ${w} / 10`, { timeout: 5000 });

      benchmarker.recordPhase(w, {
        title: `Волна ${w} логической схемы`,
        depth: w >= 9 || w === 7 ? 3 : w === 1 ? 1 : 2,
        memory: (w === 5 || w === 6) ? 3 : 2,
        inversion: (w === 2 || w === 4 || w === 6 || w === 8) ? 1 : 0,
        stress: (w === 7 || w >= 9) ? 2 : 1,
        scaffolding: w === 2 ? 2 : 1
      });

      const state = await readVisibleCircuitState(page);
      const desired = solveCircuitTargetsFromVisibleDOM(state);
      let curGateId = state.cursorGateId;
      const totalGates = state.gates.length;

      for (let i = 0; i < totalGates; i++) {
        const g = state.gates[i];
        const want = desired[g.id];
        const needsBaseChange = g.arity === 2 && g.base !== want.base;
        const needsInvChange = g.arity === 1
          ? (g.inv !== want.inv)
          : (g.inv !== want.inv);

        if (!needsBaseChange && !needsInvChange) continue;

        // Чередуем прямую адресацию Digit1..6 и курсорную навигацию ArrowRight/KeyD/KeyA
        if (w % 2 === 1) {
          if (curGateId !== g.id) {
            await page.keyboard.press(`Digit${g.id}`);
            curGateId = g.id;
          }
        } else {
          while (curGateId !== g.id) {
            await page.keyboard.press(curGateId < g.id ? 'ArrowRight' : 'ArrowLeft');
            curGateId = curGateId < g.id
              ? (curGateId % totalGates) + 1
              : ((curGateId - 2 + totalGates) % totalGates) + 1;
          }
        }

        if (g.arity === 1) {
          if (g.inv !== want.inv) {
            await page.keyboard.press(w % 2 === 1 ? 'ShiftLeft' : 'KeyW');
          }
        } else {
          if (needsBaseChange) {
            await page.keyboard.press(w % 2 === 1 ? 'KeyW' : 'ArrowDown');
          }
          if (needsInvChange) {
            await page.keyboard.press(w % 2 === 1 ? 'ShiftLeft' : 'ShiftRight');
          }
        }
      }

      await page.keyboard.press('Space');
      if (w < 10) {
        await expect(page.locator('#wave-badge')).toContainText(`Волна ${w + 1} / 10`, { timeout: 4000 });
      }
    }

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

    benchmarker.assertGradeCorridor('8-класс');
    benchmarker.assertNoFakeDifficulty();
    benchmarker.renderReport('8th GRADE LESSON 11 (Level 3) :: KEYBOARD-ONLY BLACK-BOX AUDIT');
    sim.assertCleanSession();
  });
});
