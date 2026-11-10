import { test, expect } from '@playwright/test';
import { StudentSimulator, LearnerPersona } from './student-simulator.js';

test.describe('Grade 7 Lesson 9: Information & Data Level 3 (Student Personas Simulation)', () => {

  test('Persona: NOVICE — misidentifies noisy data in Wave 1, observes hardcore reset, then succeeds', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.NOVICE });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level3');

    await page.locator('#start-game-btn').click();

    await sim.simulateNoviceDistractorTrap({
      triggerDistractorFn: async () => {
        // Ошибка: жмет не глядя
        const text = await page.locator('.card.border-danger').innerText();
        const isInvalid = text.includes('-350') || text.includes('не указан') || text.includes('2017') || text.includes('ОТСУТСТВУЕТ (сырые') || text.includes('Белый шум') || text.includes('отвратительная') || text.includes('%#@!&*') || text.includes('КРИТИЧЕСКАЯ АНОМАЛИЯ') || text.includes('УСТАРЕВШИЕ ДАННЫЕ') || text.includes('ЭЛЕКТРОМАГНИТНЫЙ ШУМ') || text.includes('СУБЪЕКТИВНАЯ ОЦЕНКА') || text.includes('НЕПОНЯТНАЯ ИНФОРМАЦИЯ');
        if (isInvalid) {
          await page.locator('#btn-accept').click();
        } else {
          await page.locator('#btn-drop').click();
        }
      },
      assertErrorStateFn: async () => {
        await expect(page.locator('.alert-danger:has-text("ХАРДКОР-СБРОС НА ВОЛНУ 1")')).toBeVisible();
        await page.waitForTimeout(2200);
        await expect(page.locator('.badge:has-text("ВОЛНА 1 / 10")')).toBeVisible();
      },
      solveCorrectlyFn: async () => {
        const text = await page.locator('.card.border-danger').innerText();
        const isInvalid = text.includes('-350') || text.includes('не указан') || text.includes('2017') || text.includes('ОТСУТСТВУЕТ (сырые') || text.includes('Белый шум') || text.includes('отвратительная') || text.includes('%#@!&*') || text.includes('КРИТИЧЕСКАЯ АНОМАЛИЯ') || text.includes('УСТАРЕВШИЕ ДАННЫЕ') || text.includes('ЭЛЕКТРОМАГНИТНЫЙ ШУМ') || text.includes('СУБЪЕКТИВНАЯ ОЦЕНКА') || text.includes('НЕПОНЯТНАЯ ИНФОРМАЦИЯ');
        if (isInvalid) {
          await page.locator('#btn-drop').click();
        } else {
          await page.locator('#btn-accept').click();
        }
      },
      assertSuccessStateFn: async () => {
        await expect(page.locator('.badge:has-text("ВОЛНА 2 / 10")')).toBeVisible();
      }
    });

    sim.assertCleanSession();
  });

  test('Persona: CHAOS — presses buttons rapidly while in game, checks stability', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CHAOS });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level3');

    await page.locator('#start-game-btn').click();
    await expect(page.locator('.badge:has-text("ВОЛНА 1 / 10")')).toBeVisible();

    // Спам кликов по кнопкам действий
    await sim.simulateSpamClick(page.locator('#btn-accept'), 3);

    sim.assertCleanSession();
  });

  test('Persona: CARELESS — navigates using numeric keys (1/0) and arrow keys', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.CARELESS });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level3');

    await page.locator('#start-game-btn').click();
    await expect(page.locator('.badge:has-text("ВОЛНА 1 / 10")')).toBeVisible();

    const text = await page.locator('.card.border-danger').innerText();
    const isInvalid = text.includes('-350') || text.includes('не указан') || text.includes('2017') || text.includes('ОТСУТСТВУЕТ (сырые') || text.includes('Белый шум') || text.includes('отвратительная') || text.includes('%#@!&*') || text.includes('КРИТИЧЕСКАЯ АНОМАЛИЯ') || text.includes('УСТАРЕВШИЕ ДАННЫЕ') || text.includes('ЭЛЕКТРОМАГНИТНЫЙ ШУМ') || text.includes('СУБЪЕКТИВНАЯ ОЦЕНКА') || text.includes('НЕПОНЯТНАЯ ИНФОРМАЦИЯ');

    if (isInvalid) {
      await page.keyboard.press('0');
    } else {
      await page.keyboard.press('1');
    }

    await expect(page.locator('.badge:has-text("ВОЛНА 2 / 10")')).toBeVisible();
    sim.assertCleanSession();
  });

  test('Persona: DILIGENT — passes entire 10-wave gauntlet on hardcore with hotkeys', async ({ page }) => {
    const sim = new StudentSimulator(page, { persona: LearnerPersona.DILIGENT });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level3');

    await page.locator('#start-game-btn').click();

    for (let wave = 0; wave < 10; wave++) {
      await page.waitForTimeout(100);
      const text = await page.locator('.card.border-danger').innerText();
      const isInvalid = text.includes('-350') || text.includes('не указан') || text.includes('2017') || text.includes('ОТСУТСТВУЕТ (сырые') || text.includes('Белый шум') || text.includes('отвратительная') || text.includes('%#@!&*') || text.includes('КРИТИЧЕСКАЯ АНОМАЛИЯ') || text.includes('УСТАРЕВШИЕ ДАННЫЕ') || text.includes('ЭЛЕКТРОМАГНИТНЫЙ ШУМ') || text.includes('СУБЪЕКТИВНАЯ ОЦЕНКА') || text.includes('НЕПОНЯТНАЯ ИНФОРМАЦИЯ');

      if (isInvalid) {
        await page.keyboard.press('d');
      } else {
        await page.keyboard.press('a');
      }
    }

    await expect(page.locator('h2:has-text("ФИНАЛЬНЫЙ БОСС ПОВЕРЖЕН!")')).toBeVisible({ timeout: 5000 });
    sim.assertCleanSession();
  });
});
