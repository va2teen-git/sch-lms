import test from 'node:test';
import assert from 'node:assert/strict';
import { compileKumir, executeKumirProgram } from '../src/lib/hotline-kumir/kumir-interpreter.ts';
import { ATLAS_SPRITES } from '../src/lib/hotline-kumir/atlas-manifest.ts';
import { HotlineGameEngine, HOTLINE_KUMIR_LEVELS } from '../src/lib/hotline-kumir/game-engine.ts';
import {
  getDoorVisualBounds,
  getExitFenceHoleVisualBounds,
  getInteractableVisualBounds,
} from '../src/lib/hotline-kumir/object-bounds.ts';
import type { KumirSensorReader } from '../src/lib/hotline-kumir/types.ts';

test('KuMir interpreter: compiles classic and speed-coding syntax with yo normalization', () => {
  const src = `
    использовать Робот
    алг Главный
    нач
      Вспомогательный
      если справа свободно то
        вправо
      всё
    кон
    алг Вспомогательный
    нач
      нц 2 раз
        вниз
      кц
    кон
  `;
  const res = compileKumir(src);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.program.usedLoops, true);
  assert.equal(res.program.usedConditions, true);
  assert.equal(res.program.usedSubprograms, true);

  const actions: string[] = [];
  const sensors: KumirSensorReader = {
    evalSensor: () => true,
  };
  const gen = executeKumirProgram(res.program, sensors);
  while (true) {
    const step = gen.next();
    if (step.done) {
      assert.equal(step.value.status, 'COMPLETED');
      break;
    }
    if (step.value.status === 'YIELD_ACTION') {
      actions.push(`${step.value.request.action}:${step.value.request.dir || ''}`);
    }
  }
  assert.deepEqual(actions, ['MOVE:DOWN', 'MOVE:DOWN', 'MOVE:RIGHT']);
});

test('KuMir interpreter: reports Russian errors with accurate line numbers', () => {
  const unclosed = compileKumir('нц 3 раз\n  вправо\n');
  assert.equal(unclosed.ok, false);
  if (!unclosed.ok) {
    assert.equal(unclosed.errors[0].code, 'E_PARSE_MISSING_END');
    assert.equal(unclosed.errors[0].line, 1);
  }

  const badCall = compileKumir('вправо\nНесуществующийАлг');
  assert.equal(badCall.ok, false);
  if (!badCall.ok) {
    assert.equal(badCall.errors[0].code, 'E_SEM_UNKNOWN_ALG');
    assert.equal(badCall.errors[0].line, 2);
  }
});

test('KuMir interpreter: Cyber-Boy lore commands (пометить, обезвредить, датчики метки, блок закрасить/открыть)', () => {
  const okLore = compileKumir(`
    использовать Агент
    пометить
    поставить метку
    активировать
    отключить лазер вправо
    бросить маячок вправо
    приманка влево
    обезвредить
    если метка стоит и рядом пк то
      подключиться
    все
    если метки нет или реле неактивно то
      ждать
    все
  `);
  assert.equal(okLore.ok, true);
  if (okLore.ok) {
    const actions: string[] = [];
    const gen = executeKumirProgram(okLore.program, {
      evalSensor: (s) => s === 'IS_PAINTED' || s === 'NEAR_TERMINAL',
    });
    while (true) {
      const step = gen.next();
      if (step.done) break;
      if (step.value.status === 'YIELD_ACTION') {
        actions.push(`${step.value.request.action}:${step.value.request.dir || ''}`);
      }
    }
    assert.deepEqual(actions, [
      'PAINT:',
      'PAINT:',
      'PAINT:',
      'DISABLE:RIGHT',
      'THROW:RIGHT',
      'THROW:LEFT',
      'FINISH:',
      'HACK:',
    ]);
  }

  const oldPaint = compileKumir('закрасить');
  assert.equal(oldPaint.ok, false);
  if (!oldPaint.ok) {
    assert.match(oldPaint.errors[0].messageRu, /пометить/);
  }

  const oldSensor = compileKumir('если клетка закрашена то ждать все');
  assert.equal(oldSensor.ok, false);
  if (!oldSensor.ok) {
    assert.match(oldSensor.errors[0].messageRu, /метка стоит/);
  }

  const openDoor = compileKumir('открыть вправо');
  assert.equal(openDoor.ok, false);
  if (!openDoor.ok) {
    assert.match(openDoor.errors[0].messageRu, /выбить дверь/);
  }
});

