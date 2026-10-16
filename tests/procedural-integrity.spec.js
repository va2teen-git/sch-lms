import { test, expect } from '@playwright/test';
import { 
  verifyMathInvariants, 
  generateInputMutations, 
  verifyMatrixProceduralSolvability, 
  lintOntologySequence,
  INFORMATICS_ONTOLOGY_RULES 
} from './procedural-contracts.js';

test.describe('Universal Procedural & Interaction Integrity Suite (School LMS Contracts)', () => {

  // =========================================================================
  // CONTRACT 1: Math Procedural Invariant & Generation Verification
  // =========================================================================
  test('Contract 1: Mathematical procedural generation produces zero discrepancies and integer delta', async ({ page }) => {
    // Grade 9, Lesson 7, Level 2: Relative and Absolute error calculations
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

    const formula = (xTrue, xModel) => (Math.abs(xModel - xTrue) / xTrue) * 100;

    const issues = verifyMathInvariants({
      pairs: validPairs,
      formula,
      isIntegerExpected: true,
      tolerance: 0.0001
    });

    expect(issues, `Found ${issues.length} mathematical discrepancies in procedural pairs: ${JSON.stringify(issues.slice(0, 3), null, 2)}`).toHaveLength(0);
  });

  // =========================================================================
  // CONTRACT 2: Input Robustness & Linguistic Tolerance Fuzzing
  // =========================================================================
  test('Contract 2: Input fields tolerate comma, %, spaces, morphological variations and synonyms', async ({ page }) => {
    await page.goto('/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level2');
    await page.waitForLoadState('domcontentloaded');

    // 2.1 Verify input elements do not block localized comma by using raw type="number"
    const p1Type = await page.locator('#p1-input').getAttribute('type');
    const p2Type = await page.locator('#p2-input').getAttribute('type');
    expect(p1Type, 'p1-input should not be type="number" which blocks comma/percent').not.toBe('number');
    expect(p2Type, 'p2-input should not be type="number" which blocks comma/percent').not.toBe('number');

    // 2.2 Fuzzing Phase 1 numeric input with commas and spaces
    const p1True = parseFloat(await page.locator('#p1-x-true').innerText());
    const p1Model = parseFloat(await page.locator('#p1-x-model').innerText());
    const delta1 = Math.abs(p1Model - p1True);
    const p1Mutations = generateInputMutations(delta1, 'number');

    // Test a comma mutation: e.g. "4,0" or "4"
    await page.locator('#p1-input').fill(`${delta1},0`);
    await page.locator('#p1-btn').click();
    await expect(page.locator('#phase2')).toBeVisible();

    // 2.3 Fuzzing Phase 2 with percent suffix and whitespace: e.g. "  5 %  "
    const p2True = parseFloat(await page.locator('#p2-x-true').innerText());
    const p2Model = parseFloat(await page.locator('#p2-x-model').innerText());
    const deltaPct = Math.round((Math.abs(p2Model - p2True) / p2True) * 100);
    await page.locator('#p2-input').fill(`   ${deltaPct}%   `);
    await page.locator('#p2-btn').click();
    await expect(page.locator('#phase3')).toBeVisible();

    // 2.4 Fuzzing Phase 3 with masculine/noun inflection: e.g. "статический" instead of "СТАТИЧЕСКАЯ"
    const p3Desc = await page.locator('#p3-desc').innerText();
    const isStatic = p3Desc.includes('чертеж') || p3Desc.includes('паспорте') || p3Desc.includes('решетки') || p3Desc.includes('балансовый');
    const p3Answer = isStatic ? 'статический' : 'динамический';
    await page.locator('#p3-input').fill(p3Answer);
    await page.locator('#p3-btn').click();
    await expect(page.locator('#phase4')).toBeVisible();

    // 2.5 Fuzzing Phase 4 with Russian textbook synonym: "вероятностная" instead of "СТОХАСТИЧЕСКАЯ"
    const p4Code = await page.locator('#p4-code').innerText();
    const isStochastic = p4Code.includes('random');
    const p4Answer = isStochastic ? 'вероятностная' : 'детерминированный';
    await page.locator('#p4-input').fill(p4Answer);
    await page.locator('#p4-btn').click();
    await expect(page.locator('#phase5')).toBeVisible();

    // 2.6 Fuzzing Phase 5 with lower-case / inflected form: "образный", "знаковый", "смешанный"
    const p5Desc = await page.locator('#p5-desc').innerText();
    let p5Answer = 'смешанный';
    if (p5Desc.includes('фотография') || p5Desc.includes('Рентгенограмма') || p5Desc.includes('эскиз')) {
      p5Answer = 'образный';
    } else if (p5Desc.includes('формула') || p5Desc.includes('описание') || p5Desc.includes('код') || p5Desc.includes('реакции')) {
      p5Answer = 'знаковый';
    }
    await page.locator('#p5-input').fill(p5Answer);
    await page.locator('#p5-btn').click();

    // Successfully reached end
    await expect(page.locator('#success-screen')).toBeVisible();
  });

  // =========================================================================
  // CONTRACT 3: Matrix / Graph Solvability & Trap-Free Engine
  // =========================================================================
  test('Contract 3: Cyber Matrix generates 100% trap-free, reachable paths without duplicate start tokens', async ({ page }) => {
    await page.goto('/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level3');
    await page.waitForLoadState('domcontentloaded');

    // Run in-page Monte Carlo analysis using the page's exact generator and wave catalog
    const simulationResults = await page.evaluate(() => {
      const el = document.getElementById('app');
      const app = el.__vue_app__._instance.ctx;
      const issues = [];

      for (let wave = 1; wave <= app.wavesCatalog.length; wave++) {
        const targetSeq = app.wavesCatalog[wave - 1].targetSequence;

        for (let sim = 0; sim < 100; sim++) {
          app.generateGuaranteedMatrix(targetSeq);
          const mat = app.matrix;

          // Invariant 1: Row 0 has exactly ONE cell with targetSeq[0]
          const row0Matches = mat[0].filter(c => c.token === targetSeq[0]);
          if (row0Matches.length !== 1) {
            issues.push({
              wave,
              sim,
              reason: `Row 0 contains ${row0Matches.length} occurrences of starting token "${targetSeq[0]}"`
            });
            continue;
          }

          // Invariant 2: Step-by-step traversal along active lines
          let curR = 0;
          let curC = mat[0].findIndex(c => c.token === targetSeq[0]);
          let curMode = 'col';
          const visited = new Set([`0,${curC}`]);
          let solved = true;

          for (let step = 1; step < targetSeq.length; step++) {
            const expectedToken = targetSeq[step];

            if (curMode === 'col') {
              let foundRow = -1;
              for (let r = 0; r < 4; r++) {
                if (r !== curR && mat[r][curC].token === expectedToken && !visited.has(`${r},${curC}`)) {
                  foundRow = r;
                  break;
                }
              }

              if (foundRow === -1) {
                issues.push({ wave, sim, step, reason: `Token "${expectedToken}" not found in column ${curC}` });
                solved = false;
                break;
              }

              visited.add(`${foundRow},${curC}`);
              curR = foundRow;
              curMode = 'row';
            } else {
              let foundCol = -1;
              for (let c = 0; c < 4; c++) {
                if (c !== curC && mat[curR][c].token === expectedToken && !visited.has(`${curR},${c}`)) {
                  foundCol = c;
                  break;
                }
              }

              if (foundCol === -1) {
                issues.push({ wave, sim, step, reason: `Token "${expectedToken}" not found in row ${curR}` });
                solved = false;
                break;
              }

              visited.add(`${curR},${foundCol}`);
              curC = foundCol;
              curMode = 'col';
            }
          }

          if (solved && visited.size !== targetSeq.length) {
            issues.push({ wave, sim, reason: `Visited cells count ${visited.size} != target length ${targetSeq.length}` });
          }
        }
      }

      return issues;
    });

    expect(simulationResults, `Detected ${simulationResults.length} matrix solvability defects: ${JSON.stringify(simulationResults.slice(0, 3), null, 2)}`).toHaveLength(0);
  });

  // =========================================================================
  // CONTRACT 4: Ontological Domain Taxonomy Integrity
  // =========================================================================
  test('Contract 4: Task catalog adheres to domain taxonomy rules without conceptual contradictions', async ({ page }) => {
    await page.goto('/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level3');
    await page.waitForLoadState('domcontentloaded');

    // Extract Waves Catalog
    const wavesCatalog = await page.evaluate(() => {
      const el = document.getElementById('app');
      return el.__vue_app__._instance.data.wavesCatalog;
    });

    const violations = [];
    for (const wave of wavesCatalog) {
      const v = lintOntologySequence(wave.targetSequence, INFORMATICS_ONTOLOGY_RULES);
      if (v.length > 0) {
        violations.push({ wave: wave.modelName, violations: v });
      }
    }

    expect(violations, `Found ontological contradictions in tasks catalog: ${JSON.stringify(violations, null, 2)}`).toHaveLength(0);
  });

  // =========================================================================
  // CONTRACT 5: UI Hit-Testing & Click-Delegation Robustness
  // =========================================================================
  test('Contract 5: Click-to-move and Drag-and-Drop work reliably on headers, slots, and nested cards', async ({ page }) => {
    await page.goto('/tasks/9-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/7/level1');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#cards-pool > div')).toHaveCount(6);

    // 1. Select first card in pool
    const firstCard = page.locator('#cards-pool > div').first();
    const targetCat = await firstCard.getAttribute('data-category');
    const bucketId = `#${targetCat.replace('bucket', 'bucket-')}`;
    await firstCard.click();

    // 2. Click on the header of the bucket (not empty slot)
    const bucketHeader = page.locator(`${bucketId} .card-header`);
    await bucketHeader.click();

    // Verify card successfully moved to bucket slot
    const slotCards = page.locator(`${bucketId} .bucket-slot > div`);
    await expect(slotCards).toHaveCount(1);

    // 3. Move second card by clicking on an ALREADY placed card in the bucket
    const secondCard = page.locator('#cards-pool > div').first();
    const secondCat = await secondCard.getAttribute('data-category');
    const secondBucketId = `#${secondCat.replace('bucket', 'bucket-')}`;
    await secondCard.click();

    // If second card is for the same bucket, click on the existing card inside the slot!
    if (secondCat === targetCat) {
      const placedCard = page.locator(`${secondBucketId} .bucket-slot > div`).first();
      await placedCard.click();
      await expect(page.locator(`${secondBucketId} .bucket-slot > div`)).toHaveCount(2);
    } else {
      const targetBucket = page.locator(secondBucketId);
      await targetBucket.click();
      await expect(page.locator(`${secondBucketId} .bucket-slot > div`)).toHaveCount(1);
    }

    // Move remaining cards to verify full phase completion
    while (await page.locator('#cards-pool > div').count() > 0) {
      const card = page.locator('#cards-pool > div').first();
      const cat = await card.getAttribute('data-category');
      const bId = `#${cat.replace('bucket', 'bucket-')}`;
      await card.click();
      await page.locator(bId).click();
    }

    const verifyBtn = page.locator('#verify-btn');
    await expect(verifyBtn).toBeEnabled();
    await verifyBtn.click();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
  });

});
