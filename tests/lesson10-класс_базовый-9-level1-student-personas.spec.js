import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';
import { DifficultyBenchmarker } from './difficulty-benchmarker.js';

const TASK_URL = '/tasks/10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/9/level1';

async function solvePhase1(page) {
  for (const cat of ['transfer', 'storage', 'protection']) {
    const cards = page.locator(`#p1-cards-pool .p1-card[data-category="${cat}"]`);
    const count = await cards.count();
    for (let i = 0; i < count; i++) {
      await page.locator(`#p1-cards-pool .p1-card[data-category="${cat}"]`).first().click();
      await page.locator(`#bucket-${cat} .bucket-slot`).click();
    }
  }
  await page.locator('#p1-submit-btn').click();
}

async function solvePhase2(page) {
  for (const role of ['source', 'encoder', 'channel', 'noise', 'decoder', 'receiver']) {
    await page.locator(`#p2-tokens-pool .p2-token[data-role="${role}"]`).first().click();
    await page.locator(`#slot-p2-${role}`).click();
  }
  await page.locator('#p2-submit-btn').click();
}

async function solvePhase3(page) {
  const sizeMB = parseInt(await page.locator('#p3-param-size').innerText(), 10);
  const speedMbps = parseInt(await page.locator('#p3-param-speed').innerText(), 10);
  const expectedTime = (sizeMB * 8) / speedMbps;

  await page.locator('#p3-time-slider').evaluate((el, val) => {
    el.value = String(val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, expectedTime);

  await page.locator('#p3-tokens-pool .p3-token[data-role="storage"]').first().click();
  await page.locator('#slot-p3-storage').click();
  await page.locator('#p3-tokens-pool .p3-token[data-role="protection"]').first().click();
  await page.locator('#slot-p3-protection').click();
  await page.locator('#p3-submit-btn').click();
}

test.describe('Grade 10 Basic Lesson 9: Level 1 Student Personas & Difficulty Audit', () => {

  test('Persona: NOVICE — places distractor on Phase 1, reads feedback, recovers and finishes', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        await page.locator('#p1-cards-pool .p1-card[data-category="distractor"]').first().click();
        await page.locator('#bucket-storage .bucket-slot').click();
        await page.locator('#p1-cards-pool .p1-card[data-category="storage"]').first().click();
        await page.locator('#bucket-storage .bucket-slot').click();
        for (const cat of ['transfer', 'protection']) {
          const cnt = await page.locator(`#p1-cards-pool .p1-card[data-category="${cat}"]`).count();
          for (let i = 0; i < cnt; i++) {
            await page.locator(`#p1-cards-pool .p1-card[data-category="${cat}"]`).first().click();
            await page.locator(`#bucket-${cat} .bucket-slot`).click();
          }
        }
        await page.locator('#p1-submit-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#feedback-box')).toBeVisible();
        await expect(page.locator('#attempts-display')).toHaveText('1');
      },
      solveCorrectlyFn: async () => {
        await page.waitForTimeout(1450);
        await expect(page.locator('#feedback-box')).toBeHidden();
        await solvePhase1(page);
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase2-container')).toBeVisible();
      }
    });

    await sim.cognitivePause();
    await solvePhase2(page);
    await expect(page.locator('#phase3-container')).toBeVisible();

    await solvePhase3(page);
    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-attempts')).toHaveText('1');

    sim.assertCleanSession();
  });

  test('Persona: CARELESS — selects trap storage token on Phase 3 without unit/volatility check, then fixes', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto(TASK_URL);

    await solvePhase1(page);
    await solvePhase2(page);
    await expect(page.locator('#phase3-container')).toBeVisible();

    const sizeMB = parseInt(await page.locator('#p3-param-size').innerText(), 10);
    const speedMbps = parseInt(await page.locator('#p3-param-speed').innerText(), 10);
    const expectedTime = (sizeMB * 8) / speedMbps;

    await page.locator('#p3-time-slider').evaluate((el, val) => {
      el.value = String(val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, expectedTime);

    // Careless places a distractor trap into storage slot
    await page.locator('#p3-tokens-pool .p3-token[data-role="distractor"]').first().click();
    await page.locator('#slot-p3-storage').click();
    await page.locator('#p3-tokens-pool .p3-token[data-role="protection"]').first().click();
    await page.locator('#slot-p3-protection').click();
    await page.locator('#p3-submit-btn').click();

    await expect(page.locator('#feedback-box')).toBeVisible();
    await page.waitForTimeout(1450);
    await expect(page.locator('#feedback-box')).toBeHidden();

    // Now solves Phase 3 properly
    await solvePhase3(page);
    await expect(page.locator('#victory-screen')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid spam-clicks across pool, reset button, and disabled submit button', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    await sim.simulateSpamClick(page.locator('#p1-reset-pool-btn'), 6);
    await sim.simulateSpamClick(page.locator('#p1-cards-pool .p1-card').first(), 6);
    await sim.simulateSpamClick(page.locator('#bucket-transfer .bucket-slot'), 5);

    await expect(page.locator('#phase1-container')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT & DifficultyBenchmarker — flawless run, >=48px hitbox ergonomics & Grade 10 Basic corridor', async ({ page }) => {
    const sim = new StudentSimulator(page, {
      persona: LearnerPersona.DILIGENT,
      courseSlug: '10-класс_базовый',
      lessonId: '9',
      levelNumber: 1
    });
    const bench = sim.benchmarker;

    await page.goto(TASK_URL);

    // Phase 1 Hitbox Audit (>= 48px)
    await bench.auditHitboxes([
      page.locator('#p1-cards-pool .p1-card'),
      page.locator('#p1-reset-pool-btn'),
      page.locator('#p1-submit-btn')
    ], 48);

    bench.recordPhase(1, {
      title: 'Классификация процессов и отсев дистрактора',
      depth: 1,
      memory: 2,
      search: 1,
      inversion: 0,
      stress: 0,
      scaffolding: 0
    });
    await solvePhase1(page);

    // Phase 2
    await expect(page.locator('#phase2-container')).toBeVisible();
    await bench.auditHitboxes([
      page.locator('#p2-tokens-pool .p2-token'),
      page.locator('.p2-slot'),
      page.locator('#p2-reset-pool-btn'),
      page.locator('#p2-submit-btn')
    ], 48);

    bench.recordPhase(2, {
      title: 'Модель передачи данных К. Шеннона (Slot & Snap)',
      depth: 2,
      memory: 2,
      search: 2,
      inversion: 0,
      stress: 0,
      scaffolding: 1
    });
    await solvePhase2(page);

    // Phase 3
    await expect(page.locator('#phase3-container')).toBeVisible();
    await bench.auditHitboxes([
      page.locator('#p3-dec-btn'),
      page.locator('#p3-inc-btn'),
      page.locator('#p3-tokens-pool .p3-token'),
      page.locator('.p3-slot'),
      page.locator('#p3-submit-btn')
    ], 48);

    bench.recordPhase(3, {
      title: 'Калибратор t = (I × 8) / v и подбор носителя/защиты',
      depth: 3,
      memory: 2,
      search: 2,
      inversion: 0,
      stress: 0,
      scaffolding: 1
    });
    await solvePhase3(page);

    await expect(page.locator('#victory-screen')).toBeVisible();
    await expect(page.locator('#final-attempts')).toHaveText('0');

    bench.assertGradeCorridor('10-класс_базовый');
    bench.assertNoFakeDifficulty();
    bench.renderReport('10-класс_базовый Lesson 9 (Level 1) :: Difficulty Benchmark');
    sim.assertCleanSession();
  });
});