test('KuMir interpreter: stops empty infinite loop and recursive overflow safely', () => {
  const loopRes = compileKumir('нц пока сверху стена\nкц');
  assert.equal(loopRes.ok, true);
  if (loopRes.ok) {
    const gen = executeKumirProgram(loopRes.program, { evalSensor: () => true });
    const step = gen.next();
    assert.equal(step.done, true);
    assert.equal(step.value.status, 'RUNTIME_ERROR');
    if (step.value.status === 'RUNTIME_ERROR') {
      assert.equal(step.value.error.code, 'E_RT_INFINITE_LOOP');
    }
  }

  const recRes = compileKumir('алг А\nнач\n  А\nкон');
  assert.equal(recRes.ok, true);
  if (recRes.ok) {
    const gen = executeKumirProgram(recRes.program, { evalSensor: () => true });
    const step = gen.next();
    assert.equal(step.done, true);
    assert.equal(step.value.status, 'RUNTIME_ERROR');
    if (step.value.status === 'RUNTIME_ERROR') {
      assert.equal(step.value.error.code, 'E_RT_STACK_OVERFLOW');
    }
  }
});

test('Calibration invariants: themes, rotating cameras, 2 relays on L4-5, rich architectural scenes & valid props', () => {
  const expectedThemes = ['kpp_street', 'lobby_hall', 'analytics_office', 'server_hall', 'master_vault'];
  HOTLINE_KUMIR_LEVELS.forEach((lvl, idx) => {
    assert.equal(lvl.theme, expectedThemes[idx]);
    assert.ok(lvl.asciiMap[0].length >= 20, `Level ${lvl.id} width must be >= 20`);
    assert.ok(lvl.asciiMap.length >= 12, `Level ${lvl.id} height must be >= 12`);
    assert.ok(lvl.asciiMap.some((row) => row.includes('W')), `Level ${lvl.id} must have glass WINDOW tiles`);
    assert.ok(lvl.scene.props.length >= 25, `Level ${lvl.id} must have >= 25 rich props`);
    for (const pr of lvl.scene.props) {
      assert.ok(ATLAS_SPRITES[pr.sprite], `Missing atlas sprite ${pr.sprite} in Level ${lvl.id}`);
    }

    const g = new HotlineGameEngine(lvl.id, 'richard', 42);
    g.startMission();
    const initSnap = g.getSnapshot();
    const gbrToExitDist =
      Math.abs(initSnap.gbrSpawnPos.x - initSnap.exitPos.x) +
      Math.abs(initSnap.gbrSpawnPos.y - initSnap.exitPos.y);
    assert.ok(
      gbrToExitDist >= 12,
      `Level ${lvl.id} GBR main door and emergency exit must be separated (dist=${gbrToExitDist})`
    );
    assert.equal(
      initSnap.gbrSpawnPos.x,
      lvl.scene.buildingBounds.x,
      `Level ${lvl.id} GBR must enter through building main facade door`
    );
    const res = g.runProgramImmediate(lvl.starterCode);
    assert.equal(res.openedTerminal, false, `Level ${lvl.id} starterCode must not auto-open terminal`);
    assert.notEqual(res.snapshot.phase, 'EXTRACTION', `Level ${lvl.id} starterCode must not auto-solve`);
    if (lvl.id >= 2) {
      assert.ok(
        lvl.cameras.some((c) => c.phases.length >= 2),
        `Level ${lvl.id} must have rotating multi-phase cameras`
      );
    }
    if (lvl.id >= 4) {
      assert.equal(res.snapshot.requiredPaintCount, 2, `Level ${lvl.id} must have 2 relays`);
    } else {
      assert.equal(res.snapshot.requiredPaintCount, 1, `Level ${lvl.id} must have 1 relay`);
    }
  });
});

test('Honest COVER, patrol_raven 3-tile vision, and tactical area decoy THROW', () => {
  // Honest COVER: crouching in open corridor without adjacent C does NOT hide from Level 1 camera
  const gOpen = new HotlineGameEngine(1, 'richard', 42);
  gOpen.startMission();
  const openCrouch = gOpen.runProgramImmediate('нц 6 раз\nвправо\nкц\nвниз; вниз\nнц 5 раз\nвправо\nкц\nукрыться');
  assert.equal(openCrouch.snapshot.alarmTriggered, true);

  // Raven 3-tile vision + area decoy THROW on Level 3
  const g3 = new HotlineGameEngine(3, 'richard', 42);
  g3.startMission();
  // Walk to C(10,3) and crouch: covered by C(10,3)
  g3.runProgramImmediate('нц 4 раз\nвправо\nкц\nвверх\nнц 5 раз\nвправо\nкц\nвниз; укрыться');
  assert.equal(g3.getSnapshot().alarmTriggered, false);
  // Throw EMP decoy toward guard-office -> emits DECOY_THROWN and distracts Raven so vision cone clears
  const throwRes = g3.runProgramImmediate('бросить вправо');
  assert.ok(throwRes.events.some((e) => e.type === 'DECOY_THROWN'));
  const raven = throwRes.snapshot.enemies.find((e) => e.kind === 'patrol_raven');
  assert.ok(raven && raven.distractedTurns >= 1);
  assert.deepEqual(raven.telegraphAttackCells, []);
});

