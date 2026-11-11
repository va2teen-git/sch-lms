import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 30: Level 1 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/30/level1.astro');

  test('Level 1 adheres to architectural requirements', async () => {
    expect(fs.existsSync(taskPath), 'level1.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={1}>');

    // 3 distinct phases
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 30');

    // Zero-Style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Zero Multiple Choice Policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Physical manipulation mechanics
    // Phase 1: Slot & Snap binary tree
    expect(code).toContain('p1-token-pool');
    expect(code).toContain('p1-tree-root');
    expect(code).toContain('p1-submit-btn');

    // Phase 2: Markov Wiring
    expect(code).toContain('p2-code-table');
    expect(code).toContain('p2-edge-pool');
    expect(code).toContain('p2-slots-container');
    expect(code).toContain('p2-trace-btn');
    expect(code).toContain('p2-submit-btn');

    // Phase 3: Bit Stream Carver
    expect(code).toContain('p3-tape-container');
    expect(code).toContain('p3-segments-preview');
    expect(code).toContain('p3-submit-btn');
  });

  test('Level 1 full interactive walkthrough with telemetry verification', async ({ page }) => {
    // Intercept telemetry messages
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryEventMock', (evt) => {
      telemetryEvents.push(evt);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryEventMock(event.data);
        }
      });
    });

    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level1');

    // --- PHASE 1: Slot & Snap Binary Tree ---
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    // Identify targets and empty slots
    const slotTargets = page.locator('.p1-slot-target');
    const slotCount = await slotTargets.count();
    expect(slotCount).toBeGreaterThan(0);

    // Read target letters directly from visible task UI badge
    const targetLettersText = await page.locator('#p1-target-letters').innerText();
    const targets = targetLettersText.split(',').map(s => s.trim());

    for (let i = 0; i < slotCount; i++) {
      const tokName = targets[i];
      const tokBtn = page.locator(`.p1-token-item[data-token="${tokName}"]`);
      await tokBtn.click();
      await slotTargets.nth(i).click();
    }

    const p1SubmitBtn = page.locator('#p1-submit-btn');
    await expect(p1SubmitBtn).toBeEnabled();
    await p1SubmitBtn.click();

    // --- PHASE 2: Markov Wiring ---
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');

    // Solve Markov Wiring
    const p2Slots = page.locator('.p2-slot-target');
    const p2SlotCount = await p2Slots.count();

    const slotMappings = await page.evaluate(() => {
      // @ts-ignore
      return window.__DEV_P2_CONFIG__ ? window.__DEV_P2_CONFIG__.slots : [{ slotId: 's1', targetId: 'e1' }, { slotId: 's2', targetId: 'e2' }];
    });

    for (const sm of slotMappings) {
      const edgeBtn = page.locator(`.p2-edge-item[data-edge-id="${sm.targetId}"]`);
      await edgeBtn.click();
      const slotEl = page.locator(`.p2-slot-target[data-slot-id="${sm.slotId}"]`);
      await slotEl.click();
    }

    // Run trace
    const p2TraceBtn = page.locator('#p2-trace-btn');
    await expect(p2TraceBtn).toBeEnabled();
    await p2TraceBtn.click();

    // Wait for trace results and click submit
    const p2SubmitBtn = page.locator('#p2-submit-btn');
    await expect(p2SubmitBtn).toBeVisible({ timeout: 4000 });
    await p2SubmitBtn.click();

    // --- PHASE 3: Stream Carver ---
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');

    // Read dictionary codes
    const dictBadges = page.locator('#p3-dict-display > div');
    const dictCount = await dictBadges.count();
    const dictionary = [];
    for (let d = 0; d < dictCount; d++) {
      const text = await dictBadges.nth(d).innerText();
      // Format: "Буква А:\n0"
      const match = text.match(/Буква\s+([А-ЯЁ]):\s*([01]+)/);
      if (match) {
        dictionary.push({ letter: match[1], code: match[2] });
      }
    }
    // Sort dictionary by code length descending for greedy match
    dictionary.sort((a, b) => b.code.length - a.code.length);

    // Read bitstream from cells
    const bitCells = page.locator('#p3-tape-container > div.d-flex.align-items-center');
    const bitCount = await bitCells.count();
    let bitStream = '';
    for (let b = 0; b < bitCount; b++) {
      bitStream += (await bitCells.nth(b).innerText()).trim();
    }

    // Greedily parse stream from left to right
    const cutButtons = page.locator('.p3-cut-btn');
    let pos = 0;
    while (pos < bitStream.length) {
      let matched = false;
      for (const item of dictionary) {
        if (bitStream.startsWith(item.code, pos)) {
          pos += item.code.length;
          matched = true;
          if (pos < bitStream.length) {
            // Cut button index is pos - 1
            const cutBtn = cutButtons.nth(pos - 1);
            await cutBtn.click();
          }
          break;
        }
      }
      if (!matched) {
        // Fallback step
        pos++;
      }
    }

    const p3SubmitBtn = page.locator('#p3-submit-btn');
    await expect(p3SubmitBtn).toBeEnabled({ timeout: 3000 });
    await p3SubmitBtn.click();

    // --- VICTORY SCREEN ---
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('h3', { hasText: 'УРОВЕНЬ 1 УСПЕШНО ПРОЙДЕН!' }).or(page.locator('.display-5', { hasText: 'МИССИЯ ВЫПОЛНЕНА' }))).toBeVisible();

    // Verify telemetry event was dispatched
    const completeEvent = telemetryEvents.find(e => (e.action_type === 'level_complete' || e.action === 'level_complete') && e.success === true);
    expect(completeEvent, 'Telemetry must receive level_complete with success=true').toBeTruthy();
    expect(completeEvent.mission_name || completeEvent.lessonId).toContain('Урок 30');
  });
});
