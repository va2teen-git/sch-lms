import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('11th Grade Advanced Lesson 33: Level 1 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/33/level1.astro');

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
    expect(code).toContain('Урок 33');

    // Zero-style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Zero Multiple Choice Policy
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Direct manipulation mechanics
    // Phase 1: NLP Preprocessing Gateway (Terms, Stop-words, Noise)
    expect(code).toContain('p1-token-palette');
    expect(code).toContain('p1-bucket-card-0');
    expect(code).toContain('p1-bucket-card-1');
    expect(code).toContain('p1-bucket-card-2');
    expect(code).toContain('p1-submit-btn');

    // Phase 2: RegEx Slot & Snap Builder with live testbench
    expect(code).toContain('p2-slots-row');
    expect(code).toContain('p2-token-palette');
    expect(code).toContain('p2-regex-preview');
    expect(code).toContain('p2-submit-btn');

    // Phase 3: DFA Transition Matrix & ReDoS Loop Guard
    expect(code).toContain('p3-transitions-table');
    expect(code).toContain('p3-state-palette');
    expect(code).toContain('p3-submit-btn');
  });

  test('Level 1 full interactive walkthrough in browser with telemetry verification', async ({ page }) => {
    // Collect telemetry messages
    const telemetryEvents = [];
    await page.exposeFunction('onTelemetryEvent', (event) => {
      telemetryEvents.push(event);
    });

    await page.addInitScript(() => {
      window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'TELEMETRY_EVENT') {
          window.onTelemetryEvent(e.data);
        }
      });
    });

    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33/level1');

    // --- Phase 1: NLP Preprocessing Gateway ---
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 3');

    const p1Tokens = await page.evaluate(() => {
      return window.__DEV_LEVEL1_STATE__ ? window.__DEV_LEVEL1_STATE__.getP1Tokens() : [];
    });
    expect(p1Tokens.length).toBe(6);

    for (const t of p1Tokens) {
      const tokenBtn = page.locator(`.btn[data-token-id="${t.id}"]`);
      await expect(tokenBtn).toBeVisible();
      await tokenBtn.click();

      const bucketIndex = t.expectedBucket;
      const emptySlot = page.locator(`#p1-slot-${bucketIndex}`);
      const appendBtn = page.locator(`#p1-append-${bucketIndex}`);

      if (await emptySlot.isVisible()) {
        await emptySlot.click();
      } else {
        await appendBtn.click();
      }
    }

    await page.locator('#p1-submit-btn').click();

    // --- Phase 2: RegEx Slot & Snap Builder ---
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');

    const expectedTokens = await page.evaluate(() => {
      return window.__DEV_LEVEL1_STATE__ ? window.__DEV_LEVEL1_STATE__.getP2ExpectedTokens() : [];
    });
    expect(expectedTokens.length).toBe(5);

    for (let i = 0; i < expectedTokens.length; i++) {
      const tok = expectedTokens[i];
      const tokBtn = page.locator(`.btn[data-token-id="${tok.id}"]`);
      await expect(tokBtn).toBeVisible();
      await tokBtn.click();

      const slot = page.locator(`[data-slot-index="${i}"]`);
      await expect(slot).toBeVisible();
      await slot.click();
    }

    await page.locator('#p2-submit-btn').click();

    // --- Phase 3: DFA Transitions Matrix ---
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 3');

    const p3Data = await page.evaluate(() => {
      const state = window.__DEV_LEVEL1_STATE__;
      return {
        alphabet: state.getP3Alphabet(),
        states: state.getP3States()
      };
    });

    for (const trans of p3Data.alphabet) {
      const matchingState = p3Data.states.find(s => s.label.startsWith(trans.expected) && s.id !== 'state_loop_dist');
      expect(matchingState).toBeDefined();

      const stateBtn = page.locator(`.btn[data-state-id="${matchingState.id}"]`);
      await expect(stateBtn).toBeVisible();
      await stateBtn.click();

      const transSlot = page.locator(`[data-transition-id="${trans.id}"]`);
      await expect(transSlot).toBeVisible();
      await transSlot.click();
    }

    await page.locator('#p3-submit-btn').click();

    // --- Victory Screen & Telemetry Verification ---
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-attempts')).toHaveText('0');

    // Verify telemetry event
    const completeEvent = telemetryEvents.find(e => e.action_type === 'level_complete');
    expect(completeEvent, 'level_complete telemetry event must be emitted').toBeDefined();
    expect(completeEvent.success).toBe(true);
    expect(completeEvent.status).toBe('completed');
  });

  test('Level 1 handles error scenarios and resets gracefully', async ({ page }) => {
    await page.goto('/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33/level1');

    await expect(page.locator('#phase1')).toBeVisible();

    // Click verify immediately without placing any tokens
    await page.locator('#p1-submit-btn').click();

    // Verify error banner and incremented attempt count
    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    // Wait for auto-hide timeout
    await page.waitForTimeout(1700);
    await expect(page.locator('#feedback-box')).toBeHidden();

    // UI remains fully operational
    await expect(page.locator('#p1-token-palette')).toBeVisible();
  });
});
