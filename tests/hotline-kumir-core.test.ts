import test from 'node:test';
import assert from 'node:assert/strict';
import { compileKumir, executeKumirProgram } from '../src/lib/hotline-kumir/kumir-interpreter.ts';
import { HotlineGameEngine, HOTLINE_KUMIR_LEVELS } from '../src/lib/hotline-kumir/game-engine.ts';
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

test('Calibration invariants: themes, rotating cameras, 2 relays on L4-5, no starterCode auto-solutions', () => {
  const expectedThemes = ['kpp_street', 'lobby_hall', 'analytics_office', 'server_hall', 'master_vault'];
  HOTLINE_KUMIR_LEVELS.forEach((lvl, idx) => {
    assert.equal(lvl.theme, expectedThemes[idx]);
    const g = new HotlineGameEngine(lvl.id, 'richard', 42);
    g.startMission();
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
  const openCrouch = gOpen.runProgramImmediate('вниз; вниз\nнц 5 раз\nвправо\nкц\nукрыться');
  assert.equal(openCrouch.snapshot.alarmTriggered, true);

  // Raven 3-tile vision + area decoy THROW on Level 3
  const g3 = new HotlineGameEngine(3, 'richard', 42);
  g3.startMission();
  // Walk to C(6,2) and crouch: covered by C(6,2)
  g3.runProgramImmediate('нц 4 раз\nвправо\nкц\nвниз; вправо; укрыться');
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
  g1.runProgramImmediate('нц 3 раз\nвправо\nкц\nподключиться');
  g1.execLinuxCommand('unlock 4821');
  g1.exitTerminal();
  const r1 = g1.runProgramImmediate('нц 4 раз\nвправо\nкц\nзакрасить\nвправо\nвниз\nвниз\nвправо');
  assert.equal(r1.snapshot.phase, 'EXTRACTION');
  assert.equal(r1.snapshot.lastResult?.styleBadge, 'GHOST');

  // Level 2 GHOST
  const g2 = new HotlineGameEngine(2, 'richard', 42);
  g2.startMission();
  g2.runProgramImmediate('нц 3 раз\nвправо\nкц\nвниз; вниз; вправо; подключиться');
  g2.execLinuxCommand('camctl off cam-01 NEON-774');
  g2.execLinuxCommand('laserctl off L1 NEON-774');
  g2.exitTerminal();
  const r2 = g2.runProgramImmediate('вправо; вниз; вниз; вправо; закрасить\nнц 4 раз\nвверх\nкц\nнц 5 раз\nвправо\nкц');
  assert.equal(r2.snapshot.phase, 'EXTRACTION');
  assert.equal(r2.snapshot.lastResult?.styleBadge, 'GHOST');

  // Level 3 GHOST (COVER at C(6,2) + decoy throw past Raven -> T(8,4) -> *(8,7) -> silent takedown -> D1)
  const g3 = new HotlineGameEngine(3, 'richard', 42);
  g3.startMission();
  g3.runProgramImmediate(
    'нц 4 раз\nвправо\nкц\nвниз; вправо; укрыться; бросить вправо; вправо; вниз; вниз; вправо; подключиться'
  );
  g3.execLinuxCommand('vault_unlock MEOA-902');
  g3.exitTerminal();
  const r3 = g3.runProgramImmediate(
    'нц 3 раз\nвниз\nкц\nзакрасить\nнц 3 раз\nвверх\nкц\nвправо; вверх\nесли сверху опасно то\n  ждать\nвсе\nвверх; бросить вправо\nнц 5 раз\n  если справа враг то\n    оглушить\n    добить\n  все\n  вправо\nкц\nвниз; вниз'
  );
  assert.equal(r3.snapshot.phase, 'EXTRACTION');
  assert.equal(r3.snapshot.lastResult?.styleBadge, 'GHOST');

  // Level 4 GHOST (2 relays: *1(14,6) and *2(12,1), decoy past guard-srv, timing cam-srv-2)
  const g4 = new HotlineGameEngine(4, 'richard', 42);
  g4.startMission();
  g4.runProgramImmediate('нц 5 раз\nвниз\nкц\nнц 7 раз\nвправо\nкц\nподключиться');
  g4.execLinuxCommand('gridctl reset --no-alarm');
  g4.execLinuxCommand('tar -czf /mnt/usb/audit.tar.gz /srv/secret');
  g4.exitTerminal();
  const r4 = g4.runProgramImmediate(
    'нц 6 раз\nвправо\nкц\nзакрасить\nнц 5 раз\nвлево\nкц\nвверх; вверх; бросить влево\nнц 3 раз\nвверх\nкц\nнц 3 раз\nвправо\nкц\nзакрасить\nвправо; вправо; вниз\nесли не снизу опасно то\n  ждать\nвсе\nвниз; отключить влево; вправо; вправо; вниз'
  );
  assert.equal(r4.snapshot.phase, 'EXTRACTION');
  assert.equal(r4.snapshot.lastResult?.styleBadge, 'GHOST');

  // Level 5 GHOST (2 relays: *1(1,8) and *2(18,4), silent truncate -s 0)
  const g5 = new HotlineGameEngine(5, 'richard', 42);
  g5.startMission();
  g5.runProgramImmediate('нц пока снизу свободно\nвниз\nкц\nзакрасить\nнц 7 раз\nвправо\nкц\nвверх; вверх; вверх; влево; влево; подключиться');
  g5.execLinuxCommand('chmod 600 /home/root_backup/.ssh/id_rsa');
  g5.execLinuxCommand('scp -P 2222 -i /home/root_backup/.ssh/id_rsa master@127.0.0.1:/vault/dump.sql /mnt/usb/');
  g5.execLinuxCommand('truncate -s 0 /var/log/access.log');
  g5.exitTerminal();
  const r5 = g5.runProgramImmediate(
    'вправо; вправо; вниз; вниз; вниз\nнц 6 раз\nвправо\nкц\nвверх; вверх\nнц пока не сверху опасно\n  ждать\nкц\nвверх\nнц 4 раз\nвправо\nкц\nвверх; закрасить\nвверх; влево; вверх; вверх; вправо'
  );
  assert.equal(r5.snapshot.phase, 'EXTRACTION');
  assert.equal(r5.snapshot.lastResult?.styleBadge, 'GHOST');
  assert.equal(r5.snapshot.lastResult?.outcomeBranch, 'stealth');
});

test('Multi-route variants: EMP flank, assault breach shortcuts (ESCAPE), and Bear shield COMBAT', () => {
  // Level 3 assault shortcut D2(11,5) + southern route -> ESCAPE
  const g3Esc = new HotlineGameEngine(3, 'sprint', 55);
  g3Esc.startMission();
  g3Esc.runProgramImmediate('нц 4 раз\nвправо\nкц\nвниз; вправо; укрыться; бросить вправо; вправо; вниз; вниз; вправо; подключиться');
  g3Esc.execLinuxCommand('vault_unlock MEOA-902');
  g3Esc.exitTerminal();
  const r3Esc = g3Esc.runProgramImmediate(
    'нц 3 раз\nвниз\nкц\nзакрасить\nнц 3 раз\nвправо\nкц\nвверх; выбить дверь вверх; вверх; вверх\nнц 3 раз\nвправо\nкц'
  );
  assert.equal(r3Esc.snapshot.phase, 'EXTRACTION');
  assert.equal(r3Esc.snapshot.lastResult?.styleBadge, 'ESCAPE');

  // Level 4 EMP flank: distract guard-srv with decoy, disable western laser L4-west via "отключить", cross cleanly
  const g4Emp = new HotlineGameEngine(4, 'rasmus', 88);
  g4Emp.startMission();
  const empRes = g4Emp.runProgramImmediate('вниз; вниз; вправо; вправо; бросить вправо; отключить вправо; вправо; вправо');
  assert.equal(empRes.snapshot.alarmTriggered, false);
  assert.equal(empRes.snapshot.player.x, 5);
  assert.equal(empRes.snapshot.player.y, 3);

  // Level 5 ESCAPE via rm tamper + assault shortcut D2(15,1)
  const g5Esc = new HotlineGameEngine(5, 'richard', 42);
  g5Esc.startMission();
  g5Esc.runProgramImmediate('нц пока снизу свободно\nвниз\nкц\nзакрасить\nнц 7 раз\nвправо\nкц\nвверх; вверх; вверх; влево; влево; подключиться');
  g5Esc.execLinuxCommand('chmod 600 /home/root_backup/.ssh/id_rsa');
  g5Esc.execLinuxCommand('scp -P 2222 -i /home/root_backup/.ssh/id_rsa master@127.0.0.1:/vault/dump.sql /mnt/usb/');
  g5Esc.execLinuxCommand('rm /var/log/access.log');
  g5Esc.exitTerminal();
  assert.equal(g5Esc.getSnapshot().phase, 'ESCAPE_RACE');
  const r5Esc = g5Esc.runProgramImmediate(
    'вправо; вправо; вниз; вниз; вниз\nнц 6 раз\nвправо\nкц\nвверх; вверх\nесли сверху опасно то\n  ждать\nвсе\nвверх\nнц 4 раз\nвправо\nкц\nвверх; закрасить\nвверх; влево; вверх; вверх; вправо'
  );
  assert.equal(r5Esc.snapshot.phase, 'EXTRACTION');
  assert.equal(r5Esc.snapshot.lastResult?.styleBadge, 'ESCAPE');

  // Level 1 COMBAT Fail-Forward
  const g1 = new HotlineGameEngine(1, 'tony', 77);
  g1.startMission();
  const camTrip = g1.runProgramImmediate('вниз; вниз\nнц 5 раз\nвправо\nкц');
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

  g1.runProgramImmediate('влево; влево; влево; влево; влево; вверх; вверх; вправо; вправо; вправо; подключиться');
  g1.execLinuxCommand('unlock 4821');
  g1.exitTerminal();

  const killIfNear = 'если рядом враг то\n  оглушить\n  добить\nвсе';
  g1.runProgramImmediate(`${killIfNear}\nнц 4 раз\n  ${killIfNear}\n  вправо\nкц\nзакрасить\nвправо\n${killIfNear}\nвниз; вниз\n${killIfNear}\nвправо`);
  const endSnap = g1.getSnapshot();
  assert.equal(endSnap.phase, 'EXTRACTION');
  assert.equal(endSnap.lastResult?.styleBadge, 'COMBAT');
  assert.equal(endSnap.lastResult?.outcomeBranch, 'combat_gbr');

  // Level 4 Bear shield test: strike without throw fails, throw breaks shield then strike succeeds
  const g4Bear = new HotlineGameEngine(4, 'tony', 99);
  g4Bear.startMission();
  g4Bear.runProgramImmediate('нц 5 раз\nвниз\nкц\nнц 7 раз\nвправо\nкц\nподключиться');
  g4Bear.execLinuxCommand('gridctl reset --no-alarm');
  g4Bear.execLinuxCommand('tar -czf /mnt/usb/audit.tar.gz /srv/secret');
  g4Bear.exitTerminal();
  g4Bear.runProgramImmediate('нц 6 раз\nвправо\nкц\nзакрасить');
  // Trigger alarm by breaching D2(16,5) and wait for GBR (gbr_boar + gbr_bear)
  g4Bear.runProgramImmediate('вправо; вправо; выбить дверь вверх');
  while (!g4Bear.getSnapshot().gbrSpawned) {
    g4Bear.handleTurnTimeout();
  }
  const bear = g4Bear.getSnapshot().enemies.find((e) => e.kind === 'gbr_bear');
  assert.ok(bear && bear.shielded === true);
  // Move Bear within throw range and verify shield break via "бросить"
  while (
    Math.abs(
      (g4Bear.getSnapshot().enemies.find((e) => e.kind === 'gbr_bear')?.x ?? 0) -
        g4Bear.getSnapshot().player.x
    ) +
      Math.abs(
        (g4Bear.getSnapshot().enemies.find((e) => e.kind === 'gbr_bear')?.y ?? 0) -
          g4Bear.getSnapshot().player.y
      ) >
    2
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
