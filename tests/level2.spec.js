import { test, expect } from '@playwright/test';
import sqlite3 from 'better-sqlite3';

test.describe('Level 2: Generative AI Epoch', () => {

  test('should complete the level 2 successfully', async ({ page }) => {
    // 1. Open the page
    await page.goto('http://localhost:4321/lesson/11-класс_углубленный/18');
    
    // 2. Click on the "Уровень 2" tab to switch to iframe-2
    // According to lesson template, the button has data-target="iframe-2"
    await page.locator('button[data-target="iframe-2"]').click();
    
    // 3. Select the iframe
    const frame = page.frameLocator('#iframe-2');
    
    // -- Phase 1: GAN --
    await expect(frame.locator('#phase1')).toBeVisible();
    
    // Read the logs and find the fake ID
    const p1Logs = await frame.locator('#p1-logs').innerText();
    // Look for FAKE-XXXX-ER
    const match1 = p1Logs.match(/FAKE-(\d{4})-ER/);
    const fakeId = match1[1];
    
    await frame.locator('#p1-input').fill(fakeId);
    await frame.locator('#p1-btn').click();
    
    // -- Phase 2: Attention --
    await expect(frame.locator('#phase1')).toBeHidden();
    await expect(frame.locator('#phase2')).toBeVisible();
    
    const p2Logs = await frame.locator('#p2-logs').innerText();
    // Parse words and scores: [ATTENTION] target -> word : 0.456
    const lines2 = p2Logs.split('\n');
    let maxScore = -1;
    let targetWord = '';
    
    for (const line of lines2) {
      if (!line.trim()) continue;
      const parts = line.split('->')[1].split(':');
      const word = parts[0].trim();
      const score = parseFloat(parts[1].trim());
      if (score > maxScore) {
        maxScore = score;
        targetWord = word;
      }
    }
    
    await frame.locator('#p2-input').fill(targetWord);
    await frame.locator('#p2-btn').click();
    
    // -- Phase 3: LLM --
    await expect(frame.locator('#phase2')).toBeHidden();
    await expect(frame.locator('#phase3')).toBeVisible();
    
    const thresholdText = await frame.locator('#p3-threshold').innerText();
    const threshold = parseInt(thresholdText, 10);
    
    const p3Logs = await frame.locator('#p3-logs').innerText();
    // Format: {token:"MASK", freq:450} | {token:"SYS", freq:120} ...
    const tokens = p3Logs.split('|').map(s => s.trim());
    let targetToken = '';
    
    for (const tokStr of tokens) {
      if (!tokStr) continue;
      const tokMatch = tokStr.match(/token:"([^"]+)"/);
      const freqMatch = tokStr.match(/freq:(\d+)/);
      if (tokMatch && freqMatch) {
        const freq = parseInt(freqMatch[1], 10);
        if (freq > threshold) {
          targetToken = tokMatch[1];
        }
      }
    }
    
    await frame.locator('#p3-input').fill(targetToken);
    await frame.locator('#p3-btn').click();
    
    // -- Phase 4: Prompt Engineering --
    await expect(frame.locator('#phase3')).toBeHidden();
    await expect(frame.locator('#phase4')).toBeVisible();
    
    const p4Logs = await frame.locator('#p4-logs').innerText();
    const p4Json = JSON.parse(p4Logs);
    const instructionCode = p4Json.payload.prompt.instruction_code;
    
    await frame.locator('#p4-input').fill(instructionCode);
    await frame.locator('#p4-btn').click();
    
    // -- Phase 5: RLHF --
    await expect(frame.locator('#phase4')).toBeHidden();
    await expect(frame.locator('#phase5')).toBeVisible();
    
    const p5Logs = await frame.locator('#p5-logs').innerText();
    // ALPHA: 5,  BETA: -2,  GAMMA: 10
    const models = p5Logs.split(',').map(s => s.trim());
    let bestModel = '';
    let maxReward = -999;
    
    for (const mStr of models) {
      if (!mStr) continue;
      const [modelName, rewardStr] = mStr.split(':').map(s => s.trim());
      const reward = parseInt(rewardStr, 10);
      if (reward > maxReward) {
        maxReward = reward;
        bestModel = modelName;
      }
    }
    
    await frame.locator('#p5-input').fill(bestModel);
    await frame.locator('#p5-btn').click();
    
    // -- Success Screen --
    await expect(frame.locator('#phase5')).toBeHidden();
    await expect(frame.locator('#success-screen')).toBeVisible();
    await expect(frame.locator('#success-screen')).toContainText('ЭВОЛЮЦИЯ ЗАВЕРШЕНА');
    
    // Wait a bit for telemetry to be saved
    await page.waitForTimeout(1000);
    
    // Check DB
    const db = new sqlite3('telemetry.db');
    const row = db.prepare(`SELECT * FROM telemetry WHERE mission_name = 'Средства искусственного интеллекта :: Уровень 2' AND action_type = 'level_complete' ORDER BY id DESC LIMIT 1`).get();
    expect(row).toBeDefined();
    expect(row.success).toBe(1);
  });

});