test('Linux VFS: solves all 5 levels, detects IDS 3x alarm, supports history & Tab autocomplete', () => {
  const g1 = new HotlineGameEngine(1, 'richard', 101);
  const lx1 = g1.getLinuxEngine();
  assert.ok(lx1.autocomplete('ls').includes('ls'));
  assert.ok(lx1.exec('ls -la').output.includes('.gate.conf'));
  assert.ok(lx1.exec('cat .gate.conf').output.includes('4821'));
  const u1 = g1.execLinuxCommand('unlock 4821');
  assert.equal(u1.result.objectiveCompletedNow, true);
  assert.equal(u1.snapshot.hackCompleted, true);
  assert.equal(lx1.getHistory().length, 3);

  const g1Alarm = new HotlineGameEngine(1, 'richard', 101);
  g1Alarm.startMission();
  g1Alarm.execLinuxCommand('unlock 0000');
  g1Alarm.execLinuxCommand('unlock 1111');
  const r3 = g1Alarm.execLinuxCommand('unlock 2222');
  assert.equal(r3.snapshot.alarmTriggered, true);
  assert.equal(r3.snapshot.phase, 'ESCAPE_RACE');

  const g2 = new HotlineGameEngine(2, 'richard', 102);
  assert.ok(g2.execLinuxCommand('cat ~/.bash_history').result.output.includes('/srv/desk'));
  g2.execLinuxCommand('cd /srv/desk');
  assert.ok(g2.execLinuxCommand('grep -i token .env').result.output.includes('NEON-774'));
  g2.execLinuxCommand('camctl off cam-01 NEON-774');
  const l2End = g2.execLinuxCommand('laserctl off L1 NEON-774');
  assert.equal(l2End.snapshot.hackCompleted, true);

  const g3 = new HotlineGameEngine(3, 'richard', 103);
  assert.ok(g3.execLinuxCommand('find /home -name "*.dmp"').result.output.includes('core.dmp'));
  assert.ok(g3.execLinuxCommand('strings /home/analyst/.cache/core.dmp | grep PASS').result.output.includes('TUVPQS05MDI='));
  assert.equal(g3.execLinuxCommand('echo TUVPQS05MDI= | base64 -d').result.output, 'MEOA-902');
  assert.equal(g3.execLinuxCommand('cat /opt/vault/coords.txt').result.exitCode, 1);
  g3.execLinuxCommand('chmod +r /opt/vault/coords.txt');
  assert.ok(g3.execLinuxCommand('cat /opt/vault/coords.txt').result.output.includes('MEOA-902'));
  assert.equal(g3.execLinuxCommand('vault_unlock MEOA-902').snapshot.hackCompleted, true);

  const g4 = new HotlineGameEngine(4, 'richard', 104);
  assert.ok(g4.execLinuxCommand('ps aux').result.output.includes('guard-grid'));
  assert.ok(g4.execLinuxCommand('ss -tulpn').result.output.includes('9090'));
  assert.ok(g4.execLinuxCommand('sudo -l').result.output.includes('/etc/crontab'));
  assert.ok(g4.execLinuxCommand('cat /opt/scripts/backup.sh').result.output.includes('gridctl reset --no-alarm'));
  g4.execLinuxCommand('gridctl reset --no-alarm');
  const t4 = g4.execLinuxCommand('tar -czf /mnt/usb/audit.tar.gz /srv/secret');
  assert.equal(t4.snapshot.hackCompleted, true);

  const g5 = new HotlineGameEngine(5, 'richard', 105);
  g5.startMission();
  assert.ok(g5.execLinuxCommand('find / -name "id_rsa" 2>/dev/null').result.output.includes('id_rsa'));
  assert.equal(
    g5.execLinuxCommand('scp -P 2222 -i /home/root_backup/.ssh/id_rsa master@127.0.0.1:/vault/dump.sql /mnt/usb/').result.exitCode,
    1
  );
  g5.execLinuxCommand('chmod 600 /home/root_backup/.ssh/id_rsa');
  g5.execLinuxCommand('scp -P 2222 -i /home/root_backup/.ssh/id_rsa master@127.0.0.1:/vault/dump.sql /mnt/usb/');
  const rmRes = g5.execLinuxCommand('rm /var/log/access.log');
  assert.equal(rmRes.snapshot.hackCompleted, true);
  assert.equal(rmRes.snapshot.alarmTriggered, true);
  assert.equal(rmRes.snapshot.phase, 'ESCAPE_RACE');

  const g5Ghost = new HotlineGameEngine(5, 'richard', 105);
  g5Ghost.startMission();
  g5Ghost.execLinuxCommand('chmod 600 /home/root_backup/.ssh/id_rsa');
  g5Ghost.execLinuxCommand('scp -P 2222 -i /home/root_backup/.ssh/id_rsa master@127.0.0.1:/vault/dump.sql /mnt/usb/');
  const trRes = g5Ghost.execLinuxCommand('truncate -s 0 /var/log/access.log');
  assert.equal(trRes.snapshot.hackCompleted, true);
  assert.equal(trRes.snapshot.alarmTriggered, false);
});

