import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('11th Grade Lesson 27: Visual Walkthrough & Full Verification Suite', () => {
  const scratchDir = 'C:\\Users\\vatutin_n_a\\.gemini\\antigravity-cli\\brain\\9329f3f3-14e6-4f6c-8f0e-3007fd107573\\scratch';

  test('01. Lesson Split-Screen & Comprehensive Theory UI Walkthrough', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27');

    await expect(page.locator('h1').first()).toContainText('Поиск простых чисел');
    await page.screenshot({ path: path.join(scratchDir, '01_lesson27_split_screen.png'), fullPage: false });

    // Scroll through theory content inside left split pane
    const theoryPane = page.locator('section.overflow-y-auto').first();
    await theoryPane.evaluate(el => el.scrollBy(0, 1200));
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(scratchDir, '02_lesson27_theory_content.png'), fullPage: false });
  });

  test('02. Level 1 - Complete 3-Phase Interactive Manipulation Walkthrough with Screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level1');

    // --- Phase 1: Number Grid Sieve ---
    await expect(page.locator('#phase1')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '03_lesson27_level1_phase1_start.png') });

    const pText = await page.locator('#p1-prime-val').innerText();
    const p = parseInt(pText.replace(/\D+/g, ''), 10);
    const maxVal = parseInt(await page.locator('#p1-max-val').innerText(), 10);

    for (let k = p * p; k <= maxVal; k += p) {
      const btn = page.locator(`.grid-num-btn[data-num="${k}"]`);
      if (await btn.isVisible()) {
        await btn.click();
      }
    }
    await page.screenshot({ path: path.join(scratchDir, '04_lesson27_level1_phase1_solved.png') });
    await page.locator('#p1-submit-btn').click();

    // --- Phase 2: Slot & Snap Pipeline ---
    await expect(page.locator('#phase2')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '05_lesson27_level1_phase2_slots_start.png') });

    const targetTokens = ['t_init', 't_outer', 't_inner', 't_comp'];
    for (let slotIdx = 0; slotIdx < targetTokens.length; slotIdx++) {
      const tokenBtn = page.locator(`.token-btn[data-token-id="${targetTokens[slotIdx]}"]`);
      await tokenBtn.click();
      await page.locator(`#slot-${slotIdx}`).click();
    }
    await page.screenshot({ path: path.join(scratchDir, '06_lesson27_level1_phase2_slots_solved.png') });
    await page.locator('#p2-submit-btn').click();

    // --- Phase 3: Buckets Sorting ---
    await expect(page.locator('#phase3')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '07_lesson27_level1_phase3_buckets_start.png') });

    const poolCards = page.locator('#p3-pool .p3-card');
    while (await poolCards.count() > 0) {
      const card = poolCards.first();
      const expectedBucket = await card.getAttribute('data-expected-bucket');
      await card.click();

      if (expectedBucket === 'p2') {
        await page.locator('#bucket-2').click();
      } else if (expectedBucket === 'p3') {
        await page.locator('#bucket-3').click();
      } else {
        await page.locator('#bucket-prime').click();
      }
    }
    await page.screenshot({ path: path.join(scratchDir, '08_lesson27_level1_phase3_buckets_solved.png') });
    await page.locator('#p3-submit-btn').click();

    // --- Victory Screen ---
    await expect(page.locator('#victory-screen')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '09_lesson27_level1_victory.png') });
  });

  test('03. Level 2 - Complete 5-Phase Sawtooth Walkthrough with Screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level2');

    // Phase 1 (Direct Count Calculation)
    await expect(page.locator('#phase1')).toBeVisible();
    const p1 = parseInt((await page.locator('#p1-p-val').innerText()).replace(/\D+/g, ''), 10);
    const n1 = parseInt((await page.locator('#p1-n-val').innerText()).replace(/\D+/g, ''), 10);
    const ans1 = Math.floor((n1 - p1 * p1) / p1) + 1;
    await page.locator('#p1-input').fill(String(ans1));
    await page.screenshot({ path: path.join(scratchDir, '10_lesson27_level2_phase1_direct.png') });
    await page.locator('#p1-submit-btn').click();

    // Phase 2 (Multi-Step Collision Calculation)
    await expect(page.locator('#phase2')).toBeVisible();
    const p2 = parseInt((await page.locator('#p2-p-val').innerText()).replace(/\D+/g, ''), 10);
    const n2 = parseInt((await page.locator('#p2-n-val').innerText()).replace(/\D+/g, ''), 10);
    let ans2 = 0;
    for (let k = p2 * p2; k <= n2; k += p2) {
      if (k % 2 !== 0 && k % 3 !== 0) ans2++;
    }
    await page.locator('#p2-input').fill(String(ans2));
    await page.screenshot({ path: path.join(scratchDir, '11_lesson27_level2_phase2_collisions.png') });
    await page.locator('#p2-submit-btn').click();

    // Phase 3 (Inverse Problem: Maximum Bound Peak 1)
    await expect(page.locator('#phase3')).toBeVisible();
    const p3 = parseInt((await page.locator('#p3-p-val').innerText()).replace(/\D+/g, ''), 10);
    const nextPrimesMap = { 5: 7, 7: 11, 11: 13, 13: 17 };
    const nextP = nextPrimesMap[p3] || 11;
    const ans3 = nextP * nextP - 1;
    await page.locator('#p3-input').fill(String(ans3));
    await page.screenshot({ path: path.join(scratchDir, '12_lesson27_level2_phase3_reverse.png') });
    await page.locator('#p3-submit-btn').click();

    // Phase 4 (Valley of Consolidation: Bit Vector Memory Footprint)
    await expect(page.locator('#phase4')).toBeVisible();
    const n4 = parseInt((await page.locator('#p4-n-val').innerText()).replace(/\D+/g, ''), 10);
    const ans4 = Math.ceil((n4 + 1) / 8);
    await page.locator('#p4-input').fill(String(ans4));
    await page.screenshot({ path: path.join(scratchDir, '13_lesson27_level2_phase4_memory.png') });
    await page.locator('#p4-submit-btn').click();

    // Phase 5 (Culmination: Segmented Sieve Start Index & Count)
    await expect(page.locator('#phase5')).toBeVisible();
    const l5 = parseInt((await page.locator('#p5-l-val').innerText()).replace(/\D+/g, ''), 10);
    const r5 = parseInt((await page.locator('#p5-r-val').innerText()).replace(/\D+/g, ''), 10);
    const p5 = parseInt((await page.locator('#p5-p-val').innerText()).replace(/\D+/g, ''), 10);
    const start5 = Math.max(p5 * p5, Math.ceil(l5 / p5) * p5);
    let count5 = 0;
    for (let k = start5; k <= r5; k += p5) count5++;
    const ans5 = `${start5}:${count5}`;
    await page.locator('#p5-input').fill(ans5);
    await page.screenshot({ path: path.join(scratchDir, '14_lesson27_level2_phase5_segmented.png') });
    await page.locator('#p5-submit-btn').click();

    // Victory Screen
    await expect(page.locator('#victory-screen')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '15_lesson27_level2_victory.png') });
  });

  test('04. Level 3 - Cyber Matrix Walkthrough & Hardcore Failure Recovery with Screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/27/level3');

    // Intro Screen
    await expect(page.locator('button', { hasText: 'ИНИЦИИРОВАТЬ ЗАБЕГ' })).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '16_lesson27_level3_intro_briefing.png') });

    // Start Game
    await page.locator('button', { hasText: 'ИНИЦИИРОВАТЬ ЗАБЕГ' }).click();
    await expect(page.locator('.badge', { hasText: 'Волна 1 из 8' })).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '17_lesson27_level3_wave1_active.png') });

    // Click active clickable cell in row 0
    const activeCell = page.locator('button.btn-outline-warning').first();
    await expect(activeCell).toBeVisible();
    await activeCell.click();
    await page.screenshot({ path: path.join(scratchDir, '18_lesson27_level3_wave_progress.png') });

    // Wait for timeout to verify hardcore reset glitch
    // Advance time or wait out the remaining timer
    await page.waitForTimeout(10500);
    await expect(page.locator('text=КРИТИЧЕСКИЙ СБОЙ МАТРИЦЫ')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '19_lesson27_level3_hardcore_fail.png') });
  });
});
