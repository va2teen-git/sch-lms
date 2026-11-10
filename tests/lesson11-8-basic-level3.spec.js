import { test, expect } from '@playwright/test';

test.describe('Grade 11 Basic Lesson 8: Personal Archive Management Level 3 (Arcade)', () => {
  const taskUrl = '/tasks/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D0%B1%D0%B0%D0%B7%D0%BE%D0%B2%D1%8B%D0%B9/8/level3';

  test('Zero-Style check: no forbidden inline <style> tags', async ({ page }) => {
    await page.goto(taskUrl);
    const inlineStyles = await page.locator('style').count();
    expect(inlineStyles).toBe(0);
  });

  test('Arcade flow: completes all 10 waves through dispatching', async ({ page }) => {
    await page.goto(taskUrl);

    // Intro screen
    await expect(page.locator('#start-btn')).toBeVisible();
    await page.locator('#start-btn').click();

    // Loop through waves 1 to 10
    for (let w = 1; w <= 10; w++) {
      // Wait for wave number
      const waveBadge = page.locator('#wave-counter-badge');
      await expect(waveBadge).toContainText(`Волна ${w} из 10`);

      // Check current wave block data
      const filename = page.locator('h4.text-light');
      await expect(filename).toBeVisible();

      // Solve wave
      await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
      await page.waitForTimeout(300);
    }

    // Victory screen
    await expect(page.locator('h2:has-text("АРКАДНЫЙ БОСС УРОВНЯ 3 ПОВЕРЖЕН!")')).toBeVisible();
  });

  test('Hardcore reset: wrong choice triggers alarm siren and resets to wave 1', async ({ page }) => {
    await page.goto(taskUrl);
    await page.locator('#start-btn').click();

    // Advance to wave 2
    await page.evaluate(() => window.__DEV_LEVEL3_STATE__.solveCurrentWave());
    await page.waitForTimeout(300);

    const waveBadge = page.locator('#wave-counter-badge');
    await expect(waveBadge).toContainText('Волна 2 из 10');

    // Telemetry capture for hardcore_reset
    const resetPromise = page.evaluate(() => {
      return new Promise((resolve) => {
        window.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'TELEMETRY_EVENT' && e.data.action_type === 'hardcore_reset') {
            resolve(e.data);
          }
        });
      });
    });

    // Deliberately choose wrong gate
    await page.evaluate(() => {
      const cur = window.__DEV_LEVEL3_STATE__.getCurrentWave();
      const wrong = cur.correctAction === 'worm' ? 'media' : 'worm';
      window.__DEV_LEVEL3_STATE__.submitAction(wrong);
    });

    const resetEvent = await resetPromise;
    expect(resetEvent.success).toBe(false);
    expect(resetEvent.action_type).toBe('hardcore_reset');

    // Alarm box should appear
    await expect(page.locator('#alarm-box')).toBeVisible();

    // Wait for reset back to wave 1
    await page.waitForTimeout(1800);
    await expect(waveBadge).toContainText('Волна 1 из 10');
  });

  test('Keyboard navigation: keys 1, 2, 3 trigger respective gates', async ({ page }) => {
    await page.goto(taskUrl);
    await page.locator('#start-btn').click();

    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 1 из 10');

    // Check which key is correct for wave 1
    const correctAction = await page.evaluate(() => window.__DEV_LEVEL3_STATE__.getCurrentWave().correctAction);
    const keyMap = { worm: '1', media: '2', quarantine: '3' };
    const keyToPress = keyMap[correctAction];

    await page.keyboard.press(keyToPress);
    await page.waitForTimeout(300);

    // Wave should advance to 2
    await expect(page.locator('#wave-counter-badge')).toContainText('Волна 2 из 10');
  });
});
