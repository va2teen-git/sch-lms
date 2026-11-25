import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona, DifficultyBenchmarker } from './student-simulator.js';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/36/level3';

async function readVisibleArcadeState(page) {
  return page.evaluate(() => {
    const payloadHtml = document.querySelector('#wave-payload').innerHTML.trim();
    const targetModeText = document.querySelector('#wave-target-mode').textContent.trim();
    const busModeText = document.querySelector('#current-bus-mode').textContent.trim();

    const cells = Array.from(document.querySelectorAll('[data-bit-index]'));
    const bits = new Array(8).fill(0);
    let cursorBit = 7;
    for (const c of cells) {
      const idx = parseInt(c.getAttribute('data-bit-index'), 10);
      bits[idx] = parseInt(c.getAttribute('data-bit-val'), 10);
      if (c.getAttribute('data-cursor') === 'true') cursorBit = idx;
    }

    return {
      payloadHtml,
      targetMode: targetModeText.startsWith('HEX') ? 'HEX' : 'OCT',
      busMode: busModeText.startsWith('HEX') ? 'HEX' : 'OCT',
      bits,
      cursorBit
    };
  });
}

function computeTargetValueFromPayload(payloadHtml) {
  // Удаляем span-обертки, оставляя теги <sub> и операторы
  const clean = payloadHtml.replace(/<\/?span[^>]*>/gi, '').trim();

  // SWAP_NIBBLES(XX<sub>16</sub>)
  let m = clean.match(/^SWAP_NIBBLES\(([0-9A-F]+)<sub>16<\/sub>\)$/i);
  if (m) {
    const a = parseInt(m[1], 16);
    return ((a & 0x0F) << 4) | ((a >> 4) & 0x0F);
  }

  // ~(XX<sub>16|8</sub>)
  m = clean.match(/^~\(([0-9A-F]+)<sub>(8|16)<\/sub>\)$/i);
  if (m) {
    const a = parseInt(m[1], parseInt(m[2], 10));
    return (~a) & 0xFF;
  }

  // ((XX<sub>16</sub> & 0x0F) << 4)
  m = clean.match(/^\(\(([0-9A-F]+)<sub>16<\/sub>\s*(?:&amp;|&)\s*0x0F\)\s*(?:&lt;&lt;|<<)\s*4\)$/i);
  if (m) {
    const a = parseInt(m[1], 16);
    return (a & 0x0F) << 4;
  }

  // (XX<sub>16</sub> >> 4)
  m = clean.match(/^\(([0-9A-F]+)<sub>16<\/sub>\s*(?:&gt;&gt;|>>)\s*4\)$/i);
  if (m) {
    return parseInt(m[1], 16) >> 4;
  }

  // XX<sub>16</sub> | 0xMASK
  m = clean.match(/^([0-9A-F]+)<sub>16<\/sub>\s*\|\s*0x([0-9A-F]+)$/i);
  if (m) {
    return parseInt(m[1], 16) | parseInt(m[2], 16);
  }

  // XX<sub>16</sub> & 0xMASK
  m = clean.match(/^([0-9A-F]+)<sub>16<\/sub>\s*(?:&amp;|&)\s*0x([0-9A-F]+)$/i);
  if (m) {
    return parseInt(m[1], 16) & parseInt(m[2], 16);
  }

  // XXX<sub>8</sub> & 0oMASK
  m = clean.match(/^([0-7]+)<sub>8<\/sub>\s*(?:&amp;|&)\s*0o([0-7]+)$/i);
  if (m) {
    return parseInt(m[1], 8) & parseInt(m[2], 8);
  }

  // XXX<sub>8</sub> ^ 0oMASK
  m = clean.match(/^([0-7]+)<sub>8<\/sub>\s*\^\s*0o([0-7]+)$/i);
  if (m) {
    return parseInt(m[1], 8) ^ parseInt(m[2], 8);
  }

  // Прямое число XX<sub>16</sub> или XXX<sub>8</sub>
  m = clean.match(/^([0-9A-F]+)<sub>(8|16)<\/sub>$/i);
  if (m) {
    return parseInt(m[1], parseInt(m[2], 10));
  }

  throw new Error('Cannot parse visible Wave payload: ' + clean);
}

