import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('9th Grade Lesson 8: Level 1 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — commits error on Phase 1, observes feedback, recovers and advances', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(encodeURI('/tasks/9-класс/8/level1'));

    await expect(page.locator('#phase-1-workspace')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    // Novice mistake: sends all cards into single OS bin
    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        const poolCards = page.locator('#cards-pool .draggable-card');
        const count = await poolCards.count();
        for (let i = 0; i < count; i++) {
          await poolCards.first().click();
          await page.locator('#bin-os').click();
          await page.waitForTimeout(40);
        }
        await page.locator('#verify-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#status-alert')).toBeVisible();
        await expect(page.locator('#status-alert')).toHaveClass(/alert-danger/);
        await expect(page.locator('#attempts-display')).toHaveText('1');
      },
      solveCorrectlyFn: async () => {
        // Wait for regeneration
        await page.waitForTimeout(1500);
        await expect(page.locator('#status-alert')).toBeHidden();

        // Properly classify cards
        const poolCards = page.locator('#cards-pool .draggable-card');
        while (await poolCards.count() > 0) {
          const card = poolCards.first();
          const cardType = await card.getAttribute('data-card-type');
          await card.click();
          if (cardType === 'os') {
            await page.locator('#bin-os').click();
          } else {
            await page.locator('#bin-oo').click();
          }
          await page.waitForTimeout(40);
        }
        await page.locator('#verify-btn').click();
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase-1-workspace')).toBeHidden();
        await expect(page.locator('#phase-2-workspace')).toBeVisible();
        await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid clicking on verify button, empty bins and matrix cells', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(encodeURI('/tasks/9-класс/8/level1'));

    // Rapid spam clicks on empty verify button
    await sim.simulateSpamClick(page.locator('#verify-btn'), 4);

    // Rapid spam clicks on bin containers
    await sim.simulateSpamClick(page.locator('#bin-os'), 3);
    await sim.simulateSpamClick(page.locator('#bin-oo'), 3);

    // Ensure session remains alive without unhandled crashes
    await page.waitForTimeout(300);
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — completes full 3-phase progression with 100% precision', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto(encodeURI('/tasks/9-класс/8/level1'));

    // --- Phase 1 ---
    await expect(page.locator('#phase-1-workspace')).toBeVisible();
    const poolCards = page.locator('#cards-pool .draggable-card');
    while (await poolCards.count() > 0) {
      const card = poolCards.first();
      const cardType = await card.getAttribute('data-card-type');
      await sim.cognitivePause(40);
      await card.click();
      if (cardType === 'os') {
        await page.locator('#bin-os').click();
      } else {
        await page.locator('#bin-oo').click();
      }
    }
    await page.locator('#verify-btn').click();

    // --- Phase 2 ---
    await expect(page.locator('#phase-2-workspace')).toBeVisible({ timeout: 3000 });
    const targetEdges = await page.evaluate(() => {
      const coords = [
        { x: 160, y: 35 },
        { x: 50,  y: 110 },
        { x: 270, y: 110 },
        { x: 160, y: 185 }
      ];
      function findIndex(x, y) {
        return coords.findIndex(c => Math.abs(c.x - x) < 5 && Math.abs(c.y - y) < 5);
      }
      const lines = Array.from(document.querySelectorAll('#graph-svg line'));
      const edges = [];
      lines.forEach(l => {
        const u = findIndex(parseFloat(l.getAttribute('x1')), parseFloat(l.getAttribute('y1')));
        const v = findIndex(parseFloat(l.getAttribute('x2')), parseFloat(l.getAttribute('y2')));
        if (u !== -1 && v !== -1) {
          edges.push([u, v]);
          edges.push([v, u]);
        }
      });
      return edges;
    });

    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (r === c) continue;
        const shouldBeOne = targetEdges.some(([u, v]) => u === r && v === c);
        const cell = page.locator(`.matrix-cell[data-row="${r}"][data-col="${c}"]`);
        const currentVal = parseInt((await cell.innerText()).trim(), 10);
        if ((shouldBeOne && currentVal === 0) || (!shouldBeOne && currentVal === 1)) {
          await sim.cognitivePause(30);
          await cell.click();
        }
      }
    }
    await page.locator('#verify-btn').click();

    // --- Phase 3 ---
    await expect(page.locator('#phase-3-workspace')).toBeVisible({ timeout: 3000 });
    const slotWeights = await page.evaluate(() => {
      const texts = Array.from(document.querySelectorAll('#weighted-graph-svg text'));
      let weightAB = null;
      let weightCD = null;
      texts.forEach(t => {
        const y = parseFloat(t.getAttribute('y'));
        const x = parseFloat(t.getAttribute('x'));
        const val = parseInt(t.textContent.trim(), 10);
        if (!isNaN(val)) {
          if (Math.abs(x - 160) < 30 && Math.abs(y - 49) < 20) weightAB = val;
          if (Math.abs(x - 160) < 30 && Math.abs(y - 179) < 20) weightCD = val;
        }
      });
      return { weightAB, weightCD };
    });

    const slotsToFill = [
      { key: '0-1', val: slotWeights.weightAB },
      { key: '1-0', val: slotWeights.weightAB },
      { key: '2-3', val: slotWeights.weightCD },
      { key: '3-2', val: slotWeights.weightCD }
    ];

    for (const item of slotsToFill) {
      await sim.cognitivePause(40);
      const token = page.locator(`.token-chip:has-text("${item.val}")`).first();
      await token.click();
      await page.locator(`#slot-${item.key}`).click();
    }
    await page.locator('#verify-btn').click();

    // --- Victory Screen ---
    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#attempts-display')).toHaveText('0');

    sim.assertCleanSession();
  });

  test('Level 1 - Hitbox & Touch Target Ergonomics Audit (>= 48px)', async ({ page }) => {
    await page.goto(encodeURI('/tasks/9-класс/8/level1'));

    // Check Verify Button
    const verifyBtnBox = await page.locator('#verify-btn').boundingBox();
    expect(verifyBtnBox.width).toBeGreaterThanOrEqual(48);
    expect(verifyBtnBox.height).toBeGreaterThanOrEqual(48);

    // Check draggable cards
    const cardBoxes = await page.locator('#cards-pool .draggable-card').all();
    for (const c of cardBoxes) {
      const box = await c.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(48);
    }
  });
});
