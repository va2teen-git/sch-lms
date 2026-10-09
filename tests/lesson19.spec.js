import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:4321';
const CLASS_PATH = '10-%D0%BA%D0%BB%D0%B0%D1%81%D1%81_%D1%83%D0%B3%D0%BB%D1%83%D0%B1%D0%BB%D0%B5%D0%BD%D0%BD%D1%8B%D0%B9';
const LESSON_ID = '19';

async function executeCommand(page, command) {
  await page.fill('#cmd-input', command);
  await page.press('#cmd-input', 'Enter');
}

test.describe('Lesson 19: Information Security (Advanced)', () => {

  // Test 1: Theory page
  test('1. Theory page loads successfully and contains all blocks', async ({ page }) => {
    await page.goto(`${BASE_URL}/lesson/${CLASS_PATH}/${LESSON_ID}`);
    await expect(page.locator('h1').first()).toContainText('Информационная безопасность');
    await expect(page.locator('text=Практика: Уровень 1')).toBeVisible();
    await expect(page.locator('text=Практика: Уровень 2')).toBeVisible();
    await expect(page.locator('text=Практика: Уровень 3')).toBeVisible();
  });

  // Test 2: Terminal Basic Mechanics
  test('2. Terminal UI handles basic commands (help, pwd, clear)', async ({ page }) => {
    await page.goto(`${BASE_URL}/tasks/${CLASS_PATH}/${LESSON_ID}/level1`);
    await page.waitForSelector('#terminal-output');
    
    await executeCommand(page, 'help');
    await expect(page.locator('#terminal-output')).toContainText('Available commands: help, clear, pwd');
    
    await executeCommand(page, 'pwd');
    await expect(page.locator('#terminal-output')).toContainText('/');
    
    await executeCommand(page, 'clear');
    const outputText = await page.locator('#terminal-output').innerText();
    expect(outputText.trim()).toBe('');
  });

  // Test 3: Level 1 Error Simulation
  test('3. Level 1: Simulate incorrect command error handling', async ({ page }) => {
    await page.goto(`${BASE_URL}/tasks/${CLASS_PATH}/${LESSON_ID}/level1`);
    // Phase 1 expects ufw deny from <IP>
    await page.waitForSelector('text=OSSEC HIDS Alert');
    await executeCommand(page, 'ufw deny from 1.1.1.1');
    // Expect failure message
    await expect(page.locator('#terminal-output')).toContainText('Attacker rotated IP address');
    await expect(page.locator('.text-info').first()).toBeVisible();
  });

  // Test 4: Level 1 Solvability (Happy Path)
  test('4. Level 1: Successfully complete all phases', async ({ page }) => {
    test.setTimeout(40000);
    await page.goto(`${BASE_URL}/tasks/${CLASS_PATH}/${LESSON_ID}/level1`);
    
    // Phase 1
    await page.waitForSelector('text=Multiple failed SSH login attempts');
    // Read the log to get IP
    await executeCommand(page, 'cat /var/log/auth.log');
    const logs = await page.locator('#terminal-output').innerText();
    const ipMatch = logs.match(/from ([\d\.]+) port/);
    expect(ipMatch).not.toBeNull();
    await executeCommand(page, `ufw deny from ${ipMatch[1]}`);
    
    // Phase 2
    await page.waitForSelector('text=CPU usage at 99.9%');
    await executeCommand(page, 'ps');
    const psLog = await page.locator('#terminal-output').innerText();
    const pidMatch = psLog.match(/www-data\s+(\d+)\s+99\.9\s+\.\/crypto_miner\.sh/);
    expect(pidMatch).not.toBeNull();
    await executeCommand(page, `kill -9 ${pidMatch[1]}`);
    
    // Phase 3
    await page.waitForSelector('text=Suspicious outbound traffic detected from user account');
    const p3Log = await page.locator('#terminal-output').innerText();
    const userMatch = p3Log.match(/account '([^']+)'/);
    expect(userMatch).not.toBeNull();
    await executeCommand(page, `passwd -l ${userMatch[1]}`);
    
    // Win
    await expect(page.locator('text=SYSTEM RECOVERY COMPLETE')).toBeVisible();
  });

  // Test 5: Level 2 Error Simulation
  test('5. Level 2: Simulate invalid command arguments', async ({ page }) => {
    await page.goto(`${BASE_URL}/tasks/${CLASS_PATH}/${LESSON_ID}/level2`);
    await page.waitForSelector('text=Execution of anomalous binary');
    await executeCommand(page, 'chmod');
    await expect(page.locator('#terminal-output')).toContainText('missing operand');
  });

  // Test 6: Level 2 Solvability (Happy Path)
  test('6. Level 2: Successfully complete all phases', async ({ page }) => {
    test.setTimeout(40000);
    await page.goto(`${BASE_URL}/tasks/${CLASS_PATH}/${LESSON_ID}/level2`);
    
    // Phase 1
    await page.waitForSelector('text=Execution of anomalous binary');
    await executeCommand(page, 'ls /var/tmp');
    const lsOut = await page.locator('#terminal-output').innerText();
    const backdoor = lsOut.match(/srv_update_\d+\.elf/)[0];
    await executeCommand(page, `chmod -x /var/tmp/${backdoor}`);
    
    // Phase 2
    await page.waitForSelector('text=File ownership modification');
    await executeCommand(page, 'chown root:root /etc/shadow');
    
    // Phase 3
    await page.waitForSelector('text=root\'s SSH keys');
    await executeCommand(page, 'rm /root/.ssh/authorized_keys');
    
    // Phase 4
    await page.waitForSelector('text=Suspicious persistence mechanism');
    await executeCommand(page, 'crontab -r');
    
    // Phase 5
    await page.waitForSelector('text=Unauthorized outbound connection');
    const c2Log = await page.locator('#terminal-output').innerText();
    const c2Match = c2Log.match(/C2 server \(([\d\.]+)\)/);
    expect(c2Match).not.toBeNull();
    await executeCommand(page, `ufw deny out to ${c2Match[1]}`);
    
    // Win
    await expect(page.locator('text=SYSTEM RECOVERY COMPLETE')).toBeVisible();
  });

  // Test 7: Level 3 Timeout Hardcore Reset
  test('7. Level 3: Verify local timer hardcore reset on timeout', async ({ page }) => {
    test.setTimeout(45000);
    await page.goto(`${BASE_URL}/tasks/${CLASS_PATH}/${LESSON_ID}/level3`);
    await page.click('#start-btn');
    await page.waitForSelector('text=Rapid SYN scan detected');
    
    // Wait for the 35s timer to expire.
    // The test framework shouldn't hang, we will just wait for the specific text.
    await expect(page.locator('text=CRITICAL TIMEOUT')).toBeVisible({ timeout: 40000 });
  });

  // Test 8: Level 3 Incorrect Action Penalty
  test('8. Level 3: Verify incorrect actions lead to immediate failure', async ({ page }) => {
    await page.goto(`${BASE_URL}/tasks/${CLASS_PATH}/${LESSON_ID}/level3`);
    await page.click('#start-btn');
    await page.waitForSelector('text=Rapid SYN scan detected');
    
    // Block wrong IP
    await executeCommand(page, 'ufw deny from 8.8.8.8');
    await expect(page.locator('text=You blocked the wrong IP')).toBeVisible();
  });

  // Test 9: Level 3 Solvability (Happy Path)
  test('9. Level 3: Successfully complete hardcore mode', async ({ page }) => {
    test.setTimeout(60000);
    await page.goto(`${BASE_URL}/tasks/${CLASS_PATH}/${LESSON_ID}/level3`);
    await page.click('#start-btn');
    
    // Phase 1
    await page.waitForSelector('text=Rapid SYN scan detected');
    const p1Log = await page.locator('#terminal-output').innerText();
    const p1Match = p1Log.match(/Source: ([\d\.]+)/);
    await executeCommand(page, `ufw deny from ${p1Match[1]}`);
    
    // Phase 2
    await page.waitForSelector('text=Interactive shell spawned');
    await executeCommand(page, 'ps');
    const p2Log = await page.locator('#terminal-output').innerText();
    const p2Match = p2Log.match(/www-data\s+(\d+)\s+0\.0\s+\/bin\/bash/);
    await executeCommand(page, `kill -9 ${p2Match[1]}`);
    
    // Phase 3
    await page.waitForSelector('text=Sensitive file /etc/shadow copied to /tmp/shadow.bak');
    await executeCommand(page, 'rm /tmp/shadow.bak');
    
    // Phase 4
    await page.waitForSelector('text=SUID binary created');
    const p4Log = await page.locator('#terminal-output').innerText();
    const p4Match = p4Log.match(/suid_bash_\d+/);
    await executeCommand(page, `chmod -s /var/tmp/${p4Match[0]}`);
    
    // Phase 5
    await page.waitForSelector('text=Unauthorized account');
    const p5Log = await page.locator('#terminal-output').innerText();
    const p5Match = p5Log.match(/'(sys_\d+)' created/);
    await executeCommand(page, `passwd -l ${p5Match[1]}`);
    
    // Phase 6
    await page.waitForSelector('text=Suspected fork bomb');
    await executeCommand(page, 'ps');
    const p6Log = await page.locator('#terminal-output').innerText();
    const p6Match = p6Log.match(/root\s+(\d+)\s+100\.0\s+stress-ng/);
    await executeCommand(page, `kill -9 ${p6Match[1]}`);
    
    // Win
    await expect(page.locator('text=SYSTEM RECOVERY COMPLETE')).toBeVisible();
  });

  // Test 10: Unknown command handling
  test('10. Terminal properly handles unknown commands', async ({ page }) => {
    await page.goto(`${BASE_URL}/tasks/${CLASS_PATH}/${LESSON_ID}/level1`);
    await page.waitForSelector('#terminal-output');
    
    await executeCommand(page, 'sudo rm -rf /');
    await expect(page.locator('#terminal-output')).toContainText('bash: sudo: command not found');
  });

});
