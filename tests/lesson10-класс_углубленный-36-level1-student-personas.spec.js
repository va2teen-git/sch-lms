import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona, DifficultyBenchmarker } from './student-simulator.js';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/36/level1';

async function solvePhase1UI(page) {
  const targetBits = await page.evaluate(() => {
    const el = document.querySelector('#p1-target-display');
    const base = parseInt(el.querySelector('sub').textContent.trim(), 10);
    const raw = el.textContent.replace(/chmod/i, '').trim();
    const codeStr = raw.slice(0, raw.length - String(base).length).trim();
    return parseInt(codeStr, base).toString(2).padStart(12, '0');
  });

  for (let i = 0; i < 12; i++) {
    if (targetBits[i] === '1') {
      await page.locator(`#p1-groups-container .p1-bit-btn[data-bit-idx="${i}"]`).click();
    }
  }
  await page.locator('#p1-submit-btn').click();
}

async function solvePhase2UI(page, useDragOnFirst = false) {
  const packets = await page.evaluate(() => {
    const parseSpan = (span) => {
      const base = parseInt(span.querySelector('sub').textContent.trim(), 10);
      const raw = span.textContent.slice(0, span.textContent.length - String(base).length).replace(/\s+/g, '');
      return parseInt(raw, base);
    };
    const valA = parseSpan(document.querySelector('#p2-label-A span'));
    const valB = parseSpan(document.querySelector('#p2-label-B span'));
    return Array.from(document.querySelectorAll('#p2-packet-pool .p2-packet-btn')).map(btn => {
      const id = btn.getAttribute('data-packet-id');
      const v = parseSpan(btn.querySelector('span'));
      return { id, bucket: v === valA ? 'A' : (v === valB ? 'B' : 'quarantine') };
    });
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

async function solvePhase3UI(page, useDragOnFirst = false) {
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

  for (let i = 0; i < expectedChars.length; i++) {
    const tokBtn = page.locator('#p3-token-pool .p3-token-btn', { hasText: new RegExp(`^${expectedChars[i]}$`) }).first();
    const slotBtn = page.locator(`#p3-slots-row .p3-slot-btn[data-slot-idx="${i}"]`);
    if (useDragOnFirst && i === 0) {
      await tokBtn.dragTo(slotBtn);
    } else {
      await tokBtn.click();
      await slotBtn.click();
    }
  }
  await page.locator('#p3-submit-btn').click();
}

test.describe('10th Grade Advanced Lesson 36 (Level 1) :: Student Personas', () => {
  test('Persona: NOVICE — makes mistake on Phase 1, observes regeneration, recovers and finishes all 3 phases', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await sim.cognitivePause(120);
    await page.locator('#p1-submit-btn').click();
    await expect(page.locator('#feedback-box')).toBeVisible();
    await expect(page.locator('#attempts-display')).toHaveText('1');

    await page.waitForTimeout(1450);
    await expect(page.locator('#feedback-box')).toBeHidden();

    await solvePhase1UI(page);
    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
    await solvePhase2UI(page);
    await expect(page.locator('#phase3')).toBeVisible({ timeout: 5000 });
    await solvePhase3UI(page);

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('1');
    sim.assertCleanSession();
  });

  test('Persona: CARELESS — clicks reset/clear mid-way across phases and recovers cleanly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);

    await page.locator('#p1-groups-container .p1-bit-btn').first().click();
    await page.locator('#p1-clear-btn').click();
    await expect(page.locator('#p1-binary-preview')).toHaveText(/^(0000 0000 0000|000 000 000 000)$/);
    await solvePhase1UI(page);

    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
    await page.locator('#p2-packet-pool .p2-packet-btn').first().click();
    await page.locator('.p2-bucket-zone[data-bucket="A"]').click();
    await page.locator('#p2-reset-btn').click();
    await expect(page.locator('#p2-counter')).toContainText('0 / 6');
    await solvePhase2UI(page);

    await expect(page.locator('#phase3')).toBeVisible({ timeout: 5000 });
    await page.locator('#p3-token-pool .p3-token-btn').first().click();
    await page.locator('#p3-slots-row .p3-slot-btn[data-slot-idx="0"]').click();
    await page.locator('#p3-reset-btn').click();
    await expect(page.locator('#p3-counter')).toContainText('0 / 5');
    await solvePhase3UI(page);

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid spam clicks across bits, clear, reset, and submit produce zero console errors', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    await sim.simulateSpamClick(page.locator('#p1-groups-container .p1-bit-btn').first(), 4);
    await sim.simulateSpamClick(page.locator('#p1-clear-btn'), 4);
    await sim.simulateSpamClick(page.locator('#p1-submit-btn'), 4);

    await expect(page.locator('#phase1')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & DifficultyBenchmarker — flawless run, >=48px hitboxes & Grade Corridor compliance', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    const benchmarker = new DifficultyBenchmarker({
      courseSlug: '10-класс_углубленный',
      lessonId: 36,
      levelNumber: 1
    });

    await page.goto(TASK_URL);
    await benchmarker.auditHitboxes([
      page.locator('#p1-groups-container .p1-bit-btn'),
      page.locator('#p1-clear-btn'),
      page.locator('#p1-submit-btn')
    ], 48);
    benchmarker.recordPhase(1, { title: '12-битный регистр chmod/Hex', depth: 2, memory: 2, search: 1, inversion: 0, stress: 0, scaffolding: 1 });
    await solvePhase1UI(page);

    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
    await benchmarker.auditHitboxes([
      page.locator('#p2-packet-pool .p2-packet-btn'),
      page.locator('#p2-reset-btn'),
      page.locator('#p2-submit-btn')
    ], 48);
    benchmarker.recordPhase(2, { title: 'Маршрутизатор байт-пакетов 2/8/16', depth: 3, memory: 2, search: 2, inversion: 0, stress: 0, scaffolding: 1 });
    await solvePhase2UI(page, true);

    await expect(page.locator('#phase3')).toBeVisible({ timeout: 5000 });
    await benchmarker.auditHitboxes([
      page.locator('#p3-token-pool .p3-token-btn'),
      page.locator('#p3-slots-row .p3-slot-btn'),
      page.locator('#p3-reset-btn'),
      page.locator('#p3-submit-btn')
    ], 48);
    benchmarker.recordPhase(3, { title: 'Двоичный мост смешанных чисел 8↔16', depth: 3, memory: 3, search: 1, inversion: 1, stress: 0, scaffolding: 1 });
    await solvePhase3UI(page, true);

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    benchmarker.assertGradeCorridor('10-класс_углубленный');
    benchmarker.assertNoFakeDifficulty();
    benchmarker.renderReport('LESSON 36 (Level 1) :: HITBOX & COGNITIVE AUDIT');
    sim.assertCleanSession();
  });
});