test('Full 5-level playthroughs: GHOST stealth routes across all 5 levels', () => {
  // Level 1 GHOST
  const g1 = new HotlineGameEngine(1, 'richard', 42);
  g1.startMission();
  g1.runProgramImmediate('вверх; вверх\nнц 4 раз\nвправо\nкц\nподключиться');
  g1.execLinuxCommand('unlock 4821');
  g1.exitTerminal();
  const r1 = g1.runProgramImmediate('нц 10 раз\nвправо\nкц\nпометить\nвправо; вправо; вправо\nнц 4 раз\nвниз\nкц');
  assert.equal(r1.snapshot.phase, 'EXTRACTION');
  assert.equal(r1.snapshot.lastResult?.styleBadge, 'GHOST');

  // Level 2 GHOST
  const g2 = new HotlineGameEngine(2, 'richard', 42);
  g2.startMission();
  g2.runProgramImmediate('нц 5 раз\nвправо\nкц\nвниз; подключиться');
  g2.execLinuxCommand('camctl off cam-01 NEON-774');
  g2.execLinuxCommand('laserctl off L1 NEON-774');
  g2.exitTerminal();
  const r2 = g2.runProgramImmediate('вверх\nнц 5 раз\nвправо\nкц\nнц 5 раз\nвниз\nкц\nпометить\nнц 5 раз\nвверх\nкц\nнц 9 раз\nвправо\nкц\nвниз');
  assert.equal(r2.snapshot.phase, 'EXTRACTION');
  assert.equal(r2.snapshot.lastResult?.styleBadge, 'GHOST');

  // Level 3 GHOST (COVER at C(10,3) + decoy throw past Raven -> T(12,5) -> *(18,8) -> silent takedown -> D1)
  const g3 = new HotlineGameEngine(3, 'richard', 42);
  g3.startMission();
  g3.runProgramImmediate(
    'нц 4 раз\nвправо\nкц\nвверх\nнц 5 раз\nвправо\nкц\nвниз; укрыться; бросить вправо; вниз; вправо; вправо; вниз; подключиться'
  );
  g3.execLinuxCommand('vault_unlock MEOA-902');
  g3.exitTerminal();
  g3.runProgramImmediate(
    'вниз; вниз; вниз\nнц 6 раз\nвправо\nкц\nпометить\nнц 6 раз\nвлево\nкц\nнц 4 раз\nвверх\nкц'
  );
  const r3 = g3.runProgramImmediate(
    'ждать; вверх; рывок вправо; бросить вправо; вправо\nесли справа враг то\n  оглушить\n  обезвредить\nвсе\nнц 5 раз\n  вправо\nкц\nвниз; вниз; вправо'
  );
  assert.equal(r3.snapshot.phase, 'EXTRACTION');
  assert.equal(r3.snapshot.lastResult?.styleBadge, 'GHOST');

  // Level 4 GHOST (2 relays: *1(21,7) and *2(16,2), decoy past guard-srv, timing cam-srv-2)
  const g4 = new HotlineGameEngine(4, 'richard', 42);
  g4.startMission();
  g4.runProgramImmediate('нц 4 раз\nвправо\nкц\nнц 5 раз\nвниз\nкц\nнц 8 раз\nвправо\nкц\nподключиться');
  g4.execLinuxCommand('gridctl reset --no-alarm');
  g4.execLinuxCommand('tar -czf /mnt/usb/audit.tar.gz /srv/secret');
  g4.exitTerminal();
  g4.runProgramImmediate(
    'вверх\nнц 8 раз\nвправо\nкц\nпометить\nнц 8 раз\nвлево\nкц\nвверх; вверх; бросить влево\nнц 3 раз\nвверх\nкц\nнц 3 раз\nвправо\nкц\nпометить'
  );
  const r4 = g4.runProgramImmediate(
    'вправо; вправо; вправо; вниз\nнц пока не снизу опасно\n  ждать\nкц\nвниз; отключить влево; вправо; вправо; вправо; вниз'
  );
  assert.equal(r4.snapshot.phase, 'EXTRACTION');
  assert.equal(r4.snapshot.lastResult?.styleBadge, 'GHOST');

  // Level 5 GHOST (2 relays: *1(6,9) and *2(26,5), silent truncate -s 0)
  const g5 = new HotlineGameEngine(5, 'richard', 42);
  g5.startMission();
  g5.runProgramImmediate('нц 4 раз\nвправо\nкц\nнц 6 раз\nвниз\nкц\nвправо; пометить\nнц 6 раз\nвправо\nкц\nнц 3 раз\nвверх\nкц\nподключиться');
  g5.execLinuxCommand('chmod 600 /home/root_backup/.ssh/id_rsa');
  g5.execLinuxCommand('scp -P 2222 -i /home/root_backup/.ssh/id_rsa master@127.0.0.1:/vault/dump.sql /mnt/usb/');
  g5.execLinuxCommand('truncate -s 0 /var/log/access.log');
  g5.exitTerminal();
  const r5 = g5.runProgramImmediate(
    'вниз; вниз; вниз\nнц 8 раз\nвправо\nкц\nвверх\nнц пока не сверху опасно\n  ждать\nкц\nвверх; вверх; отключить влево\nнц 6 раз\nвправо\nкц\nвверх; пометить; вверх; влево; вверх; вверх; вправо'
  );
  assert.equal(r5.snapshot.phase, 'EXTRACTION');
  assert.equal(r5.snapshot.lastResult?.styleBadge, 'GHOST');
  assert.equal(r5.snapshot.lastResult?.outcomeBranch, 'stealth');
});

