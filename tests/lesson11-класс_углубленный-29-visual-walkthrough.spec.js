import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('11th Grade Lesson 29: Visual Walkthrough & Comprehensive Verification Suite', () => {
  const scratchDir = 'C:\\Users\\vatutin_n_a\\.gemini\\antigravity-cli\\brain\\34532edb-ad0d-4cab-a49b-70d1d91f5483\\scratch';

  test('01. Lesson Split-Screen & Comprehensive Theory UI Walkthrough', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/29');

    // Verify title and theory rendering
    await expect(page.locator('h1').first()).toContainText('Многоразрядные целые числа');
    await page.screenshot({ path: path.join(scratchDir, '01_lesson29_theory_split_screen.png') });

    // Scroll down to Section 10 (Additional Information)
    const addInfoHeading = page.locator('h2', { hasText: '10. Дополнительная информация' });
    await addInfoHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(scratchDir, '02_lesson29_theory_additional_info.png') });
  });

  test('02. Level 1 - Complete 3-Phase Interactive Manipulation Walkthrough with Screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/29/level1');

    // --- Phase 1: Slot & Snap Little-Endian Blocks ---
    await expect(page.locator('#phase1')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '03_lesson29_level1_phase1_start.png') });

    const numStr = await page.locator('#p1-target-number').innerText();
    const block0 = numStr.slice(-4);
    const block1 = numStr.slice(-8, -4);
    const block2 = numStr.slice(0, -8);
    const expectedBlocks = [block0, block1, block2];

    for (let slot = 0; slot < 3; slot++) {
      const token = page.locator(`.p1-token-btn[data-val="${expectedBlocks[slot]}"]`).first();
      await token.click();
      await page.locator(`#p1-slot-${slot}`).click();
    }
    await page.screenshot({ path: path.join(scratchDir, '04_lesson29_level1_phase1_solved.png') });
    await page.locator('#p1-submit-btn').click();

    // --- Phase 2: Additive Accumulator with Carry ---
    await expect(page.locator('#phase2')).toBeVisible();

    const a0 = parseInt(await page.locator('#p2-val-a0').innerText(), 10);
    const b0 = parseInt((await page.locator('#p2-val-b0').innerText()).replace(/\D+/g, ''), 10);
    const a1 = parseInt(await page.locator('#p2-val-a1').innerText(), 10);
    const b1 = parseInt((await page.locator('#p2-val-b1').innerText()).replace(/\D+/g, ''), 10);

    const sum0 = a0 + b0;
    const res0 = String(sum0 % 1000);
    const carry1 = String(Math.floor(sum0 / 1000));
    const sum1 = a1 + b1 + parseInt(carry1, 10);
    const res1 = String(sum1 % 1000);
    const carry2 = String(Math.floor(sum1 / 1000));
    const res2 = String(carry2);

    const p2Assignments = [
      { slotId: 'carry1', val: carry1 },
      { slotId: 'carry2', val: carry2 },
      { slotId: 'res0', val: res0 },
      { slotId: 'res1', val: res1 },
      { slotId: 'res2', val: res2 }
    ];

    for (const item of p2Assignments) {
      const token = page.locator(`#p2-tokens-palette .p2-token-btn[data-val="${item.val}"]:not(.d-none)`).first();
      await token.click();
      await page.locator(`#p2-slot-${item.slotId}`).click();
    }
    await page.screenshot({ path: path.join(scratchDir, '05_lesson29_level1_phase2_accumulator.png') });
    await page.locator('#p2-submit-btn').click();

    // --- Phase 3: Complexity Bin Classification ---
    await expect(page.locator('#phase3')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '06_lesson29_level1_phase3_buckets.png') });

    const poolCards = page.locator('#p3-pool .p3-card');
    while (await poolCards.count() > 0) {
      const card = poolCards.first();
      const expectedBucket = await card.getAttribute('data-expected-bucket');
      await card.click();
      await page.locator(`#bucket-${expectedBucket}`).click({ position: { x: 20, y: 20 } });
      await page.waitForTimeout(50);
    }
    await page.locator('#p3-submit-btn').click();

    // --- Victory Screen ---
    await expect(page.locator('#victory-screen')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '07_lesson29_level1_victory.png') });
  });

  test('03. Level 2 - Complete 5-Phase Sawtooth Walkthrough with Screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/29/level2');

    // --- Phase 1: Block Capacity ---
    await expect(page.locator('#phase1')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '08_lesson29_level2_phase1_capacity.png') });
    const digits = parseInt(await page.locator('#p1-digits-val').innerText(), 10);
    const k = parseInt(await page.locator('#p1-k-val').innerText(), 10);
    const p1Ans = Math.ceil(digits / k);
    await page.locator('#p1-input').fill(String(p1Ans));
    await page.locator('#p1-submit-btn').click();

    // --- Phase 2: Elementary Multiplications ---
    await expect(page.locator('#phase2')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '09_lesson29_level2_phase2_multiplications.png') });
    const lenA = parseInt(await page.locator('#p2-len-a').innerText(), 10);
    const lenB = parseInt(await page.locator('#p2-len-b').innerText(), 10);
    const p2Ans = Math.ceil(lenA / 4) * Math.ceil(lenB / 4);
    await page.locator('#p2-input').fill(String(p2Ans));
    await page.locator('#p2-submit-btn').click();

    // --- Phase 3: Borrow Inversion ---
    await expect(page.locator('#phase3')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '10_lesson29_level2_phase3_borrow_inversion.png') });
    const a0 = parseInt(await page.locator('#p3-val-a0').innerText(), 10);
    const c0 = parseInt(await page.locator('#p3-val-c0').innerText(), 10);
    const p3Ans = a0 + 1000 - c0;
    await page.locator('#p3-input').fill(String(p3Ans));
    await page.locator('#p3-submit-btn').click();

    // --- Phase 4: Binary Exponentiation Steps ---
    await expect(page.locator('#phase4')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '11_lesson29_level2_phase4_bin_pow.png') });
    const bitsLen = parseInt(await page.locator('#p4-bits-len').innerText(), 10);
    const onesCnt = parseInt(await page.locator('#p4-ones-cnt').innerText(), 10);
    const p4Ans = (bitsLen - 1) + (onesCnt - 1);
    await page.locator('#p4-input').fill(String(p4Ans));
    await page.locator('#p4-submit-btn').click();

    // --- Phase 5: Karatsuba Cross Product ---
    await expect(page.locator('#phase5')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '12_lesson29_level2_phase5_karatsuba.png') });
    const p1Val = parseInt(await page.locator('#p5-val-p1').innerText(), 10);
    const p2Val = parseInt(await page.locator('#p5-val-p2').innerText(), 10);
    const p3Val = parseInt(await page.locator('#p5-val-p3').innerText(), 10);
    const p5Ans = p3Val - p1Val - p2Val;
    await page.locator('#p5-input').fill(String(p5Ans));
    await page.locator('#p5-submit-btn').click();

    // --- Victory Screen ---
    await expect(page.locator('#victory-screen')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '13_lesson29_level2_victory.png') });
  });

  test('04. Level 3 - Arcade Conveyor Walkthrough & Hardcore Failure Recovery with Screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/29/level3');

    // Intro Briefing
    await expect(page.locator('#start-btn')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '14_lesson29_level3_intro_briefing.png') });

    // Start
    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');
    await page.screenshot({ path: path.join(scratchDir, '15_lesson29_level3_wave1_active.png') });

    // Intentional Mistake on Wave 1: Trigger Hardcore Alarm Box
    const wrongBtn = page.locator('button', { hasText: '[2] BORROW_IN' });
    await wrongBtn.click();
    await expect(page.locator('#alarm-box')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '16_lesson29_level3_alarm_reset.png') });

    // Wait for recovery to Wave 1
    await page.waitForTimeout(2000);
    await expect(page.locator('#alarm-box')).not.toBeVisible();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

    // Play all 10 waves correctly
    for (let wave = 1; wave <= 10; wave++) {
      await expect(page.locator('#phase-counter')).toContainText(`ВОЛНА ${wave} ИЗ 10`);

      const expectedAction = await page.evaluate(() => {
        return window.__DEV_LEVEL3_STATE__ ? window.__DEV_LEVEL3_STATE__.currentWave().correctAction : null;
      });

      if (expectedAction === 'carry') {
        await page.locator('button', { hasText: '[1] CARRY_OUT' }).click();
      } else if (expectedAction === 'borrow') {
        await page.locator('button', { hasText: '[2] BORROW_IN' }).click();
      } else if (expectedAction === 'normal') {
        await page.locator('button', { hasText: '[3] NORMAL_PASS' }).click();
      }

      await page.waitForTimeout(300);
    }

    // Victory Screen
    await expect(page.locator('h2', { hasText: 'ХАРДКОР-РЕЖИМ УСПЕШНО ПРЕОДОЛЕН!' })).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '17_lesson29_level3_victory.png') });
  });
});
