import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('Grade 7 Lesson 9: Information & Data Level 2 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — makes calculation mistake in Phase 1, observes feedback, then solves correctly', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level2');

    await expect(page.locator('#phase1')).toBeVisible();

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        // Ошибка: просто вводит число 100 наугад
        await page.locator('#p1-input').fill('100');
        await page.locator('#p1-btn').click();
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('#error-box')).toBeVisible();
        await page.waitForTimeout(1600);
        await expect(page.locator('#p1-input')).toHaveValue('');
      },
      solveCorrectlyFn: async () => {
        const p1Text = await page.locator('#p1-task-desc').innerText();
        const v = parseInt(p1Text.match(/(\d+)\s*Кбайт/)[1], 10);
        const p = parseInt(p1Text.match(/(\d+)%/)[1], 10);
        const ans = Math.round(v * (p / 100));

        await page.locator('#p1-input').fill(String(ans));
        await page.locator('#p1-btn').click();
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('#phase1')).toBeHidden();
        await expect(page.locator('#phase2')).toBeVisible();
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — submits empty/invalid text values, checks stability', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level2');

    // Нажатие на кнопку с пустым полем
    await page.locator('#p1-btn').click();
    await expect(page.locator('#error-box')).toBeVisible();

    await page.waitForTimeout(1600);
    await expect(page.locator('#phase1')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: CARELESS — submits values with accidental spaces, Russian comma, and Enter key', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level2');

    // Phase 1 with accidental spaces and Enter key submission
    const p1Text = await page.locator('#p1-task-desc').innerText();
    const v = parseInt(p1Text.match(/(\d+)\s*Кбайт/)[1], 10);
    const p = parseInt(p1Text.match(/(\d+)%/)[1], 10);
    const ans1 = Math.round(v * p / 100);

    const input1 = page.locator('#p1-input');
    await input1.fill(`  ${ans1}  `);
    await input1.press('Enter');

    await expect(page.locator('#phase1')).toBeHidden();
    await expect(page.locator('#phase2')).toBeVisible();

    // Phase 2 with Russian comma (e.g. "120,0") and submit button
    const p2Text = await page.locator('#p2-task-desc').innerText();
    const s = parseInt(p2Text.match(/каждые\s*(\d+)\s*с/)[1], 10);
    const m = parseInt(p2Text.match(/(\d+)\s*мин/)[1], 10);
    const b = parseInt(p2Text.match(/(\d+)\s*байт/)[1], 10);
    const ans2 = Math.floor(m * 60 / s) * b;

    const input2 = page.locator('#p2-input');
    await input2.fill(`${ans2},0`);
    await input2.press('Enter');

    await expect(page.locator('#phase2')).toBeHidden();
    await expect(page.locator('#phase3')).toBeVisible();

    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — completes all 5 phases systematically', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level2');

    // Phase 1
    const p1Text = await page.locator('#p1-task-desc').innerText();
    const v = parseInt(p1Text.match(/(\d+)\s*Кбайт/)[1], 10);
    const p = parseInt(p1Text.match(/(\d+)%/)[1], 10);
    await page.locator('#p1-input').fill(String(Math.round(v * p / 100)));
    await page.locator('#p1-btn').click();

    // Phase 2
    await expect(page.locator('#phase2')).toBeVisible();
    const p2Text = await page.locator('#p2-task-desc').innerText();
    const s = parseInt(p2Text.match(/каждые\s*(\d+)\s*с/)[1], 10);
    const m = parseInt(p2Text.match(/(\d+)\s*мин/)[1], 10);
    const b = parseInt(p2Text.match(/(\d+)\s*байт/)[1], 10);
    await page.locator('#p2-input').fill(String(Math.floor(m * 60 / s) * b));
    await page.locator('#p2-btn').click();

    // Phase 3
    await expect(page.locator('#phase3')).toBeVisible();
    const p3Text = await page.locator('#p3-task-desc').innerText();
    const t = parseInt(p3Text.match(/(\d+)\s*с/)[1], 10);
    const totalBytes = parseInt(p3Text.match(/([\d\s]+)\s*байт/)[1].replace(/\s+/g, ''), 10);
    await page.locator('#p3-input').fill(String(Math.round(totalBytes / 2 / t)));
    await page.locator('#p3-btn').click();

    // Phase 4
    await expect(page.locator('#phase4')).toBeVisible();
    const p4Text = await page.locator('#p4-task-desc').innerText();
    const p4Matches = [...p4Text.matchAll(/(\d+)\s*пакетов/g)];
    const p4Ans = parseInt(p4Matches[0][1], 10) - parseInt(p4Matches[1][1], 10) - parseInt(p4Matches[2][1], 10);
    await page.locator('#p4-input').fill(String(p4Ans));
    await page.locator('#p4-btn').click();

    // Phase 5
    await expect(page.locator('#phase5')).toBeVisible();
    const p5Text = await page.locator('#p5-task-desc').innerText();
    const n = parseInt(p5Text.match(/(\d+)\s*различных команд/)[1], 10);
    let pow = 1;
    while (pow < n) pow *= 2;
    await page.locator('#p5-input').fill(String(pow - n));
    await page.locator('#p5-btn').click();

    await expect(page.locator('#success-screen')).toBeVisible();
    sim.assertCleanSession();
  });
});
