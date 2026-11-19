import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/33/level1';

async function solvePhase1UI(page) {
  const slots = page.locator('#p1-slots-container > div');
  const count = await slots.count();
  expect(count).toBe(3);

  for (let idx = 0; idx < count; idx++) {
    const row = slots.nth(idx);
    const labelHtml = await row.locator('div.text-light').innerHTML();
    const match = labelHtml.match(/<strong>(\d+)<sup>(\d+)<\/sup><\/strong>[\s\S]*?<span[^>]*>([0-9A-F]+)<\/span>/i);
    expect(match, `Cannot parse Phase 1 slot HTML: ${labelHtml}`).not.toBeNull();

    const base = Number(match[1]);
    const power = Number(match[2]);
    const digitVal = parseInt(match[3].trim(), base);
    const contribution = digitVal * Math.pow(base, power);

    const matchingToken = page.locator('#p1-token-pool button[data-token-id]', {
      hasText: new RegExp(`^${contribution}$`)
    }).first();
    await matchingToken.click();
    await row.locator('button[data-slot-id]').click();
  }

  await expect(page.locator('#p1-submit-btn')).toBeEnabled();
  await page.locator('#p1-submit-btn').click();
}

async function solvePhase2UI(page) {
  const leftButtons = page.locator('#p2-left-ports button[data-left-id]');
  const rightButtons = page.locator('#p2-right-ports button[data-right-id]');
  const leftCount = await leftButtons.count();
  const rightCount = await rightButtons.count();
  expect(leftCount).toBe(3);
  expect(rightCount).toBe(5);

  const rightHtmls = [];
  for (let r = 0; r < rightCount; r++) {
    rightHtmls.push(await rightButtons.nth(r).locator('span').nth(1).innerHTML());
  }

  for (let l = 0; l < leftCount; l++) {
    const leftBtn = leftButtons.nth(l);
    const spanHtml = (await leftBtn.locator('span').first().innerHTML()).trim();
    const match = spanHtml.match(/^([0-9A-F]+)<sub>(\d+)<\/sub>\s*(?:→|&rarr;)\s*\(\?\)<sub>(\d+)<\/sub>$/i);
    expect(match, `Cannot parse Phase 2 left port HTML: ${spanHtml}`).not.toBeNull();

    const expectedStr = parseInt(match[1], Number(match[2])).toString(Number(match[3])).toUpperCase();
    const expectedFragment = `${expectedStr}<sub>${Number(match[3])}</sub>`;
    const rIdx = rightHtmls.findIndex((rh) => rh.trim() === expectedFragment);
    expect(rIdx, `No right port matching "${expectedFragment}"`).toBeGreaterThanOrEqual(0);

    await leftBtn.click();
    await rightButtons.nth(rIdx).click();
  }

  await expect(page.locator('#p2-submit-btn')).toBeEnabled();
  await page.locator('#p2-submit-btn').click();
}

async function solvePhase3UI(page) {
  const specHtml = (await page.locator('#p3-task-spec').innerHTML()).replace(/\s+/g, ' ');
  const numMatch = specHtml.match(/([0-9A-F]+)<sub>(\d+)<\/sub>/i);
  const lenMatch = specHtml.match(/(\d+)\s*разрядов\s*\(основание\s*(\d+)\)/i);
  expect(numMatch && lenMatch, `Cannot parse Phase 3 spec HTML: ${specHtml}`).toBeTruthy();

  const tapeLen = Number(lenMatch[1]);
  const targetBase = Number(lenMatch[2]);
  const decVal = parseInt(numMatch[1], Number(numMatch[2]));
  const targetDigits = decVal.toString(targetBase).padStart(tapeLen, '0').split('').map(Number);

  for (let idx = 0; idx < tapeLen; idx++) {
    const cellBtn = page.locator(`#p3-tape-container button[data-tape-idx="${idx}"]`);
    for (let c = 0; c < targetDigits[idx]; c++) {
      await cellBtn.click();
    }
  }

  await expect(page.locator('#p3-submit-btn')).toBeEnabled();
  await page.locator('#p3-submit-btn').click();
}

