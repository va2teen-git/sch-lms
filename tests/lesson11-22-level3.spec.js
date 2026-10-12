import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import sqlite3 from 'better-sqlite3';

test.describe('Lesson 11-22 Level 3: Post Machine Arcade Conveyor Suite', () => {
  const taskFile = path.join(process.cwd(), 'src/pages/tasks/11-класс_углубленный/22/level3.astro');
  const lessonUrl = 'http://localhost:4321/lesson/11-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9/22';

  test('1. Architectural compliance and arcade standards check', async () => {
    expect(fs.existsSync(taskFile)).toBe(true);
    const code = fs.readFileSync(taskFile, 'utf-8');

    // TaskLayout level 3
    expect(code).toContain('import TaskLayout');
    expect(code).toContain('<TaskLayout');
    expect(code).toContain('level={3}');

    // Uses Vue 3
    expect(code).toContain('createApp');
    expect(code).toContain('Vue');

    // Local countdown timer per wave
    expect(code).toMatch(/timer|timeleft|phaseTimeLeft/i);

    // Telemetry events
    expect(code).toContain('TELEMETRY_EVENT');
    expect(code).toContain('level_complete');
    expect(code).toContain('hardcore_reset');
    expect(code).toContain('Урок 22');

    // Zero <style> tags
    expect(code.includes('<style>')).toBe(false);
    expect(code.includes('<style ')).toBe(false);
  });

  test('2. Complete all 8 waves of Level 3 successfully', async ({ page }) => {
    test.setTimeout(40000);
    await page.goto(lessonUrl);

    // Force show iframe-3
    await page.evaluate(() => {
      document.getElementById('iframe-1').classList.remove('block');
      document.getElementById('iframe-1').classList.add('hidden');
      const iframe3 = document.getElementById('iframe-3');
      iframe3.classList.remove('hidden');
      iframe3.classList.add('block');
      iframe3.style.position = 'relative';
      iframe3.style.height = '800px';
      iframe3.style.width = '1000px';
    });

    const frame = page.frameLocator('#iframe-3');

    // Click start button on briefing screen
    await expect(frame.locator('#start-btn')).toBeVisible();
    await frame.locator('#start-btn').click();

    // Complete all 8 waves
    for (let wave = 1; wave <= 8; wave++) {
      await expect(frame.locator('#phase-counter')).toContainText(`ВОЛНА ${wave} ИЗ 8`);

      // Wait for options and click correct one
      const correctBtn = frame.locator('button[data-is-correct="true"]');
      await expect(correctBtn).toBeVisible();
      await correctBtn.click();
    }

    // Success screen
    await expect(frame.locator('#success-title')).toBeVisible();
    await expect(frame.locator('#success-title')).toContainText('КОНВЕЙЕР СТАБИЛИЗИРОВАН');

    // Wait for telemetry to persist
    await page.waitForTimeout(1000);

    // Verify database record
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'level_complete' AND mission_name LIKE '%Урок 22%Уровень 3%' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.success).toBe(1);
  });

  test('3. Handle mistake with fatal error and reset back to wave 1', async ({ page }) => {
    test.setTimeout(30000);
    await page.goto(lessonUrl);

    // Force show iframe-3
    await page.evaluate(() => {
      document.getElementById('iframe-1').classList.remove('block');
      document.getElementById('iframe-1').classList.add('hidden');
      const iframe3 = document.getElementById('iframe-3');
      iframe3.classList.remove('hidden');
      iframe3.classList.add('block');
      iframe3.style.position = 'relative';
      iframe3.style.height = '800px';
      iframe3.style.width = '1000px';
    });

    const frame = page.frameLocator('#iframe-3');

    await expect(frame.locator('#start-btn')).toBeVisible();
    await frame.locator('#start-btn').click();

    await expect(frame.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 8');

    // Pass wave 1
    await frame.locator('button[data-is-correct="true"]').click();

    // In wave 2, click wrong option
    await expect(frame.locator('#phase-counter')).toContainText('ВОЛНА 2 ИЗ 8');
    const wrongBtn = frame.locator('button[data-is-correct="false"]').first();
    await expect(wrongBtn).toBeVisible();
    await wrongBtn.click();

    // Fail title should appear
    await expect(frame.locator('#fail-title')).toBeVisible();

    // Wait for auto reset back to wave 1
    await expect(frame.locator('#phase-counter')).toContainText('ВОЛНА 1 ИЗ 8', { timeout: 5000 });

    // Check DB for hardcore_reset event
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE action_type = 'hardcore_reset' AND mission_name LIKE '%Урок 22%Уровень 3%' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
  });

});
