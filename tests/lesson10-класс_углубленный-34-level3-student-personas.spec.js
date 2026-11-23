import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona, DifficultyBenchmarker } from './student-simulator.js';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/34/level3';

function normalizeDisplayToKey(rawText, base) {
  const clean = String(rawText || '').replace(/\s+/g, '').toUpperCase();
  if (clean.includes(',')) {
    const [intStr, fracStr] = clean.split(',');
    const intVal = parseInt(intStr || '0', base);
    let fracVal = 0;
    for (let i = 0; i < fracStr.length; i++) {
      fracVal += parseInt(fracStr[i], base) / Math.pow(base, i + 1);
    }
    return `frac:${Math.round(fracVal * 16)}`;
  }
  return `int:${parseInt(clean, base)}`;
}

async function readVisibleMatrixState(page) {
  return page.evaluate(() => {
    const board = document.querySelector('#matrix-board');
    const boardPointerEvents = board ? getComputedStyle(board).pointerEvents : '';
    const waveText = document.querySelector('#phase-counter')?.textContent?.trim() || '';
    const activeCard = document.querySelector('[data-active-step="true"]');
    let activeStep = null;

    if (activeCard) {
      const srcKind = activeCard.getAttribute('data-src-kind');
      const targetBase = Number(activeCard.getAttribute('data-target-base'));
      const exprContainer = activeCard.querySelector('.fs-5');
      const exprWrap = exprContainer?.querySelector(':scope > span');
      const innerSpans = exprWrap ? Array.from(exprWrap.querySelectorAll('span')) : [];
      const subs = exprWrap ? Array.from(exprWrap.querySelectorAll('sub')) : [];

      if (srcKind === 'direct') {
        activeStep = {
          srcKind,
          targetBase,
          srcDisplay: innerSpans[0]?.textContent?.trim() || '',
          srcBase: Number(subs[0]?.textContent?.trim())
        };
      } else if (srcKind === 'shift') {
        activeStep = {
          srcKind,
          targetBase,
          srcDisplay: innerSpans[0]?.textContent?.trim() || '',
          opLabel: innerSpans[1]?.textContent?.trim() || '',
          srcBase: Number(subs[0]?.textContent?.trim())
        };
      } else {
        activeStep = {
          srcKind,
          targetBase,
          srcDisplay: innerSpans[0]?.textContent?.trim() || '',
          opSymbol: innerSpans[1]?.textContent?.trim() || '',
          maskDisplay: innerSpans[2]?.textContent?.trim() || '',
          srcBase: Number(subs[0]?.textContent?.trim()),
          maskBase: Number(subs[1]?.textContent?.trim())
        };
      }
    }

    const cursorEl = document.querySelector('[data-cursor="true"]');
    const cursorRow = cursorEl ? Number(cursorEl.getAttribute('data-cell-row')) : -1;
    const cursorCol = cursorEl ? Number(cursorEl.getAttribute('data-cell-col')) : -1;

    const unlockedRailCells = Array.from(document.querySelectorAll('[data-cell-row][data-in-rail="true"][data-locked="false"]')).map(el => ({
      row: Number(el.getAttribute('data-cell-row')),
      col: Number(el.getAttribute('data-cell-col')),
      base: Number(el.getAttribute('data-cell-base')),
      text: el.getAttribute('data-cell-text') || ''
    }));

    const lockedCount = document.querySelectorAll('[data-locked="true"]').length;
    return {
      boardPointerEvents,
      waveText,
      activeStep,
      cursorRow,
      cursorCol,
      unlockedRailCells,
      lockedCount
    };
  });
}

function computeTargetKeyFromStep(step) {
  const cleanSrc = step.srcDisplay.replace(/\s+/g, '').toUpperCase();
  if (step.srcKind === 'direct') {
    return normalizeDisplayToKey(cleanSrc, step.srcBase);
  }
  const srcVal = parseInt(cleanSrc, step.srcBase);
  if (step.srcKind === 'shift') {
    const res = step.opLabel.includes('<<') ? (srcVal << 1) : (srcVal >> 1);
    return `int:${res}`;
  }
  const maskVal = parseInt(step.maskDisplay.replace(/\s+/g, ''), step.maskBase);
  let res = srcVal;
  if (step.opSymbol === '&') res = srcVal & maskVal;
  else if (step.opSymbol === '|') res = srcVal | maskVal;
  else res = srcVal ^ maskVal;
  return `int:${res}`;
}

async function moveCursorByKeyboard(page, curRow, curCol, targetRow, targetCol, useDigits, preferArrows) {
  if (useDigits && curRow === targetRow) {
    await page.keyboard.press(`Digit${targetCol + 1}`);
    return;
  }
  if (useDigits && curCol === targetCol) {
    await page.keyboard.press(`Digit${targetRow + 1}`);
    return;
  }

  let r = curRow;
  let c = curCol;
  const upKey = preferArrows ? 'ArrowUp' : 'KeyW';
  const downKey = preferArrows ? 'ArrowDown' : 'KeyS';
  const leftKey = preferArrows ? 'ArrowLeft' : 'KeyA';
  const rightKey = preferArrows ? 'ArrowRight' : 'KeyD';

  while (r < targetRow) { await page.keyboard.press(downKey); r++; }
  while (r > targetRow) { await page.keyboard.press(upKey); r--; }
  while (c < targetCol) { await page.keyboard.press(rightKey); c++; }
  while (c > targetCol) { await page.keyboard.press(leftKey); c--; }
}

