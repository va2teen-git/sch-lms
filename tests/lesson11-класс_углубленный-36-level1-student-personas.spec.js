import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';
import { DifficultyBenchmarker } from './difficulty-benchmarker.js';

const TASK_URL = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/36/level1';

function classifyP1CardText(text) {
  const clean = text.trim();
  if (clean.includes('(') || clean.includes(')')) return 2;
  const tokens = clean.split(/\s+/);
  const ops = new Set(['+', '-', '×', '*']);

  if (ops.has(tokens[0])) {
    let needed = 1;
    let valid = true;
    for (const t of tokens) {
      if (needed <= 0) { valid = false; break; }
      if (ops.has(t)) needed += 1;
      else if (/^-?\d+$/.test(t)) needed -= 1;
      else { valid = false; break; }
    }
    return (valid && needed === 0) ? 0 : 2;
  }

  let depth = 0;
  for (const t of tokens) {
    if (ops.has(t)) {
      if (depth < 2) return 2;
      depth -= 1;
    } else if (/^-?\d+$/.test(t)) {
      depth += 1;
    } else {
      return 2;
    }
  }
  return depth === 1 ? 1 : 2;
}

function infixToRpnTokens(infixStr) {
  const raw = infixStr.replace(/\(/g, ' ( ').replace(/\)/g, ' ) ').trim().split(/\s+/).filter(Boolean);
  const output = [];
  const ops = [];
  const prec = { '^': 4, 'u-': 3, '×': 2, '*': 2, '/': 2, '+': 1, '-': 1 };
  const rightAssoc = new Set(['^', 'u-']);

  for (const tok of raw) {
    if (/^-\d+$/.test(tok)) {
      while (ops.length && ops[ops.length - 1] !== '(' && prec[ops[ops.length - 1]] > prec['u-']) {
        output.push(ops.pop());
      }
      ops.push('u-');
      output.push(tok.slice(1));
    } else if (/^\d+$/.test(tok)) {
      output.push(tok);
    } else if (tok === '(') {
      ops.push('(');
    } else if (tok === ')') {
      while (ops.length && ops[ops.length - 1] !== '(') output.push(ops.pop());
      if (ops[ops.length - 1] === '(') ops.pop();
    } else {
      while (ops.length && ops[ops.length - 1] !== '(') {
        const top = ops[ops.length - 1];
        if (rightAssoc.has(tok) ? prec[top] > prec[tok] : prec[top] >= prec[tok]) output.push(ops.pop());
        else break;
      }
      ops.push(tok);
    }
  }
  while (ops.length) output.push(ops.pop());
  return output;
}

test.describe('Digital Student Personas :: Lesson 36 (11-класс_углубленный) Level 1', () => {

  test('Persona: NOVICE — makes classification mistake in Phase 1, observes error banner, recovers to Phase 2', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        // Put everything into bucket 1 blindly
        const cards = page.locator('#p1-token-palette [data-item-id]');
        while ((await cards.count()) > 0) {
          await cards.first().click();
          await page.locator('#p1-bucket-card-1').click();
        }
        await page.locator('#p1-check-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#feedback-box')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
      },
      solveCorrectlyFn: async () => {
        await page.waitForTimeout(1600);
        await expect(page.locator('#feedback-box')).toBeHidden();
        const cards = page.locator('#p1-token-palette [data-item-id]');
        while ((await cards.count()) > 0) {
          const card = cards.first();
          const bucket = classifyP1CardText(await card.innerText());
          await card.click();
          await page.locator(`#p1-bucket-card-${bucket}`).click();
        }
        await page.locator('#p1-check-btn').click();
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#phase-badge')).toHaveText('Шаг 2 из 3');
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid spam clicks on check and reset buttons without unhandled exceptions', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    await sim.simulateSpamClick(page.locator('#p1-check-btn'), 4);
    await expect(page.locator('#feedback-box')).toBeVisible();

    await page.waitForTimeout(1600);
    await sim.simulateSpamClick(page.locator('#p1-reset-btn'), 3);
    expect(await page.locator('#p1-token-palette [data-item-id]').count()).toBe(6);

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — Black-Box completion of all 3 phases with zero errors and >=48px hitboxes', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    const benchmarker = new DifficultyBenchmarker({
      courseSlug: '11-класс_углубленный',
      lessonId: 36,
      levelNumber: 1
    });

    await page.goto(TASK_URL);

    // Phase 1
    await benchmarker.auditHitboxes([
      page.locator('#p1-token-palette [data-item-id]').first(),
      page.locator('#p1-check-btn')
    ], 48);
    benchmarker.recordPhase(1, { title: 'Классификация нотаций (Шлюзы)', depth: 2, memory: 2, scaffolding: 1 });

    const cards = page.locator('#p1-token-palette [data-item-id]');
    while ((await cards.count()) > 0) {
      const card = cards.first();
      const bucket = classifyP1CardText(await card.innerText());
      await sim.cognitivePause(15);
      await card.click();
      await page.locator(`#p1-bucket-card-${bucket}`).click();
    }
    await page.locator('#p1-check-btn').click();

    // Phase 2
    await expect(page.locator('#phase2')).toBeVisible({ timeout: 5000 });
    await benchmarker.auditHitboxes([page.locator('#p2-exec-btn')], 48);
    benchmarker.recordPhase(2, { title: 'Манипуляция стеком LIFO (PUSH/POP B/POP A)', depth: 2, memory: 3, scaffolding: 1 });

    const tapeTotal = await page.locator('#p2-tape [data-tape-idx]').count();
    const ops = new Set(['+', '-', '×', '/']);
    for (let i = 0; i < tapeTotal; i++) {
      const tokenBtn = page.locator(`#p2-tape [data-tape-idx="${i}"]`);
      const tokText = (await tokenBtn.innerText()).trim();
      await sim.cognitivePause(15);
      if (!ops.has(tokText)) {
        await tokenBtn.click();
      } else {
        await page.locator('#p2-stack-dropzone [data-stack-top="1"]').click();
        await page.locator('#p2-stack-dropzone [data-stack-top="1"]').click();
        await page.locator('#p2-exec-btn').click();
      }
    }

    // Phase 3
    await expect(page.locator('#phase3')).toBeVisible({ timeout: 5000 });
    await benchmarker.auditHitboxes([page.locator('#p3-check-btn')], 48);
    benchmarker.recordPhase(3, { title: 'Сборка ОПЗ (Slot & Snap) с дистракторами', depth: 3, memory: 3, scaffolding: 1 });

    const infixText = await page.locator('#p3-infix-display').innerText();
    const expectedTokens = infixToRpnTokens(infixText);
    for (let i = 0; i < expectedTokens.length; i++) {
      const tokText = expectedTokens[i];
      const paletteToks = page.locator('#p3-palette [data-p3-tok]');
      const count = await paletteToks.count();
      for (let j = 0; j < count; j++) {
        const cand = paletteToks.nth(j);
        if ((await cand.innerText()).trim() === tokText) {
          await cand.click();
          break;
        }
      }
      await page.locator(`#p3-slots [data-slot-idx="${i}"]`).click();
    }
    await page.locator('#p3-check-btn').click();

    await expect(page.locator('#victory-screen')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');
    benchmarker.renderReport('LESSON 36 (Level 1) :: COGNITIVE AUDIT');
    sim.assertCleanSession();
  });
});
