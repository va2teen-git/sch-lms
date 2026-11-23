import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';
import { DifficultyBenchmarker } from './difficulty-benchmarker.js';

const TASK_URL = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/36/level3';

async function readVisibleArenaState(page) {
  return page.evaluate(() => {
    const arena = document.querySelector('#vue-app [style*="pointer-events"]');
    const pointerEvents = arena ? window.getComputedStyle(arena).pointerEvents : '';

    // 1. Find active token under ▼ HEAD
    let activeToken = null;
    let headPosText = '';
    const badges = Array.from(document.querySelectorAll('#vue-app *'));
    for (const el of badges) {
      if (el.children.length === 0 && el.textContent.trim() === '▼ HEAD') {
        const box = el.closest('.rounded-0.border');
        if (box) {
          const valEl = box.querySelector('.fs-5');
          if (valEl) activeToken = valEl.textContent.trim();
        }
        break;
      }
    }

    // 2. Read stack slots 1..6 from visible DOM
    const slotValues = {};
    const slotRows = Array.from(document.querySelectorAll('#vue-app .card-body, #vue-app .card'));
    for (const el of document.querySelectorAll('#vue-app span')) {
      const t = el.textContent.trim();
      const m = t.match(/^SLOT\s+([1-6])$/);
      if (m) {
        const n = Number(m[1]);
        const row = el.closest('.d-flex.justify-content-between.align-items-center.px-3');
        if (row) {
          const valSpan = row.querySelector('span.fs-5.fw-bold.text-light');
          slotValues[n] = valSpan ? Number(valSpan.textContent.trim()) : null;
        }
      }
    }
    const stack = [];
    for (let i = 1; i <= 6; i++) {
      if (slotValues[i] !== null && slotValues[i] !== undefined && !Number.isNaN(slotValues[i])) {
        stack.push(slotValues[i]);
      } else {
        break;
      }
    }

    // 3. Read active station cursor from DOM ("Курсор: PUSH/EVAL/SWAP/DEFUSE")
    let cursorStation = '';
    for (const badge of document.querySelectorAll('#vue-app .badge')) {
      const txt = badge.textContent.trim();
      if (txt.startsWith('Курсор:')) {
        cursorStation = txt.replace('Курсор:', '').trim();
        break;
      }
    }

    // 4. Read ACC register value from DOM
    const accEl = document.querySelector('#vue-app .display-6.fw-bold.text-warning');
    const accText = accEl ? accEl.textContent.trim() : '+00';

    const waveBadge = document.getElementById('wave-counter-badge');
    const waveText = waveBadge ? waveBadge.textContent.trim() : '';

    return { pointerEvents, activeToken, stack, cursorStation, accText, waveText, headPosText };
  });
}

function decideNextActionBlackBox(activeToken, stack) {
  if (!activeToken) return null;

  if (activeToken === 'END') {
    return stack.length === 1 ? { action: 'DONE' } : { action: 'DEFUSE' };
  }

  if (/^-?\d+$/.test(activeToken)) {
    return stack.length >= 6 ? { action: 'DEFUSE' } : { action: 'PUSH' };
  }

  if (activeToken === 'SWAP') {
    return stack.length < 2 ? { action: 'DEFUSE' } : { action: 'SWAP' };
  }

  if (activeToken === 'u-') {
    if (stack.length < 1) return { action: 'DEFUSE' };
    return { action: 'EVAL', acc: -stack[stack.length - 1] };
  }

  if (stack.length < 2) {
    return { action: 'DEFUSE' };
  }

  const b = stack[stack.length - 1];
  const a = stack[stack.length - 2];

  if ((activeToken === '//' || activeToken === '%') && b === 0) {
    return { action: 'DEFUSE' };
  }

  let acc = 0;
  if (activeToken === '+') acc = a + b;
  else if (activeToken === '-') acc = a - b;
  else if (activeToken === '*') acc = a * b;
  else if (activeToken === '//') acc = Math.floor(a / b);
  else if (activeToken === '%') acc = ((a % b) + b) % b;
  else if (activeToken === '^') acc = Math.pow(a, b);
  else throw new Error(`Unknown RPN token in DOM: ${activeToken}`);

  return { action: 'EVAL', acc };
}

async function moveStationByKeyboard(page, targetStation) {
  const order = ['PUSH', 'EVAL', 'SWAP', 'DEFUSE'];
  const state = await readVisibleArenaState(page);
  const curIdx = order.indexOf(state.cursorStation);
  const dstIdx = order.indexOf(targetStation);
  if (curIdx === -1 || dstIdx === -1) {
    throw new Error(`Station cursor not found: cur="${state.cursorStation}", dst="${targetStation}"`);
  }
  if (curIdx === dstIdx) return;

  const rightDist = (dstIdx - curIdx + 4) % 4;
  const leftDist = (curIdx - dstIdx + 4) % 4;
  if (rightDist <= leftDist) {
    for (let i = 0; i < rightDist; i++) {
      await page.keyboard.press(i % 2 === 0 ? 'KeyD' : 'ArrowRight');
    }
  } else {
    for (let i = 0; i < leftDist; i++) {
      await page.keyboard.press(i % 2 === 0 ? 'KeyA' : 'ArrowLeft');
    }
  }
}

