import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/36/level1';

async function attachTelemetrySpy(page) {
  await page.addInitScript(() => {
    window.__sentTelemetry = [];
    const orig = window.postMessage.bind(window);
    window.postMessage = (msg, targetOrigin) => {
      if (msg && msg.type === 'TELEMETRY_EVENT') {
        window.__sentTelemetry.push(msg);
      }
      return orig(msg, targetOrigin);
    };
  });
}

async function solvePhase1FromDOM(page) {
  const targetBits = await page.evaluate(() => {
    const el = document.querySelector('#p1-target-display');
    const sub = el.querySelector('sub');
    const base = parseInt(sub.textContent.trim(), 10);
    const raw = el.textContent.replace(/chmod/i, '').trim();
    const codeStr = raw.slice(0, raw.length - String(base).length).trim();
    const val = parseInt(codeStr, base);
    return val.toString(2).padStart(12, '0');
  });

  for (let i = 0; i < 12; i++) {
    if (targetBits[i] === '1') {
      await page.locator(`#p1-groups-container .p1-bit-btn[data-bit-idx="${i}"]`).click();
    }
  }
  await page.locator('#p1-submit-btn').click();
}

async function solvePhase2FromDOM(page, useDragOnFirst = false) {
  const { packets } = await page.evaluate(() => {
    const parseSpan = (span) => {
      const sub = span.querySelector('sub');
      const base = parseInt(sub.textContent.trim(), 10);
      const raw = span.textContent.slice(0, span.textContent.length - String(base).length).replace(/\s+/g, '');
      return parseInt(raw, base);
    };
    const valA = parseSpan(document.querySelector('#p2-label-A span'));
    const valB = parseSpan(document.querySelector('#p2-label-B span'));
    const list = Array.from(document.querySelectorAll('#p2-packet-pool .p2-packet-btn')).map(btn => {
      const id = btn.getAttribute('data-packet-id');
      const v = parseSpan(btn.querySelector('span'));
      let bucket = 'quarantine';
      if (v === valA) bucket = 'A';
      else if (v === valB) bucket = 'B';
      return { id, bucket };
    });
    return { packets: list };
  });

  for (let idx = 0; idx < packets.length; idx++) {
    const pkt = packets[idx];
    const pktBtn = page.locator(`#p2-packet-pool .p2-packet-btn[data-packet-id="${pkt.id}"]`);
    const zone = page.locator(`.p2-bucket-zone[data-bucket="${pkt.bucket}"]`);
    if (useDragOnFirst && idx === 0) {
      await pktBtn.dragTo(zone);
    } else {
      await pktBtn.click();
      await zone.click();
    }
  }
  await page.locator('#p2-submit-btn').click();
}

async function solvePhase3FromDOM(page, useDragOnFirst = false) {
  const expectedChars = await page.evaluate(() => {
    const span = document.querySelector('#p3-source-display span');
    const srcBase = parseInt(span.querySelector('sub').textContent.trim(), 10);
    const dstBase = srcBase === 8 ? 16 : 8;
    const raw = span.textContent.slice(0, span.textContent.length - String(srcBase).length).trim();
    const [intStr, fracStr] = raw.split(',');

    const srcW = srcBase === 16 ? 4 : 3;
    const dstW = dstBase === 16 ? 4 : 3;

    const intBin = parseInt(intStr, srcBase).toString(2);
    const paddedInt = intBin.padStart(Math.ceil(intBin.length / dstW) * dstW, '0');
    const intDigits = [];
    for (let i = 0; i < paddedInt.length; i += dstW) {
      intDigits.push(parseInt(paddedInt.slice(i, i + dstW), 2).toString(dstBase).toUpperCase());
    }
    while (intDigits.length > 3 && intDigits[0] === '0') intDigits.shift();

    let fracBin = '';
    for (const ch of fracStr) {
      fracBin += parseInt(ch, srcBase).toString(2).padStart(srcW, '0');
    }
    const paddedFrac = fracBin.padEnd(Math.ceil(fracBin.length / dstW) * dstW, '0');
    const fracDigits = [];
    for (let i = 0; i < paddedFrac.length; i += dstW) {
      fracDigits.push(parseInt(paddedFrac.slice(i, i + dstW), 2).toString(dstBase).toUpperCase());
    }
    return intDigits.slice(0, 3).concat(fracDigits.slice(0, 2));
  });

  for (let slotIdx = 0; slotIdx < expectedChars.length; slotIdx++) {
    const ch = expectedChars[slotIdx];
    const tokBtn = page.locator('#p3-token-pool .p3-token-btn', { hasText: new RegExp(`^${ch}$`) }).first();
    const slotBtn = page.locator(`#p3-slots-row .p3-slot-btn[data-slot-idx="${slotIdx}"]`);
    if (useDragOnFirst && slotIdx === 0) {
      await tokBtn.dragTo(slotBtn);
    } else {
      await tokBtn.click();
      await slotBtn.click();
    }
  }
  await page.locator('#p3-submit-btn').click();
}