test.describe('10th Grade Advanced Lesson 36 (Level 3) :: Keyboard-Only & Strict Black-Box Personas', () => {
  test('Keyboard-Only policy: mouse clicks in arena are blocked (pointer-events: none) and RU/EN e.code works without page scroll', async ({ page }) => {
    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-badge')).toContainText('Волна 1 / 10');

    const pointerEvents = await page.evaluate(() => getComputedStyle(document.querySelector('#arcade-field')).pointerEvents);
    expect(pointerEvents).toBe('none');

    const before = await readVisibleArcadeState(page);
    await page.locator('[data-bit-index="3"]').click({ force: true });
    const afterClick = await readVisibleArcadeState(page);
    expect(afterClick.bits).toEqual(before.bits);
    expect(afterClick.cursorBit).toBe(before.cursorBit);

    // Проверка RU-раскладки: физические коды KeyD (вправо) и KeyW (перекл. бит)
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'в', code: 'KeyD', bubbles: true }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ц', code: 'KeyW', bubbles: true }));
    });
    const afterRu = await readVisibleArcadeState(page);
    expect(afterRu.cursorBit).toBe(6);
    expect(afterRu.bits[6]).toBe(before.bits[6] ^ 1);

    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
  });

  test('Persona: NOVICE — commits wrong register via Space on Wave 1, observes #alarm-box & reset', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);
    await page.keyboard.press('Space');
    await expect(page.locator('#wave-badge')).toContainText('Волна 1 / 10');

    await sim.cognitivePause(150);
    await page.keyboard.press('Space');

    await expect(page.locator('#alarm-box')).toBeVisible();
    await expect(page.locator('#alarm-count')).toHaveText('1');
    await page.waitForTimeout(1700);
    await expect(page.locator('#alarm-box')).toBeHidden();
    await expect(page.locator('#wave-badge')).toContainText('Волна 1 / 10');
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — spams unmapped keys (Q/E/R/Z/Enter/Backspace) without side effects or errors', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);
    await page.keyboard.press('Space');
    await expect(page.locator('#wave-badge')).toContainText('Волна 1 / 10');

    const before = await readVisibleArcadeState(page);
    const scrollBefore = await page.evaluate(() => window.scrollY);

    for (const k of ['KeyQ', 'KeyE', 'KeyR', 'KeyZ', 'Enter', 'Backspace']) {
      await page.keyboard.press(k);
    }

    const after = await readVisibleArcadeState(page);
    expect(after.bits).toEqual(before.bits);
    expect(after.cursorBit).toBe(before.cursorBit);
    expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore);
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT (Strict Black-Box) — completes all 10 waves via keyboard only without __DEV_LEVEL3_STATE__', async ({ page }) => {
    test.setTimeout(60000);
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    const benchmarker = new DifficultyBenchmarker({
      courseSlug: '10-класс_углубленный',
      lessonId: 36,
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
        title: `Волна ${w} шины 2/8/16`,
        depth: w >= 9 ? 4 : w >= 4 ? 3 : 2,
        memory: w >= 4 ? 3 : 2,
        inversion: (w >= 4 && w !== 8) ? 2 : 0,
        stress: w <= 3 ? 1 : w === 8 ? 2 : 3
      });

      const st = await readVisibleArcadeState(page);
      const targetVal = computeTargetValueFromPayload(st.payloadHtml);

      if (st.busMode !== st.targetMode) {
        await page.keyboard.press('ShiftLeft');
      }

      // Настраиваем 8 бит через разрешенные клавиши (чередуем Digit0-7 и навигацию A/D/W/S/Arrow)
      if (w % 2 === 1) {
        for (let b = 0; b < 8; b++) {
          const want = (targetVal >> b) & 1;
          if (st.bits[b] !== want) {
            await page.keyboard.press(`Digit${b}`);
          }
        }
      } else {
        let cur = st.cursorBit;
        for (let b = 7; b >= 0; b--) {
          const want = (targetVal >> b) & 1;
          if (st.bits[b] !== want) {
            while (cur !== b) {
              await page.keyboard.press('ArrowRight');
              cur = (cur + 7) % 8;
            }
            if (want === 0) {
              await page.keyboard.press('KeyS');
            } else {
              await page.keyboard.press('KeyW');
            }
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

    benchmarker.assertGradeCorridor('10-класс_углубленный');
    benchmarker.renderReport('LESSON 36 (Level 3) :: KEYBOARD-ONLY BLACK-BOX AUDIT');
    sim.assertCleanSession();
  });
});