async function enterAccByKeyboard(page, targetAcc, exerciseAdjustKeys) {
  const absStr = String(Math.abs(targetAcc)).padStart(2, '0');
  await page.keyboard.press(`Digit${absStr[0]}`);
  await page.keyboard.press(`Digit${absStr[1]}`);

  if (exerciseAdjustKeys && Math.abs(targetAcc) < 98) {
    await page.keyboard.press('KeyW');
    await page.keyboard.press('KeyS');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowDown');
  }

  const afterDigits = await readVisibleArenaState(page);
  const isNegShown = afterDigits.accText.startsWith('-');
  if ((targetAcc < 0 && !isNegShown) || (targetAcc >= 0 && isNegShown)) {
    await page.keyboard.press('ShiftLeft');
  }
}

test.describe('Digital Student Personas (Black-Box Keyboard-Only) :: Lesson 36 Level 3', () => {

  test('Keyboard-Only policy: mouse clicks in playing arena are blocked (pointer-events: none)', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    const before = await readVisibleArenaState(page);
    expect(before.pointerEvents).toBe('none');

    // Attempt forced mouse clicks on PUSH / DEFUSE station cards inside arena
    await page.locator('#vue-app').getByText('DEFUSE', { exact: true }).first().click({ force: true });
    await page.locator('#vue-app').getByText('EVAL', { exact: true }).first().click({ force: true });

    const after = await readVisibleArenaState(page);
    expect(after.cursorStation).toBe(before.cursorStation);
    expect(after.stack).toEqual(before.stack);
    expect(after.activeToken).toBe(before.activeToken);
    sim.assertCleanSession();
  });

  test('Persona: NOVICE — presses wrong station via keyboard on Wave 1, sees #alarm-box & #alarm-count, resets cleanly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    // Token 0 on Wave 1 is a number -> needs PUSH, so moving to DEFUSE and pressing Space triggers hardcore alarm
    await moveStationByKeyboard(page, 'DEFUSE');
    await page.keyboard.press('Space');

    await expect(page.locator('#alarm-box')).toBeVisible();
    await expect(page.locator('#alarm-count')).toHaveText('1');

    await page.waitForTimeout(1700);
    await expect(page.locator('#alarm-box')).toBeHidden();
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — spams unmapped keys (Q/E/Enter/Backspace) without crash or page scroll', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();

    const scrollBefore = await page.evaluate(() => window.scrollY);
    const before = await readVisibleArenaState(page);

    for (const k of ['KeyQ', 'KeyE', 'Enter', 'Backspace', 'KeyQ', 'KeyA', 'KeyD']) {
      await page.keyboard.press(k);
    }

    const after = await readVisibleArenaState(page);
    expect(after.stack).toEqual(before.stack);
    expect(after.activeToken).toBe(before.activeToken);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT (Strict Black-Box) — completes all 10 waves via keyboard only without __DEV_LEVEL3_STATE__', async ({ page }) => {
    test.setTimeout(60000);
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    const benchmarker = new DifficultyBenchmarker({
      courseSlug: '11-класс_углубленный',
      lessonId: 36,
      levelNumber: 3
    });

    await page.goto(TASK_URL);
    // Start game purely with Space on intro screen
    await expect(page.locator('#start-btn')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    const scrollBefore = await page.evaluate(() => window.scrollY);
    let exercisedAdjKeys = false;

    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('#wave-counter-badge')).toContainText(`Волна ${w} из 10`, { timeout: 5000 });
      benchmarker.recordPhase(w, {
        title: `Волна ${w} конвейера ОПЗ`,
        depth: w >= 9 ? 4 : w >= 4 ? 3 : 2,
        memory: w >= 7 ? 3 : 2,
        inversion: (w === 3 || w === 6 || w === 8) ? 2 : 0,
        stress: w <= 2 ? 1 : (w === 7 || w === 8) ? 2 : 3
      });

      let stepGuard = 0;
      while (stepGuard < 20) {
        stepGuard++;
        const victoryVisible = await page.locator('text=СТЕКОВЫЙ РЕАКТОР СТАБИЛИЗИРОВАН').isVisible();
        if (victoryVisible) break;

        const st = await readVisibleArenaState(page);
        if (w < 10 && st.waveText.includes(`Волна ${w + 1} из 10`)) break;

        const plan = decideNextActionBlackBox(st.activeToken, st.stack);
        if (!plan || plan.action === 'DONE') {
          await page.waitForTimeout(100);
          continue;
        }

        if (plan.action === 'EVAL') {
          await enterAccByKeyboard(page, plan.acc, !exercisedAdjKeys);
          exercisedAdjKeys = true;
          await moveStationByKeyboard(page, 'EVAL');
        } else {
          await moveStationByKeyboard(page, plan.action);
        }

        await page.keyboard.press('Space');
        await page.waitForTimeout(25);
      }

      if (w < 10) {
        await expect(page.locator('#wave-counter-badge')).toContainText(`Волна ${w + 1} из 10`, { timeout: 4000 });
      }
    }

    await expect(page.locator('text=СТЕКОВЫЙ РЕАКТОР СТАБИЛИЗИРОВАН (10 / 10 ВОЛН)')).toBeVisible({ timeout: 5000 });
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

    benchmarker.assertGradeCorridor('11-класс_углубленный');
    benchmarker.renderReport('LESSON 36 (Level 3) :: KEYBOARD-ONLY BLACK-BOX AUDIT');
    sim.assertCleanSession();
  });
});