test.describe('10th Grade Advanced Lesson 36: Level 1 Manipulation Simulator', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/36/level1.astro');

  test('Architectural contracts: TaskLayout 1, Zero Multiple Choice, Zero-Style/CDN, LMSTelemetry', async () => {
    expect(fs.existsSync(taskPath)).toBe(true);
    const code = fs.readFileSync(taskPath, 'utf-8');
    expect(code).toContain('import TaskLayout');
    expect(code).toMatch(/<TaskLayout[\s\S]*level=\{1\}/);
    expect(code).toContain('window.LMSTelemetry.create');
    expect(code).toContain('telemetry.advanceStage');
    expect(code).toContain('telemetry.fail');
    expect(code).toContain('telemetry.complete');
    expect(code).toContain('bindEventsOnce');
    expect(code).not.toMatch(/<style[\s>]/i);
    expect(code).not.toMatch(/https?:\/\//i);
    expect(code).not.toMatch(/<select|type=["']radio|prince_complete/i);
  });

  test('End-to-end completion across all 3 phases emits valid LMSTelemetry events', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    await expect(page.locator('#phase1')).toBeVisible();
    expect(await page.evaluate(() => window.__sentTelemetry.length)).toBe(0);

    await solvePhase1FromDOM(page);
    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });

    await solvePhase2FromDOM(page, true);
    await expect(page.locator('#phase3')).toBeVisible({ timeout: 5000 });

    await solvePhase3FromDOM(page, true);
    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    const events = await page.evaluate(() => window.__sentTelemetry);
    const completeEvt = events.find(e => e.action_type === 'level_complete');
    expect(completeEvt).toBeTruthy();
    expect(completeEvt.success).toBe(true);
    expect(completeEvt.stage).toBe(3);
    expect(completeEvt.total_stages).toBe(3);
    expect(typeof completeEvt.start_time).toBe('string');
    expect(typeof completeEvt.time_spent_sec).toBe('number');

    const stage2Evt = events.find(e => e.action_type === 'in_progress' && e.stage === 2);
    const stage3Evt = events.find(e => e.action_type === 'in_progress' && e.stage === 3);
    expect(stage2Evt).toBeTruthy();
    expect(stage3Evt).toBeTruthy();
  });

  test('Error handling on Phase 1 triggers feedback banner, telemetry.fail, and regenerates without progress reset', async ({ page }) => {
    await attachTelemetrySpy(page);
    await page.goto(TASK_URL);

    const firstTarget = await page.locator('#p1-target-display').textContent();
    await page.locator('#p1-submit-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    const failEvents = await page.evaluate(() => window.__sentTelemetry.filter(e => !e.success));
    expect(failEvents.length).toBe(1);
    expect(failEvents[0].stage).toBe(1);
    expect(failEvents[0].total_stages).toBe(3);

    await page.waitForTimeout(1450);
    await expect(page.locator('#feedback-box')).toBeHidden();
    await expect(page.locator('#phase1')).toBeVisible();
    const regeneratedTarget = await page.locator('#p1-target-display').textContent();
    expect(regeneratedTarget).not.toBe(firstTarget);
  });
});
