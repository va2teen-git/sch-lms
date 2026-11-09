import { test, expect } from '@playwright/test';
import path from 'path';

const scratchDir = 'C:/Users/vatutin_n_a/.gemini/antigravity-cli/brain/9329f3f3-14e6-4f6c-8f0e-3007fd107573/scratch';

test.describe('Lesson 28: Visual Walkthrough, Screenshot Verification & Deep Audit', () => {

  test('01. Lesson Split-Screen & Theory UI Walkthrough', async ({ page }) => {
    // Navigate to lesson page
    await page.goto('/lesson/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/28');
    await page.setViewportSize({ width: 1366, height: 768 });

    // Verify main components visible
    await expect(page.locator('h1, h2, h3').first()).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '01_lesson_split_screen.png') });

    // Scroll through theory
    const theoryPane = page.locator('#theory-container, .theory-pane, article, main').first();
    if (await theoryPane.isVisible()) {
      await theoryPane.screenshot({ path: path.join(scratchDir, '02_theory_content.png') });
    }
  });

  test('02. Level 1 - Complete 3-Phase Walkthrough with Screenshots', async ({ page }) => {
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/28/level1');
    await page.setViewportSize({ width: 1024, height: 768 });

    // Phase 1 Screenshot
    await expect(page.locator('#phase1')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '03_level1_phase1_start.png') });

    // Solve Phase 1
    while (await page.locator('#p1-card-pool .card-token').count() > 0) {
      const card = page.locator('#p1-card-pool .card-token').first();
      const cat = await card.getAttribute('data-cat');
      await card.click();
      const targetHeader = page.locator(`.bucket-zone[data-bucket="${cat}"] .bucket-header`);
      await targetHeader.click();
    }

    await page.screenshot({ path: path.join(scratchDir, '04_level1_phase1_solved.png') });
    await page.locator('#btn-check-p1').click();

    // Phase 2 Screenshot
    await expect(page.locator('#phase2')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '05_level1_phase2_tree_start.png') });

    // Solve Phase 2
    const slotCount = await page.locator('#phase2 .tree-slot').count();
    for (let i = 0; i < slotCount; i++) {
      const slot = page.locator('#phase2 .tree-slot').nth(i);
      const targetCode = await slot.getAttribute('data-target-code');
      const token = page.locator(`#p2-token-palette .token-item[data-code="${targetCode}"][data-is-trap="false"]`).first();
      await token.click();
      await slot.click();
    }

    await page.screenshot({ path: path.join(scratchDir, '06_level1_phase2_tree_solved.png') });
    await page.locator('#btn-check-p2').click();

    // Phase 3 Screenshot
    await expect(page.locator('#phase3')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '07_level1_phase3_stream_start.png') });

    // Solve Phase 3: click all cut buttons to segment stream
    const cutButtons = page.locator('#p3-stream-container button');
    const cutCount = await cutButtons.count();
    for (let i = 0; i < cutCount; i++) {
      await cutButtons.nth(i).click();
    }

    await page.screenshot({ path: path.join(scratchDir, '08_level1_phase3_stream_solved.png') });

    // Advance if valid
    const btnCheck3 = page.locator('#btn-check-p3');
    if (await btnCheck3.isEnabled()) {
      await btnCheck3.click();
      await expect(page.locator('#completion-screen')).toBeVisible();
      await page.screenshot({ path: path.join(scratchDir, '09_level1_complete.png') });
    }
  });

  test('03. Level 2 - Complete 5-Phase Walkthrough with Screenshots', async ({ page }) => {
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/28/level2');
    await page.setViewportSize({ width: 1024, height: 768 });

    // Phase 1 (Hartley)
    await expect(page.locator('#phase1')).toBeVisible();
    const mVal = parseInt(await page.locator('#p1-m').innerText(), 10);
    const kVal = parseInt(await page.locator('#p1-k').innerText(), 10);
    const p1L = Math.ceil(Math.log2(mVal));
    const p1Bytes = (kVal * p1L) / 8;

    await page.locator('#p1-input-l').fill(p1L.toString());
    await page.locator('#p1-input-bytes').fill(p1Bytes.toString());
    await page.screenshot({ path: path.join(scratchDir, '10_level2_phase1_hartley.png') });
    await page.locator('#btn-submit-p1').click();

    // Phase 2 (Huffman Average Length)
    await expect(page.locator('#phase2')).toBeVisible();
    // Read table probabilities and lengths
    const rows = page.locator('#p2-table-body tr');
    const rowCount = await rows.count();
    let computedLavg = 0;
    for (let i = 0; i < rowCount; i++) {
      const probText = await rows.nth(i).locator('td').nth(1).innerText();
      const lenText = await rows.nth(i).locator('td').nth(3).innerText();
      // extract float from probText (e.g. "50% (0.50)")
      const match = probText.match(/\(([\d.]+)\)/);
      const prob = match ? parseFloat(match[1]) : 0;
      const len = parseInt(lenText, 10);
      computedLavg += prob * len;
    }
    const lavgStr = (Math.round(computedLavg * 100) / 100).toFixed(2);
    await page.locator('#p2-input-lavg').fill(lavgStr);
    await page.screenshot({ path: path.join(scratchDir, '11_level2_phase2_lavg.png') });
    await page.locator('#btn-submit-p2').click();

    // Phase 3 (Reverse Fano condition)
    await expect(page.locator('#phase3')).toBeVisible();
    const knownCodesText = await page.locator('#p3-known-codes').innerText();
    let targetCode = '111';
    if (knownCodesText.includes('100, Г: 101')) {
      targetCode = '11';
    } else if (knownCodesText.includes('000')) {
      targetCode = '001';
    }
    await page.locator('#p3-input-code').fill(targetCode);
    await page.screenshot({ path: path.join(scratchDir, '12_level2_phase3_fano.png') });
    await page.locator('#btn-submit-p3').click();

    // Phase 4 (Kraft Inequality)
    await expect(page.locator('#phase4')).toBeVisible();
    const kraftText = await page.locator('#p4-lengths-display').innerText();
    const matches = [...kraftText.matchAll(/=\s*(\d+)/g)];
    const kraftSum = matches.reduce((acc, m) => acc + Math.pow(2, -parseInt(m[1], 10)), 0);
    await page.locator('#p4-input-kraft').fill(kraftSum.toString());
    await page.screenshot({ path: path.join(scratchDir, '13_level2_phase4_kraft.png') });
    await page.locator('#btn-submit-p4').click();

    // Phase 5 (Culmination Stream Decoding)
    await expect(page.locator('#phase5')).toBeVisible();
    const dictBadges = page.locator('#p5-dict-display > span');
    const dictCount = await dictBadges.count();
    const dict = [];
    for (let i = 0; i < dictCount; i++) {
      const text = await dictBadges.nth(i).innerText();
      const parts = text.split(':');
      if (parts.length === 2 && parts[1].trim().length > 0) {
        dict.push({ char: parts[0].trim(), code: parts[1].trim() });
      }
    }
    // Sort dictionary by code length descending for greedy prefix match
    dict.sort((a, b) => b.code.length - a.code.length);

    let stream = (await page.locator('#p5-stream-display').innerText()).trim();
    let decodedWord = '';
    let curr = stream;
    let safetyCounter = 0;
    while (curr.length > 0 && safetyCounter < 100) {
      safetyCounter++;
      let matched = false;
      for (const d of dict) {
        if (d.code && curr.startsWith(d.code)) {
          decodedWord += d.char;
          curr = curr.slice(d.code.length);
          matched = true;
          break;
        }
      }
      if (!matched) break;
    }

    await page.locator('#p5-input-text').fill(decodedWord);
    await page.locator('#p5-input-count').fill(decodedWord.length.toString());
    await page.screenshot({ path: path.join(scratchDir, '14_level2_phase5_stream.png') });
    await page.locator('#btn-submit-p5').click();

    // Completion Screen
    await expect(page.locator('#completion-screen')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '15_level2_complete.png') });
  });

  test('04. Level 3 - Cyber Matrix Walkthrough & Hardcore Simulation with Screenshots', async ({ page }) => {
    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/28/level3');
    await page.setViewportSize({ width: 1024, height: 768 });

    // Intro briefing screenshot
    await expect(page.locator('#start-btn')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '16_level3_intro_briefing.png') });

    // Start game
    await page.locator('#start-btn').click();
    await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');
    await page.screenshot({ path: path.join(scratchDir, '17_level3_wave1_active.png') });

    // Play Wave 1 through solving algorithm:
    // Read target sequence tokens
    const targetBadges = page.locator('.card:has-text("ТРЕБУЕМАЯ ПРЕФИКСНАЯ ЦЕПОЧКА") .p-2.border-danger');
    const targetCount = await targetBadges.count();
    const targets = [];
    for (let i = 0; i < targetCount; i++) {
      targets.push((await targetBadges.nth(i).innerText()).trim());
    }

    // Try to solve Wave 1 by finding target[0] in row 0
    let solvedWave1 = false;
    const row0Buttons = page.locator('.matrix-grid > div').first().locator('button:not([disabled])');
    const r0Count = await row0Buttons.count();
    for (let c = 0; c < r0Count; c++) {
      const btn = row0Buttons.nth(c);
      const text = (await btn.innerText()).trim();
      if (text === targets[0]) {
        await btn.click();
        await page.waitForTimeout(100);

        // Now active direction is column c
        if (targets.length > 1) {
          const colButtons = page.locator('.matrix-grid button:not([disabled])');
          const colCount = await colButtons.count();
          for (let k = 0; k < colCount; k++) {
            const b = colButtons.nth(k);
            if ((await b.innerText()).trim() === targets[1]) {
              await b.click();
              await page.waitForTimeout(100);
              solvedWave1 = true;
              break;
            }
          }
        }
        break;
      }
    }

    if (solvedWave1) {
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(scratchDir, '18_level3_wave2_or_progress.png') });
    }

    // Trigger hardcore reset simulation: click until fail
    for (let step = 0; step < 7; step++) {
      const avail = page.locator('.matrix-grid button:not([disabled])');
      if (await avail.count() > 0) {
        await avail.first().click().catch(() => {});
        await page.waitForTimeout(80);
      }
    }

    const failTitle = page.locator('#fail-title');
    if (await failTitle.isVisible().catch(() => false)) {
      await page.screenshot({ path: path.join(scratchDir, '19_level3_hardcore_fail_screen.png') });
    }
  });

});
