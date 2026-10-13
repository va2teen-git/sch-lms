import { test, expect } from '@playwright/test';

test.describe('Grade 8 Lesson 8: Logic Operations Level 1', () => {

  test('Zero Multiple Choice check: no radio buttons or select dropdowns', async ({ page }) => {
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level1');
    
    // Ensure no multiple-choice input elements
    const radios = await page.locator('input[type="radio"]').count();
    expect(radios).toBe(0);

    const selects = await page.locator('select').count();
    expect(selects).toBe(0);
  });

  test('Phase 1: Token slot placement and verification', async ({ page }) => {
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level1');
    
    // Check Phase 1 is visible
    await expect(page.locator('#phase-1-container')).toBeVisible();
    await expect(page.locator('#p1-tokens-pool')).toBeVisible();

    // Mapping expected slot targets
    const expectedSlots = [
      { module: 'not', slot: 'symbol', targetId: 'not_symbol' },
      { module: 'not', slot: 'circuit', targetId: 'not_circuit' },
      { module: 'not', slot: 'math', targetId: 'not_math' },

      { module: 'and', slot: 'symbol', targetId: 'and_symbol' },
      { module: 'and', slot: 'circuit', targetId: 'and_circuit' },
      { module: 'and', slot: 'math', targetId: 'and_math' },

      { module: 'or', slot: 'symbol', targetId: 'or_symbol' },
      { module: 'or', slot: 'circuit', targetId: 'or_circuit' },
      { module: 'or', slot: 'math', targetId: 'or_math' },
    ];

    // Place each token into its target slot via click-manipulation
    for (const item of expectedSlots) {
      const token = page.locator(`.token-item[data-token-id="${item.targetId}"]`);
      await expect(token).toBeVisible();
      await token.click();

      const slot = page.locator(`.op-module[data-op="${item.module}"] .slot-target[data-slot="${item.slot}"]`);
      await slot.click();
    }

    // Verify button should now be enabled
    const verifyBtn = page.locator('#p1-verify-btn');
    await expect(verifyBtn).toBeEnabled();
    await verifyBtn.click();

    // Should advance to Phase 2
    await expect(page.locator('#phase-1-container')).toBeHidden();
    await expect(page.locator('#phase-2-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
  });

  test('Full Walkthrough: Complete all 3 phases and achieve success', async ({ page }) => {
    // Intercept telemetry events
    const telemetryEvents = [];
    page.on('console', msg => {
      if (msg.text().includes('TELEMETRY_EVENT')) telemetryEvents.push(msg.text());
    });

    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level1');

    // === PHASE 1 ===
    const phase1Targets = [
      { module: 'not', slot: 'symbol', targetId: 'not_symbol' },
      { module: 'not', slot: 'circuit', targetId: 'not_circuit' },
      { module: 'not', slot: 'math', targetId: 'not_math' },
      { module: 'and', slot: 'symbol', targetId: 'and_symbol' },
      { module: 'and', slot: 'circuit', targetId: 'and_circuit' },
      { module: 'and', slot: 'math', targetId: 'and_math' },
      { module: 'or', slot: 'symbol', targetId: 'or_symbol' },
      { module: 'or', slot: 'circuit', targetId: 'or_circuit' },
      { module: 'or', slot: 'math', targetId: 'or_math' },
    ];

    for (const item of phase1Targets) {
      await page.locator(`.token-item[data-token-id="${item.targetId}"]`).click();
      await page.locator(`.op-module[data-op="${item.module}"] .slot-target[data-slot="${item.slot}"]`).click();
    }
    await page.locator('#p1-verify-btn').click();

    // === PHASE 2 ===
    await expect(page.locator('#phase-2-container')).toBeVisible();

    // Fill truth table cells by evaluating directly according to the formula
    // Get formula text to determine the evaluator
    const formulaText = await page.locator('#p2-formula-display').innerText();
    
    // We can evaluate row by row:
    // Click simulator toggles and read truth table values
    const rows = page.locator('#p2-truth-table-body tr');
    const rowCount = await rows.count();
    expect(rowCount).toBe(4);

    const inputs = [[0, 0], [0, 1], [1, 0], [1, 1]];

    for (let i = 0; i < 4; i++) {
      const [a, b] = inputs[i];

      // Switch simulator to match (a, b) and read correct mid & out
      const btnA = page.locator('#p2-toggle-a');
      const btnB = page.locator('#p2-toggle-b');

      const curA = (await btnA.innerText()).includes('1') ? 1 : 0;
      const curB = (await btnB.innerText()).includes('1') ? 1 : 0;

      if (curA !== a) await btnA.click();
      if (curB !== b) await btnB.click();

      const expectedMid = parseInt(await page.locator('#p2-node-val').innerText(), 10);
      const expectedOut = parseInt(await page.locator('#p2-out-val').innerText(), 10);

      // Now set the cells in row i
      const row = rows.nth(i);
      const midCell = row.locator('[data-col="mid"]');
      const outCell = row.locator('[data-col="out"]');

      // Click to reach expectedMid (? -> 0 -> 1)
      if (expectedMid === 0) {
        await midCell.click(); // ? -> 0
      } else {
        await midCell.click(); // ? -> 0
        await midCell.click(); // 0 -> 1
      }

      // Click to reach expectedOut (? -> 0 -> 1)
      if (expectedOut === 0) {
        await outCell.click(); // ? -> 0
      } else {
        await outCell.click(); // ? -> 0
        await outCell.click(); // 0 -> 1
      }
    }

    // Verify Phase 2
    const p2VerifyBtn = page.locator('#p2-verify-btn');
    await expect(p2VerifyBtn).toBeEnabled();
    await p2VerifyBtn.click();

    // === PHASE 3 ===
    await expect(page.locator('#phase-3-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');

    // Read target pattern
    const targetPattern = await page.locator('#p3-target-pattern').innerText();

    // Map needed gates based on target pattern
    let g1 = 'and', g2 = 'not';
    if (targetPattern.includes('1 0 0 0')) {
      g1 = 'or';
      g2 = 'not';
    } else if (targetPattern.includes('0 1 1 1')) {
      g1 = 'or';
      g2 = 'buf';
    } else if (targetPattern.includes('1 1 1 0')) {
      g1 = 'and';
      g2 = 'not';
    }

    // Place gate 1
    await page.locator(`.token-item[data-gate-id="${g1}"]`).click();
    await page.locator('#p3-slot-gate1').click();

    // Place gate 2
    await page.locator(`.token-item[data-gate-id="${g2}"]`).click();
    await page.locator('#p3-slot-gate2').click();

    // Click verify
    const p3VerifyBtn = page.locator('#p3-verify-btn');
    await expect(p3VerifyBtn).toBeEnabled();
    await p3VerifyBtn.click();

    // === SUCCESS SCREEN ===
    await expect(page.locator('#success-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#phase-badge')).toHaveText('УСПЕХ');
  });

  test('Error handling and attempts counter behavior in Phase 1', async ({ page }) => {
    await page.goto('/tasks/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8/level1');

    // Place an intentional mismatch (place 'or_symbol' into 'not' slot)
    const tokens = page.locator('.token-item');
    const slots = page.locator('.slot-target');
    const tokenCount = await tokens.count();
    const slotCount = await slots.count();

    // Fill all 9 slots with tokens from pool in sequence
    for (let i = 0; i < slotCount; i++) {
      const token = page.locator('#p1-tokens-pool .token-item').first();
      await token.click();
      await slots.nth((i + 1) % slotCount).click(); // intentional mismatch
    }

    // Verify button should now be enabled
    const verifyBtn = page.locator('#p1-verify-btn');
    await expect(verifyBtn).toBeEnabled();
    await verifyBtn.click();

    // Feedback box should become visible with error
    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    // After timeout, feedback box hides and pool is reset/regenerated
    await expect(page.locator('#feedback-box')).toBeHidden({ timeout: 3000 });
  });

  test('Lesson Page Integration: Theory and Level 1 iframe are displayed', async ({ page }) => {
    await page.goto('/lesson/8-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/8');

    // Verify Lesson Header
    await expect(page.locator('header h1')).toContainText('Логические операции «и», «или», «не»');

    // Verify Theory Content is rendered
    const theorySection = page.locator('section').first();
    await expect(theorySection).toBeVisible();
    await expect(theorySection).toContainText('Логические операции «И», «ИЛИ», «НЕ» (по К.Ю. Полякову)');
    await expect(theorySection).toContainText('Джордж Буль');
    await expect(theorySection).toContainText('Таблица истинности');

    // Verify iframe for level 1 exists and loads
    const iframe = page.locator('#iframe-1');
    await expect(iframe).toBeVisible();
    const frame = page.frameLocator('#iframe-1');
    await expect(frame.locator('#phase-1-container')).toBeVisible();
    await expect(frame.locator('#phase-badge')).toHaveText('Шаг 1 из 3');
  });

});


