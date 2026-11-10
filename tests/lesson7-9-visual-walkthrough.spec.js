import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Grade 7 Lesson 9: Visual Walkthrough, Stage Verification & Screenshot Capture', () => {
  const scratchDir = 'C:/Users/vatutin_n_a/.gemini/antigravity-cli/brain/8218960d-3dca-4e41-ab11-d7757371ab3c/scratch';

  test('01. Lesson Split-Screen & Comprehensive Theory UI Verification', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/lesson/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('header h1')).toContainText('Информация и данные');
    await page.screenshot({ path: path.join(scratchDir, '01_lesson9_split_screen.png'), fullPage: false });

    // Scroll through theory content
    const theoryPane = page.locator('section.prose').first();
    await expect(theoryPane).toBeVisible();

    await theoryPane.evaluate(el => el.scrollBy(0, 1000));
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(scratchDir, '02_lesson9_theory_sensory_and_signals.png'), fullPage: false });

    await theoryPane.evaluate(el => el.scrollBy(0, 1500));
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(scratchDir, '03_lesson9_theory_additional_guidelines.png'), fullPage: false });
  });

  test('02. Level 1 - 3-Phase Interactive Manipulation Walkthrough', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level1');
    await page.waitForLoadState('domcontentloaded');

    // --- Phase 1: Sensory Classification ---
    await expect(page.locator('#phase1')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '04_level1_phase1_start.png') });

    for (let i = 0; i < 6; i++) {
      const card = page.locator('#p1-cards-pool .p1-card').first();
      const type = await card.getAttribute('data-type');
      await card.click();
      await page.locator(`.p1-dropzone[data-bucket="${type}"] .p1-dropzone-header`).click();
    }
    await page.screenshot({ path: path.join(scratchDir, '05_level1_phase1_placed.png') });
    await page.locator('#btn-phase1').click();

    // --- Phase 2: Slot & Snap Pipeline ---
    await expect(page.locator('#phase2')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '06_level1_phase2_slots_start.png') });

    const taskCards = page.locator('.p2-task-card');
    for (let i = 0; i < 3; i++) {
      const taskCard = taskCards.nth(i);
      const taskId = await taskCard.getAttribute('data-task-id');
      let cId = taskId === 'task_volt' ? 'c_volt' : (taskId === 'task_temp' ? 'c_temp' : 'c_net');
      let mId = taskId === 'task_volt' ? 'm_volt' : (taskId === 'task_temp' ? 'm_temp' : 'm_net');

      await page.locator(`.p2-token[data-token-id="${cId}"]`).click();
      await taskCard.locator('.p2-slot[data-slot="context"]').click();

      await page.locator(`.p2-token[data-token-id="${mId}"]`).click();
      await taskCard.locator('.p2-slot[data-slot="meaning"]').click();
    }
    await page.screenshot({ path: path.join(scratchDir, '07_level1_phase2_slots_filled.png') });
    await page.locator('#btn-phase2').click();

    // --- Phase 3: Properties Commutation ---
    await expect(page.locator('#phase3')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '08_level1_phase3_linking_start.png') });

    const conns = [
      { incId: 'inc_act', targetProp: 'prop_act' },
      { incId: 'inc_und', targetProp: 'prop_und' },
      { incId: 'inc_rel', targetProp: 'prop_rel' },
      { incId: 'inc_com', targetProp: 'prop_com' }
    ];

    for (const c of conns) {
      await page.locator(`.p3-incident-card[data-id="${c.incId}"]`).click();
      await page.locator(`.p3-prop-card[data-id="${c.targetProp}"]`).click();
    }

    await page.screenshot({ path: path.join(scratchDir, '09_level1_phase3_linking_completed.png') });
    await page.locator('#btn-phase3').click();

    // Success Screen
    await expect(page.locator('#success-screen')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '10_level1_success_screen.png') });
  });

  test('03. Level 2 - Golden Sawtooth 5-Phase Walkthrough', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level2');
    await page.waitForLoadState('domcontentloaded');

    // Phase 1
    await expect(page.locator('#phase1')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '11_level2_phase1_sensory_balance.png') });

    const p1Text = await page.locator('#p1-task-desc').innerText();
    const v = parseInt(p1Text.match(/(\d+)\s*Кбайт/)[1], 10);
    const p = parseInt(p1Text.match(/(\d+)%/)[1], 10);
    await page.locator('#p1-input').fill(String(Math.round(v * p / 100)));
    await page.locator('#p1-btn').click();

    // Phase 2
    await expect(page.locator('#phase2')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '12_level2_phase2_sampling.png') });

    const p2Text = await page.locator('#p2-task-desc').innerText();
    const s = parseInt(p2Text.match(/каждые\s*(\d+)\s*с/)[1], 10);
    const m = parseInt(p2Text.match(/(\d+)\s*мин/)[1], 10);
    const b = parseInt(p2Text.match(/(\d+)\s*байт/)[1], 10);
    await page.locator('#p2-input').fill(String(Math.floor(m * 60 / s) * b));
    await page.locator('#p2-btn').click();

    // Phase 3 (Peak 1)
    await expect(page.locator('#phase3')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '13_level2_phase3_inverse_audio_rate.png') });

    const p3Text = await page.locator('#p3-task-desc').innerText();
    const t = parseInt(p3Text.match(/(\d+)\s*с/)[1], 10);
    const totalBytes = parseInt(p3Text.match(/([\d\s]+)\s*байт/)[1].replace(/\s+/g, ''), 10);
    await page.locator('#p3-input').fill(String(Math.round(totalBytes / 2 / t)));
    await page.locator('#p3-btn').click();

    // Phase 4
    await expect(page.locator('#phase4')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '14_level2_phase4_noise_filtering.png') });

    const p4Text = await page.locator('#p4-task-desc').innerText();
    const total = parseInt(p4Text.match(/общим\s*объемом\s*(\d+)\s*пакетов/)[1], 10);
    const noise = parseInt(p4Text.match(/что\s*(\d+)\s*пакетов\s*повреждены/)[1], 10);
    const dup = parseInt(p4Text.match(/еще\s*(\d+)\s*пакетов/)[1], 10);
    await page.locator('#p4-input').fill(String(total - noise - dup));
    await page.locator('#p4-btn').click();

    // Phase 5 (Culmination Peak)
    await expect(page.locator('#phase5')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '15_level2_phase5_hartley_reserve.png') });

    const p5Text = await page.locator('#p5-task-desc').innerText();
    const n = parseInt(p5Text.match(/из\s*(\d+)\s*различных\s*команд/)[1], 10);
    let pow = 32;
    if (n > 64) pow = 128;
    else if (n > 32) pow = 64;
    await page.locator('#p5-input').fill(String(pow - n));
    await page.locator('#p5-btn').click();

    // Success Screen
    await expect(page.locator('#success-screen')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '16_level2_success_screen.png') });
  });

  test('04. Level 3 - Data Stream Analyzer Arcade Walkthrough', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 850 });
    await page.goto('/tasks/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9/level3');
    await page.waitForLoadState('domcontentloaded');

    // Start Screen
    await expect(page.locator('#start-game-btn')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '17_level3_arcade_intro.png') });

    await page.locator('#start-game-btn').click();
    await expect(page.locator('.badge:has-text("ВОЛНА 1 / 10")')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '18_level3_arcade_wave1_active.png') });

    // Solve all 10 waves
    for (let wave = 0; wave < 10; wave++) {
      if (wave === 5) {
        await page.screenshot({ path: path.join(scratchDir, '19_level3_arcade_wave5_fast.png') });
      }
      await page.waitForTimeout(100);
      const text = await page.locator('.card.border-danger').innerText();
      const isInvalid = text.includes('-350') || text.includes('не указан') || text.includes('2017') || text.includes('ОТСУТСТВУЕТ (сырые') || text.includes('Белый шум') || text.includes('отвратительная') || text.includes('%#@!&*') || text.includes('КРИТИЧЕСКАЯ АНОМАЛИЯ') || text.includes('УСТАРЕВШИЕ ДАННЫЕ') || text.includes('ЭЛЕКТРОМАГНИТНЫЙ ШУМ') || text.includes('СУБЪЕКТИВНАЯ ОЦЕНКА') || text.includes('НЕПОНЯТНАЯ ИНФОРМАЦИЯ');

      if (isInvalid) {
        await page.locator('#btn-drop').click();
      } else {
        await page.locator('#btn-accept').click();
      }
    }

    await expect(page.locator('h2:has-text("ФИНАЛЬНЫЙ БОСС ПОВЕРЖЕН!")')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(scratchDir, '20_level3_boss_defeated.png') });
  });

  test('05. Hardcore Mode Full Integration & Prince of Persia 1989 Emulator Launch', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.route('**/api/progress*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          unlockedNormal: 3,
          unlockedHardcore: 4,
          isNormalCompleted: true,
          isHardcoreCompleted: true
        })
      });
    });

    await page.addInitScript(() => {
      localStorage.setItem('student_firstName', 'Шахрияр');
      localStorage.setItem('student_lastName', 'Аль-Хорезми');
      localStorage.setItem('student_class', '7-класс');
      localStorage.setItem('hardcore_mode', 'true');
      sessionStorage.setItem('school_lms_hardcore_7-класс_9', 'true');
    });

    await page.goto('/lesson/7-%D0%BA%D0%BB%D0%B0%D1%81%D1%81/9');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.locator('#completion-screen')).toBeVisible();
    await expect(page.locator('#prince-bonus-card')).toBeVisible();
    await page.screenshot({ path: path.join(scratchDir, '21_lesson9_prince_unlocked_screen.png') });

    // Open Prince of Persia emulator
    await page.locator('#open-prince-btn').click();
    await expect(page.locator('#prince-overlay')).toBeVisible();
    await expect(page.locator('#prince-game-iframe')).toBeVisible();

    // Wait for emulator container
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(scratchDir, '22_lesson9_prince_emulator_playing.png') });
  });
});