test('Multi-route variants: EMP flank, assault breach shortcuts (ESCAPE), and Bear shield COMBAT', () => {
  // Level 3 assault shortcut D2(16,6) + southern route -> ESCAPE
  const g3Esc = new HotlineGameEngine(3, 'sprint', 55);
  g3Esc.startMission();
  g3Esc.runProgramImmediate(
    'нц 4 раз\nвправо\nкц\nвверх\nнц 5 раз\nвправо\nкц\nвниз; укрыться; бросить вправо; вправо; вниз; вправо; вниз; подключиться'
  );
  g3Esc.execLinuxCommand('vault_unlock MEOA-902');
  g3Esc.exitTerminal();
  const r3Esc = g3Esc.runProgramImmediate(
    'вниз; вниз; вниз\nнц 6 раз\nвправо\nкц\nпометить; влево; влево; вверх; выбить дверь вверх; вверх; вверх\nнц 5 раз\nвправо\nкц'
  );
  assert.equal(r3Esc.snapshot.phase, 'EXTRACTION');
  assert.equal(r3Esc.snapshot.lastResult?.styleBadge, 'ESCAPE');

  // Level 4 EMP flank: disable western laser L4-west, distract guard-srv with decoy, dash across cleanly
  const g4Emp = new HotlineGameEngine(4, 'rasmus', 88);
  g4Emp.startMission();
  const empRes = g4Emp.runProgramImmediate('нц 4 раз\nвправо\nкц\nвверх; вправо; вправо; вниз; вниз; отключить вправо; бросить вправо; рывок вправо');
  assert.equal(empRes.snapshot.alarmTriggered, false);
  assert.equal(empRes.snapshot.player.x, 9);
  assert.equal(empRes.snapshot.player.y, 4);

  // Level 5 ESCAPE via rm tamper
  const g5Esc = new HotlineGameEngine(5, 'richard', 42);
  g5Esc.startMission();
  g5Esc.runProgramImmediate('нц 4 раз\nвправо\nкц\nнц 6 раз\nвниз\nкц\nвправо; пометить\nнц 6 раз\nвправо\nкц\nнц 3 раз\nвверх\nкц\nподключиться');
  g5Esc.execLinuxCommand('chmod 600 /home/root_backup/.ssh/id_rsa');
  g5Esc.execLinuxCommand('scp -P 2222 -i /home/root_backup/.ssh/id_rsa master@127.0.0.1:/vault/dump.sql /mnt/usb/');
  g5Esc.execLinuxCommand('rm /var/log/access.log');
  g5Esc.exitTerminal();
  assert.equal(g5Esc.getSnapshot().phase, 'ESCAPE_RACE');
  const r5Esc = g5Esc.runProgramImmediate(
    'вниз; вниз; вниз\nнц 8 раз\nвправо\nкц\nвверх\nнц пока не сверху опасно\n  ждать\nкц\nвверх; вверх; отключить влево\nнц 6 раз\nвправо\nкц\nвверх; пометить; вверх; влево; вверх; вверх; вправо'
  );
  assert.equal(r5Esc.snapshot.phase, 'EXTRACTION');
  assert.equal(r5Esc.snapshot.lastResult?.styleBadge, 'ESCAPE');

  // Level 1 COMBAT Fail-Forward
  const g1 = new HotlineGameEngine(1, 'tony', 77);
  g1.startMission();
  const camTrip = g1.runProgramImmediate('нц 6 раз\nвправо\nкц\nвниз; вниз\nнц 5 раз\nвправо\nкц');
  assert.equal(camTrip.snapshot.alarmTriggered, true);
  assert.equal(camTrip.snapshot.phase, 'ESCAPE_RACE');

  while (!g1.getSnapshot().gbrSpawned) {
    g1.handleTurnTimeout();
  }
  const combatSnap = g1.getSnapshot();
  assert.equal(combatSnap.phase, 'GBR_BREACH_COMBAT');
  assert.equal(combatSnap.audioMood, 'COMBAT');
  const gbrEnemy = combatSnap.enemies.find((e) => e.isGbr);
  assert.ok(gbrEnemy && gbrEnemy.telegraphNext !== null);

  const killIfNear = 'если рядом враг то\n  оглушить\n  обезвредить\nвсе';
  g1.runProgramImmediate(
    `${killIfNear}\nнц 5 раз\n  ${killIfNear}\n  влево\nкц\nвверх; ${killIfNear}; вверх; ${killIfNear}; влево; ${killIfNear}; вверх; ${killIfNear}; вверх; подключиться`
  );
  g1.execLinuxCommand('unlock 4821');
  g1.exitTerminal();

  g1.runProgramImmediate(
    `${killIfNear}\nнц 9 раз\n  ${killIfNear}\n  вправо\nкц\nпометить\nнц 3 раз\n  ${killIfNear}\n  вправо\nкц\nнц 4 раз\n  ${killIfNear}\n  вниз\nкц\nнц пока не рядом враг\n  ждать\nкц\nоглушить\nобезвредить`
  );
  const endSnap = g1.getSnapshot();
  assert.equal(endSnap.phase, 'EXTRACTION');
  assert.equal(endSnap.lastResult?.styleBadge, 'COMBAT');
  assert.equal(endSnap.lastResult?.outcomeBranch, 'combat_gbr');

  // Level 4 Bear shield test: throw breaks shield
  const g4Bear = new HotlineGameEngine(4, 'tony', 99);
  g4Bear.startMission();
  g4Bear.runProgramImmediate('нц 4 раз\nвправо\nкц\nнц 5 раз\nвниз\nкц\nнц 8 раз\nвправо\nкц\nподключиться');
  g4Bear.execLinuxCommand('gridctl reset --no-alarm');
  g4Bear.execLinuxCommand('tar -czf /mnt/usb/audit.tar.gz /srv/secret');
  g4Bear.exitTerminal();
  g4Bear.runProgramImmediate('вверх\nнц 8 раз\nвправо\nкц\nпометить');
  // Trigger alarm by breaching D2(22,6) and wait for GBR (gbr_boar + gbr_bear)
  g4Bear.runProgramImmediate('вправо; выбить дверь вверх');
  while (!g4Bear.getSnapshot().gbrSpawned) {
    g4Bear.handleTurnTimeout();
  }
  const bear = g4Bear.getSnapshot().enemies.find((e) => e.kind === 'gbr_bear');
  assert.ok(bear && bear.shielded === true);
  let bearGuard = 0;
  while (
    bearGuard++ < 60 &&
    Math.abs(
      (g4Bear.getSnapshot().enemies.find((e) => e.kind === 'gbr_bear')?.x ?? 0) -
        g4Bear.getSnapshot().player.x
    ) +
      Math.abs(
        (g4Bear.getSnapshot().enemies.find((e) => e.kind === 'gbr_bear')?.y ?? 0) -
          g4Bear.getSnapshot().player.y
      ) >
    1
  ) {
    g4Bear.handleTurnTimeout();
    if (g4Bear.getSnapshot().phase === 'MISSION_KO') break;
  }
  if (g4Bear.getSnapshot().phase === 'GBR_BREACH_COMBAT') {
    g4Bear.runProgramImmediate('бросить');
    const bearAfter = g4Bear.getSnapshot().enemies.find((e) => e.kind === 'gbr_bear');
    assert.equal(bearAfter?.shielded, false);
  }
});

