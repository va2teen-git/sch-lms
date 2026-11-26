import { ATLAS_SPRITES, ATLAS_URL } from './atlas-manifest.ts';
import { Camera2D, TILE_PX, type CameraMode } from './camera.ts';
import { buildClosedDoorSet, computeConePolygon, renderAdditiveGlows, renderLightmap } from './lighting.ts';
import type {
  Direction,
  EnemyState,
  FloorKind,
  LevelThemeId,
  MaskId,
  SceneProp,
  TileKind,
  WorldEvent,
  WorldSnapshot,
} from './types.ts';

export interface RenderStats {
  rafFrames: number;
  lastFrameMs: number;
  isLoopRunning: boolean;
}

interface MoveAnim {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  elapsed: number;
  duration: number;
}

interface DashTrail {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  mask: MaskId;
  facing: Direction;
  life: number;
  maxLife: number;
}

interface ThrowArc {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  life: number;
  maxLife: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rot: number;
  vrot: number;
  life: number;
  maxLife: number;
}

interface Shockwave {
  x: number;
  y: number;
  maxR: number;
  color: string;
  life: number;
  maxLife: number;
}

interface ThemePalette {
  label: string;
  wallBase: string;
  wallTop: string;
  wallBevel: string;
  wallEdge: string;
  accent: string;
}

const MAX_FX_MS = 420;
const CHAR_DRAW_PX = 54;

const THEME_PALETTES: Record<LevelThemeId, ThemePalette> = {
  kpp_street: {
    label: 'КПП // ПЕРИМЕТР',
    wallBase: '#180B2C',
    wallTop: '#2E184F',
    wallBevel: 'rgba(255, 255, 255, 0.16)',
    wallEdge: '#FF007F',
    accent: '#00F0FF',
  },
  lobby_hall: {
    label: 'ХОЛЛ // РЕСЕПШЕН',
    wallBase: '#220B33',
    wallTop: '#3C1659',
    wallBevel: 'rgba(255, 210, 240, 0.18)',
    wallEdge: '#F43F5E',
    accent: '#00F0FF',
  },
  analytics_office: {
    label: 'ОФИС // АНАЛИТИКА',
    wallBase: '#151A38',
    wallTop: '#253063',
    wallBevel: 'rgba(186, 230, 253, 0.18)',
    wallEdge: '#38BDF8',
    accent: '#F472B6',
  },
  server_hall: {
    label: 'СЕРВЕРНАЯ // ХОЛОД',
    wallBase: '#0A1C36',
    wallTop: '#143866',
    wallBevel: 'rgba(165, 243, 252, 0.22)',
    wallEdge: '#00F0FF',
    accent: '#22D3EE',
  },
  master_vault: {
    label: 'ЯДРО // КРАСНАЯ ЛИНИЯ',
    wallBase: '#260718',
    wallTop: '#450E2A',
    wallBevel: 'rgba(254, 205, 211, 0.18)',
    wallEdge: '#FF1E42',
    accent: '#FB7185',
  },
};

const FLOOR_SPRITE_VARIANTS: Record<FloorKind, [string, string]> = {
  asphalt: ['asphalt_0', 'asphalt_1'],
  sidewalk: ['sidewalk_0', 'sidewalk_1'],
  grass: ['grass_0', 'grass_1'],
  gravel: ['gravel_0', 'gravel_0'],
  kpp_concrete: ['floor_kpp_0', 'floor_kpp_1'],
  lobby_marble: ['floor_lobby_marble_0', 'floor_lobby_marble_1'],
  lobby_rug: ['floor_lobby_rug', 'floor_lobby_rug'],
  office_carpet: ['floor_office_carpet_0', 'floor_office_carpet_1'],
  wood_parquet: ['floor_wood_0', 'floor_wood_1'],
  server_grate: ['floor_server_grate_0', 'floor_server_grate_1'],
  vault_obsidian: ['floor_vault_0', 'floor_vault_1'],
  vault_crimson: ['floor_vault_crimson', 'floor_vault_crimson'],
  bathroom_tile: ['floor_bathroom', 'floor_bathroom'],
};

function hash2d(x: number, y: number): number {
  let n = (x * 374761393 + y * 668265263) | 0;
  n = ((n ^ (n >> 13)) * 1274126177) | 0;
  return (n ^ (n >> 16)) & 0xff;
}

function dirToAngle(dir: Direction): number {
  switch (dir) {
    case 'RIGHT':
      return 0;
    case 'DOWN':
      return Math.PI / 2;
    case 'LEFT':
      return Math.PI;
    case 'UP':
      return -Math.PI / 2;
  }
}

