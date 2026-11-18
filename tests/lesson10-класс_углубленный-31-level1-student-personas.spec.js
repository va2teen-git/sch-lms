import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/31/level1';

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function solvePhase1UI(page) {
  const slots = page.locator('#p1-slots-container > div');
  const count = await slots.count();
  expect(count).toBe(3);

  for (let idx = 0; idx < count; idx++) {
    const row = slots.nth(idx);
    const N = Number((await row.innerText()).match(/N\s*=\s*(\d+)/)[1]);
    const bits = Math.ceil(Math.log2(N));
    await page.locator(`#p1-token-pool button[data-bits="${bits}"]`).click();
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

  const rightTexts = [];
  for (let r = 0; r < rightCount; r++) {
    rightTexts.push((await rightButtons.nth(r).innerText()).trim());
  }

  for (let l = 0; l < leftCount; l++) {
    const leftBtn = leftButtons.nth(l);
    const html = await leftBtn.innerHTML();
    const text = (await leftBtn.innerText()).replace(/\s+/g, ' ').trim();

    let expectedRegex = null;
    const textMatch = text.match(/K\s*=\s*(\d+)\s*симв\.,\s*N\s*=\s*(\d+)/);
    if (textMatch) {
      const K = Number(textMatch[1]);
      const N = Number(textMatch[2]);
      const i = Math.ceil(Math.log2(N));
      const bytes = (K * i) / 8;
      const expected = bytes >= 1024 && bytes % 1024 === 0 ? `${bytes / 1024} Кбайт` : `${bytes} байт`;
      expectedRegex = new RegExp(`^${escapeRegExp(expected)}(?:а)?$`);
    } else if (html.includes('2<sup>16</sup> бит')) {
      expectedRegex = /^8 Кбайт$/;
    } else if (html.includes('2<sup>22</sup> байт')) {
      expectedRegex = /^4 МиБ$/;
    } else if (html.includes('0,5 МиБ')) {
      expectedRegex = /^512 КиБ$/;
    } else if (html.includes('2<sup>15</sup> бит')) {
      expectedRegex = /^4 Кбайт$/;
    } else {
      const netMatch = text.match(/(\d+)\s*(М|Г)бит\/с.*за\s*(\d+)\s*с/);
      const val = (Number(netMatch[1]) * Number(netMatch[3])) / 8;
      const expectedUnit = netMatch[2] === 'Г' ? 'ГБ' : 'МБ';
      expectedRegex = new RegExp(`^${escapeRegExp(`${val} ${expectedUnit}`)}`);
    }

    const rIdx = rightTexts.findIndex((rt) => expectedRegex.test(rt));
    expect(rIdx).toBeGreaterThanOrEqual(0);
    await leftBtn.click();
    await rightButtons.nth(rIdx).click();
  }

  await expect(page.locator('#p2-submit-btn')).toBeEnabled();
  await page.locator('#p2-submit-btn').click();
}

async function solvePhase3UI(page) {
  const specText = (await page.locator('#p3-task-spec').innerText()).replace(/\s+/g, ' ');
  const M = Number(specText.match(/M\s*=\s*(\d+)/)[1]);
  const K = Number(specText.match(/K\s*=\s*(\d+)/)[1]);
  const letters = Number(specText.match(/(\d+)\s*латинских букв/)[1]);
  const digits = Number(specText.match(/(\d+)\s*цифр/)[1]);
  const specMatch = specText.match(/(\d+)\s*спецсимволов/);
  const extraBytes = Number(specText.match(/отводится\s*(\d+)\s*байт/)[1]);

  const N = letters + digits + (specMatch ? Number(specMatch[1]) : 0);
  const bits = Math.ceil(Math.log2(N));
  const recordBytes = Math.ceil((K * bits) / 8) + extraBytes;
  const totalBytes = M * recordBytes;

  await page.locator(`#p3-bit-bar button[data-bit-index="${bits}"]`).click();
  await page.locator(`#p3-byte-grid button[data-byte-index="${recordBytes}"]`).click();
  await page.locator('#p3-total-slider').fill(String(totalBytes));
  await expect(page.locator('#p3-submit-btn')).toBeEnabled();
  await page.locator('#p3-submit-btn').click();
}

test.describe('10th Grade Advanced Lesson 31: Level 1 Student Personas & Ergonomics', () => {
  test('Persona: NOVICE — places distractor bit token on Phase 1, observes feedback, recovers to victory', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        const slots = page.locator('#p1-slots-container > div');
        for (let idx = 0; idx < 3; idx++) {
          const row = slots.nth(idx);
          const N = Number((await row.innerText()).match(/N\s*=\s*(\d+)/)[1]);
          const rightBits = Math.ceil(Math.log2(N));
          const poolBtns = page.locator('#p1-token-pool button[data-bits]:not([disabled])');
          const count = await poolBtns.count();
          let clicked = false;
          for (let i = 0; i < count; i++) {
            const b = Number(await poolBtns.nth(i).getAttribute('data-bits'));
            if (b !== rightBits) {
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

  test('Persona: CARELESS — resets Phase 1 slots & Phase 2 wires, tweaks Phase 3 calibrator with +/- buttons, then passes', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);

    // Click token then reset slots cleanly
    await page.locator('#p1-token-pool button[data-bits]').first().click();
    await page.locator('#p1-slots-container button[data-slot-id]').first().click();
    await page.locator('#p1-reset-btn').click();
    await expect(page.locator('#p1-submit-btn')).toBeDisabled();
    await solvePhase1UI(page);

    // Phase 2: link a wire, reset wires, then solve
    await expect(page.locator('#phase2')).toBeVisible();
    await page.locator('#p2-left-ports button[data-left-id]').first().click();
    await page.locator('#p2-right-ports button[data-right-id]').first().click();
    await page.locator('#p2-reset-btn').click();
    await expect(page.locator('#p2-link-counter')).toContainText('0 / 3');
    await solvePhase2UI(page);

    // Phase 3: test +/-10 and +/-1 incremental buttons before solving
    await expect(page.locator('#phase3')).toBeVisible();
    await page.locator('#p3-inc10-btn').click();
    await page.locator('#p3-inc1-btn').click();
    await page.locator('#p3-dec1-btn').click();
    await page.locator('#p3-dec10-btn').click();
    await expect(page.locator('#p3-total-badge')).toContainText('0 байт');
    await solvePhase3UI(page);

    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-attempts')).toHaveText('0');
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid spam clicks across pools, slots, reset, and disabled submit cause zero runtime exceptions', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    await sim.simulateSpamClick(page.locator('#p1-reset-btn'), 6);
    await sim.simulateSpamClick(page.locator('#p1-token-pool button[data-bits]').first(), 6);
    await sim.simulateSpamClick(page.locator('#p1-slots-container button[data-slot-id]').first(), 5);
    await sim.simulateSpamClick(page.locator('#p1-reset-btn'), 4);

    await expect(page.locator('#phase1')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & DifficultyBenchmarker — flawless run, >=48px hitboxes & Grade 10 Advanced corridor', async ({ page }) => {
    const sim = new StudentSimulator(page, {
      persona: LearnerPersona.DILIGENT,
      courseSlug: '10-класс_углубленный',
      lessonId: '31',
      levelNumber: 1
    });
    const bench = sim.benchmarker;

    await page.goto(TASK_URL);

    // Phase 1 Hitboxes
    await bench.auditHitboxes([
      page.locator('#p1-token-pool button[data-bits]'),
      page.locator('#p1-slots-container button[data-slot-id]'),
      page.locator('#p1-reset-btn'),
      page.locator('#p1-submit-btn')
    ], 48);

    bench.recordPhase(1, {
      title: 'Квантование алфавита по Хартли (Slot & Snap)',
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
      title: 'Коммутация потоков: двоичные МЭК vs десятичные СИ (Wire Patching)',
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
      page.locator('#p3-bit-bar button[data-bit-index]'),
      page.locator('#p3-byte-grid button[data-byte-index]'),
      page.locator('#p3-dec10-btn'),
      page.locator('#p3-dec1-btn'),
      page.locator('#p3-inc1-btn'),
      page.locator('#p3-inc10-btn'),
      page.locator('#p3-reset-btn'),
      page.locator('#p3-submit-btn')
    ], 48);

    bench.recordPhase(3, {
      title: 'Проектировщик байтового хранилища с выравниванием (Grid & Calibrator)',
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
    bench.renderReport('10-класс_углубленный Lesson 31 (Level 1) :: Difficulty Benchmark');
    sim.assertCleanSession();
  });
});