test('KuMir help commands (помощь / справка) open guide without spending turns', () => {
  const c1 = compileKumir('помощь');
  const c2 = compileKumir('справка датчики');
  assert.equal(c1.ok, true);
  assert.equal(c2.ok, true);

  const g = new HotlineGameEngine(1, 'richard', 42);
  g.startMission();
  const r1 = g.runProgramImmediate('помощь');
  assert.equal(r1.compiledOk, true);
  assert.equal(r1.openedHelp, true);
  assert.equal(r1.snapshot.turnIndex, 0);
  assert.ok(r1.events.some((e) => e.type === 'HELP_OPENED'));

  const r2 = g.runProgramImmediate('справка датчики');
  assert.equal(r2.compiledOk, true);
  assert.equal(r2.openedHelp, true);
  assert.equal(r2.helpTopic, 'датчики');
  assert.equal(r2.snapshot.turnIndex, 0);
});

test('Interior interactables: inspect crates, plants, urns, furniture, HAS_INTERACTABLE sensor and required gating', () => {
  const g1 = new HotlineGameEngine(1, 'richard', 42);
  g1.startMission();
  const snap0 = g1.getSnapshot();
  const cats = new Set(snap0.interactables.map((i) => i.category));
  assert.ok(cats.has('crate'));
  assert.ok(cats.has('plant'));
  assert.ok(cats.has('urn'));
  assert.ok(cats.has('furniture'));

  // Walk to (8,3) adjacent to urn at (8,2), inspect via sensor condition
  const rUrn = g1.runProgramImmediate('вверх; вверх\nнц 7 раз\nвправо\nкц\nесли сверху предмет то\n  осмотреть сверху\nвсе');
  assert.equal(rUrn.compiledOk, true);
  assert.ok(rUrn.events.some((e) => e.type === 'OBJECT_INSPECTED'));
  assert.equal(rUrn.snapshot.inspectedCount, 1);
  assert.ok(rUrn.snapshot.lastInspectMessage?.includes('.gate.conf'));
  assert.equal(rUrn.snapshot.collectedIntel.length, 1);

  // Move to (10,3) below locker (10,2) and test synonym "обыскать шкаф"
  const rLocker = g1.runProgramImmediate('вправо; вправо\nесли рядом предмет то\n  обыскать шкаф\nвсе');
  assert.equal(rLocker.snapshot.inspectedCount, 2);

  // Test plant & sofa in guardhouse lounge (10,9) and (6,9) via doorway at x=9,y=6
  const rLounge = g1.runProgramImmediate(
    'влево\nнц 6 раз\nвниз\nкц\nвправо\nвзаимодействовать цветок\nнц 4 раз\nвлево\nкц\nвзять диван'
  );
  assert.equal(rLounge.snapshot.inspectedCount, 4);

  // Verify required interactable blocks exit until inspected
  const l1 = HOTLINE_KUMIR_LEVELS[0];
  const orig = l1.interactables;
  l1.interactables = [
    {
      id: 'req-test',
      x: 2,
      y: 5,
      category: 'urn',
      name: 'Контрольная урна',
      inspectText: 'Код доступа найден.',
      required: true,
    },
  ];
  try {
    const gReq = new HotlineGameEngine(1, 'richard', 42);
    gReq.startMission();
    gReq.runProgramImmediate('вверх; вверх\nнц 4 раз\nвправо\nкц\nподключиться');
    gReq.execLinuxCommand('unlock 4821');
    gReq.exitTerminal();
    gReq.runProgramImmediate('нц 10 раз\nвправо\nкц\nпометить');
    // Required interactable not yet inspected -> exit must still be locked
    assert.equal(gReq.isExitUnlocked(), false);
  } finally {
    l1.interactables = orig;
  }
});

