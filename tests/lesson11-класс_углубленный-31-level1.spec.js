import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 31: Level 1 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/31/level1.astro');

  test('Level 1 adheres to architectural requirements', async () => {
    expect(fs.existsSync(taskPath), 'level1.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}>');

    // 3 phases
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 31');

    // Zero-style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Zero Multiple Choice Policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Direct manipulation mechanics
    // Phase 1: Separate Chaining with Collision Filtration
    expect(code).toContain('p1-token-palette');
    expect(code).toContain('p1-buckets-grid');
    expect(code).toContain('p1-verify-btn');

    // Phase 2: Open Addressing with Tombstone Marker
    expect(code).toContain('p2-cells-strip');
    expect(code).toContain('p2-verify-btn');
    expect(code).toContain('Tombstone');
    expect(code).toContain('[DEL]');

    // Phase 3: Alphabetical-Frequency Dictionary with Two-Criteria Order
    expect(code).toContain('p3-tokens-flow');
    expect(code).toContain('p3-counter-cards');
    expect(code).toContain('p3-rank-palette');
    expect(code).toContain('p3-rank-slots');
    expect(code).toContain('p3-verify-btn');
  });

  test('Level 1 full interactive walkthrough in browser', async ({ page }) => {
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level1');

    // --- Phase 1: Separate Chaining & Collision Resolution ---
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    // Retrieve valid tokens from state
    const validTokens = await page.evaluate(() => {
      return window.__DEV_LEVEL1_STATE__ ? window.__DEV_LEVEL1_STATE__.getP1ValidTokens() : [];
    });
    expect(validTokens.length).toBe(4);

    for (const t of validTokens) {
      const tokenBtn = page.locator(`.btn[data-token-id="${t.id}"]`);
      await expect(tokenBtn).toBeVisible();
      await tokenBtn.click();

      // Click the empty slot or append button for the expected bucket
      const bucketIndex = t.expectedBucket;
      const emptySlot = page.locator(`#p1-slot-${bucketIndex}`);
      const appendBtn = page.locator(`#p1-append-${bucketIndex}`);

      if (await emptySlot.isVisible()) {
        await emptySlot.click();
      } else {
        await appendBtn.click();
      }
    }

    await page.locator('#p1-verify-btn').click();

    // --- Phase 2: Open Addressing with Tombstone Marker ---
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');

    const deleteTarget = await page.evaluate(() => {
      return window.__DEV_LEVEL1_STATE__ ? window.__DEV_LEVEL1_STATE__.getP2Delete() : null;
    });
    expect(deleteTarget).not.toBeNull();

    // Click on target cell to toggle it into [DEL] (Tombstone)
    const delCell = page.locator(`#p2-cell-${deleteTarget.idx}`);
    await expect(delCell).toBeVisible();
    await delCell.click();

    // Select this deleted cell as insert target for incoming key
    const insertBtn = page.locator(`#p2-insert-btn-${deleteTarget.idx}`);
    await expect(insertBtn).toBeVisible();
    await insertBtn.click();

    await page.locator('#p2-verify-btn').click();

    // --- Phase 3: Frequency Dictionary Ranking ---
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');

    const p3Data = await page.evaluate(() => {
      const state = window.__DEV_LEVEL1_STATE__;
      return {
        words: state.getP3Words(),
        trueFreq: state.getP3TrueFreq(),
        ranking: state.getP3ExpectedRanking()
      };
    });

    // Step 1: Set correct counters
    for (const word of p3Data.words) {
      const targetCount = p3Data.trueFreq[word];
      const incBtn = page.locator(`#p3-inc-${word}`);
      for (let i = 0; i < targetCount; i++) {
        await incBtn.click();
      }
    }

    // Step 2: Rank words into slots 0..3
    for (let r = 0; r < 4; r++) {
      const expectedWord = p3Data.ranking[r];
      const chip = page.locator(`#p3-chip-${expectedWord}`);
      await expect(chip).toBeVisible();
      await chip.click();

      const rankSlot = page.locator(`#p3-rank-slot-${r}`);
      await rankSlot.click();
    }

    await page.locator('#p3-verify-btn').click();

    // --- Victory Screen ---
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('h2', { hasText: 'Архитектурный рубеж преодолён!' })).toBeVisible();
  });
});
