import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('Level 3: Arcade (AlphaGo)', () => {

  test('should complete the level 3 successfully', async ({ page }) => {
    await page.goto('http://localhost:4321/lesson/11-класс_углубленный/18');
    
    // Switch to Level 3 tab
    await page.locator('button[data-target="iframe-3"]').click();
    
    const frame = page.frameLocator('#iframe-3');
    
    // Start mission
    await frame.locator('button:has-text("[ ИНИЦИАЛИЗАЦИЯ СИСТЕМЫ ]")').click();
    
    for (let phase = 1; phase <= 10; phase++) {
      // Wait for the phase indicator to update
      await expect(frame.locator('.fs-4').first()).toContainText(`ФАЗА: ${phase} / 10`);
      
      const title = await frame.locator('h4').innerText();
      const desc = await frame.locator('p.text-white-50').innerText();
      
      if (title.includes('ПОЛИТИКИ')) {
        // Buttons task
        const buttons = frame.locator('button.btn-outline-danger');
        const count = await buttons.count();
        let maxProb = -1;
        let btnIndexToClick = -1;
        
        for (let i = 0; i < count; i++) {
          const text = await buttons.nth(i).innerText();
          const prob = parseFloat(text.replace('P = ', ''));
          if (prob > maxProb) {
            maxProb = prob;
            btnIndexToClick = i;
          }
        }
        await buttons.nth(btnIndexToClick).click();
      } 
      else if (title.includes('ЦЕННОСТИ')) {
        // Input task
        const match = desc.match(/Побед: (\d+)\. Поражений: (\d+)/);
        const wins = parseInt(match[1], 10);
        const losses = parseInt(match[2], 10);
        const winrate = Math.round((wins / (wins + losses)) * 100);
        
        await frame.locator('input[type="text"]').fill(winrate.toString());
        await frame.locator('button:has-text("ВВОД")').click();
      }
      else if (title.includes('MCTS')) {
        // Buttons task
        const buttons = frame.locator('button.btn-outline-danger');
        const count = await buttons.count();
        let maxScore = -1;
        let btnIndexToClick = -1;
        
        for (let i = 0; i < count; i++) {
          const text = await buttons.nth(i).innerText();
          const match = text.match(/Q=(\d+), U=(\d+)/);
          const score = parseInt(match[1], 10) + parseInt(match[2], 10);
          if (score > maxScore) {
            maxScore = score;
            btnIndexToClick = i;
          }
        }
        await buttons.nth(btnIndexToClick).click();
      }
      else if (title.includes('ХОД 37')) {
        // Input task
        const match = desc.match(/координаты хода: ([A-Z]\d+)/);
        const coord = match[1];
        
        await frame.locator('input[type="text"]').fill(coord);
        await frame.locator('button:has-text("ВВОД")').click();
      }
    }
    
    // Check Success Screen
    await expect(frame.locator('h1')).toContainText('ХОД 37 ВЫПОЛНЕН!');
    
    // Wait for telemetry
    await page.waitForTimeout(1000);
    
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE mission_name = 'Средства искусственного интеллекта :: Уровень 3' AND action_type = 'level_complete' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.success).toBe(1);
  });

});