test('Level prop layout invariants: zero wall/window/laser/spawn clipping and 6 authored clues per level', () => {
  for (const lvl of HOTLINE_KUMIR_LEVELS) {
    assert.ok(
      (lvl.interactables?.length || 0) >= 6,
      `Level ${lvl.id} must have at least 6 authored clues`
    );

    const h = lvl.asciiMap.length;
    const w = lvl.asciiMap[0].length;
    for (const p of lvl.scene.props) {
      if (p.layer === 'floor' || p.layer === 'overhead') continue;
      const r = ATLAS_SPRITES[p.sprite];
      assert.ok(r, `Missing sprite ${p.sprite}`);
      const sw = p.w ?? r.tilesW;
      const sh = p.h ?? r.tilesH;
      const rot = p.rot || 0;
      const fw = rot === 90 || rot === 270 ? sh : sw;
      const fh = rot === 90 || rot === 270 ? sw : sh;
      const minX = Math.floor(p.x + 0.02);
      const maxX = Math.ceil(p.x + fw - 0.02) - 1;
      const minY = Math.floor(p.y + 0.02);
      const maxY = Math.ceil(p.y + fh - 0.02) - 1;
      for (let gy = minY; gy <= maxY; gy++) {
        for (let gx = minX; gx <= maxX; gx++) {
          if (gx < 0 || gx >= w || gy < 0 || gy >= h) continue;
          const ch = lvl.asciiMap[gy][gx];
          assert.notEqual(ch, '#', `Level ${lvl.id} prop ${p.sprite} clips wall at (${gx},${gy})`);
          assert.notEqual(ch, 'W', `Level ${lvl.id} prop ${p.sprite} clips window at (${gx},${gy})`);
          assert.notEqual(ch, '=', `Level ${lvl.id} prop ${p.sprite} clips laser at (${gx},${gy})`);
          assert.notEqual(ch, 'S', `Level ${lvl.id} prop ${p.sprite} clips player spawn at (${gx},${gy})`);
          assert.notEqual(ch, 'G', `Level ${lvl.id} prop ${p.sprite} clips GBR entry at (${gx},${gy})`);
        }
      }
    }
  }
});

