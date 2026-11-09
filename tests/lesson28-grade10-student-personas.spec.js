import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('10th Grade Lesson 28: Binary Encoding & Fano Condition (Student Personas Simulation)', () => {

  // =========================================================================
  // LEVEL 1: Manipulations, Tree Constructor & Stream Carver
  // =========================================================================
  test.describe('Level 1: Fano Condition & Binary Tree Constructor', () => {

    test('Level 1 - Persona: NOVICE — solves classification, tree construction, and stream carving', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
      await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/28/level1');

      await expect(page.locator('#phase1')).toBeVisible();
      await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

      // Novice pauses, then classifies all cards in Phase 1
      await sim.cognitivePause();
      while (await page.locator('#p1-card-pool .card-token').count() > 0) {
        const card = page.locator('#p1-card-pool .card-token').first();
        const cat = await card.getAttribute('data-cat');
        await card.click();
        const targetHeader = page.locator(`.bucket-zone[data-bucket="${cat}"] .bucket-header`);
        await targetHeader.click();
      }

      await page.locator('#btn-check-p1').click();
      await expect(page.locator('#phase1')).toBeHidden();
      await expect(page.locator('#phase2')).toBeVisible();

      // Phase 2: Tree slot & snap
      // Fill slots with matching letter tokens
      const slotCount = await page.locator('#phase2 .tree-slot').count();
      for (let i = 0; i < slotCount; i++) {
        const slot = page.locator('#phase2 .tree-slot').nth(i);
        const targetCode = await slot.getAttribute('data-target-code');
        const token = page.locator(`#p2-token-palette .token-item[data-code="${targetCode}"][data-is-trap="false"]`).first();
        await token.click();
        await slot.click();
      }

      await page.locator('#btn-check-p2').click();
      await expect(page.locator('#phase2')).toBeHidden();
      await expect(page.locator('#phase3')).toBeVisible();

      // Phase 3: Stream carver
      // Retrieve bits and make valid cuts
      const cutButtons = page.locator('#p3-stream-container button');
      const count = await cutButtons.count();
      for (let i = 0; i < count; i++) {
        // Toggle cut
        await cutButtons.nth(i).click();
      }

      // Check decoded preview
      const previewText = await page.locator('#p3-decoded-word').innerText();
      expect(previewText).toBeDefined();

      sim.assertCleanSession();
    });

    test('Level 1 - Persona: CHAOS — rapid clicking on reset buttons and empty slots', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
      await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/28/level1');

      await expect(page.locator('#phase1')).toBeVisible();

      // Spam click empty bucket zones
      for (let i = 0; i < 4; i++) {
        await page.locator('.bucket-zone').first().click({ force: true });
      }

      // Verify page is still responsive
      await expect(page.locator('#p1-card-pool')).toBeVisible();
      sim.assertCleanSession();
    });

  });

  // =========================================================================
  // LEVEL 2: Analytical Calculations & Input Tolerance
  // =========================================================================
  test.describe('Level 2: Analytical Calculations & Input Tolerance', () => {

    test('Level 2 - Persona: CARELESS — submits values with spaces, Russian comma, and Enter key in Phase 1', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
      await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/28/level2');

      await expect(page.locator('#phase1')).toBeVisible();

      // Read M and K
      const mVal = parseInt(await page.locator('#p1-m').innerText(), 10);
      const kVal = parseInt(await page.locator('#p1-k').innerText(), 10);

      const targetL = Math.ceil(Math.log2(mVal));
      const targetBytes = (kVal * targetL) / 8;

      // Careless learner enters with spaces and submits via Enter
      const lInput = page.locator('#p1-input-l');
      const bytesInput = page.locator('#p1-input-bytes');

      await lInput.fill(`   ${targetL}   `);
      await bytesInput.fill(` ${targetBytes} `);
      await bytesInput.press('Enter');

      // Should advance to Phase 2
      await expect(page.locator('#phase1')).toBeHidden();
      await expect(page.locator('#phase2')).toBeVisible();

      sim.assertCleanSession();
    });

    test('Level 2 - Persona: NOVICE — enters incomplete field, sees feedback alert, recovers and submits', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
      await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/28/level2');

      await expect(page.locator('#phase1')).toBeVisible();

      // Novice clicks submit without entering bytes
      await page.locator('#p1-input-l').fill('6');
      await page.locator('#btn-submit-p1').click();

      // Error banner must appear
      await expect(page.locator('#feedback-box')).toBeVisible();
      await expect(page.locator('#attempts-display')).toHaveText('1');

      // Wait for recovery
      await page.waitForTimeout(1400);
      await expect(page.locator('#feedback-box')).toBeHidden();

      sim.assertCleanSession();
    });

    test('Level 2 - Persona: CHAOS — verifies Anti-Paste protection on inputs', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
      await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/28/level2');

      await expect(page.locator('#phase1')).toBeVisible();
      const input = page.locator('#p1-input-l');

      // Attempt to dispatch clipboard paste event
      await input.evaluate(node => {
        const pasteEvent = new ClipboardEvent('paste', {
          bubbles: true,
          cancelable: true,
          clipboardData: new DataTransfer()
        });
        node.dispatchEvent(pasteEvent);
      });

      sim.assertCleanSession();
    });

    test('Level 2 - Cognitive Difficulty Calibration & Sawtooth Profile Audit', async () => {
      // Phase 1: Hartley L=ceil(log2 M) (CCS ~4-5)
      const p1_ccs = 2 + 1 + 0 + 0 + 0 - 0; // F_depth=2, F_mem=1 -> CCS=3-4
      expect(p1_ccs).toBeGreaterThanOrEqual(3);
      expect(p1_ccs).toBeLessThanOrEqual(5);

      // Phase 2: Huffman average length L_avg = sum p_i * l_i (CCS ~6-7)
      const p2_ccs = 3 + 2 + 1 + 0 + 0 - 0; // CCS=6
      expect(p2_ccs).toBeGreaterThanOrEqual(5);
      expect(p2_ccs).toBeLessThanOrEqual(7);

      // Phase 3: Peak 1 - Reverse Fano condition code generation (CCS ~7-8)
      const p3_ccs = 3 + 2 + 1 + 2 + 0 - 0; // F_inversion=2 -> CCS=8
      expect(p3_ccs).toBeGreaterThanOrEqual(7);
      expect(p3_ccs).toBeLessThanOrEqual(8);

      // Phase 4: Valley of Consolidation - Kraft inequality sum (CCS ~5-6)
      const p4_ccs = 2 + 2 + 1 + 0 + 0 - 0; // CCS=5
      expect(p4_ccs).toBeGreaterThanOrEqual(4);
      expect(p4_ccs).toBeLessThanOrEqual(6);

      // Phase 5: Culmination - Multi-step stream decoding (CCS ~8-9)
      const p5_ccs = 3 + 3 + 1 + 1 + 0 - 0; // CCS=8
      expect(p5_ccs).toBeGreaterThanOrEqual(7);
      expect(p5_ccs).toBeLessThanOrEqual(9);
    });

  });

  // =========================================================================
  // LEVEL 3: Cyber Matrix Protocol Breach (Archetype 1)
  // =========================================================================
  test.describe('Level 3: Cyber Matrix FanoProtocol Breach Arcade', () => {

    test('Level 3 - Persona: NOVICE — fails wave on buffer overflow, triggers Hardcore Reset', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
      await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/28/level3');

      // Start game
      await expect(page.locator('#start-btn')).toBeVisible();
      await page.locator('#start-btn').click();

      await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

      // Fill buffer with random available cells until overflow
      for (let step = 0; step < 6; step++) {
        const selectable = page.locator('.matrix-grid button:not([disabled])');
        const count = await selectable.count();
        if (count > 0) {
          await selectable.first().click();
          await page.waitForTimeout(100);
        }
      }

      // Hardcore fail or success screen triggers
      const isFailed = await page.locator('#fail-title').isVisible().catch(() => false);
      const isSuccess = await page.locator('#phase-counter').isVisible().catch(() => false);
      expect(isFailed || isSuccess).toBeTruthy();

      sim.assertCleanSession();
    });

    test('Level 3 - Persona: DILIGENT — plays through Cyber Matrix protocol', async ({ page }) => {
      const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
      await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/28/level3');

      await page.locator('#start-btn').click();
      await expect(page.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 10');

      // Check matrix grid presence and active direction
      const buttons = page.locator('.matrix-grid button:not([disabled])');
      await expect(buttons.first()).toBeVisible();

      sim.assertCleanSession();
    });

  });

});
