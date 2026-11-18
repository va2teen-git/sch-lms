import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona, DifficultyBenchmarker } from './student-simulator.js';

const TASK_URL = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/35/level3';

function analyzeBracketStream(tokens) {
  const openToClose = { '(': ')', '[': ']', '{': '}', '<': '>' };
  const closeToOpen = { ')': '(', ']': '[', '}': '{', '>': '<' };
  const stack = [];
  for (let i = 0; i < tokens.length; i++) {
    const ch = tokens[i];
    if (openToClose[ch]) {
      stack.push(ch);
    } else if (closeToOpen[ch]) {
      if (stack.length === 0 || stack[stack.length - 1] !== closeToOpen[ch]) {
        return { mode: 'fix_error', errorIndex: i, expectedTail: [] };
      }
      stack.pop();
    }
  }
  return {
    mode: 'close_tail',
    errorIndex: -1,
    expectedTail: stack.slice().reverse().map((o) => openToClose[o])
  };
}

test.describe('11th Grade Lesson 35: Level 3 Arcade (Student Personas Simulation)', () => {

  test('Persona: NOVICE — misidentifies token on Wave 1, observes alarm and hardcore reset, then solves Wave 1 via DOM', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto(TASK_URL);

    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        const tapeBtns = page.locator('.card.border-danger .py-2 button');
        const count = await tapeBtns.count();
        const tokens = [];
        for (let i = 0; i < count; i++) {
          tokens.push((await tapeBtns.nth(i).locator('span.fs-4').innerText()).trim());
        }
        const plan = analyzeBracketStream(tokens);
        const tailBtnIdx = { ')': 0, ']': 1, '}': 2, '>': 3 };
        // Deliberately submit wrong index 0 on fix_error or wrong closing bracket on close_tail
        if (plan.mode === 'fix_error') {
          await tapeBtns.nth(plan.errorIndex === 0 ? 1 : 0).click();
        } else {
          const wrongChar = plan.expectedTail[0] === ')' ? ']' : ')';
          await page.locator('.card.border-secondary button:has(span.fs-4)').nth(tailBtnIdx[wrongChar]).click();
        }
        await page.locator('#launch-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#alarm-box')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('#alarm-box')).toContainText('STACK PANIC');
      },
      solveCorrectlyFn: async () => {
        await page.waitForTimeout(1600);
        await expect(page.locator('#alarm-box')).toBeHidden();
        await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

        const tapeBtns = page.locator('.card.border-danger .py-2 button');
        const count = await tapeBtns.count();
        const tokens = [];
        for (let i = 0; i < count; i++) {
          tokens.push((await tapeBtns.nth(i).locator('span.fs-4').innerText()).trim());
        }
        const plan = analyzeBracketStream(tokens);
        const tailBtnIdx = { ')': 0, ']': 1, '}': 2, '>': 3 };
        if (plan.mode === 'fix_error') {
          await tapeBtns.nth(plan.errorIndex).click();
        } else {
          for (const ch of plan.expectedTail) {
            await page.locator('.card.border-secondary button:has(span.fs-4)').nth(tailBtnIdx[ch]).click();
          }
        }
        await page.locator('#launch-btn').click();
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#wave-counter-badge')).toContainText('Волна 2 из 10', { timeout: 5000 });
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — rapid clicking on tail buttons and tape tokens without UI corruption', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto(TASK_URL);

    await page.locator('#start-btn').click();
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    // Spam click closing palette button and clear tail button
    const closeBtn = page.locator('.card.border-secondary button:has(span.fs-4)').nth(0);
    await sim.simulateSpamClick(closeBtn, 4);
    const clearBtn = page.locator('button', { hasText: 'Очистить хвост' });
    await sim.simulateSpamClick(clearBtn, 2);

    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — solves all 10 waves purely via visible DOM (Black-Box) + Hitbox & CCS audit', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    const benchmarker = new DifficultyBenchmarker({
      courseSlug: '11-класс_углубленный',
      lessonId: 35,
      levelNumber: 3
    });

    await page.goto(TASK_URL);
    await page.locator('#start-btn').click();

    await benchmarker.auditHitboxes([
      page.locator('.card.border-danger .py-2 button'),
      page.locator('.card.border-secondary button:has(span.fs-4)'),
      page.locator('#launch-btn')
    ], 48);

    const tailBtnIdx = { ')': 0, ']': 1, '}': 2, '>': 3 };
    for (let wave = 1; wave <= 10; wave++) {
      await expect(page.locator('#wave-counter-badge')).toContainText(`Волна ${wave} из 10`, { timeout: 5000 });

      const tapeBtns = page.locator('.card.border-danger .py-2 button');
      const count = await tapeBtns.count();
      const tokens = [];
      for (let i = 0; i < count; i++) {
        tokens.push((await tapeBtns.nth(i).locator('span.fs-4').innerText()).trim());
      }

      const plan = analyzeBracketStream(tokens);
      if (plan.mode === 'fix_error') {
        await tapeBtns.nth(plan.errorIndex).click();
      } else {
        for (const ch of plan.expectedTail) {
          await page.locator('.card.border-secondary button:has(span.fs-4)').nth(tailBtnIdx[ch]).click();
        }
      }

      await sim.cognitivePause(20);
      await page.locator('#launch-btn').click();

      benchmarker.recordPhase(wave, {
        title: `Волна ${wave} (${plan.mode})`,
        depth: wave >= 7 ? 4 : 3,
        memory: 3,
        search: wave >= 5 ? 2 : 1,
        stress: wave >= 7 ? 3 : 2
      });
    }

    await expect(page.locator('text=МИССИЯ ВЫПОЛНЕНА')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#final-attempts')).toHaveText('0');

    benchmarker.assertGradeCorridor('11-класс_углубленный');
    benchmarker.assertNoFakeDifficulty();
    benchmarker.renderReport('LESSON 35 (Level 3) :: 10-WAVE ARCADE AUDIT');
    sim.assertCleanSession();
  });
});
