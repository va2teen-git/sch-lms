import { test, expect } from '@playwright/test';
import Database from 'better-sqlite3';
import path from 'path';

const TEST_STUDENT = {
  firstName: 'ТестХК',
  lastName: 'Агент',
  className: '8-класс',
};

function cleanupTestStudentDb() {
  try {
    const db = new Database(path.join(process.cwd(), 'telemetry.db'));
    for (const table of ['telemetry', 'hotline_kumir_progress', 'hotline_kumir_state']) {
      try {
        db.prepare(`DELETE FROM ${table} WHERE first_name = ? AND last_name = ?`).run(
          TEST_STUDENT.firstName,
          TEST_STUDENT.lastName
        );
      } catch {
        // table may not exist yet before first API hit
      }
    }
    db.close();
  } catch {
    // telemetry.db may not exist yet
  }
}

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

test.describe('Кибер-Boy: E2E (5 Levels, Manual Input, Lore Commands, 40/60, GBR Anim, Progress)', () => {
  test.beforeEach(() => {
    cleanupTestStudentDb();
  });

  test.afterAll(() => {
    cleanupTestStudentDb();
  });

  test('1. Viewport 1366x768, 40/60 split, no clickable operators, Anti-Paste, Zero-Dep & Idle-Zero', async ({ page }) => {
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

    await page.goto('/games/hotline-kumir?seed=42&fastAnim=1&mute=1');
    await expect(page.locator('#hk-briefing-overlay')).toBeVisible();
    await page.locator('#hk-btn-start-mission').click();
    await expect(page.locator('#hk-briefing-overlay')).toBeHidden();

    expect(externalUrls).toEqual([]);
    expect(consoleErrors).toEqual([]);

    // No level selector, only sequential badge; no clickable snippet buttons
    await expect(page.locator('#hk-level-select')).toHaveCount(0);
    await expect(page.locator('#hk-level-badge')).toBeVisible();
    await expect(page.locator('#hk-level-badge')).toContainText('Ур.1/5');
    await expect(page.locator('#hk-snippets')).toHaveCount(0);
    await expect(page.locator('#hk-command-ref')).toBeVisible();
    await expect(page.locator('#hk-command-ref button')).toHaveCount(0);

    const layoutOk = await page.evaluate(() => {
      const doc = document.documentElement;
      const editorPane = document.getElementById('hk-editor-pane').getBoundingClientRect();
      const arenaPane = document.getElementById('hk-arena-pane').getBoundingClientRect();
      const editor = document.getElementById('hk-code-editor').getBoundingClientRect();
      const canvas = document.getElementById('hk-arena-canvas').getBoundingClientRect();
      const timer = document.getElementById('hk-turn-timer').getBoundingClientRect();
      const total = editorPane.width + arenaPane.width;
      return {
        noHorizontalOverflow: doc.scrollWidth <= doc.clientWidth,
        editorRatio: editorPane.width / total,
        arenaRatio: arenaPane.width / total,
        editorVisible: editor.width > 200 && editor.height > 150,
        canvasVisible: canvas.width > 250 && canvas.height > 150,
        timerVisible: timer.width > 40 && timer.height > 20,
      };
    });
    expect(layoutOk.noHorizontalOverflow).toBe(true);
    expect(layoutOk.editorRatio).toBeGreaterThan(0.38);
    expect(layoutOk.editorRatio).toBeLessThan(0.42);
    expect(layoutOk.arenaRatio).toBeGreaterThan(0.58);
    expect(layoutOk.arenaRatio).toBeLessThan(0.62);
    expect(layoutOk.editorVisible).toBe(true);
    expect(layoutOk.canvasVisible).toBe(true);
    expect(layoutOk.timerVisible).toBe(true);

    // Anti-Paste protection on code editor
    const pasteBlocked = await page.evaluate(() => {
      const ed = document.getElementById('hk-code-editor');
      const ev = new Event('paste', { bubbles: true, cancelable: true });
      ed.dispatchEvent(ev);
      return ev.defaultPrevented;
    });
    expect(pasteBlocked).toBe(true);
    await expect(page.locator('#hk-error-box')).toBeVisible();
    await expect(page.locator('#hk-error-box')).toContainText('Вставка отключена');

    // Idle-Zero check: rAF must stay stopped during idle coding
    const statsBefore = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getRenderStats());
    await page.waitForTimeout(450);
    const statsAfter = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getRenderStats());
    expect(statsAfter.isLoopRunning).toBe(false);
    expect(statsAfter.rafFrames).toBe(statsBefore.rafFrames);
  });

  test('2. Browser KuMir interpreter handles valid steps, lore hints for «закрасить», syntax errors, and infinite loops', async ({ page }) => {
    await setupStudentSession(page);
    await page.goto('/games/hotline-kumir?seed=42&fastAnim=1&mute=1&skipBriefing=1');

    // Valid command moves agent
    await enterEditorRun(page, 'вправо');
    const st1 = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getState());
    expect(st1.player.x).toBe(2);

    // Legacy "закрасить" guides student to "пометить"
    await enterEditorRun(page, 'закрасить');
    await expect(page.locator('#hk-error-box')).toBeVisible();
    await expect(page.locator('#hk-error-box')).toContainText('пометить');

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

  test('3. Lesson header entry left of Logo-Storm, removed from /courses, sequential 5-level playthrough with SQLite progress', async ({ page }) => {
    await setupStudentSession(page);
    await page.setViewportSize({ width: 1366, height: 768 });

    // Verify /courses no longer renders Hotline KuMir button
    await page.goto('/courses');
    await expect(page.locator('#hotline-kumir-counter')).toHaveCount(0);

    // Verify lesson header has "Кибер-Boy" link strictly to the left of "Лого-Шторм"
    await page.goto('/lesson/8-класс/7');
    const cyberLink = page.locator('#cyber-boy-link');
    const sprintBtn = page.locator('#sprint-toggle');
    await expect(cyberLink).toBeVisible();
    await expect(cyberLink).toContainText('Кибер-Boy');
    await expect(sprintBtn).toBeVisible();

    const headerPositions = await page.evaluate(() => {
      const c = document.getElementById('cyber-boy-link').getBoundingClientRect();
      const s = document.getElementById('sprint-toggle').getBoundingClientRect();
      return { cyberRight: c.x + c.width, sprintLeft: s.x };
    });
    expect(headerPositions.cyberRight).toBeLessThanOrEqual(headerPositions.sprintLeft + 2);

    await cyberLink.click();
    await page.waitForURL(/\/games\/hotline-kumir\?returnTo=/);
    await expect(page.locator('#hk-back-link')).toHaveAttribute('href', '/lesson/8-класс/7');

    // Trying to skip to ?level=5 must still load level 1
    await page.goto('/games/hotline-kumir?level=5&seed=42&fastAnim=1&mute=1&skipBriefing=1');
    await expect.poll(() => page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getState().levelId)).toBe(1);

    // Level 1
    const tel1Promise = page.waitForResponse((r) => r.url().includes('/api/hotline-kumir/progress') && r.status() === 200);
    await enterEditorRun(page, 'вверх; вверх\nнц 4 раз\nвправо\nкц\nподключиться');
    await runLinuxInModal(page, ['ls -la', 'cat .gate.conf', 'unlock 4821']);
    await enterEditorRun(page, 'нц 10 раз\nвправо\nкц\nпометить\nвправо; вправо; вправо\nнц 4 раз\nвниз\nкц');
    await expect(page.locator('#hk-result-overlay')).toBeVisible();
    await tel1Promise;

    // Clear localStorage level cache & reload -> server SQLite state must resume directly at Level 2!
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) {
        if (k.startsWith('cyber_boy_level:')) localStorage.removeItem(k);
      }
    });
    await page.goto('/games/hotline-kumir?seed=42&fastAnim=1&mute=1&skipBriefing=1');
    await expect.poll(() => page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getState().levelId)).toBe(2);
    await expect(page.locator('#hk-level-badge')).toContainText('Ур.2/5');

    // Level 2
    await enterEditorRun(page, 'нц 5 раз\nвправо\nкц\nвниз; подключиться');
    await runLinuxInModal(page, [
      'cat ~/.bash_history',
      'cd /srv/desk',
      'grep -i token .env',
      'camctl off cam-01 NEON-774',
      'laserctl off L1 NEON-774',
    ]);
    await enterEditorRun(page, 'вверх\nнц 5 раз\nвправо\nкц\nнц 5 раз\nвниз\nкц\nпометить\nнц 5 раз\nвверх\nкц\nнц 9 раз\nвправо\nкц\nвниз');
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
      'вниз; вниз; вниз\nнц 6 раз\nвправо\nкц\nпометить\nвлево; влево; вверх; выбить дверь вверх; вверх; вверх\nнц 5 раз\nвправо\nкц'
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
      'вверх\nнц 8 раз\nвправо\nкц\nпометить\nнц 8 раз\nвлево\nкц\nвверх; вверх; бросить влево\nнц 3 раз\nвверх\nкц\nнц 3 раз\nвправо\nкц\nпометить'
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
      'нц 4 раз\nвправо\nкц\nнц 6 раз\nвниз\nкц\nвправо; пометить\nнц 6 раз\nвправо\nкц\nнц 3 раз\nвверх\nкц\nподключиться'
    );
    await runLinuxInModal(page, [
      'find / -name "id_rsa" 2>/dev/null',
      'chmod 600 /home/root_backup/.ssh/id_rsa',
      'scp -P 2222 -i /home/root_backup/.ssh/id_rsa master@127.0.0.1:/vault/dump.sql /mnt/usb/',
      'rm /var/log/access.log',
    ]);
    await expect(page.locator('#hk-gbr-tracker')).toBeVisible();
    const tel5Promise = page.waitForResponse((r) => r.url().includes('/api/hotline-kumir/progress') && r.status() === 200);
    await enterEditorRun(
      page,
      'вниз; вниз; вниз\nнц 8 раз\nвправо\nкц\nвверх\nнц пока не сверху опасно\n  ждать\nкц\nвверх; вверх; отключить влево\nнц 6 раз\nвправо\nкц\nвверх; пометить; вверх; влево; вверх; вверх; вправо'
    );
    await expect(page.locator('#hk-result-overlay')).toBeVisible();
    await tel5Promise;

    // Verify SQLite records directly
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

    const stateRow = db
      .prepare(`SELECT current_level FROM hotline_kumir_state WHERE first_name = ? AND last_name = ?`)
      .get(TEST_STUDENT.firstName, TEST_STUDENT.lastName);
    expect(stateRow?.current_level).toBe(5);
    db.close();
  });

  test('4. Fail-Forward ESCAPE_RACE: camera alarm triggers GBR dispatch (not Game Over) and allows extraction', async ({ page }) => {
    await setupStudentSession(page);
    await page.goto('/games/hotline-kumir?seed=77&fastAnim=1&mute=1&skipBriefing=1');

    // Intentionally enter camera cone (12,7)
    await enterEditorRun(page, 'нц 6 раз\nвправо\nкц\nвниз; вниз\nнц 5 раз\nвправо\nкц');
    await expect(page.locator('#hk-gbr-tracker')).toBeVisible();
    const stAlarm = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getState());
    expect(stAlarm.phase).toBe('ESCAPE_RACE');

    // Move back, unlock door, extract before ETA hits 0
    await enterEditorRun(page, 'нц 5 раз\nвлево\nкц\nвверх; вверх; влево; вверх; вверх; подключиться');
    await runLinuxInModal(page, ['unlock 4821']);
    await enterEditorRun(page, 'нц 9 раз\nвправо\nкц\nпометить\nвправо; вправо; вправо\nнц 4 раз\nвниз\nкц');

    await expect(page.locator('#hk-result-overlay')).toBeVisible();
    const endState = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getState());
    expect(endState.lastResult.styleBadge).toBe('ESCAPE');
    expect(endState.lastResult.outcomeBranch).toBe('escape_before_gbr');
  });

  test('5. Fail-Forward GBR_BREACH_COMBAT: wait until ETA=0, fight spawned GBR unit with KuMir, extract', async ({ page }) => {
    await setupStudentSession(page);
    await page.goto('/games/hotline-kumir?mask=tony&seed=77&fastAnim=1&mute=1&skipBriefing=1');

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

    const killIfNear = 'если рядом враг то\n  оглушить\n  обезвредить\nвсе';
    await enterEditorRun(
      page,
      `${killIfNear}\nнц 9 раз\n  ${killIfNear}\n  вправо\nкц\nпометить\nнц 3 раз\n  ${killIfNear}\n  вправо\nкц\nнц 4 раз\n  ${killIfNear}\n  вниз\nкц`
    );

    await expect(page.locator('#hk-result-overlay')).toBeVisible();
    const finalState = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getState());
    expect(finalState.lastResult.styleBadge).toBe('COMBAT');
    expect(finalState.lastResult.outcomeBranch).toBe('combat_gbr');
  });

  test('6. Approaching GBR van animation, FX Idle-Zero <= 420ms, Atlas + Camera modes & render all 5 themes', async ({ page }) => {
    await setupStudentSession(page);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto('/games/hotline-kumir?seed=42&mute=1&skipBriefing=1');
    await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.waitForAtlasReady());

    // Trigger alarm on Level 1 in normal mode and verify approaching GBR van animation
    await enterEditorRun(page, 'нц 6 раз\nвправо\nкц\nвниз; вниз\nнц 5 раз\nвправо\nкц');
    await expect(page.locator('#hk-gbr-tracker')).toBeVisible();
    await expect(page.locator('#hk-gbr-van-marker')).toBeVisible();
    await page.waitForTimeout(550);

    const gbr1 = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getGbrAnimationState());
    expect(gbr1.active).toBe(true);
    expect(gbr1.x).not.toBeNull();
    expect(gbr1.animating).toBe(false);

    // Advance 2 turns so GBR drives closer to building entrance
    await page.evaluate(() => {
      window.__HOTLINE_KUMIR_TEST__.forceTimeout();
      window.__HOTLINE_KUMIR_TEST__.forceTimeout();
    });
    await page.waitForTimeout(550);
    const gbr2 = await page.evaluate(() => window.__HOTLINE_KUMIR_TEST__.getGbrAnimationState());
    expect(gbr2.progress).toBeGreaterThan(gbr1.progress);
    expect(gbr2.x).toBeLessThan(gbr1.x);
    expect(gbr2.animating).toBe(false);

    const markerLeft = await page.locator('#hk-gbr-van-marker').evaluate((el) => parseFloat(el.style.left || '0'));
    expect(markerLeft).toBeGreaterThan(0);

    // Switch to Level 3 Rasmus for tactical throw + dash Idle-Zero check
    await page.evaluate(() => {
      window.__HOTLINE_KUMIR_TEST__.selectLevel(3, 'rasmus');
    });
    await enterEditorRun(page, 'бросить вправо; рывок вправо');
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

    const cases = [
      { level: 1, mask: 'richard' },
      { level: 2, mask: 'sprint' },
      { level: 3, mask: 'rasmus' },
      { level: 4, mask: 'tony' },
      { level: 5, mask: 'richard' },
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
    }
  });
});