test('Object-bound highlights: size adapts to doors, urns, sofas, vending machines & fence hole', () => {
  const g1 = new HotlineGameEngine(1, 'richard', 42);
  g1.startMission();
  const s1 = g1.getSnapshot();

  // No duplicate auto-interactable created on multi-tile sofa or desk tiles covered by authored interactables
  assert.equal(
    s1.interactables.some((i) => i.id.startsWith('auto-sofa_leather')),
    false
  );

  const doorBounds = getDoorVisualBounds(s1.doors[0], s1);
  assert.ok(Math.min(doorBounds.w, doorBounds.h) <= 20, `Door highlight must fit door frame, got ${doorBounds.w}x${doorBounds.h}`);
  assert.ok(Math.max(doorBounds.w, doorBounds.h) >= 44, `Door highlight length must span jambs, got ${doorBounds.w}x${doorBounds.h}`);

  const urn = s1.interactables.find((i) => i.id === 'l1-urn')!;
  const sofa = s1.interactables.find((i) => i.id === 'l1-sofa')!;
  const urnRect = getInteractableVisualBounds(urn, s1);
  const sofaRect = getInteractableVisualBounds(sofa, s1);
  assert.ok(urnRect.w <= 24 && urnRect.h <= 24, `Urn highlight should be compact, got ${urnRect.w}x${urnRect.h}`);
  assert.ok(sofaRect.w > 75 && sofaRect.h < 44, `Sofa highlight should match 2x1 sprite, got ${sofaRect.w}x${sofaRect.h}`);

  const holeRect = getExitFenceHoleVisualBounds(s1);
  assert.ok(holeRect.w <= 26 && holeRect.h >= 36, `Exit fence hole highlight must fit gap, got ${holeRect.w}x${holeRect.h}`);

  const g2 = new HotlineGameEngine(2, 'richard', 42);
  const s2 = g2.getSnapshot();
  const vend = s2.interactables.find((i) => i.id === 'l2-vending')!;
  const vendRect = getInteractableVisualBounds(vend, s2);
  assert.ok(vendRect.h > 75 && vendRect.w < 44, `Vending highlight should be 1x2 vertical, got ${vendRect.w}x${vendRect.h}`);

  const g3 = new HotlineGameEngine(3, 'richard', 42);
  const s3 = g3.getSnapshot();
  const rotSofa = s3.interactables.find((i) => i.id === 'l3-sofa')!;
  const rotSofaRect = getInteractableVisualBounds(rotSofa, s3);
  assert.ok(rotSofaRect.h > 75 && rotSofaRect.w < 44, `Rotated sofa highlight should be vertical, got ${rotSofaRect.w}x${rotSofaRect.h}`);
});