test.describe('10th Grade Advanced Lesson 33: Level 1 Student Personas & Ergonomics', () => {
  test('Persona: NOVICE — places distractor token on Phase 1, observes feedback, recovers to victory', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        const slots = page.locator('#p1-slots-container > div');
        for (let idx = 0; idx < 3; idx++) {
          const row = slots.nth(idx);
          const labelHtml = await row.locator('div.text-light').innerHTML();
          const match = labelHtml.match(/<strong>(\d+)<sup>(\d+)<\/sup><\/strong>[\s\S]*?<span[^>]*>([0-9A-F]+)<\/span>/i);
          const base = Number(match[1]);
          const power = Number(match[2]);
          const correctVal = parseInt(match[3].trim(), base) * Math.pow(base, power);

          const poolBtns = page.locator('#p1-token-pool button[data-token-id]');
          const count = await poolBtns.count();
          let clicked = false;
          for (let i = 0; i < count; i++) {
            const val = Number((await poolBtns.nth(i).innerText()).trim());
            if (val !== correctVal) {
              await poolBtns.nth(i).click();
              clicked = true;
              break;
            }
          }
          if (!clicked) await poolBtns.first().click();
          await row.locator('button[data-slot-id]').click();
        }
        await page.locator('#p1-submit-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#feedback-box')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
        await page.waitForTimeout(1400);
        await expect(page.locator('#feedback-box')).toBeHidden();
      },
      solveCorrectlyFn: async () => {
        await solvePhase1UI(page);
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase2')).toBeVisible();
      }
    });

    await solvePhase2UI(page);
    await expect(page.locator('#phase3')).toBeVisible();
    await solvePhase3UI(page);
    await expect(page.locator('#victory-screen')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: CARELESS — resets Phase 1 slots, resets Phase 2 wires, clears Phase 3 tape, then passes', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);

    // Phase 1: assign token then reset
    await page.locator('#p1-token-pool button[data-token-id]').first().click();
    await page.locator('#p1-slots-container button[data-slot-id]').first().click();
    await page.locator('#p1-reset-btn').click();
    await expect(page.locator('#p1-submit-btn')).toBeDisabled();
    await solvePhase1UI(page);

    // Phase 2: connect one wire, reset, then solve
    await expect(page.locator('#phase2')).toBeVisible();
    await page.locator('#p2-left-ports button[data-left-id]').first().click();
    await page.locator('#p2-right-ports button[data-right-id]').first().click();
    await page.locator('#p2-reset-btn').click();
    await expect(page.locator('#p2-link-counter')).toContainText('0 / 3');
    await solvePhase2UI(page);

    // Phase 3: toggle tape cells then clear before solving
    await expect(page.locator('#phase3')).toBeVisible();
    await page.locator('#p3-tape-container button[data-tape-idx]').first().click();
    await page.locator('#p3-clear-tape-btn').click();
    await expect(page.locator('#p3-preview-text')).toContainText('000');
    await solvePhase3UI(page);

    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-attempts')).toHaveText('0');
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid spam clicks across pools, slots, reset, and submit cause zero runtime exceptions', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    await sim.simulateSpamClick(page.locator('#p1-reset-btn'), 6);
    await sim.simulateSpamClick(page.locator('#p1-token-pool button[data-token-id]').first(), 6);
    await sim.simulateSpamClick(page.locator('#p1-slots-container button[data-slot-id]').first(), 5);
    await sim.simulateSpamClick(page.locator('#p1-reset-btn'), 4);

    await expect(page.locator('#phase1')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & DifficultyBenchmarker — flawless run, >=48px hitboxes & Grade 10 Advanced corridor', async ({ page }) => {
    const sim = new StudentSimulator(page, {
      persona: LearnerPersona.DILIGENT,
      courseSlug: '10-класс_углубленный',
      lessonId: '33',
      levelNumber: 1
    });
    const bench = sim.benchmarker;

    await page.goto(TASK_URL);

    // Phase 1 Hitboxes
    await bench.auditHitboxes([
      page.locator('#p1-token-pool button[data-token-id]'),
      page.locator('#p1-slots-container button[data-slot-id]'),
      page.locator('#p1-reset-btn'),
      page.locator('#p1-submit-btn')
    ], 48);

    bench.recordPhase(1, {
      title: 'Развернутая форма числа q -> 10 (Slot & Snap)',
      depth: 1,
      memory: 2,
      search: 1,
      inversion: 0,
      stress: 0,
      scaffolding: 1
    });
    await solvePhase1UI(page);

    // Phase 2 Hitboxes
    await expect(page.locator('#phase2')).toBeVisible();
    await bench.auditHitboxes([
      page.locator('#p2-left-ports button[data-left-id]'),
      page.locator('#p2-right-ports button[data-right-id]'),
      page.locator('#p2-reset-btn'),
      page.locator('#p2-submit-btn')
    ], 48);

    bench.recordPhase(2, {
      title: 'Коммутация разнонаправленных переводов 10 <-> q (Wire Patching)',
      depth: 2,
      memory: 3,
      search: 2,
      inversion: 0,
      stress: 0,
      scaffolding: 1
    });
    await solvePhase2UI(page);

    // Phase 3 Hitboxes
    await expect(page.locator('#phase3')).toBeVisible();
    await bench.auditHitboxes([
      page.locator('#p3-tape-container button[data-tape-idx]'),
      page.locator('#p3-clear-tape-btn'),
      page.locator('#p3-submit-btn')
    ], 48);

    bench.recordPhase(3, {
      title: 'Синтезатор разрядной ленты кросс-перевода p -> q (Direct Tape Toggle)',
      depth: 3,
      memory: 3,
      search: 1,
      inversion: 0,
      stress: 0,
      scaffolding: 1
    });
    await solvePhase3UI(page);

    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-attempts')).toHaveText('0');

    bench.assertGradeCorridor('10-класс_углубленный');
    bench.assertNoFakeDifficulty();
    bench.renderReport('10-класс_углубленный Lesson 33 (Level 1) :: Difficulty Benchmark');
    sim.assertCleanSession();
  });
});
