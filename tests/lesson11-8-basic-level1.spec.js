import { test, expect } from '@playwright/test';

test.describe('Grade 11 Basic Lesson 8: Personal Archive Management Level 1', () => {
  const taskUrl = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level1';

  test('Zero Multiple Choice check: no radio buttons or select dropdowns', async ({ page }) => {
    await page.goto(taskUrl);
    
    // Ensure no multiple-choice input elements
    const radios = await page.locator('input[type="radio"]').count();
    expect(radios).toBe(0);

    const selects = await page.locator('select').count();
    expect(selects).toBe(0);
  });

  test('Phase 1: Bucket sorting of files by Lossless vs Lossy compression', async ({ page }) => {
    await page.goto(taskUrl);
    
    await expect(page.locator('#phase-1-container')).toBeVisible();
    await expect(page.locator('#p1-cards-pool')).toBeVisible();

    // Check 4 cards in pool
    const cards = page.locator('#p1-cards-pool .phase1-card');
    await expect(cards).toHaveCount(4);

    // Place each card into correct bucket using click-to-slot
    for (let i = 0; i < 4; i++) {
      const card = page.locator('#p1-cards-pool .phase1-card').first();
      const expectedType = await card.getAttribute('data-expected-type');
      expect(['lossless', 'lossy']).toContain(expectedType);

      await card.click();
      const dropzone = page.locator(`#bucket-${expectedType} .bucket-slots`);
      await dropzone.click();
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

  test('Phase 2: Topology construction for 3-2-1-1-0 architecture', async ({ page }) => {
    await page.goto(taskUrl);

    // Solve phase 1 via test hook or clicks
    await page.evaluate(() => window.__DEV_LEVEL1_STATE__.solvePhase1());

    await expect(page.locator('#phase-2-container')).toBeVisible();
    const tokens = page.locator('#p2-tokens-pool .device-token');
    await expect(tokens).toHaveCount(8);

    // Solve phase 2 via click-to-slot
    const slots = ['original', 'local_backup', 'offsite', 'airgap'];
    for (const slotName of slots) {
      const matchToken = page.locator(`.device-token[data-expected-slot="${slotName}"]`);
      await matchToken.click();
      const targetSlot = page.locator(`.slot-target[data-slot="${slotName}"]`);
      await targetSlot.click();
    }

    const verifyBtn = page.locator('#p2-verify-btn');
    await expect(verifyBtn).toBeEnabled();
    await verifyBtn.click();

    // Should advance to Phase 3
    await expect(page.locator('#phase-2-container')).toBeHidden();
    await expect(page.locator('#phase-3-container')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');
  });

  test('Phase 3: Calibrator and regulatory policy verification', async ({ page }) => {
    await page.goto(taskUrl);

    // Advance to Phase 3
    await page.evaluate(() => {
      window.__DEV_LEVEL1_STATE__.solvePhase1();
      window.__DEV_LEVEL1_STATE__.solvePhase2();
    });

    await expect(page.locator('#phase-3-container')).toBeVisible();

    // Set RPO slider to 1 hour
    await page.locator('#slider-rpo').fill('1');
    await page.locator('#slider-rpo').dispatchEvent('input');

    // Set retention slider to 35 days
    await page.locator('#slider-retention').fill('35');
    await page.locator('#slider-retention').dispatchEvent('input');

    // Toggle format to PDF/A
    const formatBtn = page.locator('#toggle-format-btn');
    await formatBtn.click();
    await expect(formatBtn).toHaveAttribute('data-state', 'pdfa');

    // Toggle signature to KEP (pep -> nep -> kep)
    const sigBtn = page.locator('#toggle-sig-btn');
    await sigBtn.click(); // to nep
    await sigBtn.click(); // to kep
    await expect(sigBtn).toHaveAttribute('data-state', 'kep');

    // Toggle hash to SHA-256
    const hashBtn = page.locator('#toggle-hash-btn');
    await hashBtn.click();
    await expect(hashBtn).toHaveAttribute('data-state', 'sha256');

    // Listen for telemetry
    const telemetryPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        window.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'TELEMETRY_EVENT' && e.data.action_type === 'level_complete') {
            resolve(e.data);
          }
        });
      });
    });

    await page.locator('#p3-verify-btn').click();

    const telemetry = await telemetryPromise;
    expect(telemetry.success).toBe(true);
    expect(telemetry.action_type).toBe('level_complete');

    // Final screen check
    await expect(page.locator('#final-screen')).toBeVisible();
  });
});
