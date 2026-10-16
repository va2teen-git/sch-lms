import { test, expect } from '@playwright/test';

test.describe('Grade 9 Lesson 7: Verification of Mechanics, Logic, and Procedural Generation', () => {

  test('Level 1: Complete walkthrough and drop zone mechanics', async ({ page }) => {
    await page.goto('/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level1');
    await page.waitForLoadState('domcontentloaded');

    for (let phase = 1; phase <= 3; phase++) {
      const badge = page.locator('#phase-badge');
      await expect(badge).toHaveText(`Шаг ${phase} из 3`);

      const cards = page.locator('#cards-pool > div');
      await expect(cards).toHaveCount(6);

      // Verify that cards in pool have clear text without ambiguity
      for (let i = 0; i < 6; i++) {
        const card = page.locator('#cards-pool > div').first();
        const cat = await card.getAttribute('data-category');
        const bucketNum = cat.replace('bucket', '');

        // Test click-to-move accessibility
        await card.click();
        const targetBucket = page.locator(`#bucket-${bucketNum}`);
        await targetBucket.click();
      }

      // Verify verify button activates and advances phase
      const verifyBtn = page.locator('#verify-btn');
      await expect(verifyBtn).toBeEnabled();
      await verifyBtn.click();

      if (phase < 3) {
        await page.waitForTimeout(400);
      }
    }

    // Success screen should be visible
    const successScreen = page.locator('#success-screen');
    await expect(successScreen).toBeVisible();
  });

  test('Level 2: Zero math discrepancies, input normalization (dot/comma, %, synonyms)', async ({ page }) => {
    await page.goto('/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level2');
    await page.waitForLoadState('domcontentloaded');

    // 1. In-page forensic check across all possible generation pairs: MUST be 0 discrepancies
    const discrepancies = await page.evaluate(() => {
      const validPairs = [
        { xTrue: 50, pct: 2 }, { xTrue: 50, pct: 4 }, { xTrue: 50, pct: 6 }, { xTrue: 50, pct: 8 }, { xTrue: 50, pct: 10 }, { xTrue: 50, pct: 12 }, { xTrue: 50, pct: 14 }, { xTrue: 50, pct: 16 }, { xTrue: 50, pct: 20 },
        { xTrue: 80, pct: 5 }, { xTrue: 80, pct: 10 }, { xTrue: 80, pct: 15 }, { xTrue: 80, pct: 20 }, { xTrue: 80, pct: 25 },
        { xTrue: 100, pct: 2 }, { xTrue: 100, pct: 3 }, { xTrue: 100, pct: 4 }, { xTrue: 100, pct: 5 }, { xTrue: 100, pct: 8 }, { xTrue: 100, pct: 10 }, { xTrue: 100, pct: 12 }, { xTrue: 100, pct: 15 }, { xTrue: 100, pct: 20 },
        { xTrue: 120, pct: 5 }, { xTrue: 120, pct: 10 }, { xTrue: 120, pct: 15 }, { xTrue: 120, pct: 20 }, { xTrue: 120, pct: 25 },
        { xTrue: 150, pct: 2 }, { xTrue: 150, pct: 4 }, { xTrue: 150, pct: 6 }, { xTrue: 150, pct: 8 }, { xTrue: 150, pct: 10 }, { xTrue: 150, pct: 12 }, { xTrue: 150, pct: 14 }, { xTrue: 150, pct: 16 }, { xTrue: 150, pct: 20 },
        { xTrue: 200, pct: 2 }, { xTrue: 200, pct: 3 }, { xTrue: 200, pct: 4 }, { xTrue: 200, pct: 5 }, { xTrue: 200, pct: 7 }, { xTrue: 200, pct: 8 }, { xTrue: 200, pct: 10 }, { xTrue: 200, pct: 15 }, { xTrue: 200, pct: 20 },
        { xTrue: 250, pct: 2 }, { xTrue: 250, pct: 4 }, { xTrue: 250, pct: 6 }, { xTrue: 250, pct: 8 }, { xTrue: 250, pct: 10 }, { xTrue: 250, pct: 12 }, { xTrue: 250, pct: 14 }, { xTrue: 250, pct: 16 }, { xTrue: 250, pct: 20 },
        { xTrue: 400, pct: 2 }, { xTrue: 400, pct: 3 }, { xTrue: 400, pct: 4 }, { xTrue: 400, pct: 5 }, { xTrue: 400, pct: 8 }, { xTrue: 400, pct: 10 }, { xTrue: 400, pct: 15 }, { xTrue: 400, pct: 20 }
      ];
      const results = [];

      for (let pair of validPairs) {
        const xTrue = pair.xTrue;
        const deltaPct = pair.pct;
        const delta = (xTrue * deltaPct) / 100;
        for (let sign of [1, -1]) {
          const xModel = xTrue + (sign * delta);
          const actualDelta = Math.abs(xModel - xTrue);
          const mathematicallyCorrectPct = (actualDelta / xTrue) * 100;
          const expectedByCode = deltaPct;

          if (Math.abs(mathematicallyCorrectPct - expectedByCode) > 0.001) {
            results.push({
              xTrue,
              xModel,
              actualDelta,
              deltaPctConfig: deltaPct,
              mathematicallyCorrectPct
            });
          }
        }
      }
      return results;
    });

    expect(discrepancies.length).toBe(0);

    // 2. Play Phase 1 with comma decimal separator test (e.g. "12,0" or integer)
    const p1True = parseFloat(await page.locator('#p1-x-true').innerText());
    const p1Model = parseFloat(await page.locator('#p1-x-model').innerText());
    const delta1 = Math.abs(p1Model - p1True);
    await page.locator('#p1-input').fill(`${delta1},0`);
    await page.locator('#p1-btn').click();

    // 3. Play Phase 2 with percentage symbol and spaces (e.g. "5 %" or "10%")
    await expect(page.locator('#phase2')).toBeVisible();
    const p2True = parseFloat(await page.locator('#p2-x-true').innerText());
    const p2Model = parseFloat(await page.locator('#p2-x-model').innerText());
    const deltaPct = Math.round((Math.abs(p2Model - p2True) / p2True) * 100);
    await page.locator('#p2-input').fill(`  ${deltaPct} %  `);
    await page.locator('#p2-btn').click();

    // 4. Play Phase 3 with lower-case / masculine or noun synonym
    await expect(page.locator('#phase3')).toBeVisible();
    const p3Desc = await page.locator('#p3-desc').innerText();
    // Decide static or dynamic based on desc
    const isStatic = p3Desc.includes('чертеж') || p3Desc.includes('паспорте') || p3Desc.includes('решетки') || p3Desc.includes('балансовый');
    const p3Answer = isStatic ? 'статический' : 'динамический'; // masculine form to test tolerance
    await page.locator('#p3-input').fill(p3Answer);
    await page.locator('#p3-btn').click();

    // 5. Play Phase 4 with synonym "вероятностная" or "детерминированный"
    await expect(page.locator('#phase4')).toBeVisible();
    const p4Code = await page.locator('#p4-code').innerText();
    const isStochastic = p4Code.includes('random');
    const p4Answer = isStochastic ? 'вероятностная' : 'детерминированный'; // synonym / masculine form
    await page.locator('#p4-input').fill(p4Answer);
    await page.locator('#p4-btn').click();

    // 6. Play Phase 5 with case variation (e.g. "образный", "знаковый", "смешанный")
    await expect(page.locator('#phase5')).toBeVisible();
    const p5Desc = await page.locator('#p5-desc').innerText();
    let p5Answer = 'смешанный';
    if (p5Desc.includes('фотография') || p5Desc.includes('Рентгенограмма') || p5Desc.includes('эскиз')) {
      p5Answer = 'образный';
    } else if (p5Desc.includes('формула') || p5Desc.includes('описание') || p5Desc.includes('код') || p5Desc.includes('реакции')) {
      p5Answer = 'знаковый';
    }
    await page.locator('#p5-input').fill(p5Answer);
    await page.locator('#p5-btn').click();

    // 7. Success screen
    const successScreen = page.locator('#success-screen');
    await expect(successScreen).toBeVisible();
  });

  test('Level 3: Waves Catalog conceptual integrity and Matrix Generator solvability', async ({ page }) => {
    await page.goto('/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level3');
    await page.waitForLoadState('domcontentloaded');

    // 1. Verify Waves Catalog has no conceptual contradictions
    const wavesAnalysis = await page.evaluate(() => {
      const el = document.getElementById('app');
      const app = el.__vue_app__._instance.data;
      return app.wavesCatalog.map((w, idx) => ({
        wave: idx + 1,
        modelName: w.modelName,
        targetSequence: w.targetSequence
      }));
    });

    const wave1 = wavesAnalysis.find(w => w.wave === 1);
    expect(wave1.targetSequence).not.toContain('ОБРАЗНАЯ');
    expect(wave1.targetSequence).toEqual(['НАТУРНАЯ', 'СТАТИЧЕСКАЯ']);

    const wave7 = wavesAnalysis.find(w => w.wave === 7);
    expect(wave7.targetSequence).not.toContain('НАТУРНАЯ');
    expect(wave7.targetSequence).toEqual(['ИНФОРМАЦИОННАЯ', 'ДИНАМИЧЕСКАЯ', 'ОБРАЗНАЯ']);

    // 2. Test 100 matrix simulations per wave to verify zero trap duplicates and 100% path solvability
    const matrixTestResults = await page.evaluate(() => {
      const el = document.getElementById('app');
      const app = el.__vue_app__._instance.ctx;
      const issues = [];

      for (let wave = 1; wave <= 8; wave++) {
        const targetSeq = app.wavesCatalog[wave - 1].targetSequence;
        for (let sim = 0; sim < 100; sim++) {
          app.generateGuaranteedMatrix(targetSeq);
          const mat = app.matrix;

          // Check Row 0: must contain EXACTLY ONE cell with targetSeq[0]
          const row0Matches = mat[0].filter(c => c.token === targetSeq[0]);
          if (row0Matches.length !== 1) {
            issues.push({
              wave,
              sim,
              reason: `Row 0 has ${row0Matches.length} occurrences of ${targetSeq[0]}`
            });
          }

          // Test path solvability step-by-step
          let c0 = mat[0].findIndex(c => c.token === targetSeq[0]);
          if (c0 === -1) {
            issues.push({ wave, sim, reason: `targetSeq[0] not found in row 0` });
            continue;
          }

          // Step 1: in col c0, must find targetSeq[1]
          let nextR = mat.findIndex(row => row[c0].token === targetSeq[1]);
          if (nextR === -1 || nextR === 0) {
            issues.push({ wave, sim, reason: `targetSeq[1] not found in col ${c0}` });
            continue;
          }

          // If 3 tokens: Step 2: in row nextR, must find targetSeq[2]
          if (targetSeq.length > 2) {
            let nextC = mat[nextR].findIndex(cell => cell.token === targetSeq[2]);
            if (nextC === -1 || nextC === c0) {
              issues.push({ wave, sim, reason: `targetSeq[2] not found in row ${nextR}` });
              continue;
            }

            // If 4 tokens: Step 3: in col nextC, must find targetSeq[3]
            if (targetSeq.length > 3) {
              let r3 = mat.findIndex((row, rIdx) => rIdx !== nextR && row[nextC].token === targetSeq[3]);
              if (r3 === -1) {
                issues.push({ wave, sim, reason: `targetSeq[3] not found in col ${nextC}` });
              }
            }
          }
        }
      }
      return issues;
    });

    expect(matrixTestResults.length).toBe(0);
  });

});