function tileCenter(x: number, y: number): { cx: number; cy: number } {
  return {
    cx: x * TILE_PX + TILE_PX / 2,
    cy: y * TILE_PX + TILE_PX / 2,
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

export class HotlineCanvasRenderer {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly fastAnim: boolean;
  readonly camera = new Camera2D();

  private atlasImg: HTMLImageElement | null = null;
  private atlasReady = false;
  private atlasWaiters: Array<() => void> = [];
  private onAtlasReadyCb: (() => void) | null = null;

  private backdropCanvas: HTMLCanvasElement | null = null;
  private backdropKey = '';
  private lightCanvas: HTMLCanvasElement | null = null;

  private snapshot: WorldSnapshot | null = null;
  private rafId: number | null = null;
  private lastTickTs = 0;
  private rafFrames = 0;
  private lastFrameMs = 0;

  private moveAnims = new Map<string, MoveAnim>();
  private dashTrails: DashTrail[] = [];
  private throwArcs: ThrowArc[] = [];
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];
  private fxTimerMs = 0;
  private fxKind: 'NONE' | 'SHAKE' | 'GLITCH' | 'ALARM_PULSE' = 'NONE';
  private shakeIntensity = 0;
  private sirenPhase = 0;
  private dpr = 1;
  private gbrVanCurrentX: number | null = null;
  private gbrVanAnim: { fromX: number; toX: number; elapsed: number; duration: number } | null = null;
  private gbrLastProgress = -1;
  private gbrSkidAlpha = 0;
  private hoveredTile: { x: number; y: number } | null = null;

  private readonly onVisibilityChange = () => {
    if (typeof document !== 'undefined' && document.hidden) {
      this.stopLoop();
    }
  };

  constructor(canvas: HTMLCanvasElement, fastAnim = false) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context unavailable');
    }
    this.ctx = context;
    this.fastAnim = fastAnim;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.onVisibilityChange);
      this.lightCanvas = document.createElement('canvas');
    }

    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = () => {
        this.atlasReady = true;
        this.backdropKey = '';
        if (this.snapshot) {
          this.ensureBackdropCache(this.snapshot);
          this.drawFrame();
        }
        this.onAtlasReadyCb?.();
        const waiters = this.atlasWaiters.splice(0);
        for (const w of waiters) w();
      };
      img.onerror = () => {
        const waiters = this.atlasWaiters.splice(0);
        for (const w of waiters) w();
      };
      img.src = ATLAS_URL;
      this.atlasImg = img;
    }
  }

  onAtlasLoad(cb: () => void): void {
    this.onAtlasReadyCb = cb;
    if (this.atlasReady) cb();
  }

  waitForAtlasReady(): Promise<void> {
    if (this.atlasReady || !this.atlasImg) return Promise.resolve();
    return new Promise((resolve) => {
      this.atlasWaiters.push(resolve);
      setTimeout(resolve, 2500);
    });
  }

  drawPortraitToCanvas(targetCanvas: HTMLCanvasElement, kind: MaskId | 'gbr'): void {
    const g = targetCanvas.getContext('2d');
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, targetCanvas.width, targetCanvas.height);

    const key = `portrait_${kind}`;
    const rect = ATLAS_SPRITES[key];
    if (this.atlasReady && this.atlasImg && rect) {
      g.drawImage(
        this.atlasImg,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        0,
        0,
        targetCanvas.width,
        targetCanvas.height
      );
      return;
    }

    // Crisp fallback before atlas onload completes
    g.fillStyle = '#110824';
    g.fillRect(0, 0, targetCanvas.width, targetCanvas.height);
    g.strokeStyle = '#FF007F';
    g.lineWidth = 2;
    g.strokeRect(1, 1, targetCanvas.width - 2, targetCanvas.height - 2);
  }

  getRenderStats(): RenderStats {
    return {
      rafFrames: this.rafFrames,
      lastFrameMs: this.lastFrameMs,
      isLoopRunning: this.rafId !== null,
    };
  }

  getCameraState(): { mode: CameraMode; zoom: number; x: number; y: number } {
    return {
      mode: this.camera.mode,
      zoom: Number(this.camera.zoom.toFixed(2)),
      x: Math.round(this.camera.x),
      y: Math.round(this.camera.y),
    };
  }

  getGbrAnimationState(): { active: boolean; progress: number; x: number | null; animating: boolean } {
    return {
      active: Boolean(this.snapshot && (this.snapshot.alarmTriggered || this.snapshot.gbrSpawned)),
      progress: this.gbrLastProgress < 0 ? 0 : Number(this.gbrLastProgress.toFixed(3)),
      x: this.gbrVanCurrentX !== null ? Number(this.gbrVanCurrentX.toFixed(1)) : null,
      animating: this.gbrVanAnim !== null,
    };
  }

  private getGbrVanTarget(snap: WorldSnapshot): {
    progress: number;
    startX: number;
    parkX: number;
    targetX: number;
    y: number;
    rot: number;
  } | null {
    if (!snap.alarmTriggered && !snap.gbrSpawned) return null;
    const fromLeft = snap.scene.gbrVanPos.x < snap.width / 2;
    const parkX =
      (fromLeft
        ? Math.min(snap.scene.gbrVanPos.x, -1.5)
        : Math.max(snap.scene.gbrVanPos.x, snap.width + 1.8)) * TILE_PX;
    const startX =
      (fromLeft
        ? -snap.scene.exteriorMargin - 2.6
        : snap.width + snap.scene.exteriorMargin + 2.6) * TILE_PX;
    const raw = (snap.gbrEtaMaxTurns - snap.gbrEtaTurns) / Math.max(1, snap.gbrEtaMaxTurns);
    const progress = snap.gbrSpawned ? 1 : Math.min(0.92, 0.14 + Math.max(0, raw) * 0.78);
    const targetX = startX + (parkX - startX) * progress;
    return {
      progress,
      startX,
      parkX,
      targetX,
      y: snap.scene.gbrVanPos.y * TILE_PX,
      rot: snap.scene.gbrVanPos.rot,
    };
  }

  private getCurrentGbrVanWorldPos(snap: WorldSnapshot): { x: number; y: number; rot: number } | null {
    const target = this.getGbrVanTarget(snap);
    if (!target) return null;
    return {
      x: this.gbrVanCurrentX ?? target.targetX,
      y: target.y,
      rot: target.rot,
    };
  }

  resize(): void {
    if (!this.snapshot) return;
    this.ensureCanvasDimensions();
    this.drawFrame();
  }

  setCameraMode(mode: CameraMode): void {
    if (!this.snapshot) return;
    const p = tileCenter(this.snapshot.player.x, this.snapshot.player.y);
    this.camera.setMode(mode, p.cx, p.cy);
    this.drawFrame();
  }

  zoomBy(factor: number, sx?: number, sy?: number): void {
    if (!this.snapshot) return;
    this.camera.zoomAt(factor, sx, sy);
    this.drawFrame();
  }

  panBy(dxScreen: number, dyScreen: number): void {
    if (!this.snapshot) return;
    this.camera.panBy(dxScreen, dyScreen);
    this.drawFrame();
  }

  getHoveredTile(clientX: number, clientY: number): { x: number; y: number } | null {
    if (!this.snapshot) return null;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return this.camera.screenToTile(sx, sy, TILE_PX);
  }

  setHoveredTile(tile: { x: number; y: number } | null): void {
    const prev = this.hoveredTile;
    if ((prev === null && tile === null) || (prev && tile && prev.x === tile.x && prev.y === tile.y)) {
      return;
    }
    this.hoveredTile = tile;
    if (this.snapshot) {
      this.drawFrame();
    }
  }

  renderSnapshot(snapshot: WorldSnapshot, events: WorldEvent[] = []): void {
    const levelChanged = this.snapshot?.levelId !== snapshot.levelId;
    this.snapshot = snapshot;
    this.ensureCanvasDimensions();

    const marginPx = snapshot.scene.exteriorMargin * TILE_PX;
    this.camera.setWorldBounds(
      -marginPx,
      -marginPx,
      snapshot.width * TILE_PX + marginPx,
      snapshot.height * TILE_PX + marginPx
    );

    if (levelChanged) {
      this.camera.mode = 'FOLLOW';
      this.camera.zoom = 1.0;
      const p = tileCenter(snapshot.player.x, snapshot.player.y);
      this.camera.followTarget(p.cx, p.cy, 16, true);
      this.gbrVanCurrentX = null;
      this.gbrVanAnim = null;
      this.gbrLastProgress = -1;
      this.gbrSkidAlpha = 0;
      this.hoveredTile = null;
    }

    this.ensureBackdropCache(snapshot);

    const vanTarget = this.getGbrVanTarget(snapshot);
    if (!vanTarget) {
      this.gbrVanCurrentX = null;
      this.gbrVanAnim = null;
      this.gbrLastProgress = -1;
      this.gbrSkidAlpha = 0;
      this.hoveredTile = null;
    } else if (this.fastAnim) {
      this.gbrVanCurrentX = vanTarget.targetX;
      this.gbrVanAnim = null;
      this.gbrLastProgress = vanTarget.progress;
      this.gbrSkidAlpha = vanTarget.progress >= 0.7 ? 0.65 : 0;
    } else if (Math.abs(this.gbrLastProgress - vanTarget.progress) > 0.001) {
      const fromX = this.gbrVanCurrentX ?? vanTarget.startX;
      this.gbrVanCurrentX = fromX;
      this.gbrVanAnim = {
        fromX,
        toX: vanTarget.targetX,
        elapsed: 0,
        duration: snapshot.gbrSpawned ? 350 : 380,
      };
      this.gbrLastProgress = vanTarget.progress;
      if (vanTarget.progress >= 0.7) {
        this.gbrSkidAlpha = 0.65;
      }
      const fromLeft = snapshot.scene.gbrVanPos.x < snapshot.width / 2;
      this.spawnBurst(
        vanTarget.targetX / TILE_PX + (fromLeft ? -1.1 : 1.1),
        snapshot.scene.gbrVanPos.y,
        ['#94A3B8', '#FF1E42', '#00A8FF'],
        8,
        280
      );
    }

    if (!this.fastAnim && events.length > 0) {
      this.ingestEvents(snapshot, events);
    } else if (this.fastAnim) {
      this.flushAnimationsInternal();
      const p = tileCenter(snapshot.player.x, snapshot.player.y);
      this.camera.followTarget(p.cx, p.cy, 16, true);
    }

    this.drawFrame();

    if (!this.fastAnim && this.hasActiveAnimations()) {
      this.startLoop();
    } else {
      this.stopLoop();
    }
  }

  flushAnimations(): void {
    this.flushAnimationsInternal();
    if (this.snapshot) {
      const p = tileCenter(this.snapshot.player.x, this.snapshot.player.y);
      this.camera.followTarget(p.cx, p.cy, 16, true);
      this.drawFrame();
    }
  }

  private flushAnimationsInternal(): void {
    this.moveAnims.clear();
    this.dashTrails = [];
    this.throwArcs = [];
    this.particles = [];
    this.shockwaves = [];
    this.fxTimerMs = 0;
    this.fxKind = 'NONE';
    this.shakeIntensity = 0;
    this.gbrVanAnim = null;
    if (this.snapshot) {
      const vt = this.getGbrVanTarget(this.snapshot);
      this.gbrVanCurrentX = vt ? vt.targetX : null;
      this.gbrLastProgress = vt ? vt.progress : -1;
      this.gbrSkidAlpha = vt && vt.progress >= 0.7 ? 0.65 : 0;
    }
    this.stopLoop();
  }

  dispose(): void {
    this.stopLoop();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
    }
  }

  private hasActiveAnimations(): boolean {
    return (
      this.moveAnims.size > 0 ||
      this.dashTrails.length > 0 ||
      this.throwArcs.length > 0 ||
      this.particles.length > 0 ||
      this.shockwaves.length > 0 ||
      this.fxTimerMs > 0 ||
      this.gbrVanAnim !== null
    );
  }

  private ingestEvents(snap: WorldSnapshot, events: WorldEvent[]): void {
    for (const ev of events) {
      if (
        ev.type === 'ROBOT_MOVED' &&
        ev.fromX !== undefined &&
        ev.fromY !== undefined &&
        ev.x !== undefined &&
        ev.y !== undefined
      ) {
        this.moveAnims.set('player', {
          fromX: ev.fromX,
          fromY: ev.fromY,
          toX: ev.x,
          toY: ev.y,
          elapsed: 0,
          duration: 120,
        });
      } else if (
        ev.type === 'ROBOT_DASHED' &&
        ev.fromX !== undefined &&
        ev.fromY !== undefined &&
        ev.x !== undefined &&
        ev.y !== undefined
      ) {
        this.moveAnims.set('player', {
          fromX: ev.fromX,
          fromY: ev.fromY,
          toX: ev.x,
          toY: ev.y,
          elapsed: 0,
          duration: 145,
        });
        this.dashTrails.push({
          fromX: ev.fromX,
          fromY: ev.fromY,
          toX: ev.x,
          toY: ev.y,
          mask: snap.mask,
          facing: ev.dir || snap.player.facing,
          life: 260,
          maxLife: 260,
        });
        this.spawnBurst(ev.x, ev.y, ['#00F0FF', '#F8FAFC'], 10, 260);
      } else if (
        ev.type === 'ENEMY_MOVED' &&
        ev.label &&
        ev.fromX !== undefined &&
        ev.fromY !== undefined &&
        ev.x !== undefined &&
        ev.y !== undefined
      ) {
        this.moveAnims.set(ev.label, {
          fromX: ev.fromX,
          fromY: ev.fromY,
          toX: ev.x,
          toY: ev.y,
          elapsed: 0,
          duration: 130,
        });
      } else if (
        ev.type === 'DECOY_THROWN' &&
        ev.fromX !== undefined &&
        ev.fromY !== undefined &&
        ev.x !== undefined &&
        ev.y !== undefined
      ) {
        this.throwArcs.push({
          fromX: ev.fromX,
          fromY: ev.fromY,
          toX: ev.x,
          toY: ev.y,
          life: 240,
          maxLife: 240,
        });
        this.shockwaves.push({
          x: ev.x,
          y: ev.y,
          maxR: TILE_PX * 1.45,
          color: '#00F0FF',
          life: 320,
          maxLife: 320,
        });
      } else if (ev.type === 'TILE_PAINTED' && ev.x !== undefined && ev.y !== undefined) {
        this.shockwaves.push({
          x: ev.x,
          y: ev.y,
          maxR: TILE_PX * 1.0,
          color: '#00F0FF',
          life: 260,
          maxLife: 260,
        });
        this.spawnBurst(ev.x, ev.y, ['#00F0FF', '#FF007F'], 10, 260);
      } else if (ev.type === 'OBJECT_INSPECTED' && ev.x !== undefined && ev.y !== undefined) {
        this.shockwaves.push({
          x: ev.x,
          y: ev.y,
          maxR: TILE_PX * 1.15,
          color: '#FBBF24',
          life: 260,
          maxLife: 260,
        });
        this.spawnBurst(ev.x, ev.y, ['#FBBF24', '#00F0FF', '#F8FAFC'], 10, 260);
      } else if (ev.type === 'DOOR_BROKEN' && ev.x !== undefined && ev.y !== undefined) {
        this.triggerFx('SHAKE', 240, 4.5);
        this.spawnBurst(ev.x, ev.y, ['#F59E0B', '#F8FAFC', '#FF007F'], 16, 300);
      } else if (ev.type === 'ENEMY_STUNNED' || ev.type === 'ENEMY_OFFLINE' || ev.type === 'ENEMY_SHIELD_BROKEN') {
        this.triggerFx('SHAKE', 180, 3.2);
        if (ev.x !== undefined && ev.y !== undefined) {
          this.spawnBurst(ev.x, ev.y, ['#FACC15', '#FF007F', '#00F0FF'], 12, 260);
        }
      } else if (ev.type === 'WALL_CRASH' || ev.type === 'ENEMY_ATTACK' || ev.type === 'PLAYER_KO') {
        this.triggerFx('GLITCH', 280, 4.5);
        if (ev.x !== undefined && ev.y !== undefined) {
          this.spawnBurst(ev.x, ev.y, ['#FF1E42', '#F8FAFC'], 14, 280);
        }
      } else if (ev.type === 'ALERT_TRIGGERED') {
        this.triggerFx('ALARM_PULSE', MAX_FX_MS, 5.5);
      } else if (ev.type === 'GBR_ARRIVED') {
        this.triggerFx('ALARM_PULSE', MAX_FX_MS, 5.5);
        this.shockwaves.push({
          x: snap.gbrSpawnPos.x,
          y: snap.gbrSpawnPos.y,
          maxR: TILE_PX * 1.6,
          color: '#FF1E42',
          life: 320,
          maxLife: 320,
        });
        const entryFromX =
          snap.scene.gbrVanPos.x < snap.width / 2
            ? Math.max(-1, Math.round(snap.scene.gbrVanPos.x))
            : Math.min(snap.width + 1, Math.round(snap.scene.gbrVanPos.x));
        const entryFromY = Math.round(snap.scene.gbrVanPos.y);
        for (const e of snap.enemies) {
          if (e.isGbr) {
            this.moveAnims.set(e.id, {
              fromX: entryFromX,
              fromY: entryFromY,
              toX: e.x,
              toY: e.y,
              elapsed: 0,
              duration: 240,
            });
          }
        }
      }
    }
  }

  private spawnBurst(tx: number, ty: number, colors: string[], count: number, maxLife: number): void {
    const { cx, cy } = tileCenter(tx, ty);
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= 120) break;
      const angle = (Math.PI * 2 * i) / count + ((i % 3) - 1) * 0.2;
      const speed = 0.045 + (i % 4) * 0.025;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3 + (i % 3),
        color: colors[i % colors.length],
        rot: angle,
        vrot: 0.02,
        life: maxLife,
        maxLife,
      });
    }
  }

  private triggerFx(kind: 'SHAKE' | 'GLITCH' | 'ALARM_PULSE', durationMs: number, intensity: number): void {
    this.fxKind = kind;
    this.fxTimerMs = Math.min(MAX_FX_MS, Math.max(this.fxTimerMs, durationMs));
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  private startLoop(): void {
    if (this.rafId !== null || typeof requestAnimationFrame === 'undefined') return;
    if (typeof document !== 'undefined' && document.hidden) return;
    this.lastTickTs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const tick = (now: number) => {
      this.rafId = null;
      if (!this.snapshot) return;
      const rawDt = now - this.lastTickTs;
      this.lastTickTs = now;
      const dt = Math.max(1, Math.min(rawDt, 50));

      for (const [key, anim] of this.moveAnims.entries()) {
        anim.elapsed += dt;
        if (anim.elapsed >= anim.duration) {
          this.moveAnims.delete(key);
        }
      }

      const pPos = this.getInterpolatedPos('player', this.snapshot.player.x, this.snapshot.player.y);
      const target = tileCenter(pPos.x, pPos.y);
      this.camera.followTarget(target.cx, target.cy, dt, false);

      this.dashTrails = this.dashTrails.filter((t) => {
        t.life -= dt;
        return t.life > 0;
      });
      this.throwArcs = this.throwArcs.filter((a) => {
        a.life -= dt;
        return a.life > 0;
      });
      this.shockwaves = this.shockwaves.filter((s) => {
        s.life -= dt;
        return s.life > 0;
      });
      this.particles = this.particles.filter((p) => {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        return p.life > 0;
      });
      if (this.fxTimerMs > 0) {
        this.fxTimerMs = Math.max(0, this.fxTimerMs - dt);
        if (this.fxTimerMs === 0) {
          this.fxKind = 'NONE';
          this.shakeIntensity = 0;
        }
      }
      if (this.gbrVanAnim) {
        this.gbrVanAnim.elapsed += dt;
        const t = Math.min(1, this.gbrVanAnim.elapsed / this.gbrVanAnim.duration);
        const eased = 1 - Math.pow(1 - t, 3);
        this.gbrVanCurrentX = this.gbrVanAnim.fromX + (this.gbrVanAnim.toX - this.gbrVanAnim.fromX) * eased;
        if (t >= 1) {
          this.gbrVanCurrentX = this.gbrVanAnim.toX;
          this.gbrVanAnim = null;
        }
      }
      this.sirenPhase += dt * 0.012;
      this.rafFrames++;
      this.drawFrame();

      if (this.hasActiveAnimations() && !(typeof document !== 'undefined' && document.hidden)) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.stopLoop();
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = null;
  }

  private ensureCanvasDimensions(): void {
    const parent = this.canvas.parentElement;
    const cssW = parent && parent.clientWidth > 120 ? parent.clientWidth : 760;
    const cssH = parent && parent.clientHeight > 120 ? parent.clientHeight : 540;
    this.dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;

    const targetW = Math.round(cssW * this.dpr);
    const targetH = Math.round(cssH * this.dpr);
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
    }
    this.camera.setViewport(cssW, cssH);
  }

  private drawSprite(
    g: CanvasRenderingContext2D,
    name: string,
    dx: number,
    dy: number,
    dw: number,
    dh: number
  ): boolean {
    if (!this.atlasReady || !this.atlasImg) return false;
    const rect = ATLAS_SPRITES[name];
    if (!rect) return false;
    g.drawImage(this.atlasImg, rect.x, rect.y, rect.w, rect.h, dx, dy, dw, dh);
    return true;
  }

  private drawPropRotated(g: CanvasRenderingContext2D, prop: SceneProp): void {
    const rect = ATLAS_SPRITES[prop.sprite];
    if (!rect || !this.atlasReady || !this.atlasImg) return;
    const sw = prop.w ? prop.w * TILE_PX : rect.w * 2;
    const sh = prop.h ? prop.h * TILE_PX : rect.h * 2;
    const rot = prop.rot || 0;
    const rotated = rot === 90 || rot === 270;
    const fw = rotated ? sh : sw;
    const fh = rotated ? sw : sh;
    const cx = prop.x * TILE_PX + fw / 2;
    const cy = prop.y * TILE_PX + fh / 2;

    g.save();
    g.translate(cx, cy);
    if (rot !== 0) g.rotate((rot * Math.PI) / 180);
    if (prop.flipX) g.scale(-1, 1);
    g.drawImage(this.atlasImg, rect.x, rect.y, rect.w, rect.h, -sw / 2, -sh / 2, sw, sh);
    g.restore();
  }

  private ensureBackdropCache(snap: WorldSnapshot): void {
    const theme = snap.theme || 'kpp_street';
    const margin = snap.scene.exteriorMargin;
    const key = `${snap.levelId}:${theme}:${snap.width}x${snap.height}:${this.atlasReady ? 1 : 0}`;
    if (this.backdropCanvas && this.backdropKey === key) return;
    if (typeof document === 'undefined') return;

    const totalW = (snap.width + margin * 2) * TILE_PX;
    const totalH = (snap.height + margin * 2) * TILE_PX;
    const off = document.createElement('canvas');
    off.width = totalW;
    off.height = totalH;
    const g = off.getContext('2d');
    if (!g) return;
    g.imageSmoothingEnabled = false;

    const pal = THEME_PALETTES[theme];
    const ox = margin * TILE_PX;
    const oy = margin * TILE_PX;
    g.save();
    g.translate(ox, oy);

    // 1. Fill full exterior night asphalt
    for (let y = -margin; y < snap.height + margin; y++) {
      for (let x = -margin; x < snap.width + margin; x++) {
        const px = x * TILE_PX;
        const py = y * TILE_PX;
        const h = hash2d(x, y);
        const keyTile = h > 236 ? 'asphalt_crack' : h % 2 === 0 ? 'asphalt_0' : 'asphalt_1';
        if (!this.drawSprite(g, keyTile, px, py, TILE_PX, TILE_PX)) {
          g.fillStyle = h % 2 === 0 ? '#121024' : '#17142C';
          g.fillRect(px, py, TILE_PX, TILE_PX);
        }
      }
    }

    // Road curb frame around playable compound [0..width, 0..height]
    g.fillStyle = '#334155';
    g.fillRect(-4, -4, snap.width * TILE_PX + 8, 4);
    g.fillRect(-4, snap.height * TILE_PX, snap.width * TILE_PX + 8, 4);
    g.fillRect(-4, 0, 4, snap.height * TILE_PX);
    g.fillRect(snap.width * TILE_PX, 0, 4, snap.height * TILE_PX);

    // 2. Scene Zones (sidewalks, grass, gravel, interior marble/carpet/parquet/grate)
    for (const zone of snap.scene.zones) {
      const variants = FLOOR_SPRITE_VARIANTS[zone.floor];
      for (let y = zone.y; y < zone.y + zone.h; y++) {
        for (let x = zone.x; x < zone.x + zone.w; x++) {
          const px = x * TILE_PX;
          const py = y * TILE_PX;
          const spr = (x + y) % 2 === 0 ? variants[0] : variants[1];
          if (!this.drawSprite(g, spr, px, py, TILE_PX, TILE_PX)) {
            g.fillStyle = zone.indoor ? '#1B1035' : '#252338';
            g.fillRect(px, py, TILE_PX, TILE_PX);
          }
        }
      }
      if (zone.label) {
        g.fillStyle = zone.indoor ? 'rgba(226, 232, 240, 0.22)' : 'rgba(148, 163, 184, 0.28)';
        g.font = 'bold 9px monospace';
        g.textAlign = 'left';
        g.fillText(zone.label, zone.x * TILE_PX + 8, zone.y * TILE_PX + 14);
      }
    }

    // 3. Subtle yet crisp KuMir Tactical Grid inside playable arena (dual-contrast for light & dark floors)
    for (let y = 0; y < snap.height; y++) {
      for (let x = 0; x < snap.width; x++) {
        const tile = snap.tiles[y][x];
        if (tile === 'WALL' || tile === 'WINDOW') continue;
        const px = x * TILE_PX;
        const py = y * TILE_PX;
        // Dark seam for light/grey tiles (sidewalk, concrete, marble, gravel, bathroom)
        g.strokeStyle = 'rgba(5, 3, 14, 0.28)';
        g.lineWidth = 1;
        g.strokeRect(px + 0.5, py + 0.5, TILE_PX - 1, TILE_PX - 1);
        // Inner soft highlight for dark floors (obsidian, carpet, grate)
        g.strokeStyle = 'rgba(186, 230, 253, 0.09)';
        g.strokeRect(px + 1.5, py + 1.5, TILE_PX - 3, TILE_PX - 3);
        // Subtle 4px corner ticks for instant step counting
        g.fillStyle = 'rgba(125, 211, 252, 0.26)';
        g.fillRect(px + 1, py + 1, 4, 1);
        g.fillRect(px + 1, py + 1, 1, 4);
        g.fillRect(px + TILE_PX - 5, py + 1, 4, 1);
        g.fillRect(px + TILE_PX - 2, py + 1, 1, 4);
        g.fillRect(px + 1, py + TILE_PX - 2, 4, 1);
        g.fillRect(px + 1, py + TILE_PX - 5, 1, 4);
        g.fillRect(px + TILE_PX - 5, py + TILE_PX - 2, 4, 1);
        g.fillRect(px + TILE_PX - 2, py + TILE_PX - 5, 1, 4);
      }
    }

    // 4. Floor decal props (puddles, manholes, rugs, cable trays, clutter)
    for (const prop of snap.scene.props) {
      if (prop.layer === 'floor') {
        this.drawPropRotated(g, prop);
      }
    }

    // 5. Parked Hacker Sports Coupe on exterior avenue
    const coupe = snap.scene.coupePos;
    const coupeRect = ATLAS_SPRITES['car_hacker_coupe'];
    if (coupeRect && this.atlasReady && this.atlasImg) {
      g.save();
      g.translate(coupe.x * TILE_PX, coupe.y * TILE_PX);
      g.rotate((coupe.rot * Math.PI) / 180);
      const cw = coupeRect.w * 2;
      const ch = coupeRect.h * 2;
      g.drawImage(this.atlasImg, coupeRect.x, coupeRect.y, coupeRect.w, coupeRect.h, -cw / 2, -ch / 2, cw, ch);
      g.restore();
    }

    // 6. Ambient Occlusion & Directional Drop Shadows from Building Walls/Windows
    const isBorderTile = (gx: number, gy: number): boolean =>
      gx === 0 || gy === 0 || gx === snap.width - 1 || gy === snap.height - 1;
    const isStruct = (gx: number, gy: number): boolean => {
      if (gx < 0 || gy < 0 || gx >= snap.width || gy >= snap.height) return false;
      const t = snap.tiles[gy][gx];
      return t === 'WALL' || t === 'WINDOW' || snap.doors.some((d) => d.x === gx && d.y === gy);
    };
    const isBuildingStruct = (gx: number, gy: number): boolean => !isBorderTile(gx, gy) && isStruct(gx, gy);

    for (let y = 0; y < snap.height; y++) {
      for (let x = 0; x < snap.width; x++) {
        if (isStruct(x, y)) continue;
        const px = x * TILE_PX;
        const py = y * TILE_PX;
        if (isBuildingStruct(x - 1, y)) {
          g.fillStyle = 'rgba(6, 3, 14, 0.36)';
          g.fillRect(px, py, 8, TILE_PX);
        }
        if (isBuildingStruct(x, y - 1)) {
          g.fillStyle = 'rgba(6, 3, 14, 0.42)';
          g.fillRect(px, py, TILE_PX, 9);
        }
        if (isBuildingStruct(x + 1, y)) {
          g.fillStyle = 'rgba(6, 3, 14, 0.16)';
          g.fillRect(px + TILE_PX - 5, py, 5, TILE_PX);
        }
        if (isBuildingStruct(x, y + 1)) {
          g.fillStyle = 'rgba(6, 3, 14, 0.16)';
          g.fillRect(px, py + TILE_PX - 5, TILE_PX, 5);
        }
      }
    }

    // 7. Auto-tiled Thin Top-Down Building Walls (14 px) + Sleek Compound Perimeter Fence (6 px) + Glass Windows
    const wallThick = 14;
    const wallOff = (TILE_PX - wallThick) / 2; // 17 px
    const fenceThick = 6;
    const fenceOff = (TILE_PX - fenceThick) / 2; // 21 px

    for (let y = 0; y < snap.height; y++) {
      for (let x = 0; x < snap.width; x++) {
        const tile = snap.tiles[y][x];
        const px = x * TILE_PX;
        const py = y * TILE_PX;

        if (tile === 'WALL' && isBorderTile(x, y)) {
          const fn = isBorderTile(x, y - 1) && isStruct(x, y - 1);
          const fs = isBorderTile(x, y + 1) && isStruct(x, y + 1);
          const fw = isBorderTile(x - 1, y) && isStruct(x - 1, y);
          const fe = isBorderTile(x + 1, y) && isStruct(x + 1, y);

          g.fillStyle = '#0A0614';
          g.fillRect(px + fenceOff - 1, py + fenceOff - 1, fenceThick + 2, fenceThick + 2);
          if (fn) g.fillRect(px + fenceOff - 1, py, fenceThick + 2, fenceOff + 1);
          if (fs) g.fillRect(px + fenceOff - 1, py + fenceOff, fenceThick + 2, TILE_PX - fenceOff);
          if (fw) g.fillRect(px, py + fenceOff - 1, fenceOff + 1, fenceThick + 2);
          if (fe) g.fillRect(px + fenceOff, py + fenceOff - 1, TILE_PX - fenceOff, fenceThick + 2);

          g.fillStyle = '#475569';
          g.fillRect(px + fenceOff, py + fenceOff, fenceThick, fenceThick);
          if (fn) g.fillRect(px + fenceOff, py, fenceThick, fenceOff);
          if (fs) g.fillRect(px + fenceOff, py + fenceOff, fenceThick, TILE_PX - fenceOff);
          if (fw) g.fillRect(px, py + fenceOff, fenceOff, fenceThick);
          if (fe) g.fillRect(px + fenceOff, py + fenceOff, TILE_PX - fenceOff, fenceThick);

          // Fence post cap
          g.fillStyle = '#94A3B8';
          g.fillRect(px + fenceOff + 1, py + fenceOff + 1, fenceThick - 2, fenceThick - 2);
        } else if (tile === 'WALL') {
          const n = isBuildingStruct(x, y - 1);
          const s = isBuildingStruct(x, y + 1);
          const w = isBuildingStruct(x - 1, y);
          const e = isBuildingStruct(x + 1, y);

          // Cast crisp pixel shadow SE
          g.fillStyle = 'rgba(6, 3, 14, 0.48)';
          g.fillRect(px + wallOff + 4, py + wallOff + 4, wallThick, wallThick);
          if (e) g.fillRect(px + wallOff + 4, py + wallOff + 4, TILE_PX - wallOff, wallThick);
          if (s) g.fillRect(px + wallOff + 4, py + wallOff + 4, wallThick, TILE_PX - wallOff);

          // Dark #0A0614 outer wall casing
          g.fillStyle = '#0A0614';
          g.fillRect(px + wallOff - 2, py + wallOff - 2, wallThick + 4, wallThick + 4);
          if (n) g.fillRect(px + wallOff - 2, py, wallThick + 4, wallOff + 2);
          if (s) g.fillRect(px + wallOff - 2, py + wallOff, wallThick + 4, TILE_PX - wallOff);
          if (w) g.fillRect(px, py + wallOff - 2, wallOff + 2, wallThick + 4);
          if (e) g.fillRect(px + wallOff, py + wallOff - 2, TILE_PX - wallOff, wallThick + 4);

          // Wall masonry cap fill
          g.fillStyle = pal.wallTop;
          g.fillRect(px + wallOff, py + wallOff, wallThick, wallThick);
          if (n) g.fillRect(px + wallOff, py, wallThick, wallOff);
          if (s) g.fillRect(px + wallOff, py + wallOff, wallThick, TILE_PX - wallOff);
          if (w) g.fillRect(px, py + wallOff, wallOff, wallThick);
          if (e) g.fillRect(px + wallOff, py + wallOff, TILE_PX - wallOff, wallThick);

          // Inner top-left bevel + neon perimeter highlight on outer building edge
          g.fillStyle = pal.wallBevel;
          g.fillRect(px + wallOff, py + wallOff, wallThick, 2);
          g.fillRect(px + wallOff, py + wallOff, 2, wallThick);

          const isOuterWall =
            x === snap.scene.buildingBounds.x ||
            x === snap.scene.buildingBounds.x + snap.scene.buildingBounds.w - 1 ||
            y === snap.scene.buildingBounds.y ||
            y === snap.scene.buildingBounds.y + snap.scene.buildingBounds.h - 1;
          if (isOuterWall) {
            g.fillStyle = pal.wallEdge;
            if (e || w) g.fillRect(px + (w ? 0 : wallOff), py + wallOff + wallThick - 2, (w ? wallOff : 0) + wallThick + (e ? TILE_PX - wallOff - wallThick : 0), 2);
            if (n || s) g.fillRect(px + wallOff + wallThick - 2, py + (n ? 0 : wallOff), 2, (n ? wallOff : 0) + wallThick + (s ? TILE_PX - wallOff - wallThick : 0));
          }

          // Brick joint pixel ticks
          g.fillStyle = pal.wallBase;
          g.fillRect(px + wallOff + 4, py + wallOff + 4, 2, 2);
          if (e) g.fillRect(px + TILE_PX - 8, py + wallOff + 5, 2, 3);
          if (s) g.fillRect(px + wallOff + 5, py + TILE_PX - 8, 3, 2);
        } else if (tile === 'WINDOW') {
          const horiz = isStruct(x - 1, y) || isStruct(x + 1, y);
          if (horiz) {
            // Window sill & frame
            g.fillStyle = '#0A0614';
            g.fillRect(px, py + wallOff - 1, TILE_PX, wallThick + 2);
            g.fillStyle = pal.wallTop;
            g.fillRect(px, py + wallOff, 6, wallThick);
            g.fillRect(px + TILE_PX - 6, py + wallOff, 6, wallThick);
            // Cyan glass pane
            g.fillStyle = '#0E4A6E';
            g.fillRect(px + 6, py + wallOff + 2, TILE_PX - 12, wallThick - 4);
            g.fillStyle = '#38BDF8';
            g.fillRect(px + 6, py + wallOff + 4, TILE_PX - 12, 3);
            g.fillStyle = '#E0F2FE';
            g.fillRect(px + 12, py + wallOff + 3, 8, 2);
            g.fillRect(px + 28, py + wallOff + 6, 8, 2);
            // Center mullion
            g.fillStyle = '#1E293B';
            g.fillRect(px + TILE_PX / 2 - 1, py + wallOff, 2, wallThick);
          } else {
            g.fillStyle = '#0A0614';
            g.fillRect(px + wallOff - 1, py, wallThick + 2, TILE_PX);
            g.fillStyle = pal.wallTop;
            g.fillRect(px + wallOff, py, wallThick, 6);
            g.fillRect(px + wallOff, py + TILE_PX - 6, wallThick, 6);
            g.fillStyle = '#0E4A6E';
            g.fillRect(px + wallOff + 2, py + 6, wallThick - 4, TILE_PX - 12);
            g.fillStyle = '#38BDF8';
            g.fillRect(px + wallOff + 4, py + 6, 3, TILE_PX - 12);
            g.fillStyle = '#E0F2FE';
            g.fillRect(px + wallOff + 3, py + 12, 2, 8);
            g.fillRect(px + wallOff + 6, py + 28, 2, 8);
            g.fillStyle = '#1E293B';
            g.fillRect(px + wallOff, py + TILE_PX / 2 - 1, wallThick, 2);
          }
        }
      }
    }

    // 8. Interior Furniture & Yard Props (layer === 'prop' or undefined)
    for (const prop of snap.scene.props) {
      if (!prop.layer || prop.layer === 'prop') {
        this.drawPropRotated(g, prop);
      }
    }

    // 9. Neon Building Facade Marquee Sign (placed cleanly above facade line)
    if (snap.scene.neonSignPos) {
      const sign = snap.scene.neonSignPos;
      const sx = sign.x * TILE_PX;
      const sy = sign.y * TILE_PX - 28;
      g.font = 'bold 11px monospace';
      const tw = Math.max(114, g.measureText(sign.text).width + 20);
      g.fillStyle = '#090414';
      g.fillRect(sx, sy, tw, 20);
      g.strokeStyle = sign.color;
      g.lineWidth = 2;
      g.strokeRect(sx, sy, tw, 20);
      g.fillStyle = sign.color;
      g.textAlign = 'left';
      g.fillText(sign.text, sx + 10, sy + 14);
    }

    g.restore();
    this.backdropCanvas = off;
    this.backdropKey = key;
  }

  private drawFrame(): void {
    const snap = this.snapshot;
    if (!snap) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;

    const ctx = this.ctx;
    const viewW = this.camera.viewW;
    const viewH = this.camera.viewH;

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#070312';
    ctx.fillRect(0, 0, viewW, viewH);

    // Camera World Transform + L4 Reactive Shake
    this.camera.applyTransform(ctx, this.dpr);
    ctx.imageSmoothingEnabled = false;

    if (this.fxTimerMs > 0 && this.shakeIntensity > 0) {
      const ratio = this.fxTimerMs / MAX_FX_MS;
      const dx = Math.sin(this.fxTimerMs * 0.45) * this.shakeIntensity * ratio;
      const dy = Math.cos(this.fxTimerMs * 0.6) * this.shakeIntensity * ratio;
      ctx.translate(dx, dy);
    }

    // L0: Static World Backdrop (Exterior + Floors + Thin Walls/Windows + Furniture)
    if (this.backdropCanvas) {
      const mPx = snap.scene.exteriorMargin * TILE_PX;
      ctx.drawImage(this.backdropCanvas, -mPx, -mPx);
    }

    // L1: Relays, Painted Tiles, Terminal, Exit, Orientation-Aware Doors
    this.drawWorldObjects(ctx, snap);

    // L2: 2D Raycast Vision Cones, Camera Rays, Lasers, Rasmus Forecast
    this.drawLightingAndCones(ctx, snap);

    // L3: GBR Van, Dash Trails, Animated Multi-Layer Characters
    const gbrVanWorldPos = this.getCurrentGbrVanWorldPos(snap);
    this.drawGbrStreetPresence(ctx, snap, gbrVanWorldPos);
    this.drawDashTrails(ctx);

    for (const enemy of snap.enemies) {
      this.drawEnemy(ctx, enemy);
    }
    this.drawPlayer(ctx, snap);

    // L4: Overhead Trees & Streetlamps (translucent if player passes underneath)
    this.drawOverheadProps(ctx, snap);

    // L5a: Additive Neon Glows & Particles in world space
    renderAdditiveGlows(ctx, snap, this.sirenPhase, TILE_PX, gbrVanWorldPos);
    this.drawEffectsOverlay(ctx);

    // L5b: Half-res Offscreen Night Lightmap in screen space
    if (this.lightCanvas) {
      renderLightmap(this.lightCanvas, this.camera, snap, this.sirenPhase, TILE_PX, gbrVanWorldPos);
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.drawImage(this.lightCanvas, 0, 0, viewW, viewH);
    }

    // L5c: Post-FX (Alarm vignette, Glitch slices, Scanlines) + L6 Tactical Minimap
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.drawPostFx(ctx, snap, viewW, viewH);
    this.drawMinimap(ctx, snap, viewW);

    ctx.restore();
    if (typeof performance !== 'undefined') {
      this.lastFrameMs = Number((performance.now() - t0).toFixed(2));
    }
  }

  private drawCornerBrackets(
    ctx: CanvasRenderingContext2D,
    px: number,
    py: number,
    color: string,
    len: number,
    lineWidth: number
  ): void {
    const pad = 2;
    const x0 = px + pad;
    const y0 = py + pad;
    const x1 = px + TILE_PX - pad;
    const y1 = py + TILE_PX - pad;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + len);
    ctx.lineTo(x0, y0);
    ctx.lineTo(x0 + len, y0);
    ctx.moveTo(x1 - len, y0);
    ctx.lineTo(x1, y0);
    ctx.lineTo(x1, y0 + len);
    ctx.moveTo(x0, y1 - len);
    ctx.lineTo(x0, y1);
    ctx.lineTo(x0 + len, y1);
    ctx.moveTo(x1 - len, y1);
    ctx.lineTo(x1, y1);
    ctx.lineTo(x1, y1 - len);
    ctx.stroke();
  }

  private drawWorldObjects(ctx: CanvasRenderingContext2D, snap: WorldSnapshot): void {
    const paintedKeys = new Set(snap.paintedTiles.map((pt) => `${pt.x},${pt.y}`));

    for (let y = 0; y < snap.height; y++) {
      for (let x = 0; x < snap.width; x++) {
        const tile = snap.tiles[y][x];
        const px = x * TILE_PX;
        const py = y * TILE_PX;
        const isPainted = paintedKeys.has(`${x},${y}`);

        if (isPainted) {
          ctx.fillStyle = 'rgba(0, 240, 255, 0.22)';
          ctx.fillRect(px + 4, py + 4, TILE_PX - 8, TILE_PX - 8);
          ctx.strokeStyle = '#00F0FF';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 5, py + 5, TILE_PX - 10, TILE_PX - 10);
        }

        if (tile === 'COVER') {
          this.drawCornerBrackets(ctx, px, py, 'rgba(56, 189, 248, 0.55)', 6, 1.4);
          ctx.fillStyle = 'rgba(9, 4, 20, 0.85)';
          ctx.fillRect(px + 3, py + 3, 12, 12);
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.75)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 3, py + 3, 12, 12);
          ctx.fillStyle = '#7DD3FC';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('C', px + 9, py + 12);
        } else if (tile === 'RELAY') {
          if (!this.drawSprite(ctx, isPainted ? 'relay_on' : 'relay_off', px + 3, py + 3, TILE_PX - 6, TILE_PX - 6)) {
            ctx.fillStyle = isPainted ? '#082F49' : '#2E0927';
            ctx.fillRect(px + 6, py + 6, TILE_PX - 12, TILE_PX - 12);
          }
          this.drawCornerBrackets(ctx, px, py, isPainted ? '#22D3EE' : '#F472B6', 7, 1.6);
          ctx.fillStyle = isPainted ? '#67E8F9' : '#F472B6';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(isPainted ? '✓' : '*', px + TILE_PX / 2, py + TILE_PX - 6);
        } else if (tile === 'TERMINAL') {
          if (!this.drawSprite(ctx, snap.hackCompleted ? 'terminal_hacked' : 'terminal_locked', px + 2, py + 2, TILE_PX - 4, TILE_PX - 4)) {
            ctx.fillStyle = '#0F172A';
            ctx.fillRect(px + 5, py + 5, TILE_PX - 10, TILE_PX - 10);
          }
          this.drawCornerBrackets(ctx, px, py, snap.hackCompleted ? '#34D399' : '#00F0FF', 7, 1.6);
          ctx.fillStyle = snap.hackCompleted ? '#34D399' : '#38BDF8';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('ПК', px + TILE_PX / 2, py + TILE_PX - 4);
        } else if (tile === 'EXIT') {
          const open = snap.exitUnlocked;
          const horizWall =
            (x > 0 && (snap.tiles[y][x - 1] === 'WALL' || snap.tiles[y][x - 1] === 'WINDOW')) ||
            (x + 1 < snap.width && (snap.tiles[y][x + 1] === 'WALL' || snap.tiles[y][x + 1] === 'WINDOW'));
          ctx.fillStyle = open ? 'rgba(16, 185, 129, 0.30)' : 'rgba(255, 30, 66, 0.18)';
          ctx.fillRect(px + 3, py + 3, TILE_PX - 6, TILE_PX - 6);
          ctx.strokeStyle = open ? '#10B981' : '#FF1E42';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 4, py + 4, TILE_PX - 8, TILE_PX - 8);

          // Emergency exit door jambs & panic-bar leaf
          ctx.save();
          ctx.translate(px + TILE_PX / 2, py + TILE_PX / 2);
          if (!horizWall) ctx.rotate(Math.PI / 2);
          ctx.fillStyle = '#334155';
          ctx.fillRect(-TILE_PX / 2, -6, 5, 12);
          ctx.fillRect(TILE_PX / 2 - 5, -6, 5, 12);
          if (open) {
            ctx.fillStyle = '#065F46';
            ctx.fillRect(-TILE_PX / 2 + 5, -4, 6, TILE_PX - 14);
            ctx.strokeStyle = '#34D399';
            ctx.lineWidth = 1.4;
            ctx.strokeRect(-TILE_PX / 2 + 5, -4, 6, TILE_PX - 14);
          } else {
            ctx.fillStyle = '#4C0519';
            ctx.fillRect(-TILE_PX / 2 + 5, -3, TILE_PX - 10, 6);
            ctx.fillStyle = '#E2E8F0';
            ctx.fillRect(-TILE_PX / 2 + 9, -1, TILE_PX - 18, 2);
          }
          ctx.restore();

          ctx.strokeStyle = open ? '#34D399' : '#FB7185';
          ctx.lineWidth = 2;
          for (let c = -1; c <= 1; c++) {
            const ox = px + TILE_PX / 2 + c * 7;
            const oy = py + 15;
            ctx.beginPath();
            ctx.moveTo(ox - 2.5, oy - 5);
            ctx.lineTo(ox + 2.5, oy);
            ctx.lineTo(ox - 2.5, oy + 5);
            ctx.stroke();
          }

          ctx.fillStyle = open ? '#6EE7B7' : '#FDA4AF';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(open ? 'ВЫХ' : 'ЗАП', px + TILE_PX / 2, py + TILE_PX - 7);
        } else if (tile === 'GBR_SPAWN') {
          const horizWall =
            (x > 0 && (snap.tiles[y][x - 1] === 'WALL' || snap.tiles[y][x - 1] === 'WINDOW')) ||
            (x + 1 < snap.width && (snap.tiles[y][x + 1] === 'WALL' || snap.tiles[y][x + 1] === 'WINDOW'));
          ctx.fillStyle = snap.gbrSpawned ? 'rgba(255, 30, 66, 0.28)' : 'rgba(255, 30, 66, 0.14)';
          ctx.fillRect(px + 3, py + 3, TILE_PX - 6, TILE_PX - 6);
          ctx.strokeStyle = '#FF1E42';
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(px + 4, py + 4, TILE_PX - 8, TILE_PX - 8);
          ctx.setLineDash([]);

          // Main entrance door frame for GBR breach
          ctx.save();
          ctx.translate(px + TILE_PX / 2, py + TILE_PX / 2);
          if (!horizWall) ctx.rotate(Math.PI / 2);
          ctx.fillStyle = '#334155';
          ctx.fillRect(-TILE_PX / 2, -7, 6, 14);
          ctx.fillRect(TILE_PX / 2 - 6, -7, 6, 14);
          ctx.fillStyle = snap.gbrSpawned ? '#7F1D1D' : '#1E293B';
          ctx.fillRect(-TILE_PX / 2 + 6, -4, 7, TILE_PX - 14);
          ctx.strokeStyle = snap.gbrSpawned ? '#FF1E42' : '#94A3B8';
          ctx.lineWidth = 1.4;
          ctx.strokeRect(-TILE_PX / 2 + 6, -4, 7, TILE_PX - 14);
          ctx.restore();

          ctx.fillStyle = '#FCA5A5';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('ГБР', px + TILE_PX / 2, py + TILE_PX - 7);
        }
      }
    }

    // Interactive interior objects (crates, plants, urns, upholstered furniture, items)
    for (const obj of snap.interactables) {
      const px = obj.x * TILE_PX;
      const py = obj.y * TILE_PX;

      if (obj.drawIcon === 'urn') {
        const cx = px + TILE_PX / 2;
        const cy = py + TILE_PX / 2;
        ctx.fillStyle = 'rgba(4, 2, 12, 0.45)';
        ctx.beginPath();
        ctx.arc(cx + 2, cy + 2, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#334155';
        ctx.beginPath();
        ctx.arc(cx, cy, 8.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.fillStyle = '#0F172A';
        ctx.beginPath();
        ctx.arc(cx, cy, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#E2E8F0';
        ctx.fillRect(cx - 2, cy - 1, 4, 2);
      }

      if (!obj.inspected) {
        this.drawCornerBrackets(ctx, px, py, '#FBBF24', 7, 1.8);
        ctx.fillStyle = '#090414';
        ctx.fillRect(px + TILE_PX - 16, py + 3, 13, 13);
        ctx.strokeStyle = '#FBBF24';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(px + TILE_PX - 16, py + 3, 13, 13);
        ctx.fillStyle = '#FDE68A';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('?', px + TILE_PX - 9.5, py + 13);
      } else {
        this.drawCornerBrackets(ctx, px, py, 'rgba(52, 211, 153, 0.45)', 5, 1.2);
        ctx.fillStyle = 'rgba(9, 4, 20, 0.85)';
        ctx.fillRect(px + TILE_PX - 15, py + 3, 12, 12);
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.65)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + TILE_PX - 15, py + 3, 12, 12);
        ctx.fillStyle = '#6EE7B7';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('✓', px + TILE_PX - 9, py + 12);
      }
    }

    // Orientation-aware architectural doors
    const isWall = (gx: number, gy: number) =>
      gx >= 0 && gy >= 0 && gx < snap.width && gy < snap.height && (snap.tiles[gy][gx] === 'WALL' || snap.tiles[gy][gx] === 'WINDOW');

    for (const d of snap.doors) {
      const px = d.x * TILE_PX;
      const py = d.y * TILE_PX;
      const horiz = isWall(d.x - 1, d.y) || isWall(d.x + 1, d.y);

      ctx.save();
      ctx.translate(px + TILE_PX / 2, py + TILE_PX / 2);
      if (!horiz) ctx.rotate(Math.PI / 2);

      // Door jambs matching 14px wall thickness
      ctx.fillStyle = '#334155';
      ctx.fillRect(-TILE_PX / 2, -8, 6, 16);
      ctx.fillRect(TILE_PX / 2 - 6, -8, 6, 16);

      if (!d.open) {
        ctx.fillStyle = '#3B0764';
        ctx.fillRect(-TILE_PX / 2 + 6, -5, TILE_PX - 12, 10);
        ctx.strokeStyle = '#FF007F';
        ctx.lineWidth = 2;
        ctx.strokeRect(-TILE_PX / 2 + 6, -5, TILE_PX - 12, 10);
        ctx.fillStyle = '#FF1E42';
        ctx.fillRect(-3, -2, 6, 4);
      } else if (d.broken) {
        // Splintered blown-off door slab
        ctx.save();
        ctx.translate(-TILE_PX / 2 + 6, -5);
        ctx.rotate(-0.65);
        ctx.fillStyle = '#78350F';
        ctx.fillRect(0, 0, TILE_PX - 14, 7);
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(0, 0, TILE_PX - 14, 7);
        ctx.restore();
      } else {
        // Swung 90 deg open against jamb with green LED
        ctx.fillStyle = '#064E3B';
        ctx.fillRect(-TILE_PX / 2 + 6, -5, 8, TILE_PX - 14);
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-TILE_PX / 2 + 6, -5, 8, TILE_PX - 14);
      }
      ctx.restore();

      if (!d.open) {
        ctx.fillStyle = 'rgba(9, 4, 20, 0.85)';
        ctx.fillRect(px + 3, py + 3, 12, 12);
        ctx.strokeStyle = '#FF007F';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 3, py + 3, 12, 12);
        ctx.fillStyle = '#F9A8D4';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('D', px + 9, py + 12);
      }
    }

    // Hover cursor highlight (Idle-Zero safe: drawn only on pointer move)
    if (
      this.hoveredTile &&
      this.hoveredTile.x >= 0 &&
      this.hoveredTile.y >= 0 &&
      this.hoveredTile.x < snap.width &&
      this.hoveredTile.y < snap.height
    ) {
      const ht = snap.tiles[this.hoveredTile.y][this.hoveredTile.x];
      if (ht !== 'WALL' && ht !== 'WINDOW') {
        ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
          this.hoveredTile.x * TILE_PX + 1.5,
          this.hoveredTile.y * TILE_PX + 1.5,
          TILE_PX - 3,
          TILE_PX - 3
        );
      }
    }
  }

  private drawLightingAndCones(ctx: CanvasRenderingContext2D, snap: WorldSnapshot): void {
    const closedDoors = buildClosedDoorSet(snap.doors);

    for (const cam of snap.cameras) {
      const cx = cam.x * TILE_PX + TILE_PX / 2;
      const cy = cam.y * TILE_PX + TILE_PX / 2;
      const cells = cam.enabled && cam.phases.length > 0 ? cam.phases[cam.phaseIndex % cam.phases.length] : [];

      let aimAngle = 0;
      if (cells.length > 0) {
        const avgX = cells.reduce((s, c) => s + c.x, 0) / cells.length;
        const avgY = cells.reduce((s, c) => s + c.y, 0) / cells.length;
        aimAngle = Math.atan2(avgY - cam.y, avgX - cam.x);
      }

      if (cam.enabled && cells.length > 0) {
        // Smooth wall-clipped 2D raycast cone
        const poly = computeConePolygon(
          cx,
          cy,
          aimAngle,
          0.48,
          TILE_PX * 3.1,
          snap.tiles,
          closedDoors,
          snap.width,
          snap.height,
          TILE_PX,
          24
        );
        const coneGrad = ctx.createRadialGradient(cx, cy, 4, cx, cy, TILE_PX * 3.1);
        coneGrad.addColorStop(0, 'rgba(255, 0, 127, 0.34)');
        coneGrad.addColorStop(1, 'rgba(255, 0, 127, 0.05)');
        ctx.fillStyle = coneGrad;
        ctx.beginPath();
        poly.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.closePath();
        ctx.fill();

        // Crisp tactical danger cell brackets for exact KuMir planning
        for (const cell of cells) {
          const px = cell.x * TILE_PX;
          const py = cell.y * TILE_PX;
          ctx.fillStyle = 'rgba(255, 0, 127, 0.15)';
          ctx.fillRect(px + 2, py + 2, TILE_PX - 4, TILE_PX - 4);
          ctx.strokeStyle = 'rgba(255, 0, 127, 0.72)';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(px + 2, py + 2, TILE_PX - 4, TILE_PX - 4);
        }
      }

      if (cam.enabled && snap.mask === 'rasmus' && cam.phases.length > 1) {
        const nextCells = cam.phases[(cam.phaseIndex + 1) % cam.phases.length];
        for (const nc of nextCells) {
          const px = nc.x * TILE_PX;
          const py = nc.y * TILE_PX;
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(px + 4, py + 4, TILE_PX - 8, TILE_PX - 8);
          ctx.setLineDash([]);
        }
      }

      // Dome camera housing
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = cam.enabled ? '#F43F5E' : '#475569';
      ctx.lineWidth = 1.8;
      ctx.stroke();

      ctx.rotate(aimAngle);
      ctx.fillStyle = cam.enabled ? '#334155' : '#1E293B';
      ctx.fillRect(0, -4, 12, 8);
      ctx.fillStyle = cam.enabled ? '#FF1E42' : '#64748B';
      ctx.beginPath();
      ctx.arc(10, 0, 2.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3-layer Lasers
    for (const l of snap.lasers) {
      if (!l.enabled || l.cells.length === 0) continue;
      const vertical = l.cells.length > 1 && l.cells[0].x === l.cells[1].x;
      const first = l.cells[0];
      const last = l.cells[l.cells.length - 1];
      const sx = first.x * TILE_PX + (vertical ? TILE_PX / 2 : 3);
      const sy = first.y * TILE_PX + (vertical ? 3 : TILE_PX / 2);
      const ex = last.x * TILE_PX + (vertical ? TILE_PX / 2 : TILE_PX - 3);
      const ey = last.y * TILE_PX + (vertical ? TILE_PX - 3 : TILE_PX / 2);

      ctx.strokeStyle = 'rgba(255, 30, 66, 0.30)';
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.strokeStyle = '#FF1E42';
      ctx.lineWidth = 4.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.strokeStyle = '#FFE4E6';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#FF1E42';
      ctx.lineWidth = 1.6;
      for (const pt of [
        { x: sx, y: sy },
        { x: ex, y: ey },
      ]) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Patrol flashlight 2D raycast cones & telegraphed tiles
    for (const enemy of snap.enemies) {
      if (enemy.status !== 'active') continue;
      if (!enemy.isGbr && enemy.distractedTurns <= 0) {
        const ePos = this.getInterpolatedPos(enemy.id, enemy.x, enemy.y);
        const ex = ePos.x * TILE_PX + TILE_PX / 2;
        const ey = ePos.y * TILE_PX + TILE_PX / 2;
        const range = enemy.kind === 'patrol_raven' ? 3.3 : 2.3;
        const poly = computeConePolygon(
          ex,
          ey,
          dirToAngle(enemy.facing),
          0.38,
          range * TILE_PX,
          snap.tiles,
          closedDoors,
          snap.width,
          snap.height,
          TILE_PX,
          20
        );
        const fGrad = ctx.createRadialGradient(ex, ey, 6, ex, ey, range * TILE_PX);
        fGrad.addColorStop(0, 'rgba(250, 204, 21, 0.28)');
        fGrad.addColorStop(1, 'rgba(250, 204, 21, 0.03)');
        ctx.fillStyle = fGrad;
        ctx.beginPath();
        poly.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
        ctx.closePath();
        ctx.fill();
      }

      for (const cell of enemy.telegraphAttackCells) {
        const px = cell.x * TILE_PX;
        const py = cell.y * TILE_PX;
        ctx.fillStyle = enemy.isGbr ? 'rgba(255, 30, 66, 0.24)' : 'rgba(250, 204, 21, 0.11)';
        ctx.fillRect(px + 3, py + 3, TILE_PX - 6, TILE_PX - 6);
        ctx.strokeStyle = enemy.isGbr ? '#FF1E42' : 'rgba(250, 204, 21, 0.72)';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(px + 3, py + 3, TILE_PX - 6, TILE_PX - 6);
      }

      if (enemy.telegraphNext && (snap.mask === 'rasmus' || enemy.isGbr || enemy.patrolRoute.length > 1)) {
        const nx = enemy.telegraphNext.x * TILE_PX + TILE_PX / 2;
        const ny = enemy.telegraphNext.y * TILE_PX + TILE_PX / 2;
        const pos = this.getInterpolatedPos(enemy.id, enemy.x, enemy.y);
        const ex = pos.x * TILE_PX + TILE_PX / 2;
        const ey = pos.y * TILE_PX + TILE_PX / 2;
        ctx.strokeStyle = enemy.isGbr ? 'rgba(255, 30, 66, 0.7)' : 'rgba(0, 240, 255, 0.5)';
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  private drawGbrStreetPresence(
    ctx: CanvasRenderingContext2D,
    snap: WorldSnapshot,
    gbrVanWorldPos: { x: number; y: number; rot: number } | null
  ): void {
    if (!gbrVanWorldPos || (!snap.alarmTriggered && !snap.gbrSpawned)) return;
    const vx = gbrVanWorldPos.x;
    const vy = gbrVanWorldPos.y;
    const redFirst = Math.floor(this.sirenPhase) % 2 === 0;

    if (this.gbrSkidAlpha > 0) {
      const fromLeft = snap.scene.gbrVanPos.x < snap.width / 2;
      const skidStart = fromLeft ? vx - 22 : vx + 22;
      const skidEnd = fromLeft ? vx - 110 : vx + 110;
      ctx.save();
      ctx.strokeStyle = `rgba(15, 23, 42, ${this.gbrSkidAlpha.toFixed(2)})`;
      ctx.lineWidth = 4;
      ctx.setLineDash([10, 4]);
      ctx.beginPath();
      ctx.moveTo(skidStart, vy - 12);
      ctx.lineTo(skidEnd, vy - 12);
      ctx.moveTo(skidStart, vy + 12);
      ctx.lineTo(skidEnd, vy + 12);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    const vanRect = ATLAS_SPRITES['van_gbr_swat'];
    if (vanRect && this.atlasReady && this.atlasImg) {
      ctx.save();
      ctx.translate(vx, vy);
      ctx.rotate((gbrVanWorldPos.rot * Math.PI) / 180);
      const vw = vanRect.w * 2;
      const vh = vanRect.h * 2;
      ctx.drawImage(this.atlasImg, vanRect.x, vanRect.y, vanRect.w, vanRect.h, -vw / 2, -vh / 2, vw, vh);
      // Animated flashing lightbar overlay
      ctx.fillStyle = redFirst ? '#FF1E42' : '#00A8FF';
      ctx.fillRect(-16, -vh / 2 + 29, 14, 6);
      ctx.fillStyle = redFirst ? '#00A8FF' : '#FF1E42';
      ctx.fillRect(2, -vh / 2 + 29, 14, 6);
      ctx.restore();
    }
  }

  private getInterpolatedPos(key: string, targetX: number, targetY: number): { x: number; y: number; strideFrame: number } {
    const anim = this.moveAnims.get(key);
    if (!anim || anim.duration <= 0) return { x: targetX, y: targetY, strideFrame: 0 };
    const t = Math.min(1, anim.elapsed / anim.duration);
    const eased = 1 - Math.pow(1 - t, 2);
    const strideFrame = Math.floor(t * 4) % 4;
    return {
      x: anim.fromX + (anim.toX - anim.fromX) * eased,
      y: anim.fromY + (anim.toY - anim.fromY) * eased,
      strideFrame,
    };
  }

  private drawDashTrails(ctx: CanvasRenderingContext2D): void {
    for (const trail of this.dashTrails) {
      const alpha = Math.max(0, trail.life / trail.maxLife) * 0.48;
      for (let i = 1; i <= 3; i++) {
        const f = i / 4;
        const x = trail.fromX + (trail.toX - trail.fromX) * f;
        const y = trail.fromY + (trail.toY - trail.fromY) * f;
        const cx = x * TILE_PX + TILE_PX / 2;
        const cy = y * TILE_PX + TILE_PX / 2;
        ctx.save();
        ctx.globalAlpha = alpha * (i / 3);
        ctx.translate(cx, cy);
        ctx.rotate(dirToAngle(trail.facing));
        if (!this.drawSprite(ctx, `char_${trail.mask}_stand`, -CHAR_DRAW_PX / 2, -CHAR_DRAW_PX / 2, CHAR_DRAW_PX, CHAR_DRAW_PX)) {
          ctx.fillStyle = '#00F0FF';
          ctx.beginPath();
          ctx.arc(0, 0, 12, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
    }
  }

  private drawCharacterSprite(
    ctx: CanvasRenderingContext2D,
    kind: MaskId | EnemyState['kind'],
    opts: { crouched?: boolean; shielded?: boolean; downed?: boolean; strideFrame?: number; alpha?: number }
  ): void {
    const { crouched = false, shielded = false, downed = false, strideFrame = 0, alpha = 1 } = opts;
    ctx.save();
    ctx.globalAlpha = alpha;

    const half = CHAR_DRAW_PX / 2;
    if (downed) {
      if (!this.drawSprite(ctx, `char_${kind}_down`, -half, -half, CHAR_DRAW_PX, CHAR_DRAW_PX)) {
        ctx.fillStyle = '#475569';
        ctx.fillRect(-14, -9, 28, 18);
      }
      ctx.restore();
      return;
    }

    // Animated legs layer underneath torso
    this.drawSprite(ctx, `legs_${strideFrame % 4}`, -half, -half, CHAR_DRAW_PX, CHAR_DRAW_PX);

    // Detailed top-down character torso + arms + animal mask
    if (!this.drawSprite(ctx, `char_${kind}_stand`, -half, -half, CHAR_DRAW_PX, CHAR_DRAW_PX)) {
      ctx.fillStyle = '#00F0FF';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    if (shielded) {
      if (!this.drawSprite(ctx, 'bear_shield_fx', -half, -half, CHAR_DRAW_PX, CHAR_DRAW_PX)) {
        ctx.strokeStyle = '#00A8FF';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(4, 0, 18, -Math.PI * 0.38, Math.PI * 0.38);
        ctx.stroke();
      }
    }

    if (crouched) {
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, snap: WorldSnapshot): void {
    const pos = this.getInterpolatedPos('player', snap.player.x, snap.player.y);
    const cx = pos.x * TILE_PX + TILE_PX / 2;
    const cy = pos.y * TILE_PX + TILE_PX / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dirToAngle(snap.player.facing));
    if (snap.player.crouched) {
      ctx.scale(0.86, 0.86);
    }
    this.drawCharacterSprite(ctx, snap.mask, {
      crouched: snap.player.crouched,
      strideFrame: pos.strideFrame,
    });
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyState): void {
    const pos = this.getInterpolatedPos(enemy.id, enemy.x, enemy.y);
    const cx = pos.x * TILE_PX + TILE_PX / 2;
    const cy = pos.y * TILE_PX + TILE_PX / 2;
    const isDown = enemy.status === 'stunned' || enemy.status === 'offline';

    ctx.save();
    ctx.translate(cx, cy);
    const baseAngle = dirToAngle(enemy.facing);
    ctx.rotate(isDown ? baseAngle + 0.75 : baseAngle);
    const alpha = enemy.status === 'offline' ? 0.55 : enemy.status === 'stunned' ? 0.8 : 1;
    this.drawCharacterSprite(ctx, enemy.kind, {
      shielded: enemy.shielded && enemy.status === 'active',
      downed: isDown,
      strideFrame: pos.strideFrame,
      alpha,
    });
    ctx.restore();

    if (isDown) {
      ctx.fillStyle = enemy.status === 'offline' ? '#10B981' : '#FACC15';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(enemy.status === 'offline' ? 'OFF' : 'ZZZ', cx, cy - 18);
    } else if (enemy.distractedTurns > 0) {
      ctx.fillStyle = '#00F0FF';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?!', cx, cy - 18);
    }
  }

  private drawOverheadProps(ctx: CanvasRenderingContext2D, snap: WorldSnapshot): void {
    const px = snap.player.x + 0.5;
    const py = snap.player.y + 0.5;
    for (const prop of snap.scene.props) {
      if (prop.layer !== 'overhead') continue;
      const rect = ATLAS_SPRITES[prop.sprite];
      if (!rect) continue;
      const wTiles = (rect.w * 2) / TILE_PX;
      const hTiles = (rect.h * 2) / TILE_PX;
      const dist = Math.hypot(px - (prop.x + wTiles / 2), py - (prop.y + hTiles / 2));
      ctx.save();
      if (dist < 1.6) ctx.globalAlpha = 0.45;
      this.drawPropRotated(ctx, prop);
      ctx.restore();
    }
  }

  private drawEffectsOverlay(ctx: CanvasRenderingContext2D): void {
    for (const arc of this.throwArcs) {
      const progress = 1 - arc.life / arc.maxLife;
      const x = arc.fromX + (arc.toX - arc.fromX) * progress;
      const y = arc.fromY + (arc.toY - arc.fromY) * progress;
      const cx = x * TILE_PX + TILE_PX / 2;
      const cy = y * TILE_PX + TILE_PX / 2 - Math.sin(progress * Math.PI) * 20;

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.55)';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(arc.fromX * TILE_PX + TILE_PX / 2, arc.fromY * TILE_PX + TILE_PX / 2);
      ctx.lineTo(arc.toX * TILE_PX + TILE_PX / 2, arc.toY * TILE_PX + TILE_PX / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#00F0FF';
      ctx.beginPath();
      ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const sw of this.shockwaves) {
      const progress = 1 - sw.life / sw.maxLife;
      const cx = sw.x * TILE_PX + TILE_PX / 2;
      const cy = sw.y * TILE_PX + TILE_PX / 2;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - progress);
      ctx.strokeStyle = sw.color;
      ctx.lineWidth = 2.6 * (1 - progress * 0.5);
      ctx.beginPath();
      ctx.arc(cx, cy, 6 + sw.maxR * progress, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    for (const pt of this.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      ctx.fillStyle = pt.color;
      ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size);
      ctx.restore();
    }
  }

  private drawPostFx(ctx: CanvasRenderingContext2D, snap: WorldSnapshot, w: number, h: number): void {
    if (snap.alarmTriggered && snap.phase !== 'EXTRACTION') {
      const pulse = 0.08 + 0.06 * Math.abs(Math.sin(this.sirenPhase * 1.4));
      const vig = ctx.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.65);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, `rgba(255, 0, 80, ${pulse.toFixed(3)})`);
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.fxKind === 'ALARM_PULSE' && this.fxTimerMs > 0) {
      const alpha = (this.fxTimerMs / MAX_FX_MS) * 0.22;
      ctx.fillStyle = `rgba(255, 0, 80, ${alpha.toFixed(3)})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (this.fxKind === 'GLITCH' && this.fxTimerMs > 0) {
      for (let i = 0; i < 4; i++) {
        const sy = Math.floor(((i * 79 + this.fxTimerMs * 3) % Math.max(40, h - 24)));
        const sh = 10 + (i % 3) * 6;
        const shift = (i % 2 === 0 ? 1 : -1) * 5;
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 0, 127, 0.22)' : 'rgba(0, 240, 255, 0.22)';
        ctx.fillRect(Math.max(0, shift), sy, w, sh);
      }
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.09)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }
  }

  private drawMinimap(ctx: CanvasRenderingContext2D, snap: WorldSnapshot, viewW: number): void {
    if (viewW < 360) return;
    const cell = 4;
    const mw = snap.width * cell;
    const mh = snap.height * cell;
    const mx = viewW - mw - 14;
    const my = 10;

    ctx.save();
    ctx.fillStyle = 'rgba(7, 3, 18, 0.82)';
    drawRoundedRect(ctx, mx - 4, my - 4, mw + 8, mh + 8, 2);
    ctx.fill();
    ctx.strokeStyle = '#FF007F';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(mx - 4, my - 4, mw + 8, mh + 8);

    for (let y = 0; y < snap.height; y++) {
      for (let x = 0; x < snap.width; x++) {
        const t = snap.tiles[y][x];
        if (t === 'WALL') ctx.fillStyle = '#475569';
        else if (t === 'WINDOW') ctx.fillStyle = '#38BDF8';
        else if (t === 'TERMINAL') ctx.fillStyle = snap.hackCompleted ? '#10B981' : '#00F0FF';
        else if (t === 'RELAY') ctx.fillStyle = '#F472B6';
        else if (t === 'EXIT') ctx.fillStyle = snap.exitUnlocked ? '#10B981' : '#FF1E42';
        else continue;
        ctx.fillRect(mx + x * cell, my + y * cell, cell, cell);
      }
    }

    for (const e of snap.enemies) {
      if (e.status === 'offline') continue;
      ctx.fillStyle = e.isGbr ? '#FF1E42' : '#FACC15';
      ctx.fillRect(mx + e.x * cell, my + e.y * cell, cell, cell);
    }

    if (snap.alarmTriggered || snap.gbrSpawned) {
      const progress = this.gbrLastProgress >= 0 ? this.gbrLastProgress : snap.gbrSpawned ? 1 : 0.2;
      const fromLeft = snap.scene.gbrVanPos.x < snap.width / 2;
      const vanMiniX = fromLeft
        ? mx - Math.max(3, Math.round((1 - progress) * 8) + 2)
        : mx + mw + Math.max(1, Math.round((1 - progress) * 8));
      const vanMiniY = my + Math.min(mh - cell, Math.max(0, Math.round(snap.scene.gbrVanPos.y * cell)));
      ctx.fillStyle = Math.floor(this.sirenPhase) % 2 === 0 ? '#FF1E42' : '#00A8FF';
      ctx.fillRect(vanMiniX - 2, vanMiniY - 1, cell + 2, cell + 2);
    }

    // Player dot
    ctx.fillStyle = '#00F0FF';
    ctx.fillRect(mx + snap.player.x * cell - 1, my + snap.player.y * cell - 1, cell + 2, cell + 2);

    // Camera viewport rectangle
    const vr = this.camera.getViewportRectWorld();
    const rx = mx + (vr.x / TILE_PX) * cell;
    const ry = my + (vr.y / TILE_PX) * cell;
    const rw = (vr.w / TILE_PX) * cell;
    const rh = (vr.h / TILE_PX) * cell;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      Math.max(mx - 2, rx),
      Math.max(my - 2, ry),
      Math.min(mw + 4, rw),
      Math.min(mh + 4, rh)
    );
    ctx.restore();
  }
}
