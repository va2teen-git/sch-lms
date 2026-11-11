import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('10th Grade Lesson 30: Level 1 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — commits error on Phase 1, observes feedback, recovers and advances', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level1');

    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    // Novice mistake: attempts to submit with wrong distractor tokens
    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        const slotTargets = page.locator('.p1-slot-target');
        const slotCount = await slotTargets.count();
        const targetLettersText = await page.locator('#p1-target-letters').innerText();
        const targets = targetLettersText.split(',').map(s => s.trim());

        const allTokens = page.locator('.p1-token-item');
        const tokenCount = await allTokens.count();
        let distractorBtn = null;
        for (let i = 0; i < tokenCount; i++) {
          const t = await allTokens.nth(i).getAttribute('data-token');
          if (!targets.includes(t)) {
            distractorBtn = allTokens.nth(i);
            break;
          }
        }

        if (distractorBtn) {
          await distractorBtn.click();
          await page.waitForTimeout(50);
          await slotTargets.first().click();
          await page.waitForTimeout(50);
        }

        for (let i = 1; i < slotCount; i++) {
          const tok = page.locator(`.p1-token-item[data-token="${targets[i - 1]}"]`);
          await tok.click();
          await page.waitForTimeout(50);
          await slotTargets.nth(i).click();
          await page.waitForTimeout(50);
        }

        await page.locator('#p1-submit-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#feedback-box')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
      },
      solveCorrectlyFn: async () => {
        // Wait for regeneration
        await page.waitForTimeout(1500);
        await expect(page.locator('#feedback-box')).toBeHidden();

        // Identify targets and empty slots
        const slotTargets = page.locator('.p1-slot-target');
        const slotCount = await slotTargets.count();

        const targetLettersText = await page.locator('#p1-target-letters').innerText();
        const targets = targetLettersText.split(',').map(s => s.trim());

        for (let i = 0; i < slotCount; i++) {
          const tokName = targets[i];
          const tokBtn = page.locator(`.p1-token-item[data-token="${tokName}"]`);
          await tokBtn.click();
          await slotTargets.nth(i).click();
        }

        await page.locator('#p1-submit-btn').click();
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase1')).toBeHidden();
        await expect(page.locator('#phase2')).toBeVisible();
        await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid clicking on reset button, empty slots and palette', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level1');

    // Rapid spam clicks on reset button
    await sim.simulateSpamClick(page.locator('#p1-reset-btn'), 5);

    // Click slots without selected token
    const slots = page.locator('.p1-slot-target');
    const slotCount = await slots.count();
    for (let i = 0; i < slotCount; i++) {
      await slots.nth(i).click();
    }

    // Verify slots remain empty
    for (let i = 0; i < slotCount; i++) {
      await expect(slots.nth(i)).toContainText('-- свободно --');
    }

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — completes full 3-phase progression with 100% precision', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level1');

    // --- Phase 1: Slot & Snap ---
    await expect(page.locator('#phase1')).toBeVisible();
    const slotTargets = page.locator('.p1-slot-target');
    const slotCount = await slotTargets.count();

    const targetLettersText = await page.locator('#p1-target-letters').innerText();
    const targets = targetLettersText.split(',').map(s => s.trim());

    for (let i = 0; i < slotCount; i++) {
      await page.locator(`.p1-token-item[data-token="${targets[i]}"]`).click();
      await slotTargets.nth(i).click();
      await sim.cognitivePause(40);
    }
    await page.locator('#p1-submit-btn').click();

    // --- Phase 2: Markov Wiring ---
    await expect(page.locator('#phase2')).toBeVisible();
    await sim.cognitivePause(60);

    const slotMappings = await page.evaluate(() => {
      // @ts-ignore
      return window.__DEV_P2_CONFIG__ ? window.__DEV_P2_CONFIG__.slots : [{ slotId: 's1', targetId: 'e1' }, { slotId: 's2', targetId: 'e2' }];
    });

    for (const sm of slotMappings) {
      await page.locator(`.p2-edge-item[data-edge-id="${sm.targetId}"]`).click();
      await page.locator(`.p2-slot-target[data-slot-id="${sm.slotId}"]`).click();
      await sim.cognitivePause(40);
    }

    // Run trace
    await page.locator('#p2-trace-btn').click();
    await page.locator('#p2-submit-btn').waitFor({ state: 'visible', timeout: 4000 });
    await page.locator('#p2-submit-btn').click();

    // --- Phase 3: Stream Carver ---
    await expect(page.locator('#phase3')).toBeVisible();
    await sim.cognitivePause(60);

    // Read dictionary codes
    const dictBadges = page.locator('#p3-dict-display > div');
    const dictCount = await dictBadges.count();
    const dictionary = [];
    for (let d = 0; d < dictCount; d++) {
      const text = await dictBadges.nth(d).innerText();
      const match = text.match(/Буква\s+([А-ЯЁ]):\s*([01]+)/);
      if (match) {
        dictionary.push({ letter: match[1], code: match[2] });
      }
    }
    dictionary.sort((a, b) => b.code.length - a.code.length);

    // Read bitstream
    const bitCells = page.locator('#p3-tape-container > div.d-flex.align-items-center');
    const bitCount = await bitCells.count();
    let bitStream = '';
    for (let b = 0; b < bitCount; b++) {
      bitStream += (await bitCells.nth(b).innerText()).trim();
    }

    const cutButtons = page.locator('.p3-cut-btn');
    let pos = 0;
    while (pos < bitStream.length) {
      let matched = false;
      for (const item of dictionary) {
        if (bitStream.startsWith(item.code, pos)) {
          pos += item.code.length;
          matched = true;
          if (pos < bitStream.length) {
            await cutButtons.nth(pos - 1).click();
            await sim.cognitivePause(20);
          }
          break;
        }
      }
      if (!matched) pos++;
    }

    await page.locator('#p3-submit-btn').click();

    // Verify victory
    await expect(page.locator('#victory-screen')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Level 1 - Hitbox & Touch Target Ergonomics Audit (>= 48px)', async ({ page }) => {
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level1');

    // Test token elements in Phase 1
    const tokens = page.locator('.p1-token-item');
    const tokenCount = await tokens.count();
    for (let i = 0; i < tokenCount; i++) {
      const box = await tokens.nth(i).boundingBox();
      expect(box, `Token ${i} must have bounding box`).not.toBeNull();
      expect(box.height, `Token ${i} height must be >= 48px`).toBeGreaterThanOrEqual(48);
      expect(box.width, `Token ${i} width must be >= 48px`).toBeGreaterThanOrEqual(48);
    }

    // Test slot targets in Phase 1
    const slots = page.locator('.p1-slot-target');
    const slotCount = await slots.count();
    for (let i = 0; i < slotCount; i++) {
      const box = await slots.nth(i).boundingBox();
      expect(box, `Slot ${i} must have bounding box`).not.toBeNull();
      expect(box.height, `Slot ${i} height must be >= 48px`).toBeGreaterThanOrEqual(48);
      expect(box.width, `Slot ${i} width must be >= 48px`).toBeGreaterThanOrEqual(48);
    }
  });
});
