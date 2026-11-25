import { HOTLINE_KUMIR_LEVELS, getHotlineLevel } from '../../data/hotline-kumir-levels.ts';
import { KUMIR_LIMITS, compileKumir, executeKumirProgram } from './kumir-interpreter.ts';
import { LinuxHackEngine } from './linux-hack-engine.ts';
import { createSeededPrng } from './prng.ts';
import type {
  AudioMood,
  CameraState,
  Direction,
  DoorState,
  EnemyState,
  GamePhase,
  KumirError,
  KumirSensorReader,
  LaserState,
  LevelDefinition,
  LevelResult,
  LinuxExecResult,
  MaskId,
  OutcomeBranch,
  PlayerState,
  ProgramNode,
  RankGrade,
  SensorDirection,
  SensorKind,
  StepResult,
  StyleBadge,
  TileKind,
  WorldEvent,
  WorldSnapshot,
} from './types.ts';

const DIR_DELTAS: Record<Direction, { dx: number; dy: number }> = {
  UP: { dx: 0, dy: -1 },
  DOWN: { dx: 0, dy: 1 },
  LEFT: { dx: -1, dy: 0 },
  RIGHT: { dx: 1, dy: 0 },
};

const ALL_DIRS: Direction[] = ['RIGHT', 'DOWN', 'LEFT', 'UP'];

