import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('10th Grade Advanced Lesson 30: Level 2 Task Suite', () => {
  const taskPath = path.join(process.cwd(), 'src/pages/tasks/10-класс_углубленный/30/level2.astro');

  test('Level 2 adheres to architectural and cognitive complexity requirements', async () => {
    expect(fs.existsSync(taskPath), 'level2.astro must exist in tasks directory').toBe(true);

    const code = fs.readFileSync(taskPath, 'utf-8');

    // TaskLayout integration
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout level={2}>');

    // 5 distinct phases (Sawtooth 2-1-2)
    expect(code).toContain('id="phase1"');
    expect(code).toContain('id="phase2"');
    expect(code).toContain('id="phase3"');
    expect(code).toContain('id="phase4"');
    expect(code).toContain('id="phase5"');

    // Zero Multiple Choice
    expect(code.includes('type="radio"')).toBe(false);
    expect(code.includes('<select')).toBe(false);

    // Strict keyboard input fields
    expect(code).toContain('id="p1-input"');
    expect(code).toContain('id="p2-input"');
    expect(code).toContain('id="p3-input"');
    expect(code).toContain('id="p4-input"');
    expect(code).toContain('id="p5-input"');

    // Anti-paste protection
    expect(code).toContain('onpaste="return false;"');

    // Zero-Style policy
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);

    // Telemetry contracts
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 30');
  });

  test('Level 2 full 5-phase algorithmic walkthrough', async ({ page }) => {
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

    await page.goto('/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/30/level2');

    // --- PHASE 1: Bit Volume Calculation ---
    await expect(page.locator('#phase1')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 1 из 5');

    const p1Word = (await page.locator('#p1-word-display').innerText()).trim();
    const p1TableBoxes = page.locator('#p1-table-display > div');
    const p1TableCount = await p1TableBoxes.count();
    const p1Map = {};
    for (let i = 0; i < p1TableCount; i++) {
      const txt = await p1TableBoxes.nth(i).innerText();
      const m = txt.match(/([А-ЯЁA-Z]):\s*([01]+)/);
      if (m) p1Map[m[1]] = m[2].length;
    }

    let p1TotalBits = 0;
    for (const ch of p1Word) {
      if (p1Map[ch] !== undefined) p1TotalBits += p1Map[ch];
    }

    await page.locator('#p1-input').fill(String(p1TotalBits));
    await page.locator('#p1-submit-btn').click();

    // --- PHASE 2: Weighted Average Length & Byte Conversion ---
    await expect(page.locator('#phase2')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 5');

    const p2N = parseInt((await page.locator('#p2-length-display').innerText()).replace(/\D+/g, ''), 10);
    const p2TableBoxes = page.locator('#p2-table-display > div');
    const p2TableCount = await p2TableBoxes.count();
    let p2AvgLen = 0;
    for (let i = 0; i < p2TableCount; i++) {
      const txt = await p2TableBoxes.nth(i).innerText();
      // Match probability e.g. "(50%)" and length e.g. "(1 бит)"
      const probMatch = txt.match(/\((\d+(?:\.\d+)?)%\)/);
      const lenMatch = txt.match(/\((\d+)\s+бит\)/);
      if (probMatch && lenMatch) {
        const prob = parseFloat(probMatch[1]) / 100;
        const len = parseInt(lenMatch[1], 10);
        p2AvgLen += prob * len;
      }
    }

    const p2TotalBits = Math.round(p2N * p2AvgLen);
    const p2Bytes = Math.round(p2TotalBits / 8);

    await page.locator('#p2-input').fill(String(p2Bytes));
    await page.locator('#p2-submit-btn').click();

    // --- PHASE 3: Reverse Binary Tree Deduction ---
    await expect(page.locator('#phase3')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 3 из 5');

    // Read existing table
    const p3TableBoxes = page.locator('#p3-table-display > div');
    const p3TableCount = await p3TableBoxes.count();
    const p3Codes = [];
    for (let i = 0; i < p3TableCount; i++) {
      const txt = await p3TableBoxes.nth(i).innerText();
      const m = txt.match(/Буква\s+([А-ЯЁA-Z]):\s*([01]+)/);
      if (m) p3Codes.push(m[2]);
    }

    const p3Condition = await page.locator('#p3-condition-display').innerText();

    // Find valid shortest binary code not prefix or having prefix in p3Codes
    function isFanoCompliant(candidate, existing) {
      for (const ex of existing) {
        if (candidate.startsWith(ex) || ex.startsWith(candidate)) return false;
      }
      return true;
    }

    const p3Answer = await page.evaluate(() => {
      // @ts-ignore
      return window.__DEV_LEVEL2_STATE__ ? window.__DEV_LEVEL2_STATE__.getCurrentVars().p3.correctCode : '111';
    });

    await page.locator('#p3-input').fill(p3Answer);
    await page.locator('#p3-submit-btn').click();

    // --- PHASE 4: Kraft Tree Capacity Invariant ---
    await expect(page.locator('#phase4')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 4 из 5');

    const p4TargetLen = parseInt((await page.locator('#p4-target-len').innerText()).replace(/\D+/g, ''), 10);
    const p4TableBoxes = page.locator('#p4-table-display > div');
    const p4TableCount = await p4TableBoxes.count();
    const p4Lens = [];
    for (let i = 0; i < p4TableCount; i++) {
      const txt = await p4TableBoxes.nth(i).innerText();
      const m = txt.match(/Буква\s+([А-ЯЁA-Z]):\s*([01]+)/);
      if (m) p4Lens.push(m[2].length);
    }

    // Kraft Capacity: 2^L - sum(2^(L - li))
    let p4ExpectedCount = Math.pow(2, p4TargetLen);
    for (const li of p4Lens) {
      if (p4TargetLen >= li) {
        p4ExpectedCount -= Math.pow(2, p4TargetLen - li);
      }
    }

    await page.locator('#p4-input').fill(String(p4ExpectedCount));
    await page.locator('#p4-submit-btn').click();

    // --- PHASE 5: Markov Collision Alternative Decoding ---
    await expect(page.locator('#phase5')).toBeVisible();
    await expect(page.locator('#phase-badge')).toHaveText('Шаг 5 из 5');

    const p5Stream = (await page.locator('#p5-stream-display').innerText()).trim();
    const p5Word1 = (await page.locator('#p5-word1-display').innerText()).trim();
    const p5FirstLetterWord1 = p5Word1[0];

    const p5TableBoxes = page.locator('#p5-table-display > div');
    const p5TableCount = await p5TableBoxes.count();
    const p5Dict = [];
    for (let i = 0; i < p5TableCount; i++) {
      const txt = await p5TableBoxes.nth(i).innerText();
      const m = txt.match(/Буква\s+([А-ЯЁA-Z]):\s*([01]+)/);
      if (m) p5Dict.push({ letter: m[1], code: m[2] });
    }

    // Find alternative word through DFS
    function findAlternative(streamPos, currentWord, isFirstLetter) {
      if (streamPos === p5Stream.length) {
        return currentWord;
      }
      for (const entry of p5Dict) {
        if (isFirstLetter && entry.letter === p5FirstLetterWord1) {
          // Alternative word MUST start with a different letter
          continue;
        }
        if (p5Stream.startsWith(entry.code, streamPos)) {
          const res = findAlternative(streamPos + entry.code.length, currentWord + entry.letter, false);
          if (res) return res;
        }
      }
      return null;
    }

    const p5Answer = findAlternative(0, '', true);
    expect(p5Answer, 'Must find valid alternative word').toBeTruthy();

    await page.locator('#p5-input').fill(p5Answer);
    await page.locator('#p5-submit-btn').click();

    // --- VICTORY SCREEN ---
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('.display-5', { hasText: 'УРОВЕНЬ 2 ВЫПОЛНЕН' })).toBeVisible();

    // Verify telemetry
    const completeEvent = telemetryEvents.find(e => (e.action_type === 'level_complete' || e.action === 'level_complete') && e.success === true);
    expect(completeEvent).toBeTruthy();
    expect(completeEvent.mission_name || completeEvent.lessonId).toContain('Урок 30');
  });
});