test.describe('Digital Student Personas (Strict Black-Box Keyboard-Only) :: Lesson 34 Level 3', () => {
  test('Keyboard-Only policy: mouse clicks in playing arena are blocked (pointer-events: none)', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    const before = await readVisibleMatrixState(page);
    expect(before.boardPointerEvents).toBe('none');

    // Attempt forced mouse clicks inside playing matrix
    await page.locator('[data-cell-row="0"][data-cell-col="2"]').click({ force: true });
    await page.locator('[data-cell-row="2"][data-cell-col="2"]').click({ force: true });

    const after = await readVisibleMatrixState(page);
    expect(after.cursorRow).toBe(before.cursorRow);
    expect(after.cursorCol).toBe(before.cursorCol);
    expect(after.lockedCount).toBe(0);
    sim.assertCleanSession();
  });

  test('Persona: NOVICE — selects off-rail cell via keyboard on Wave 1, sees #alarm-box & #alarm-count, resets cleanly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    // Step 1 active rail is Row 0 (R1); moving down onto R2 puts cursor off-rail -> Space triggers alarm
    await page.keyboard.press('KeyS');
    await page.keyboard.press('Space');

    await expect(page.locator('#alarm-box')).toBeVisible();
    await expect(page.locator('#alarm-count')).toHaveText('1');

    await page.waitForTimeout(1800);
    await expect(page.locator('#alarm-box')).toBeHidden();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — spams unmapped keys (Q/E/R/Enter/Backspace) + Shift grouper without crash or scroll', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();

    const scrollBefore = await page.evaluate(() => window.scrollY);
    const before = await readVisibleMatrixState(page);

    for (const k of ['KeyQ', 'KeyE', 'KeyR', 'Enter', 'Backspace', 'KeyD', 'KeyA', 'ShiftLeft', 'ShiftLeft', 'ShiftLeft']) {
      await page.keyboard.press(k);
    }

    const after = await readVisibleMatrixState(page);
    expect(after.cursorRow).toBe(before.cursorRow);
    expect(after.cursorCol).toBe(before.cursorCol);
    expect(after.lockedCount).toBe(0);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT (Strict Black-Box) — completes all 10 waves via keyboard only without __DEV_LEVEL3_STATE__', async ({ page }) => {
    test.setTimeout(60000);
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    const benchmarker = new DifficultyBenchmarker({
      courseSlug: '10-класс_углубленный',
      lessonId: 34,
      levelNumber: 3
    });

    await page.goto(TASK_URL);
    await expect(page.locator('#start-btn')).toBeVisible();
    await page.keyboard.press('Space');
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    const scrollBefore = await page.evaluate(() => window.scrollY);

    for (let w = 1; w <= 10; w++) {
      await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w} ИЗ 10`, { timeout: 5000 });
      benchmarker.recordPhase(w, {
        title: `Волна ${w} матрицы 2↔8↔16`,
        depth: w >= 9 ? 4 : w >= 4 ? 3 : 2,
        memory: w >= 4 ? 3 : 2,
        inversion: (w >= 4 && w !== 8) ? 2 : 0,
        stress: w <= 3 ? 1 : w === 8 ? 2 : 3
      });

      // Cycle bit grouper with Shift on binary waves to exercise 3-БИТ / 4-БИТ / RAW modes
      if (w === 1) await page.keyboard.press('ShiftLeft');
      if (w === 2) await page.keyboard.press('ShiftLeft');
      if (w === 3) await page.keyboard.press('ShiftLeft');

      const totalSteps = await page.locator('[data-target-step]').count();
      for (let stepIdx = 0; stepIdx < totalSteps; stepIdx++) {
        await expect(page.locator(`[data-target-step="${stepIdx}"][data-active-step="true"]`)).toBeVisible({ timeout: 3000 });
        const st = await readVisibleMatrixState(page);
        expect(st.activeStep, `Wave ${w} step ${stepIdx}: activeStep missing`).toBeTruthy();

        const targetKey = computeTargetKeyFromStep(st.activeStep);
        const targetCell = st.unlockedRailCells.find(
          c => c.base === st.activeStep.targetBase && normalizeDisplayToKey(c.text, c.base) === targetKey
        );
        expect(targetCell, `Wave ${w} step ${stepIdx}: expected target cell for ${targetKey}@${st.activeStep.targetBase}`).toBeTruthy();

        const useDigits = w % 3 === 0;
        const preferArrows = w % 2 === 1;
        await moveCursorByKeyboard(page, st.cursorRow, st.cursorCol, targetCell.row, targetCell.col, useDigits, preferArrows);
        await page.keyboard.press('Space');
        await page.waitForTimeout(30);
      }

      if (w < 10) {
        await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${w + 1} ИЗ 10`, { timeout: 4000 });
      }
    }

    await expect(page.locator('text=ПРОТОКОЛ 2 ↔ 8 ↔ 16 ВЗЛОМАН!')).toBeVisible({ timeout: 5000 });
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);

    benchmarker.assertGradeCorridor('10-класс_углубленный');
    benchmarker.renderReport('LESSON 34 (Level 3) :: KEYBOARD-ONLY BLACK-BOX AUDIT');
    sim.assertCleanSession();
  });
});