function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export class HotlineGameEngine {
  private readonly levelDef: LevelDefinition;
  private readonly mask: MaskId;
  private readonly seed: number;
  private readonly prng: () => number;
  private readonly linux: LinuxHackEngine;

  private phase: GamePhase = 'BRIEFING';
  private turnIndex = 0;
  private totalStepsSession = 0;
  private turnTimeLeftSec: number;
  private turnTimeMaxSec: number;
  private alarmTriggered = false;
  private alarmReason: string | null = null;
  private gbrSpawned = false;
  private gbrEtaTurns: number;
  private readonly gbrEtaMaxTurns: number;
  private gbrEtaSec: number;
  private idsNoise = 0;
  private readonly idsMaxNoise: number;
  private hackCompleted = false;
  private activeLine: number | null = null;
  private lastError: KumirError | null = null;
  private lastResult: LevelResult | null = null;

  private readonly width: number;
  private readonly height: number;
  private readonly tiles: TileKind[][];
  private readonly paintedSet = new Set<string>();
  private readonly requiredPaintKeys = new Set<string>();
  private terminalPos = { x: 1, y: 1 };
  private exitPos = { x: 1, y: 1 };
  private gbrSpawnPos = { x: 1, y: 1 };

  private readonly player: PlayerState;
  private readonly doors: DoorState[];
  private readonly cameras: CameraState[];
  private readonly lasers: LaserState[];
  private readonly enemies: EnemyState[];

  private usedLoops = false;
  private usedConditions = false;
  private usedSubprograms = false;
  private lastLocCount = 0;

  private activeProgramGen: Generator<StepResult, StepResult, void> | null = null;

  constructor(levelId: number, mask: MaskId = 'richard', seed = 1337) {
    this.levelDef = getHotlineLevel(levelId);
    this.mask = mask;
    this.seed = seed;
    this.prng = createSeededPrng(seed + levelId * 97);
    this.linux = new LinuxHackEngine(this.levelDef.linuxConfig);

    // Parse map
    this.height = this.levelDef.asciiMap.length;
    this.width = this.levelDef.asciiMap[0].length;
    this.tiles = [];
    let startX = 1;
    let startY = 1;

    for (let y = 0; y < this.height; y++) {
      const row: TileKind[] = [];
      const line = this.levelDef.asciiMap[y];
      for (let x = 0; x < this.width; x++) {
        const ch = line[x] || '#';
        if (ch === '#') {
          row.push('WALL');
        } else if (ch === 'C') {
          row.push('COVER');
        } else if (ch === 'E') {
          row.push('EXIT');
          this.exitPos = { x, y };
        } else if (ch === 'T') {
          row.push('TERMINAL');
          this.terminalPos = { x, y };
        } else if (ch === '*') {
          row.push('RELAY');
          this.requiredPaintKeys.add(`${x},${y}`);
        } else if (ch === 'G') {
          row.push('GBR_SPAWN');
          this.gbrSpawnPos = { x, y };
        } else {
          if (ch === 'S') {
            startX = x;
            startY = y;
          }
          row.push('FLOOR');
        }
      }
      this.tiles.push(row);
    }

    this.player = {
      x: startX,
      y: startY,
      facing: 'RIGHT',
      crouched: false,
      dashCooldown: 0,
      hp: 3,
      stepsTaken: 0,
    };

    this.doors = this.levelDef.doors.map((d) => ({ ...d, open: false, broken: false }));
    this.cameras = this.levelDef.cameras.map((c) => ({
      id: c.id,
      x: c.x,
      y: c.y,
      enabled: true,
      disabledTurns: 0,
      phases: c.phases.map((ph) => ph.map((pt) => ({ ...pt }))),
      phaseIndex: 0,
    }));
    this.lasers = this.levelDef.lasers.map((l) => ({
      id: l.id,
      cells: l.cells.map((pt) => ({ ...pt })),
      enabled: true,
      disabledTurns: 0,
    }));
    this.enemies = this.levelDef.patrols.map((p) => ({
      id: p.id,
      kind: p.kind,
      isGbr: false,
      x: p.route[0].x,
      y: p.route[0].y,
      facing: p.facing,
      status: 'active',
      stunTurns: 0,
      shielded: false,
      patrolRoute: p.route.map((pt) => ({ ...pt })),
      patrolIndex: 0,
      patrolForward: true,
      telegraphNext: null,
      telegraphAttackCells: [],
      alertedTurns: 0,
      distractedTurns: 0,
    }));

    const sprintEtaBonus = this.mask === 'sprint' ? 1 : 0;
    const sprintSecBonus = this.mask === 'sprint' ? 15 : 0;
    this.gbrEtaMaxTurns = this.levelDef.gbrEtaTurns + sprintEtaBonus;
    this.gbrEtaTurns = this.gbrEtaMaxTurns;
    this.gbrEtaSec = this.levelDef.gbrEtaSec + sprintSecBonus;
    this.idsMaxNoise = this.mask === 'sprint' ? 4 : 3;

    this.turnTimeMaxSec = this.levelDef.turnTimerStealthSec;
    this.turnTimeLeftSec = this.turnTimeMaxSec;

    // Slight deterministic jitter check so PRNG isn't unused
    this.prng();
    this.refreshTelegraphs();
  }

  startMission(): WorldSnapshot {
    if (this.phase === 'BRIEFING') {
      this.phase = 'STEALTH';
    }
    return this.getSnapshot();
  }

  enterTerminal(): WorldSnapshot {
    if (this.phase !== 'EXTRACTION' && this.phase !== 'MISSION_KO') {
      this.phase = 'TERMINAL_HACK';
    }
    return this.getSnapshot();
  }

  exitTerminal(): WorldSnapshot {
    if (this.phase === 'TERMINAL_HACK') {
      this.activeProgramGen = null;
      this.phase = this.gbrSpawned
        ? 'GBR_BREACH_COMBAT'
        : this.alarmTriggered
          ? 'ESCAPE_RACE'
          : 'STEALTH';
    }
    return this.getSnapshot();
  }

  getLinuxEngine(): LinuxHackEngine {
    return this.linux;
  }

  getAudioMood(): AudioMood {
    if (this.phase === 'BRIEFING') return 'SILENT';
    if (this.phase === 'GBR_BREACH_COMBAT') return 'COMBAT';
    if (this.alarmTriggered || this.phase === 'ALERT_DISPATCH' || this.phase === 'ESCAPE_RACE') {
      return 'ALERT';
    }
    return 'STEALTH';
  }

  isExitUnlocked(): boolean {
    if (!this.hackCompleted) return false;
    for (const k of this.requiredPaintKeys) {
      if (!this.paintedSet.has(k)) return false;
    }
    if (this.phase === 'GBR_BREACH_COMBAT') {
      const gbrUnits = this.enemies.filter((e) => e.isGbr);
      if (gbrUnits.length === 0) return true;
      const allNeutralized = gbrUnits.every((g) => g.status !== 'active');
      if (allNeutralized) return true;
      const anyNeutralized = gbrUnits.some((g) => g.status !== 'active');
      const gbrBlockingExit = gbrUnits.some(
        (g) => g.status === 'active' && manhattan(g.x, g.y, this.exitPos.x, this.exitPos.y) <= 2
      );
      return anyNeutralized && !gbrBlockingExit;
    }
    return true;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  private isPassable(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    if (this.tiles[y][x] === 'WALL') return false;
    const closedDoor = this.doors.find((d) => d.x === x && d.y === y && !d.open);
    if (closedDoor) return false;
    return true;
  }

  private getCameraDangerCells(cam: CameraState): Array<{ x: number; y: number }> {
    if (!cam.enabled || cam.phases.length === 0) return [];
    return cam.phases[cam.phaseIndex % cam.phases.length] || [];
  }

  private getEnemyVisionCells(enemy: EnemyState): Array<{ x: number; y: number }> {
    if (enemy.status !== 'active') return [];
    if (enemy.isGbr) {
      // GBR units threaten melee + facing adjacent cell
      const d = DIR_DELTAS[enemy.facing];
      const cells = [
        { x: enemy.x, y: enemy.y },
        { x: enemy.x + d.dx, y: enemy.y + d.dy },
      ];
      return cells.filter((c) => this.inBounds(c.x, c.y));
    }
    // Regular patrols look 2 tiles ahead unless blocked by wall/closed door
    const d = DIR_DELTAS[enemy.facing];
    const seen: Array<{ x: number; y: number }> = [];
    for (let step = 1; step <= 2; step++) {
      const cx = enemy.x + d.dx * step;
      const cy = enemy.y + d.dy * step;
      if (!this.isPassable(cx, cy)) break;
      seen.push({ x: cx, y: cy });
    }
    return seen;
  }

  private isTileDangerous(x: number, y: number): boolean {
    if (!this.inBounds(x, y)) return false;
    for (const cam of this.cameras) {
      if (this.getCameraDangerCells(cam).some((c) => c.x === x && c.y === y)) {
        return true;
      }
    }
    for (const l of this.lasers) {
      if (l.enabled && l.cells.some((c) => c.x === x && c.y === y)) {
        return true;
      }
    }
    for (const e of this.enemies) {
      if (e.status !== 'active') continue;
      if (this.getEnemyVisionCells(e).some((c) => c.x === x && c.y === y)) {
        return true;
      }
    }
    return false;
  }

  private findEnemyAt(x: number, y: number): EnemyState | undefined {
    return this.enemies.find((e) => e.x === x && e.y === y && e.status !== 'offline');
  }

  private resolveTargetDir(explicit: Direction | undefined, mode: 'move' | 'door' | 'enemy' | 'device'): Direction {
    if (explicit) return explicit;
    if (mode === 'move') return this.player.facing;

    const candidates = [this.player.facing, ...ALL_DIRS.filter((d) => d !== this.player.facing)];
    for (const dir of candidates) {
      const { dx, dy } = DIR_DELTAS[dir];
      const nx = this.player.x + dx;
      const ny = this.player.y + dy;
      if (mode === 'door' && this.doors.some((d) => d.x === nx && d.y === ny && !d.open)) {
        return dir;
      }
      if (mode === 'enemy' && this.enemies.some((e) => e.x === nx && e.y === ny && e.status !== 'offline')) {
        return dir;
      }
      if (
        mode === 'device' &&
        (this.cameras.some((c) => c.x === nx && c.y === ny && c.enabled) ||
          this.lasers.some((l) => l.enabled && l.cells.some((c) => c.x === nx && c.y === ny)))
      ) {
        return dir;
      }
    }
    return this.player.facing;
  }

  private createSensorReader(): KumirSensorReader {
    return {
      evalSensor: (sensor: SensorKind, dir?: SensorDirection): boolean => {
        const resolveDir = (): Direction => {
          if (!dir || dir === 'FRONT' || dir === 'ANY') return this.player.facing;
          return dir;
        };

        switch (sensor) {
          case 'IS_CLEAR': {
            const d = DIR_DELTAS[resolveDir()];
            return this.isPassable(this.player.x + d.dx, this.player.y + d.dy);
          }
          case 'IS_WALL': {
            const d = DIR_DELTAS[resolveDir()];
            return !this.isPassable(this.player.x + d.dx, this.player.y + d.dy);
          }
          case 'IS_PAINTED':
            return this.paintedSet.has(`${this.player.x},${this.player.y}`);
          case 'IS_DANGER': {
            const d = DIR_DELTAS[resolveDir()];
            return this.isTileDangerous(this.player.x + d.dx, this.player.y + d.dy);
          }
          case 'HAS_ENEMY': {
            if (dir === 'ANY') {
              return ALL_DIRS.some((ad) => {
                const delta = DIR_DELTAS[ad];
                return this.enemies.some(
                  (e) => e.x === this.player.x + delta.dx && e.y === this.player.y + delta.dy && e.status === 'active'
                );
              });
            }
            const d = DIR_DELTAS[resolveDir()];
            return this.enemies.some(
              (e) => e.x === this.player.x + d.dx && e.y === this.player.y + d.dy && e.status === 'active'
            );
          }
          case 'ENEMY_STUNNED': {
            if (dir === 'ANY') {
              return ALL_DIRS.some((ad) => {
                const delta = DIR_DELTAS[ad];
                return this.enemies.some(
                  (e) => e.x === this.player.x + delta.dx && e.y === this.player.y + delta.dy && e.status === 'stunned'
                );
              });
            }
            const d = DIR_DELTAS[resolveDir()];
            return this.enemies.some(
              (e) => e.x === this.player.x + d.dx && e.y === this.player.y + d.dy && e.status === 'stunned'
            );
          }
          case 'HAS_DOOR': {
            if (dir === 'ANY') {
              return ALL_DIRS.some((ad) => {
                const delta = DIR_DELTAS[ad];
                return this.doors.some((door) => door.x === this.player.x + delta.dx && door.y === this.player.y + delta.dy && !door.open);
              });
            }
            const d = DIR_DELTAS[resolveDir()];
            return this.doors.some((door) => door.x === this.player.x + d.dx && door.y === this.player.y + d.dy && !door.open);
          }
          case 'NEAR_TERMINAL':
            return manhattan(this.player.x, this.player.y, this.terminalPos.x, this.terminalPos.y) <= 1;
          case 'IS_ALARM':
            return this.alarmTriggered;
          case 'GBR_INSIDE':
            return this.gbrSpawned;
          case 'DASH_READY':
            return this.player.dashCooldown === 0;
        }
      },
    };
  }

  private triggerAlarm(reason: string, events: WorldEvent[]): void {
    if (this.alarmTriggered) return;
    this.alarmTriggered = true;
    this.alarmReason = reason;
    this.phase = 'ESCAPE_RACE';
    this.turnTimeMaxSec = this.levelDef.turnTimerAlertSec;
    this.turnTimeLeftSec = Math.min(this.turnTimeLeftSec, this.turnTimeMaxSec);
    // Cameras go on high-alert/auto-recover mode, patrols alert
    for (const e of this.enemies) {
      if (!e.isGbr && e.status === 'active') {
        e.alertedTurns = 6;
      }
    }
    events.push({
      type: 'ALERT_TRIGGERED',
      label: reason,
      moodAfter: this.getAudioMood(),
    });
  }

  private spawnGbrSquad(events: WorldEvent[]): void {
    if (this.gbrSpawned) return;
    this.gbrSpawned = true;
    this.phase = 'GBR_BREACH_COMBAT';
    this.gbrEtaTurns = 0;
    this.gbrEtaSec = 0;

    const offsets = [
      { dx: 0, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: -1 },
      { dx: 1, dy: 0 },
    ];

    this.levelDef.gbrSquad.forEach((kind, idx) => {
      let sx = this.gbrSpawnPos.x;
      let sy = this.gbrSpawnPos.y;
      for (const off of offsets) {
        const cx = this.gbrSpawnPos.x + off.dx * (idx > 0 ? 1 : 0);
        const cy = this.gbrSpawnPos.y + off.dy * (idx > 0 ? 1 : 0);
        if (this.isPassable(cx, cy) && !this.findEnemyAt(cx, cy)) {
          sx = cx;
          sy = cy;
          break;
        }
      }
      this.enemies.push({
        id: `gbr-${idx + 1}`,
        kind,
        isGbr: true,
        x: sx,
        y: sy,
        facing: 'LEFT',
        status: 'active',
        stunTurns: 0,
        shielded: kind === 'gbr_bear',
        patrolRoute: [{ x: sx, y: sy }],
        patrolIndex: 0,
        patrolForward: true,
        telegraphNext: null,
        telegraphAttackCells: [],
        alertedTurns: 99,
        distractedTurns: 0,
      });
    });

    events.push({
      type: 'GBR_ARRIVED',
      x: this.gbrSpawnPos.x,
      y: this.gbrSpawnPos.y,
      label: `ГБР вошёл в здание (${this.levelDef.gbrSquad.length} чел.)`,
      moodAfter: this.getAudioMood(),
    });
    this.refreshTelegraphs();
  }

  private bfsNextStep(sx: number, sy: number, tx: number, ty: number): { x: number; y: number } | null {
    if (sx === tx && sy === ty) return null;
    const queue: Array<{ x: number; y: number; first?: { x: number; y: number } }> = [{ x: sx, y: sy }];
    const visited = new Set<string>([`${sx},${sy}`]);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const dir of ALL_DIRS) {
        const d = DIR_DELTAS[dir];
        const nx = cur.x + d.dx;
        const ny = cur.y + d.dy;
        const key = `${nx},${ny}`;
        if (visited.has(key)) continue;
        if (!this.isPassable(nx, ny)) continue;
        // Avoid stepping onto other living enemies except if target
        const occ = this.enemies.find((e) => e.x === nx && e.y === ny && e.status === 'active');
        if (occ && !(nx === tx && ny === ty)) continue;

        const first = cur.first ?? { x: nx, y: ny };
        if (nx === tx && ny === ty) return first;
        visited.add(key);
        queue.push({ x: nx, y: ny, first });
      }
    }
    return null;
  }

  private computeGbrNextStep(e: EnemyState): { x: number; y: number; attackCells: Array<{ x: number; y: number }> } {
    const speed = e.kind === 'gbr_dog' ? 2 : 1;
    let cx = e.x;
    let cy = e.y;

    // GBR Boar dash telegraph if aligned orthogonally within 3 tiles
    if (e.kind === 'gbr_boar' && (e.x === this.player.x || e.y === this.player.y) && manhattan(e.x, e.y, this.player.x, this.player.y) <= 3) {
      const dx = Math.sign(this.player.x - e.x);
      const dy = Math.sign(this.player.y - e.y);
      const tx = e.x + dx * 2;
      const ty = e.y + dy * 2;
      const midOk = this.isPassable(e.x + dx, e.y + dy);
      if (midOk && this.isPassable(tx, ty)) {
        return {
          x: tx,
          y: ty,
          attackCells: [
            { x: e.x + dx, y: e.y + dy },
            { x: tx, y: ty },
          ],
        };
      }
    }

    for (let s = 0; s < speed; s++) {
      if (manhattan(cx, cy, this.player.x, this.player.y) <= 1) break;
      const step = this.bfsNextStep(cx, cy, this.player.x, this.player.y);
      if (!step) break;
      cx = step.x;
      cy = step.y;
    }

    return {
      x: cx,
      y: cy,
      attackCells: manhattan(cx, cy, this.player.x, this.player.y) <= 1 ? [{ x: this.player.x, y: this.player.y }] : [],
    };
  }

  private refreshTelegraphs(): void {
    for (const e of this.enemies) {
      if (e.status !== 'active') {
        e.telegraphNext = null;
        e.telegraphAttackCells = [];
        continue;
      }
      if (e.isGbr) {
        const plan = this.computeGbrNextStep(e);
        e.telegraphNext = { x: plan.x, y: plan.y };
        e.telegraphAttackCells = plan.attackCells;
      } else if (e.patrolRoute.length > 1) {
        let nextIdx = e.patrolForward ? e.patrolIndex + 1 : e.patrolIndex - 1;
        if (nextIdx >= e.patrolRoute.length) nextIdx = e.patrolIndex - 1;
        if (nextIdx < 0) nextIdx = e.patrolIndex + 1;
        e.telegraphNext = { ...e.patrolRoute[nextIdx] };
        e.telegraphAttackCells = this.getEnemyVisionCells(e);
      } else {
        e.telegraphNext = null;
        e.telegraphAttackCells = [];
      }
    }
  }

  private advanceWorldEntities(events: WorldEvent[]): void {
    // Rotate/recover cameras & lasers
    for (const cam of this.cameras) {
      if (!cam.enabled && cam.disabledTurns > 0) {
        cam.disabledTurns--;
        if (cam.disabledTurns === 0) cam.enabled = true;
      }
      if (cam.enabled && cam.phases.length > 1) {
        cam.phaseIndex = (cam.phaseIndex + 1) % cam.phases.length;
      }
    }
    for (const l of this.lasers) {
      if (!l.enabled && l.disabledTurns > 0) {
        l.disabledTurns--;
        if (l.disabledTurns === 0) l.enabled = true;
      }
    }

    // Advance enemies
    for (const e of this.enemies) {
      if (e.status === 'offline') continue;
      if (e.status === 'stunned') {
        e.stunTurns--;
        if (e.stunTurns <= 0) {
          e.status = 'active';
        }
        continue;
      }
      if (e.distractedTurns > 0) {
        e.distractedTurns--;
        continue;
      }

      if (e.isGbr) {
        if (this.totalStepsSession % 2 === 0 && !e.telegraphAttackCells.some((c) => c.x === this.player.x && c.y === this.player.y)) {
          continue;
        }
        const startDist = manhattan(e.x, e.y, this.player.x, this.player.y);
        const plan = this.computeGbrNextStep(e);
        const dx = plan.x - e.x;
        const dy = plan.y - e.y;
        if (Math.abs(dx) >= Math.abs(dy) && dx !== 0) {
          e.facing = dx > 0 ? 'RIGHT' : 'LEFT';
        } else if (dy !== 0) {
          e.facing = dy > 0 ? 'DOWN' : 'UP';
        }
        const collidedBoar =
          e.kind === 'gbr_boar' &&
          plan.attackCells.some((c) => c.x === this.player.x && c.y === this.player.y);

        e.x = plan.x;
        e.y = plan.y;
        events.push({ type: 'ENEMY_MOVED', x: e.x, y: e.y, label: e.id, moodAfter: this.getAudioMood() });

        if (collidedBoar || manhattan(e.x, e.y, this.player.x, this.player.y) === 0) {
          this.player.hp--;
          events.push({
            type: 'ENEMY_ATTACK',
            x: this.player.x,
            y: this.player.y,
            label: `${e.kind} нанёс удар`,
            moodAfter: this.getAudioMood(),
          });
        } else if (startDist <= 1 && manhattan(e.x, e.y, this.player.x, this.player.y) <= 1 && !this.player.crouched) {
          this.player.hp--;
          events.push({
            type: 'ENEMY_ATTACK',
            x: this.player.x,
            y: this.player.y,
            label: `${e.kind} атаковал вблизи`,
            moodAfter: this.getAudioMood(),
          });
        }
      } else if (e.patrolRoute.length > 1) {
        if (e.patrolForward) {
          if (e.patrolIndex + 1 >= e.patrolRoute.length) {
            e.patrolForward = false;
            e.patrolIndex = Math.max(0, e.patrolIndex - 1);
          } else {
            e.patrolIndex++;
          }
        } else {
          if (e.patrolIndex - 1 < 0) {
            e.patrolForward = true;
            e.patrolIndex = Math.min(e.patrolRoute.length - 1, e.patrolIndex + 1);
          } else {
            e.patrolIndex--;
          }
        }
        const nextPt = e.patrolRoute[e.patrolIndex];
        if (nextPt.x > e.x) e.facing = 'RIGHT';
        else if (nextPt.x < e.x) e.facing = 'LEFT';
        else if (nextPt.y > e.y) e.facing = 'DOWN';
        else if (nextPt.y < e.y) e.facing = 'UP';
        e.x = nextPt.x;
        e.y = nextPt.y;
        events.push({ type: 'ENEMY_MOVED', x: e.x, y: e.y, label: e.id, moodAfter: this.getAudioMood() });
      }
    }

    if (this.player.hp <= 0) {
      this.phase = 'MISSION_KO';
      events.push({
        type: 'PLAYER_KO',
        x: this.player.x,
        y: this.player.y,
        label: 'Боец ГБР перехватил агента',
        moodAfter: this.getAudioMood(),
      });
    } else {
      this.checkEnvironmentDetection(events);
    }

    this.refreshTelegraphs();
  }

  private checkEnvironmentDetection(events: WorldEvent[]): void {
    // Active laser check (always triggers even if crouched!)
    for (const l of this.lasers) {
      if (l.enabled && l.cells.some((c) => c.x === this.player.x && c.y === this.player.y)) {
        this.triggerAlarm(`Пересечён лазер ${l.id}`, events);
        return;
      }
    }

    if (this.player.crouched) {
      return;
    }

    for (const cam of this.cameras) {
      if (this.getCameraDangerCells(cam).some((c) => c.x === this.player.x && c.y === this.player.y)) {
        this.triggerAlarm(`Обнаружение камерой ${cam.id}`, events);
        return;
      }
    }

    for (const e of this.enemies) {
      if (e.isGbr || e.status !== 'active') continue;
      if (this.getEnemyVisionCells(e).some((c) => c.x === this.player.x && c.y === this.player.y)) {
        this.triggerAlarm(`Патрульный (${e.id}) заметил агента`, events);
        return;
      }
    }
  }

  private finalizeVictory(events: WorldEvent[]): void {
    this.phase = 'EXTRACTION';
    this.activeProgramGen = null;

    let styleBadge: StyleBadge = 'GHOST';
    let outcomeBranch: OutcomeBranch = 'stealth';
    let styleBonus = 500;
    let alarmPenalty = 0;

    if (this.gbrSpawned) {
      styleBadge = 'COMBAT';
      outcomeBranch = 'combat_gbr';
      styleBonus = 300;
      alarmPenalty = 100;
    } else if (this.alarmTriggered) {
      styleBadge = 'ESCAPE';
      outcomeBranch = 'escape_before_gbr';
      styleBonus = 350;
      alarmPenalty = 50;
    }

    const baseClear = 1000;
    const timeBonus = Math.max(0, Math.min(350, (12 - this.turnIndex) * 35));
    let algoBonus = 0;
    if (this.usedLoops) algoBonus += 120;
    if (this.usedConditions) algoBonus += 120;
    if (this.usedSubprograms) algoBonus += 150;
    if (this.lastLocCount > 0 && this.lastLocCount <= this.levelDef.parLoc) algoBonus += 100;
    algoBonus = Math.min(400, algoBonus);

    const score = Math.max(400, baseClear + timeBonus + styleBonus + algoBonus - alarmPenalty);
    const grade: RankGrade =
      score >= 1900 ? 'S' : score >= 1500 ? 'A' : score >= 1100 ? 'B' : 'C';

    this.lastResult = {
      levelId: this.levelDef.id,
      mask: this.mask,
      styleBadge,
      outcomeBranch,
      grade,
      score,
      baseClear,
      timeBonus,
      styleBonus,
      algoBonus,
      alarmPenalty,
      locCount: this.lastLocCount,
      parLoc: this.levelDef.parLoc,
      usedLoops: this.usedLoops,
      usedConditions: this.usedConditions,
      usedSubprograms: this.usedSubprograms,
      linuxCommandsCount: this.linux.getCommandsCount(),
      turnsUsed: this.turnIndex,
      timeSpentSec: Math.max(1, this.turnIndex * 4),
    };

    events.push({
      type: 'EXTRACTION',
      x: this.player.x,
      y: this.player.y,
      label: `Эвакуация завершена [${styleBadge} • ранг ${grade}]`,
      moodAfter: this.getAudioMood(),
    });
  }

  private decrementTurnEtaAndTick(events: WorldEvent[]): void {
    if (this.player.dashCooldown > 0) {
      this.player.dashCooldown--;
    }
    if (this.alarmTriggered && !this.gbrSpawned) {
      this.gbrEtaTurns--;
      this.gbrEtaSec = Math.max(0, Math.round((this.gbrEtaTurns / this.gbrEtaMaxTurns) * this.levelDef.gbrEtaSec));
      if (this.gbrEtaTurns <= 0) {
        this.spawnGbrSquad(events);
      }
    }
    this.turnTimeLeftSec = this.turnTimeMaxSec;
  }

  execLinuxCommand(rawLine: string): { result: LinuxExecResult; events: WorldEvent[]; snapshot: WorldSnapshot } {
    if (this.phase === 'EXTRACTION' || this.phase === 'MISSION_KO') {
      return {
        result: {
          output: 'Миссия уже завершена.',
          exitCode: 1,
          noiseDelta: 0,
          commandTickCost: 0,
          effects: [],
          objectiveCompletedNow: false,
        },
        events: [],
        snapshot: this.getSnapshot(),
      };
    }

    const res = this.linux.exec(rawLine);
    const events: WorldEvent[] = [];

    for (const eff of res.effects) {
      if (eff.type === 'UNLOCK_DOOR') {
        for (const d of this.doors) {
          if (!eff.doorId || d.id === eff.doorId) {
            d.open = true;
            events.push({ type: 'DOOR_OPENED', x: d.x, y: d.y, moodAfter: this.getAudioMood() });
          }
        }
      } else if (eff.type === 'DISABLE_CAMERA') {
        for (const c of this.cameras) {
          if (!eff.cameraId || c.id === eff.cameraId) {
            c.enabled = false;
            c.disabledTurns = 999;
            events.push({ type: 'CAMERA_DISABLED', x: c.x, y: c.y, moodAfter: this.getAudioMood() });
          }
        }
      } else if (eff.type === 'DISABLE_LASER') {
        for (const l of this.lasers) {
          if (!eff.laserId || l.id === eff.laserId) {
            l.enabled = false;
            l.disabledTurns = 999;
            events.push({ type: 'LASER_DISABLED', x: l.cells[0]?.x, y: l.cells[0]?.y, moodAfter: this.getAudioMood() });
          }
        }
      } else if (eff.type === 'COMPLETE_HACK') {
        this.hackCompleted = true;
        events.push({
          type: 'TERMINAL_HACKED',
          x: this.terminalPos.x,
          y: this.terminalPos.y,
          label: 'Данные целевого ПК получены',
          moodAfter: this.getAudioMood(),
        });
      } else if (eff.type === 'TRIGGER_ALARM') {
        this.triggerAlarm(eff.reason, events);
      }
    }

    if (res.noiseDelta > 0) {
      this.idsNoise += res.noiseDelta;
      if (this.idsNoise >= this.idsMaxNoise) {
        this.triggerAlarm('IDS-сигнализация: превышен лимит ошибок в терминале', events);
      }
    }

    if (res.commandTickCost > 0) {
      const cmdCount = this.linux.getCommandsCount();
      if (cmdCount % 3 === 0) {
        this.advanceWorldEntities(events);
      }
      if (this.alarmTriggered && !this.gbrSpawned && cmdCount % 4 === 0) {
        this.gbrEtaTurns--;
        if (this.gbrEtaTurns <= 0) {
          this.spawnGbrSquad(events);
        }
      }
    }

    this.refreshTelegraphs();
    return { result: res, events, snapshot: this.getSnapshot() };
  }

  prepareProgramTurn(source: string): { ok: true; program: ProgramNode } | { ok: false; errors: KumirError[] } {
    this.lastError = null;
    const compiled = compileKumir(source);
    if (!compiled.ok) {
      this.lastError = compiled.errors[0];
      return compiled;
    }

    if (compiled.program.usedLoops) this.usedLoops = true;
    if (compiled.program.usedConditions) this.usedConditions = true;
    if (compiled.program.usedSubprograms) this.usedSubprograms = true;
    this.lastLocCount = compiled.program.locCount;

    this.activeProgramGen = executeKumirProgram(compiled.program, this.createSensorReader());
    return compiled;
  }

  stepNextAction(): {
    done: boolean;
    openedTerminal: boolean;
    events: WorldEvent[];
    error: KumirError | null;
    snapshot: WorldSnapshot;
  } {
    const events: WorldEvent[] = [];
    if (!this.activeProgramGen) {
      return { done: true, openedTerminal: false, events, error: null, snapshot: this.getSnapshot() };
    }

    if (this.totalStepsSession >= KUMIR_LIMITS.MAX_TOTAL_STEPS_SESSION) {
      const err: KumirError = {
        code: 'E_RT_INFINITE_LOOP',
        line: this.activeLine ?? 1,
        column: 1,
        messageRu: `Превышен лимит шагов сессии (${KUMIR_LIMITS.MAX_TOTAL_STEPS_SESSION}). Перезапустите уровень [R].`,
        isFatalToTurn: true,
      };
      this.lastError = err;
      this.activeProgramGen = null;
      return { done: true, openedTerminal: false, events, error: err, snapshot: this.getSnapshot() };
    }

    const next = this.activeProgramGen.next();
    if (next.done) {
      const fin = next.value;
      if (fin.status === 'RUNTIME_ERROR') {
        this.lastError = fin.error;
        this.activeLine = fin.error.line;
      } else {
        this.activeLine = null;
      }
      this.activeProgramGen = null;
      this.turnIndex++;
      this.decrementTurnEtaAndTick(events);
      return {
        done: true,
        openedTerminal: false,
        events,
        error: this.lastError,
        snapshot: this.getSnapshot(),
      };
    }

    const yielded = next.value;
    if (yielded.status !== 'YIELD_ACTION') {
      this.activeProgramGen = null;
      return { done: true, openedTerminal: false, events, error: null, snapshot: this.getSnapshot() };
    }

    this.totalStepsSession++;
    this.activeLine = yielded.line;
    const req = yielded.request;
    let openedTerminal = false;

    const failTurn = (code: KumirError['code'], msg: string, crashWall = false) => {
      const err: KumirError = {
        code,
        line: req.line,
        column: 1,
        messageRu: msg,
        isFatalToTurn: true,
      };
      this.lastError = err;
      this.activeProgramGen = null;
      if (crashWall) {
        this.idsNoise++;
        events.push({
          type: 'WALL_CRASH',
          line: req.line,
          x: this.player.x,
          y: this.player.y,
          label: msg,
          moodAfter: this.getAudioMood(),
        });
        if (this.idsNoise >= this.idsMaxNoise) {
          this.triggerAlarm('Громкое столкновение привлекло охрану', events);
        }
      }
      this.turnIndex++;
      this.decrementTurnEtaAndTick(events);
      return { done: true, openedTerminal: false, events, error: err, snapshot: this.getSnapshot() };
    };

    switch (req.action) {
      case 'MOVE': {
        const dir = req.dir || this.player.facing;
        this.player.facing = dir;
        this.player.crouched = false;
        const delta = DIR_DELTAS[dir];
        const nx = this.player.x + delta.dx;
        const ny = this.player.y + delta.dy;
        if (!this.isPassable(nx, ny)) {
          return failTurn(
            'E_RT_WALL_CRASH',
            `Строка ${req.line}: Робот упёрся в стену или закрытую дверь. Используйте датчик «свободно» или «выбить дверь».`,
            true
          );
        }
        const enemyAtTarget = this.enemies.find((e) => e.x === nx && e.y === ny && e.status === 'active');
        if (enemyAtTarget) {
          // Stepping directly into an active enemy stuns/alerts or triggers melee contact
          this.player.hp--;
          events.push({
            type: 'ENEMY_ATTACK',
            x: nx,
            y: ny,
            label: `Столкновение с ${enemyAtTarget.kind}`,
            moodAfter: this.getAudioMood(),
          });
          if (this.player.hp <= 0) {
            this.phase = 'MISSION_KO';
            events.push({ type: 'PLAYER_KO', x: nx, y: ny, moodAfter: this.getAudioMood() });
            this.activeProgramGen = null;
            return { done: true, openedTerminal: false, events, error: null, snapshot: this.getSnapshot() };
          }
          break;
        }
        const prevX = this.player.x;
        const prevY = this.player.y;
        this.player.x = nx;
        this.player.y = ny;
        this.player.stepsTaken++;
        events.push({
          type: 'ROBOT_MOVED',
          line: req.line,
          fromX: prevX,
          fromY: prevY,
          x: nx,
          y: ny,
          dir,
          moodAfter: this.getAudioMood(),
        });
        break;
      }

      case 'DASH': {
        if (this.player.dashCooldown > 0) {
          return failTurn(
            'E_RT_DASH_COOLDOWN',
            `Строка ${req.line}: «рывок» ещё перезаряжается (${this.player.dashCooldown} ход.).`
          );
        }
        const dir = req.dir || this.player.facing;
        this.player.facing = dir;
        this.player.crouched = false;
        const delta = DIR_DELTAS[dir];
        const fromX = this.player.x;
        const fromY = this.player.y;
        let moved = 0;
        for (let step = 0; step < 2; step++) {
          const nx = this.player.x + delta.dx;
          const ny = this.player.y + delta.dy;
          if (!this.isPassable(nx, ny)) {
            if (moved === 0) {
              return failTurn('E_RT_WALL_CRASH', `Строка ${req.line}: «рывок» невозможен — впереди стена.`, true);
            }
            break;
          }
          this.player.x = nx;
          this.player.y = ny;
          moved++;
        }
        this.player.dashCooldown = this.mask === 'tony' ? 1 : 2;
        this.player.stepsTaken += moved;
        events.push({
          type: 'ROBOT_DASHED',
          line: req.line,
          fromX,
          fromY,
          x: this.player.x,
          y: this.player.y,
          dir,
          moodAfter: this.getAudioMood(),
        });
        break;
      }

      case 'PAINT': {
        this.paintedSet.add(`${this.player.x},${this.player.y}`);
        events.push({
          type: 'TILE_PAINTED',
          line: req.line,
          x: this.player.x,
          y: this.player.y,
          moodAfter: this.getAudioMood(),
        });
        break;
      }

      case 'WAIT':
        break;

      case 'CROUCH':
        this.player.crouched = true;
        events.push({
          type: 'ROBOT_CROUCHED',
          line: req.line,
          x: this.player.x,
          y: this.player.y,
          moodAfter: this.getAudioMood(),
        });
        break;

      case 'HACK': {
        if (manhattan(this.player.x, this.player.y, this.terminalPos.x, this.terminalPos.y) > 1) {
          return failTurn(
            'E_RT_NO_TERMINAL',
            `Строка ${req.line}: рядом нет ПК «T» для команды «взломать / подключиться».`
          );
        }
        this.enterTerminal();
        openedTerminal = true;
        events.push({
          type: 'TERMINAL_OPENED',
          line: req.line,
          x: this.terminalPos.x,
          y: this.terminalPos.y,
          moodAfter: this.getAudioMood(),
        });
        break;
      }

      case 'DISABLE': {
        const dir = this.resolveTargetDir(req.dir, 'device');
        const d = DIR_DELTAS[dir];
        const tx = this.player.x + d.dx;
        const ty = this.player.y + d.dy;
        let hit = false;
        for (const cam of this.cameras) {
          if (cam.x === tx && cam.y === ty && cam.enabled) {
            cam.enabled = false;
            cam.disabledTurns = 3;
            hit = true;
            events.push({ type: 'CAMERA_DISABLED', x: tx, y: ty, moodAfter: this.getAudioMood() });
          }
        }
        for (const l of this.lasers) {
          if (l.enabled && l.cells.some((c) => c.x === tx && c.y === ty)) {
            l.enabled = false;
            l.disabledTurns = 3;
            hit = true;
            events.push({ type: 'LASER_DISABLED', x: tx, y: ty, moodAfter: this.getAudioMood() });
          }
        }
        if (!hit) {
          return failTurn('E_RT_NO_TARGET', `Строка ${req.line}: рядом в направлении нет щитка камеры или лазера.`);
        }
        break;
      }

      case 'BREACH_DOOR': {
        const dir = this.resolveTargetDir(req.dir, 'door');
        const d = DIR_DELTAS[dir];
        const tx = this.player.x + d.dx;
        const ty = this.player.y + d.dy;
        const door = this.doors.find((dr) => dr.x === tx && dr.y === ty);
        if (!door) {
          return failTurn('E_RT_NO_TARGET', `Строка ${req.line}: рядом нет двери для «выбить дверь».`);
        }
        door.open = true;
        door.broken = true;
        events.push({ type: 'DOOR_BROKEN', line: req.line, x: tx, y: ty, moodAfter: this.getAudioMood() });
        // Knock out anyone right behind the door
        const beyond = this.findEnemyAt(tx + d.dx, ty + d.dy) || this.findEnemyAt(tx, ty);
        if (beyond) {
          beyond.status = 'stunned';
          beyond.shielded = false;
          beyond.stunTurns = this.mask === 'tony' ? 4 : 3;
          events.push({ type: 'ENEMY_STUNNED', x: beyond.x, y: beyond.y, label: beyond.id, moodAfter: this.getAudioMood() });
        }
        this.triggerAlarm('Выбита электродверь — сработала тревога', events);
        break;
      }

      case 'THROW': {
        const dir = this.resolveTargetDir(req.dir, 'enemy');
        this.player.facing = dir;
        const d = DIR_DELTAS[dir];
        let hitEnemy: EnemyState | undefined;
        for (let dist = 1; dist <= 3; dist++) {
          const cx = this.player.x + d.dx * dist;
          const cy = this.player.y + d.dy * dist;
          if (!this.isPassable(cx, cy)) break;
          const found = this.findEnemyAt(cx, cy);
          if (found) {
            hitEnemy = found;
            break;
          }
        }
        if (hitEnemy) {
          if (hitEnemy.shielded) {
            hitEnemy.shielded = false;
            hitEnemy.distractedTurns = 1;
            events.push({
              type: 'ENEMY_SHIELD_BROKEN',
              x: hitEnemy.x,
              y: hitEnemy.y,
              label: 'Щит Медведя сбит ЭМИ-маячком',
              moodAfter: this.getAudioMood(),
            });
          } else {
            hitEnemy.distractedTurns = 2;
            events.push({
              type: 'ENEMY_STUNNED',
              x: hitEnemy.x,
              y: hitEnemy.y,
              label: 'Противник отвлечён ЭМИ-маячком',
              moodAfter: this.getAudioMood(),
            });
          }
        }
        break;
      }

      case 'STRIKE': {
        const dir = this.resolveTargetDir(req.dir, 'enemy');
        this.player.facing = dir;
        const d = DIR_DELTAS[dir];
        const tx = this.player.x + d.dx;
        const ty = this.player.y + d.dy;
        const target = this.findEnemyAt(tx, ty);
        if (!target) {
          return failTurn('E_RT_NO_TARGET', `Строка ${req.line}: на соседней клетке нет врага для удара.`);
        }
        if (target.shielded && target.facing !== dir) {
          return failTurn(
            'E_RT_NO_TARGET',
            `Строка ${req.line}: силовой щит «Медведя» отразил удар! Сначала примените «бросить».`
          );
        }
        target.status = 'stunned';
        target.shielded = false;
        target.stunTurns = this.mask === 'tony' ? 4 : 3;
        events.push({
          type: 'ENEMY_STUNNED',
          line: req.line,
          x: target.x,
          y: target.y,
          label: `${target.kind} оглушён ЭМИ-разрядом`,
          moodAfter: this.getAudioMood(),
        });
        break;
      }

      case 'FINISH': {
        const dir = this.resolveTargetDir(req.dir, 'enemy');
        const d = DIR_DELTAS[dir];
        const tx = this.player.x + d.dx;
        const ty = this.player.y + d.dy;
        const target = this.enemies.find((e) => e.x === tx && e.y === ty && e.status === 'stunned');
        if (!target) {
          return failTurn('E_RT_NO_TARGET', `Строка ${req.line}: рядом нет оглушённого врага для «добить».`);
        }
        target.status = 'offline';
        events.push({
          type: 'ENEMY_OFFLINE',
          line: req.line,
          x: target.x,
          y: target.y,
          label: `${target.kind} выведен из строя (OFFLINE)`,
          moodAfter: this.getAudioMood(),
        });
        break;
      }
    }

    // Check victory right after player's movement onto E!
    if (this.player.x === this.exitPos.x && this.player.y === this.exitPos.y && this.isExitUnlocked()) {
      this.finalizeVictory(events);
      return { done: true, openedTerminal: false, events, error: null, snapshot: this.getSnapshot() };
    }

    if (req.action !== 'HACK') {
      this.advanceWorldEntities(events);
    }

    // Check again in case mission KO happened
    if (this.phase === 'MISSION_KO') {
      this.activeProgramGen = null;
      return { done: true, openedTerminal, events, error: null, snapshot: this.getSnapshot() };
    }

    return {
      done: false,
      openedTerminal,
      events,
      error: null,
      snapshot: this.getSnapshot(),
    };
  }

  runProgramImmediate(source: string): {
    compiledOk: boolean;
    openedTerminal: boolean;
    events: WorldEvent[];
    errors: KumirError[];
    snapshot: WorldSnapshot;
  } {
    const prep = this.prepareProgramTurn(source);
    if (!prep.ok) {
      return {
        compiledOk: false,
        openedTerminal: false,
        events: [],
        errors: prep.errors,
        snapshot: this.getSnapshot(),
      };
    }

    const allEvents: WorldEvent[] = [];
    let openedTerminal = false;
    while (true) {
      const step = this.stepNextAction();
      allEvents.push(...step.events);
      if (step.openedTerminal) openedTerminal = true;
      if (step.openedTerminal) {
        // Keep remainder paused or finish cleanly after terminal opens
        this.activeProgramGen = null;
        break;
      }
      if (step.done) break;
    }

    return {
      compiledOk: true,
      openedTerminal,
      events: allEvents,
      errors: this.lastError ? [this.lastError] : [],
      snapshot: this.getSnapshot(),
    };
  }

  handleTurnTimeout(): { events: WorldEvent[]; snapshot: WorldSnapshot } {
    const events: WorldEvent[] = [];
    if (this.phase === 'EXTRACTION' || this.phase === 'MISSION_KO' || this.phase === 'BRIEFING') {
      return { events, snapshot: this.getSnapshot() };
    }
    this.turnIndex++;
    events.push({
      type: 'TURN_TIMEOUT',
      x: this.player.x,
      y: this.player.y,
      label: 'Время хода вышло — выполнен 1 такт ожидания',
      moodAfter: this.getAudioMood(),
    });
    this.advanceWorldEntities(events);
    this.decrementTurnEtaAndTick(events);
    return { events, snapshot: this.getSnapshot() };
  }

  getSnapshot(): WorldSnapshot {
    return {
      levelId: this.levelDef.id,
      levelTitle: this.levelDef.title,
      mask: this.mask,
      phase: this.phase,
      audioMood: this.getAudioMood(),
      seed: this.seed,
      turnIndex: this.turnIndex,
      turnTimeLeftSec: this.turnTimeLeftSec,
      turnTimeMaxSec: this.turnTimeMaxSec,
      alarmTriggered: this.alarmTriggered,
      alarmReason: this.alarmReason,
      gbrSpawned: this.gbrSpawned,
      gbrEtaTurns: this.gbrEtaTurns,
      gbrEtaMaxTurns: this.gbrEtaMaxTurns,
      gbrEtaSec: this.gbrEtaSec,
      idsNoise: this.idsNoise,
      idsMaxNoise: this.idsMaxNoise,
      hackCompleted: this.hackCompleted,
      paintedCount: this.paintedSet.size,
      requiredPaintCount: this.requiredPaintKeys.size,
      exitUnlocked: this.isExitUnlocked(),
      activeLine: this.activeLine,
      width: this.width,
      height: this.height,
      tiles: this.tiles.map((r) => [...r]),
      paintedTiles: Array.from(this.paintedSet).map((k) => {
        const [x, y] = k.split(',').map(Number);
        return { x, y };
      }),
      player: { ...this.player },
      doors: this.doors.map((d) => ({ ...d })),
      cameras: this.cameras.map((c) => ({
        ...c,
        phases: c.phases.map((ph) => ph.map((pt) => ({ ...pt }))),
      })),
      lasers: this.lasers.map((l) => ({ ...l, cells: l.cells.map((pt) => ({ ...pt })) })),
      enemies: this.enemies.map((e) => ({
        ...e,
        patrolRoute: e.patrolRoute.map((pt) => ({ ...pt })),
        telegraphNext: e.telegraphNext ? { ...e.telegraphNext } : null,
        telegraphAttackCells: e.telegraphAttackCells.map((pt) => ({ ...pt })),
      })),
      terminalPos: { ...this.terminalPos },
      exitPos: { ...this.exitPos },
      gbrSpawnPos: { ...this.gbrSpawnPos },
      lastError: this.lastError ? { ...this.lastError } : null,
      lastResult: this.lastResult ? { ...this.lastResult } : null,
    };
  }
}

export { HOTLINE_KUMIR_LEVELS };
