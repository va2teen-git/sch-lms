import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';

const TEST_STUDENT = {
  firstName: 'ТестХК',
  lastName: 'Агент',
  className: '8-класс',
};

async function setupStudentSession(page) {
  await page.addInitScript((student) => {
    localStorage.setItem('student_firstName', student.firstName);
    localStorage.setItem('student_lastName', student.lastName);
    localStorage.setItem('student_class', student.className);
  }, TEST_STUDENT);
}

async function enterEditorRun(page, code) {
  await page.locator('#hk-code-editor').fill(code);
  await page.locator('#hk-btn-run').click();
}

async function runLinuxInModal(page, commands) {
  await expect(page.locator('#hk-terminal-overlay')).toBeVisible();
  const input = page.locator('#hk-term-input');
  for (const cmd of commands) {
    await input.fill(cmd);
    await input.press('Enter');
  }
  await page.locator('#hk-term-close').click();
  await expect(page.locator('#hk-terminal-overlay')).toBeHidden();
}

test.describe('Hotline KuMir: E2E (5 Levels, KuMir VM, GBR Combat, Zero-Dep, 1366x768, Telemetry)', () => {
  test('1. Viewport 1366x768, Zero-Dependency (0 external URLs), and Idle-Zero 0 FPS check', async ({ page }) => {
    await setupStudentSession(page);
    await page.setViewportSize({ width: 1366, height: 768 });

    const externalUrls = [];
    const consoleErrors = [];
    page.on('request', (req) => {
      const url = req.url();
      if (!url.startsWith('http://127.0.0.1') && !url.startsWith('http://localhost') && !url.startsWith('data:')) {
        externalUrls.push(url);
      }
    });
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    await page.goto('/games/hotline-kumir?level=1&seed=42&fastAnim=1&mute=1');
    await expect(page.locator('#hk-briefing-overlay')).toBeVisible();
    await page.locator('#hk-btn-start-mission').click();
    await expect(page.locator('#hk-briefing-overlay')).toBeHidden();

    expect(externalUrls).toEqual([]);
    expect(consoleErrors).toEqual([]);

    const layoutOk = await page.evaluate(() => {
      const doc = document.documentElement;
      const editor = document.getElementById('hk-code-editor').getBoundingClientRect();
      const canvas = document.getElementById('hk-arena-canvas').getBoundingClientRect();
      const timer = document.getElementById('hk-turn-timer').getBoundingClientRect();
      return {
        noHorizontalOverflow: doc.scrollWidth <= doc.clientWidth,
        editorVisible: editor.width > 200 && editor.height > 150,
        canvasVisible: canvas.width > 250 && canvas.height > 150,
        timerVisible: timer.width > 40 && timer.height > 20,
      };
    });
    expect(layoutOk).toEqual({
      noHorizontalOverflow: true,
      editorVisible: true,
      canvasVisible: true,
      timerVisible: true,
    });

    // Idle-Zero check: rAF must stay stopped during idle coding
    const statsBefore = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getRenderStats());
    await page.waitForTimeout(450);
    const statsAfter = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getRenderStats());
    expect(statsAfter.isLoopRunning).toBe(false);
    expect(statsAfter.rafFrames).toBe(statsBefore.rafFrames);
  });

  test('2. Browser KuMir interpreter handles valid steps, Russian syntax errors, and infinite loops safely', async ({ page }) => {
    await setupStudentSession(page);
    await page.goto('/games/hotline-kumir?level=1&seed=42&fastAnim=1&mute=1&skipBriefing=1');

    // Valid command moves robot
    await enterEditorRun(page, 'вправо');
    const st1 = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getState());
    expect(st1.player.x).toBe(2);

    // Syntax error displays Russian message with line number
    await enterEditorRun(page, 'вправо\nнц 3 раз\n  вниз');
    await expect(page.locator('#hk-error-box')).toBeVisible();
    const errTxt = await page.locator('#hk-error-box').textContent();
    expect(errTxt).toContain('Строка 2');
    expect(errTxt).toContain('кц');

    // Empty infinite loop aborts safely via E_RT_INFINITE_LOOP
    await enterEditorRun(page, 'нц пока сверху свободно\nкц');
    await expect(page.locator('#hk-error-box')).toBeVisible();
    const loopErr = await page.locator('#hk-error-box').textContent();
    expect(loopErr).toContain('зацикливание');
  });

  test('3. Play through all 5 levels via KuMir + real Linux terminal commands & verify telemetry DB + /courses badge', async ({ page }) => {
    await setupStudentSession(page);
    await page.setViewportSize({ width: 1366, height: 768 });

    // Level 1
    await page.goto('/games/hotline-kumir?level=1&seed=42&fastAnim=1&mute=1&skipBriefing=1');
    const tel1Promise = page.waitForResponse((r) => r.url().includes('/api/hotline-kumir/progress') && r.status() === 200);
    await enterEditorRun(page, 'вверх; вверх\nнц 4 раз\nвправо\nкц\nподключиться');
    await runLinuxInModal(page, ['ls -la', 'cat .gate.conf', 'unlock 4821']);
    await enterEditorRun(page, 'нц 10 раз\nвправо\nкц\nзакрасить\nвправо; вправо; вправо\nнц 4 раз\nвниз\nкц');
    await expect(page.locator('#hk-result-overlay')).toBeVisible();
    await tel1Promise;

    // Level 2 via "Next Level" button
    await page.locator('#hk-btn-next-level').click();
    await page.locator('#hk-btn-start-mission').click();
    await enterEditorRun(page, 'нц 5 раз\nвправо\nкц\nвниз; подключиться');
    await runLinuxInModal(page, [
      'cat ~/.bash_history',
      'cd /srv/desk',
      'grep -i token .env',
      'camctl off cam-01 NEON-774',
      'laserctl off L1 NEON-774',
    ]);
    await enterEditorRun(page, 'вверх\nнц 5 раз\nвправо\nкц\nнц 5 раз\nвниз\nкц\nзакрасить\nнц 5 раз\nвверх\nкц\nнц 9 раз\nвправо\nкц\nвниз');
    await expect(page.locator('#hk-result-overlay')).toBeVisible();

    // Level 3
    await page.locator('#hk-btn-next-level').click();
    await page.locator('#hk-btn-start-mission').click();
    await enterEditorRun(
      page,
      'нц 4 раз\nвправо\nкц\nвверх\nнц 5 раз\nвправо\nкц\nвниз; укрыться; бросить вправо; вниз; вправо; вправо; вниз; подключиться'
    );
    await runLinuxInModal(page, [
      'find /home -name "*.dmp"',
      'strings /home/analyst/.cache/core.dmp | grep PASS',
      'echo TUVPQS05MDI= | base64 -d',
      'chmod +r /opt/vault/coords.txt',
      'cat /opt/vault/coords.txt',
      'vault_unlock MEOA-902',
    ]);
    await enterEditorRun(
      page,
      'вниз; вниз; вниз\nнц 6 раз\nвправо\nкц\nзакрасить\nвлево; влево; вверх; выбить дверь вверх; вверх; вверх\nнц 5 раз\nвправо\nкц'
    );
    await expect(page.locator('#hk-result-overlay')).toBeVisible();

    // Level 4 (2 relays)
    await page.locator('#hk-btn-next-level').click();
    await page.locator('#hk-btn-start-mission').click();
    await enterEditorRun(page, 'нц 4 раз\nвправо\nкц\nнц 5 раз\nвниз\nкц\nнц 8 раз\nвправо\nкц\nподключиться');
    await runLinuxInModal(page, [
      'ps aux',
      'ss -tulpn',
      'sudo -l',
      'gridctl reset --no-alarm',
      'tar -czf /mnt/usb/audit.tar.gz /srv/secret',
    ]);
    await enterEditorRun(
      page,
      'вверх\nнц 8 раз\nвправо\nкц\nзакрасить\nнц 8 раз\nвлево\nкц\nвверх; вверх; бросить влево\nнц 3 раз\nвверх\nкц\nнц 3 раз\nвправо\nкц\nзакрасить'
    );
    await enterEditorRun(
      page,
      'вправо; вправо; вправо; вниз\nнц пока не снизу опасно\n  ждать\nкц\nвниз; отключить влево; вправо; вправо; вправо; вниз'
    );
    await expect(page.locator('#hk-result-overlay')).toBeVisible();

    // Level 5 (2 relays)
    await page.locator('#hk-btn-next-level').click();
    await page.locator('#hk-btn-start-mission').click();
    await enterEditorRun(
      page,
      'нц 4 раз\nвправо\nкц\nнц 6 раз\nвниз\nкц\nвправо; закрасить\nнц 6 раз\nвправо\nкц\nнц 3 раз\nвверх\nкц\nподключиться'
    );
    await runLinuxInModal(page, [
      'find / -name "id_rsa" 2>/dev/null',
      'chmod 600 /home/root_backup/.ssh/id_rsa',
      'scp -P 2222 -i /home/root_backup/.ssh/id_rsa master@127.0.0.1:/vault/dump.sql /mnt/usb/',
      'rm /var/log/access.log',
    ]);
    await expect(page.locator('#hk-gbr-tracker')).toBeVisible();
    await enterEditorRun(
      page,
      'вниз; вниз; вниз\nнц 8 раз\nвправо\nкц\nвверх\nнц пока не сверху опасно\n  ждать\nкц\nвверх; вверх; отключить влево\nнц 6 раз\nвправо\nкц\nвверх; закрасить; вверх; влево; вверх; вверх; вправо'
    );
    await expect(page.locator('#hk-result-overlay')).toBeVisible();

    // Verify /courses entry & counter reflects 5/5
    await page.goto('/courses');
    const counter = page.locator('#hotline-kumir-counter');
    await expect(counter).toBeVisible();
    await expect(counter).toHaveAttribute('href', '/games/hotline-kumir');
    await expect(counter).toContainText('5 / 5');

    // Verify SQLite records directly and cleanup test user rows
    const db = new Database(path.join(process.cwd(), 'telemetry.db'));
    const telRows = db
      .prepare(
        `SELECT action_type, course_slug, lesson_id, level_number
         FROM telemetry
         WHERE first_name = ? AND last_name = ? AND action_type = 'hotline_kumir_complete'`
      )
      .all(TEST_STUDENT.firstName, TEST_STUDENT.lastName);
    expect(telRows.length).toBeGreaterThanOrEqual(5);
    expect(telRows[0].course_slug).toBe('games');
    expect(telRows[0].lesson_id).toBe('hotline-kumir');
    expect(telRows[0].level_number).toBe(0);

    const progRows = db
      .prepare(`SELECT level_id, best_rank FROM hotline_kumir_progress WHERE first_name = ? AND last_name = ?`)
      .all(TEST_STUDENT.firstName, TEST_STUDENT.lastName);
    expect(progRows.length).toBe(5);

    db.prepare(`DELETE FROM telemetry WHERE first_name = ? AND last_name = ?`).run(
      TEST_STUDENT.firstName,
      TEST_STUDENT.lastName
    );
    db.prepare(`DELETE FROM hotline_kumir_progress WHERE first_name = ? AND last_name = ?`).run(
      TEST_STUDENT.firstName,
      TEST_STUDENT.lastName
    );
    db.close();
  });

  test('4. Fail-Forward ESCAPE_RACE: camera alarm triggers GBR dispatch (not Game Over) and allows extraction', async ({ page }) => {
    await setupStudentSession(page);
    await page.goto('/games/hotline-kumir?level=1&seed=77&fastAnim=1&mute=1&skipBriefing=1');

    // Intentionally enter camera cone (12,7)
    await enterEditorRun(page, 'нц 6 раз\nвправо\nкц\nвниз; вниз\nнц 5 раз\nвправо\nкц');
    await expect(page.locator('#hk-gbr-tracker')).toBeVisible();
    const stAlarm = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getState());
    expect(stAlarm.phase).toBe('ESCAPE_RACE');

    // Move back, unlock door, extract before ETA hits 0
    await enterEditorRun(page, 'нц 5 раз\nвлево\nкц\nвверх; вверх; влево; вверх; вверх; подключиться');
    await runLinuxInModal(page, ['unlock 4821']);
    await enterEditorRun(page, 'нц 9 раз\nвправо\nкц\nзакрасить\nвправо; вправо; вправо\nнц 4 раз\nвниз\nкц');

    await expect(page.locator('#hk-result-overlay')).toBeVisible();
    const endState = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getState());
    expect(endState.lastResult.styleBadge).toBe('ESCAPE');
    expect(endState.lastResult.outcomeBranch).toBe('escape_before_gbr');
  });

  test('5. Fail-Forward GBR_BREACH_COMBAT: wait until ETA=0, fight spawned GBR unit with KuMir, extract', async ({ page }) => {
    await setupStudentSession(page);
    await page.goto('/games/hotline-kumir?level=1&mask=tony&seed=77&fastAnim=1&mute=1&skipBriefing=1');

    await enterEditorRun(page, 'нц 6 раз\nвправо\nкц\nвниз; вниз\nнц 5 раз\nвправо\nкц');
    await expect(page.locator('#hk-gbr-tracker')).toBeVisible();

    // Advance timeouts until GBR enters the building
    await page.evaluate(() => {
      while (!window.__HOTLINE_KUMIR_TEST__.getState().gbrSpawned) {
        window.__HOTLINE_KUMIR_TEST__.forceTimeout();
      }
    });

    const combatState = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getState());
    expect(combatState.phase).toBe('GBR_BREACH_COMBAT');
    await expect(page.locator('#hk-phase-badge')).toContainText('БОЙ С ГБР');

    await enterEditorRun(page, 'нц 5 раз\nвлево\nкц\nвверх; вверх; влево; вверх; вверх; подключиться');
    await runLinuxInModal(page, ['unlock 4821']);

    const killIfNear = 'если рядом враг то\n  оглушить\n  добить\nвсе';
    await enterEditorRun(
      page,
      `${killIfNear}\nнц 9 раз\n  ${killIfNear}\n  вправо\nкц\nзакрасить\nнц 3 раз\n  ${killIfNear}\n  вправо\nкц\nнц 4 раз\n  ${killIfNear}\n  вниз\nкц`
    );

    await expect(page.locator('#hk-result-overlay')).toBeVisible();
    const finalState = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getState());
    expect(finalState.lastResult.styleBadge).toBe('COMBAT');
    expect(finalState.lastResult.outcomeBranch).toBe('combat_gbr');
  });

  test('6. FX Idle-Zero <= 420ms without fastAnim, Atlas + Camera modes & render all 5 level themes cleanly', async ({ page }) => {
    await setupStudentSession(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/games/hotline-kumir?level=3&mask=rasmus&seed=42&mute=1&skipBriefing=1');
    await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.waitForAtlasReady());

    // Run tactical throw + dash to trigger FX in normal (non-fastAnim) mode
    await enterEditorRun(page, 'бросить вправо; рывок вправо');
    // Wait 550ms (> 420ms max FX window): rAF loop must auto-stop back to Idle-Zero
    await page.waitForTimeout(550);
    const s1 = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getRenderStats());
    expect(s1.isLoopRunning).toBe(false);
    await page.waitForTimeout(250);
    const s2 = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getRenderStats());
    expect(s2.rafFrames).toBe(s1.rafFrames);

    // Verify camera OVERVIEW & FOLLOW toggles via HUD buttons
    await page.locator('#hk-btn-cam-overview').click();
    const camOver = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getCameraState());
    expect(camOver.mode).toBe('OVERVIEW');
    await page.locator('#hk-btn-cam-follow').click();
    const camFol = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getCameraState());
    expect(camFol.mode).toBe('FOLLOW');

    // Optional visual screenshot capture when HK_SCREENSHOT_DIR is set
    const shotDir = process.env.HK_SCREENSHOT_DIR;
    const cases = [
      { level: 1, mask: 'richard', slug: 'level1-kpp-richard' },
      { level: 2, mask: 'sprint', slug: 'level2-lobby-sprint' },
      { level: 3, mask: 'rasmus', slug: 'level3-office-rasmus' },
      { level: 4, mask: 'tony', slug: 'level4-server-tony' },
      { level: 5, mask: 'richard', slug: 'level5-vault-gbr' },
    ];
    for (const c of cases) {
      await page.evaluate(({ level, mask }) => {
        window.__HOTLINE_KUMIR_TEST__.selectLevel(level, mask);
        window.__HOTLINE_KUMIR_TEST__.setCameraMode('FOLLOW');
      }, c);
      if (c.level === 5) {
        await page.evaluate(() => {
          window.__HOTLINE_KUMIR_TEST__.execLinux('chmod 600 /home/root_backup/.ssh/id_rsa');
          window.__HOTLINE_KUMIR_TEST__.execLinux(
            'scp -P 2222 -i /home/root_backup/.ssh/id_rsa master@127.0.0.1:/vault/dump.sql /mnt/usb/'
          );
          window.__HOTLINE_KUMIR_TEST__.execLinux('rm /var/log/access.log');
          while (!window.__HOTLINE_KUMIR_TEST__.getState().gbrSpawned) {
            window.__HOTLINE_KUMIR_TEST__.forceTimeout();
          }
          window.__HOTLINE_KUMIR_TEST__.flushAnimations();
        });
      }
      const theme = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getState().theme);
      expect(theme).toBeTruthy();
      if (shotDir) {
        await page.locator('#hk-arena-canvas').screenshot({ path: path.join(shotDir, `${c.slug}-follow.png`) });
        await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.setCameraMode('OVERVIEW'));
        await page.locator('#hk-arena-canvas').screenshot({ path: path.join(shotDir, `${c.slug}-overview.png`) });
      }
    }

    if (shotDir) {
      await page.goto('/games/hotline-kumir?level=1&seed=42&mute=1');
      await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.waitForAtlasReady());
      await expect(page.locator('#hk-briefing-overlay')).toBeVisible();
      await page.screenshot({ path: path.join(shotDir, 'briefing-portraits.png') });
    }
  });
});
