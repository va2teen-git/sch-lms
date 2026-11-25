import type {
  AudioMood,
  Direction,
  EnemyState,
  LevelThemeId,
  MaskId,
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
  floorA: string;
  floorB: string;
  gridLine: string;
  wallBase: string;
  wallTop: string;
  wallBevel: string;
  wallEdge: string;
  coverFill: string;
  coverStroke: string;
}

const TILE_PX = 36;
const PAD_PX = 36;
const MAX_FX_MS = 420;

const THEME_PALETTES: Record<LevelThemeId, ThemePalette> = {
  kpp_street: {
    label: 'КПП // ПЕРИМЕТР',
    floorA: '#100A20',
    floorB: '#140E27',
    gridLine: 'rgba(0, 240, 255, 0.10)',
    wallBase: '#1B0C30',
    wallTop: '#261142',
    wallBevel: 'rgba(255, 255, 255, 0.14)',
    wallEdge: '#FF007F',
    coverFill: '#334155',
    coverStroke: '#FACC15',
  },
  lobby_hall: {
    label: 'ХОЛЛ // РЕСЕПШЕН',
    floorA: '#160B2A',
    floorB: '#1E1038',
    gridLine: 'rgba(255, 0, 127, 0.12)',
    wallBase: '#230D36',
    wallTop: '#31124B',
    wallBevel: 'rgba(255, 210, 240, 0.16)',
    wallEdge: '#F43F5E',
    coverFill: '#4C1D95',
    coverStroke: '#00F0FF',
  },
  analytics_office: {
    label: 'ОФИС // АНАЛИТИКА',
    floorA: '#0E1328',
    floorB: '#121933',
    gridLine: 'rgba(56, 189, 248, 0.12)',
    wallBase: '#171C3A',
    wallTop: '#222A54',
    wallBevel: 'rgba(186, 230, 253, 0.16)',
    wallEdge: '#38BDF8',
    coverFill: '#1E3A5F',
    coverStroke: '#38BDF8',
  },
  server_hall: {
    label: 'СЕРВЕРНАЯ // ХОЛОД',
    floorA: '#071426',
    floorB: '#0B1D34',
    gridLine: 'rgba(0, 240, 255, 0.16)',
    wallBase: '#0C203D',
    wallTop: '#133159',
    wallBevel: 'rgba(165, 243, 252, 0.2)',
    wallEdge: '#00F0FF',
    coverFill: '#0F294A',
    coverStroke: '#22D3EE',
  },
  master_vault: {
    label: 'ЯДРО // КРАСНАЯ ЛИНИЯ',
    floorA: '#140814',
    floorB: '#1B0A1B',
    gridLine: 'rgba(255, 30, 66, 0.16)',
    wallBase: '#26081A',
    wallTop: '#380C26',
    wallBevel: 'rgba(254, 205, 211, 0.16)',
    wallEdge: '#FF1E42',
    coverFill: '#3F1D2B',
    coverStroke: '#FB7185',
  },
};

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
    cx: PAD_PX + x * TILE_PX + TILE_PX / 2,
    cy: PAD_PX + y * TILE_PX + TILE_PX / 2,
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
  private backdropCanvas: HTMLCanvasElement | null = null;
  private backdropKey = '';

  private snapshot: WorldSnapshot | null = null;
  private rafId: number | null = null;
  private lastTimestamp = 0;

  private fastAnim = false;
  private fxTimerMs = 0;
  private fxKind: 'NONE' | 'SHAKE' | 'GLITCH' | 'ALARM_PULSE' = 'NONE';
  private shakeIntensity = 0;
  private sirenPhase = 0;

  private moveAnims = new Map<string, MoveAnim>();
  private dashTrails: DashTrail[] = [];
  private throwArcs: ThrowArc[] = [];
  private particles: Particle[] = [];
  private shockwaves: Shockwave[] = [];

  private rafFrames = 0;
  private lastFrameMs = 0;

  constructor(canvas: HTMLCanvasElement, fastAnim = false) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas 2D context is not available');
    }
    this.ctx = context;
    this.fastAnim = fastAnim;

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.stopLoop();
        }
      });
    }
  }

  getRenderStats(): RenderStats {
    return {
      rafFrames: this.rafFrames,
      lastFrameMs: this.lastFrameMs,
      isLoopRunning: this.rafId !== null,
    };
  }

  renderSnapshot(snapshot: WorldSnapshot, events: WorldEvent[] = []): void {
    this.snapshot = snapshot;
    this.ensureCanvasDimensions(snapshot);
    this.ensureBackdropCache(snapshot);

    if (!this.fastAnim && events.length > 0) {
      this.ingestEvents(snapshot, events);
    }

    this.drawFrame();

    if (!this.fastAnim && this.hasActiveAnimations()) {
      this.startLoop();
    } else {
      this.stopLoop();
    }
  }

  flushAnimations(): void {
    this.fxTimerMs = 0;
    this.fxKind = 'NONE';
    this.shakeIntensity = 0;
    this.moveAnims.clear();
    this.dashTrails = [];
    this.throwArcs = [];
    this.particles = [];
    this.shockwaves = [];
    this.stopLoop();
    if (this.snapshot) {
      this.drawFrame();
    }
  }

  dispose(): void {
    this.stopLoop();
  }

  private hasActiveAnimations(): boolean {
    return (
      this.fxTimerMs > 0 ||
      this.moveAnims.size > 0 ||
      this.dashTrails.length > 0 ||
      this.throwArcs.length > 0 ||
      this.particles.length > 0 ||
      this.shockwaves.length > 0
    );
  }

  private ingestEvents(snap: WorldSnapshot, events: WorldEvent[]): void {
    for (const ev of events) {
      if (ev.type === 'ROBOT_MOVED' && ev.fromX !== undefined && ev.fromY !== undefined && ev.x !== undefined && ev.y !== undefined) {
        this.moveAnims.set('player', {
          fromX: ev.fromX,
          fromY: ev.fromY,
          toX: ev.x,
          toY: ev.y,
          elapsed: 0,
          duration: 145,
        });
      } else if (ev.type === 'ROBOT_DASHED' && ev.fromX !== undefined && ev.fromY !== undefined && ev.x !== undefined && ev.y !== undefined) {
        this.moveAnims.set('player', {
          fromX: ev.fromX,
          fromY: ev.fromY,
          toX: ev.x,
          toY: ev.y,
          elapsed: 0,
          duration: 165,
        });
        this.dashTrails.push({
          fromX: ev.fromX,
          fromY: ev.fromY,
          toX: ev.x,
          toY: ev.y,
          mask: snap.mask,
          facing: ev.dir || snap.player.facing,
          life: 280,
          maxLife: 280,
        });
        this.triggerFx('SHAKE', 180, 2.5);
      } else if (ev.type === 'ENEMY_MOVED' && ev.label && ev.fromX !== undefined && ev.fromY !== undefined && ev.x !== undefined && ev.y !== undefined) {
        this.moveAnims.set(ev.label, {
          fromX: ev.fromX,
          fromY: ev.fromY,
          toX: ev.x,
          toY: ev.y,
          elapsed: 0,
          duration: 145,
        });
      } else if (ev.type === 'DECOY_THROWN' && ev.fromX !== undefined && ev.fromY !== undefined && ev.x !== undefined && ev.y !== undefined) {
        this.throwArcs.push({
          fromX: ev.fromX,
          fromY: ev.fromY,
          toX: ev.x,
          toY: ev.y,
          life: 360,
          maxLife: 360,
        });
        const { cx, cy } = tileCenter(ev.x, ev.y);
        this.shockwaves.push({ x: cx, y: cy, maxR: TILE_PX * 1.8, color: '#00F0FF', life: 360, maxLife: 360 });
      } else if (ev.type === 'DOOR_BROKEN' && ev.x !== undefined && ev.y !== undefined) {
        this.triggerFx('SHAKE', 280, 5);
        this.spawnBurst(ev.x, ev.y, ['#F59E0B', '#FDE047', '#FF007F'], 10, 360);
        const { cx, cy } = tileCenter(ev.x, ev.y);
        this.shockwaves.push({ x: cx, y: cy, maxR: TILE_PX * 1.2, color: '#F59E0B', life: 280, maxLife: 280 });
      } else if (ev.type === 'ENEMY_SHIELD_BROKEN' && ev.x !== undefined && ev.y !== undefined) {
        this.triggerFx('SHAKE', 260, 4.5);
        this.spawnBurst(ev.x, ev.y, ['#00A8FF', '#38BDF8', '#FFFFFF'], 10, 380);
        const { cx, cy } = tileCenter(ev.x, ev.y);
        this.shockwaves.push({ x: cx, y: cy, maxR: TILE_PX * 1.4, color: '#38BDF8', life: 320, maxLife: 320 });
      } else if ((ev.type === 'ENEMY_STUNNED' || ev.type === 'ENEMY_OFFLINE') && ev.x !== undefined && ev.y !== undefined) {
        this.triggerFx('SHAKE', 220, 4);
        const col = ev.type === 'ENEMY_OFFLINE' ? '#10B981' : '#FACC15';
        this.spawnBurst(ev.x, ev.y, [col, '#00F0FF'], 6, 300);
        const { cx, cy } = tileCenter(ev.x, ev.y);
        this.shockwaves.push({ x: cx, y: cy, maxR: TILE_PX * 1.1, color: col, life: 290, maxLife: 290 });
      } else if (ev.type === 'TILE_PAINTED' && ev.x !== undefined && ev.y !== undefined) {
        this.triggerFx('SHAKE', 150, 2);
        const { cx, cy } = tileCenter(ev.x, ev.y);
        this.shockwaves.push({ x: cx, y: cy, maxR: TILE_PX * 1.15, color: '#00F0FF', life: 300, maxLife: 300 });
      } else if (ev.type === 'WALL_CRASH' || ev.type === 'PLAYER_KO') {
        this.triggerFx('GLITCH', 320, 6);
        if (ev.x !== undefined && ev.y !== undefined) {
          this.spawnBurst(ev.x, ev.y, ['#FF1E42', '#FF007F'], 7, 320);
        }
      } else if (ev.type === 'ALERT_TRIGGERED' || ev.type === 'GBR_ARRIVED' || ev.type === 'ENEMY_ATTACK') {
        this.triggerFx('ALARM_PULSE', 400, 5.5);
      } else if (ev.type === 'EXTRACTION') {
        this.triggerFx('SHAKE', 200, 2);
        if (ev.x !== undefined && ev.y !== undefined) {
          const { cx, cy } = tileCenter(ev.x, ev.y);
          this.shockwaves.push({ x: cx, y: cy, maxR: TILE_PX * 1.6, color: '#10B981', life: 380, maxLife: 380 });
        }
      }
    }
  }

  private spawnBurst(tx: number, ty: number, colors: string[], count: number, maxLife: number): void {
    const { cx, cy } = tileCenter(tx, ty);
    const clampedLife = Math.min(MAX_FX_MS, maxLife);
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + (i % 2) * 0.25;
      const spd = 0.045 + (i % 3) * 0.03;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        size: 2.5 + (i % 3),
        color: colors[i % colors.length],
        rot: ang,
        vrot: (i % 2 === 0 ? 1 : -1) * 0.015,
        life: clampedLife,
        maxLife: clampedLife,
      });
    }
  }

  private triggerFx(kind: 'SHAKE' | 'GLITCH' | 'ALARM_PULSE', durationMs: number, intensity: number): void {
    this.fxKind = kind;
    this.fxTimerMs = Math.min(MAX_FX_MS, Math.max(this.fxTimerMs, durationMs));
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.sirenPhase = (this.sirenPhase + 1) % 2;
  }

  private startLoop(): void {
    if (this.rafId !== null || typeof requestAnimationFrame === 'undefined') return;
    if (typeof document !== 'undefined' && document.hidden) return;
    this.lastTimestamp = performance.now();
    const tick = (now: number) => {
      this.rafId = null;
      if (!this.snapshot) return;
      const rawDt = now - this.lastTimestamp;
      this.lastTimestamp = now;
      const dt = Math.min(Math.max(rawDt, 0), 50);
      this.rafFrames++;

      this.fxTimerMs = Math.max(0, this.fxTimerMs - dt);
      this.sirenPhase = (this.sirenPhase + dt * 0.012) % 2;

      for (const [key, anim] of this.moveAnims.entries()) {
        anim.elapsed += dt;
        if (anim.elapsed >= anim.duration) {
          this.moveAnims.delete(key);
        }
      }
      this.dashTrails = this.dashTrails.filter((t) => {
        t.life -= dt;
        return t.life > 0;
      });
      this.throwArcs = this.throwArcs.filter((a) => {
        a.life -= dt;
        return a.life > 0;
      });
      this.particles = this.particles.filter((p) => {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        return p.life > 0;
      });
      this.shockwaves = this.shockwaves.filter((s) => {
        s.life -= dt;
        return s.life > 0;
      });

      this.drawFrame();

      if (this.hasActiveAnimations() && !(typeof document !== 'undefined' && document.hidden)) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.fxKind = 'NONE';
        this.shakeIntensity = 0;
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private stopLoop(): void {
    if (this.rafId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private ensureCanvasDimensions(snap: WorldSnapshot): void {
    const logicalW = snap.width * TILE_PX + PAD_PX * 2;
    const logicalH = snap.height * TILE_PX + PAD_PX * 2;
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 1.5) : 1;

    const targetW = Math.round(logicalW * dpr);
    const targetH = Math.round(logicalH * dpr);
    if (this.canvas.width !== targetW || this.canvas.height !== targetH) {
      this.canvas.width = targetW;
      this.canvas.height = targetH;
      this.canvas.style.aspectRatio = `${logicalW} / ${logicalH}`;
    }
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
  }

  private ensureBackdropCache(snap: WorldSnapshot): void {
    const theme = snap.theme || 'kpp_street';
    const key = `${snap.levelId}:${theme}:${snap.width}x${snap.height}`;
    if (this.backdropCanvas && this.backdropKey === key) return;
    if (typeof document === 'undefined') return;

    const logicalW = snap.width * TILE_PX + PAD_PX * 2;
    const logicalH = snap.height * TILE_PX + PAD_PX * 2;
    const off = document.createElement('canvas');
    off.width = logicalW;
    off.height = logicalH;
    const g = off.getContext('2d');
    if (!g) return;

    const pal = THEME_PALETTES[theme];

    // L0: Night street wet asphalt outside building
    g.fillStyle = '#070312';
    g.fillRect(0, 0, logicalW, logicalH);

    // Street asphalt texture & dashed lane markings along outer perimeter
    g.strokeStyle = 'rgba(255, 0, 127, 0.10)';
    g.lineWidth = 1;
    for (let x = 0; x < logicalW; x += 24) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, logicalH);
      g.stroke();
    }
    g.strokeStyle = 'rgba(250, 204, 21, 0.25)';
    g.setLineDash([12, 10]);
    g.beginPath();
    g.moveTo(PAD_PX, logicalH - 12);
    g.lineTo(logicalW - PAD_PX, logicalH - 12);
    g.stroke();
    g.setLineDash([]);

    // Wet neon puddles on the night street
    const puddles = [
      { x: 18, y: logicalH * 0.52, rx: 12, ry: 22, color: 'rgba(0, 240, 255, 0.14)' },
      { x: logicalW - 18, y: logicalH * 0.35, rx: 11, ry: 20, color: 'rgba(255, 0, 127, 0.14)' },
    ];
    for (const pd of puddles) {
      g.fillStyle = pd.color;
      g.beginPath();
      g.ellipse(pd.x, pd.y, pd.rx, pd.ry, 0, 0, Math.PI * 2);
      g.fill();
    }

    // Street lamp pools at corners
    const lamps = [
      { x: 16, y: 16, color: 'rgba(0, 240, 255, 0.24)' },
      { x: logicalW - 16, y: 16, color: 'rgba(255, 0, 127, 0.24)' },
      { x: logicalW - 16, y: logicalH - 16, color: 'rgba(0, 168, 255, 0.22)' },
    ];
    for (const lamp of lamps) {
      const grad = g.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 48);
      grad.addColorStop(0, lamp.color);
      grad.addColorStop(1, 'rgba(7, 3, 18, 0)');
      g.fillStyle = grad;
      g.fillRect(lamp.x - 48, lamp.y - 48, 96, 96);
    }

    // Hacker's Sport Coupe parked on the west/bottom-left street outside KPP/building
    this.drawHackerCoupe(g, 18, Math.min(logicalH - 54, PAD_PX + TILE_PX * 1.4));

    // Building interior floor tiles by theme
    for (let y = 0; y < snap.height; y++) {
      for (let x = 0; x < snap.width; x++) {
        const px = PAD_PX + x * TILE_PX;
        const py = PAD_PX + y * TILE_PX;
        const tile = snap.tiles[y][x];
        if (tile === 'WALL') continue;

        g.fillStyle = (x + y) % 2 === 0 ? pal.floorA : pal.floorB;
        g.fillRect(px, py, TILE_PX, TILE_PX);
        g.strokeStyle = pal.gridLine;
        g.lineWidth = 1;
        g.strokeRect(px, py, TILE_PX, TILE_PX);

        // Theme-specific subtle floor surface accents
        if (theme === 'lobby_hall' && (y === 1 || y === 3) && x > 1 && x < snap.width - 2) {
          g.fillStyle = 'rgba(244, 63, 94, 0.12)';
          g.fillRect(px + 2, py + 7, TILE_PX - 4, TILE_PX - 14);
        } else if (theme === 'analytics_office' && (x + y) % 3 === 0) {
          g.strokeStyle = 'rgba(56, 189, 248, 0.14)';
          g.strokeRect(px + 6, py + 6, TILE_PX - 12, TILE_PX - 12);
        } else if (theme === 'server_hall') {
          g.fillStyle = 'rgba(0, 240, 255, 0.16)';
          g.fillRect(px + 8, py + 8, 2, 2);
          g.fillRect(px + TILE_PX - 10, py + 8, 2, 2);
          g.fillRect(px + 8, py + TILE_PX - 10, 2, 2);
          g.fillRect(px + TILE_PX - 10, py + TILE_PX - 10, 2, 2);
          if (y === 6) {
            g.fillStyle = 'rgba(0, 240, 255, 0.09)';
            g.fillRect(px, py + TILE_PX / 2 - 2, TILE_PX, 4);
          }
        } else if (theme === 'master_vault') {
          if (x >= 5 && x <= 8 && y >= 4 && y <= 6) {
            g.fillStyle = 'rgba(255, 30, 66, 0.09)';
            g.fillRect(px + 2, py + 2, TILE_PX - 4, TILE_PX - 4);
          }
        }

        if (tile === 'COVER') {
          this.drawThemeCover(g, px, py, theme, pal);
        } else if (tile === 'GBR_SPAWN') {
          g.fillStyle = 'rgba(255, 30, 66, 0.18)';
          g.fillRect(px + 2, py + 2, TILE_PX - 4, TILE_PX - 4);
          g.strokeStyle = '#FF1E42';
          g.lineWidth = 1.5;
          g.strokeRect(px + 3, py + 3, TILE_PX - 6, TILE_PX - 6);
          g.fillStyle = '#FCA5A5';
          g.font = 'bold 10px monospace';
          g.textAlign = 'center';
          g.fillText('ГБР', px + TILE_PX / 2, py + TILE_PX / 2 + 4);
        }
      }
    }

    // Pass 1 for 3D Walls: directional drop shadows onto adjacent non-wall tiles
    g.fillStyle = 'rgba(0, 0, 0, 0.48)';
    for (let y = 0; y < snap.height; y++) {
      for (let x = 0; x < snap.width; x++) {
        if (snap.tiles[y][x] !== 'WALL') continue;
        const px = PAD_PX + x * TILE_PX;
        const py = PAD_PX + y * TILE_PX;
        if (x + 1 < snap.width && snap.tiles[y][x + 1] !== 'WALL') {
          g.fillRect(px + TILE_PX, py + 5, 6, TILE_PX);
        }
        if (y + 1 < snap.height && snap.tiles[y + 1][x] !== 'WALL') {
          g.fillRect(px + 5, py + TILE_PX, TILE_PX, 6);
        }
      }
    }

    // Pass 2 for 3D Walls: extruded blocks + bevels + connected neon perimeter contour
    for (let y = 0; y < snap.height; y++) {
      for (let x = 0; x < snap.width; x++) {
        if (snap.tiles[y][x] !== 'WALL') continue;
        const px = PAD_PX + x * TILE_PX;
        const py = PAD_PX + y * TILE_PX;

        g.fillStyle = pal.wallBase;
        g.fillRect(px, py, TILE_PX, TILE_PX);
        g.fillStyle = pal.wallTop;
        g.fillRect(px + 2, py + 2, TILE_PX - 6, TILE_PX - 6);
        g.fillStyle = pal.wallBevel;
        g.fillRect(px + 2, py + 2, TILE_PX - 6, 2);
        g.fillRect(px + 2, py + 2, 2, TILE_PX - 6);

        // Connected neon contour only on exposed faces
        g.strokeStyle = pal.wallEdge;
        g.lineWidth = 1.6;
        g.beginPath();
        if (y === 0 || snap.tiles[y - 1][x] !== 'WALL') {
          g.moveTo(px, py + 1);
          g.lineTo(px + TILE_PX, py + 1);
        }
        if (y === snap.height - 1 || snap.tiles[y + 1][x] !== 'WALL') {
          g.moveTo(px, py + TILE_PX - 1);
          g.lineTo(px + TILE_PX, py + TILE_PX - 1);
        }
        if (x === 0 || snap.tiles[y][x - 1] !== 'WALL') {
          g.moveTo(px + 1, py);
          g.lineTo(px + 1, py + TILE_PX);
        }
        if (x === snap.width - 1 || snap.tiles[y][x + 1] !== 'WALL') {
          g.moveTo(px + TILE_PX - 1, py);
          g.lineTo(px + TILE_PX - 1, py + TILE_PX);
        }
        g.stroke();

        // Server hall LED dots on interior wall blocks
        if (theme === 'server_hall' && y > 0 && y < snap.height - 1 && (x + y) % 2 === 0) {
          g.fillStyle = '#00F0FF';
          g.fillRect(px + 8, py + 12, 3, 2);
          g.fillStyle = '#10B981';
          g.fillRect(px + 14, py + 12, 3, 2);
        }
      }
    }

    // Neon street sign banner
    g.fillStyle = '#0B0618';
    g.fillRect(PAD_PX, 7, 210, 20);
    g.strokeStyle = pal.wallEdge;
    g.lineWidth = 1.2;
    g.strokeRect(PAD_PX, 7, 210, 20);
    g.fillStyle = '#00F0FF';
    g.font = 'bold 10px monospace';
    g.textAlign = 'left';
    g.fillText(`0${snap.levelId} // ${pal.label}`, PAD_PX + 8, 20);

    this.backdropCanvas = off;
    this.backdropKey = key;
  }

  private drawHackerCoupe(g: CanvasRenderingContext2D, cx: number, cy: number): void {
    g.save();
    g.translate(cx, cy);
    // Soft cyan/magenta underglow
    g.fillStyle = 'rgba(0, 240, 255, 0.16)';
    drawRoundedRect(g, -11, -24, 22, 48, 6);
    g.fill();
    // Car chassis
    g.fillStyle = '#0F172A';
    drawRoundedRect(g, -9, -21, 18, 42, 4);
    g.fill();
    g.strokeStyle = '#FF007F';
    g.lineWidth = 1.2;
    g.stroke();
    // Hood stripe & dark cockpit windshield
    g.fillStyle = '#00F0FF';
    g.fillRect(-2, -19, 4, 10);
    g.fillStyle = '#020617';
    drawRoundedRect(g, -6, -7, 12, 16, 2);
    g.fill();
    // Headlights & taillights
    g.fillStyle = '#FEF08A';
    g.fillRect(-7, -21, 4, 2);
    g.fillRect(3, -21, 4, 2);
    g.fillStyle = '#FF1E42';
    g.fillRect(-7, 19, 4, 2);
    g.fillRect(3, 19, 4, 2);
    g.restore();
  }

  private drawThemeCover(
    g: CanvasRenderingContext2D,
    px: number,
    py: number,
    theme: LevelThemeId,
    pal: ThemePalette
  ): void {
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.fillRect(px + 7, py + 9, TILE_PX - 10, TILE_PX - 14);

    g.fillStyle = pal.coverFill;
    drawRoundedRect(g, px + 5, py + 7, TILE_PX - 10, TILE_PX - 14, 3);
    g.fill();
    g.strokeStyle = pal.coverStroke;
    g.lineWidth = 1.3;
    g.stroke();

    if (theme === 'kpp_street') {
      g.fillStyle = '#FACC15';
      g.fillRect(px + 8, py + 9, 5, 4);
      g.fillRect(px + 18, py + 9, 5, 4);
    } else if (theme === 'analytics_office') {
      g.fillStyle = '#00F0FF';
      g.fillRect(px + 11, py + 11, 14, 6);
    } else if (theme === 'server_hall') {
      g.fillStyle = '#00F0FF';
      g.fillRect(px + 9, py + 12, 4, 3);
      g.fillStyle = '#10B981';
      g.fillRect(px + 15, py + 12, 4, 3);
    } else {
      g.fillStyle = 'rgba(255, 255, 255, 0.25)';
      g.fillRect(px + 9, py + 10, TILE_PX - 18, 2);
    }
  }

  private drawFrame(): void {
    const snap = this.snapshot;
    if (!snap) return;
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;

    const ctx = this.ctx;
    const logicalW = snap.width * TILE_PX + PAD_PX * 2;
    const logicalH = snap.height * TILE_PX + PAD_PX * 2;

    ctx.save();

    // L4 Reactive Screen Shake
    if (this.fxTimerMs > 0 && this.shakeIntensity > 0) {
      const ratio = this.fxTimerMs / MAX_FX_MS;
      const dx = Math.sin(this.fxTimerMs * 0.45) * this.shakeIntensity * ratio;
      const dy = Math.cos(this.fxTimerMs * 0.6) * this.shakeIntensity * ratio;
      ctx.translate(dx, dy);
    }

    // L0: Static backdrop
    if (this.backdropCanvas) {
      ctx.drawImage(this.backdropCanvas, 0, 0);
    } else {
      ctx.fillStyle = '#0B0618';
      ctx.fillRect(0, 0, logicalW, logicalH);
    }

    // L1: Relays, painted decals, Terminal T, Exit E, Doors D
    this.drawWorldObjects(ctx, snap);

    // L3 (under characters): Camera rays, 3-layer Lasers, Guard sight & Rasmus owl forecast
    this.drawLightingAndCones(ctx, snap);

    // L2: GBR van lights, dash afterimages, characters in animal masks
    this.drawGbrStreetPresence(ctx, snap);
    this.drawDashTrails(ctx);

    for (const enemy of snap.enemies) {
      this.drawEnemy(ctx, enemy);
    }
    this.drawPlayer(ctx, snap);

    // L4: Decoy arcs, shockwaves, particles, alarm vignette, Glitch slices & Scanlines
    this.drawEffectsOverlay(ctx);
    this.drawPostFx(ctx, snap, logicalW, logicalH);

    ctx.restore();
    if (typeof performance !== 'undefined') {
      this.lastFrameMs = Number((performance.now() - t0).toFixed(2));
    }
  }

  private drawWorldObjects(ctx: CanvasRenderingContext2D, snap: WorldSnapshot): void {
    const paintedKeys = new Set(snap.paintedTiles.map((pt) => `${pt.x},${pt.y}`));

    for (let y = 0; y < snap.height; y++) {
      for (let x = 0; x < snap.width; x++) {
        const tile = snap.tiles[y][x];
        const px = PAD_PX + x * TILE_PX;
        const py = PAD_PX + y * TILE_PX;
        const isPainted = paintedKeys.has(`${x},${y}`);

        if (isPainted) {
          ctx.fillStyle = 'rgba(0, 240, 255, 0.22)';
          ctx.fillRect(px + 3, py + 3, TILE_PX - 6, TILE_PX - 6);
          ctx.strokeStyle = '#00F0FF';
          ctx.lineWidth = 1.4;
          ctx.strokeRect(px + 4, py + 4, TILE_PX - 8, TILE_PX - 8);
        }

        if (tile === 'RELAY') {
          // Industrial EMP hatch + coil ring
          ctx.fillStyle = isPainted ? '#082F49' : '#2E0927';
          drawRoundedRect(ctx, px + 5, py + 5, TILE_PX - 10, TILE_PX - 10, 3);
          ctx.fill();
          ctx.strokeStyle = isPainted ? '#00F0FF' : '#FF007F';
          ctx.lineWidth = 1.8;
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(px + TILE_PX / 2, py + TILE_PX / 2, 7, 0, Math.PI * 2);
          ctx.stroke();

          ctx.fillStyle = isPainted ? '#67E8F9' : '#F472B6';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(isPainted ? '✓' : '*', px + TILE_PX / 2, py + TILE_PX / 2 + 4);
        } else if (tile === 'TERMINAL') {
          // Detailed terminal desk with glowing dual monitor & code lines
          ctx.fillStyle = '#0F172A';
          drawRoundedRect(ctx, px + 4, py + 5, TILE_PX - 8, TILE_PX - 10, 3);
          ctx.fill();
          ctx.strokeStyle = snap.hackCompleted ? '#10B981' : '#00F0FF';
          ctx.lineWidth = 1.8;
          ctx.stroke();

          ctx.fillStyle = snap.hackCompleted ? '#064E3B' : '#082F49';
          ctx.fillRect(px + 7, py + 8, TILE_PX - 14, 11);
          ctx.fillStyle = snap.hackCompleted ? '#34D399' : '#38BDF8';
          ctx.fillRect(px + 9, py + 10, 10, 2);
          ctx.fillRect(px + 9, py + 14, 14, 2);

          ctx.fillStyle = snap.hackCompleted ? '#10B981' : '#00F0FF';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('ПК', px + TILE_PX / 2, py + TILE_PX - 7);
        } else if (tile === 'EXIT') {
          const open = snap.exitUnlocked;
          ctx.fillStyle = open ? 'rgba(16, 185, 129, 0.28)' : 'rgba(255, 30, 66, 0.16)';
          ctx.fillRect(px + 2, py + 2, TILE_PX - 4, TILE_PX - 4);
          ctx.strokeStyle = open ? '#10B981' : '#FF1E42';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 3, py + 3, TILE_PX - 6, TILE_PX - 6);

          // Chevrons >>>
          ctx.strokeStyle = open ? '#34D399' : '#FB7185';
          ctx.lineWidth = 1.6;
          for (let c = -1; c <= 1; c++) {
            const ox = px + TILE_PX / 2 + c * 6;
            const oy = py + 12;
            ctx.beginPath();
            ctx.moveTo(ox - 2, oy - 4);
            ctx.lineTo(ox + 2, oy);
            ctx.lineTo(ox - 2, oy + 4);
            ctx.stroke();
          }

          ctx.fillStyle = open ? '#6EE7B7' : '#FDA4AF';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(open ? 'ВЫХ' : 'ЗАП', px + TILE_PX / 2, py + TILE_PX - 7);
        }
      }
    }

    // Doors with pockets & shattered leaf on breach
    for (const d of snap.doors) {
      const px = PAD_PX + d.x * TILE_PX;
      const py = PAD_PX + d.y * TILE_PX;
      // Door pocket jambs
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(px + 1, py + 12, 4, TILE_PX - 24);
      ctx.fillRect(px + TILE_PX - 5, py + 12, 4, TILE_PX - 24);

      if (!d.open) {
        ctx.fillStyle = '#3B0764';
        drawRoundedRect(ctx, px + 3, py + 7, TILE_PX - 6, TILE_PX - 14, 2);
        ctx.fill();
        ctx.strokeStyle = '#FF007F';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = '#FF007F';
        ctx.fillRect(px + 7, py + TILE_PX / 2 - 1, TILE_PX - 14, 2);
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('D', px + TILE_PX / 2, py + TILE_PX / 2 + 3);
      } else if (d.broken) {
        // Skewed broken door leaf + scorch marks
        ctx.save();
        ctx.translate(px + 5, py + 5);
        ctx.rotate(-0.42);
        ctx.fillStyle = '#78350F';
        ctx.fillRect(0, 0, TILE_PX - 10, 6);
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(0, 0, TILE_PX - 10, 6);
        ctx.restore();
      } else {
        // Retracted into pocket with emerald LED
        ctx.fillStyle = '#064E3B';
        ctx.fillRect(px + 5, py + 3, TILE_PX - 10, 5);
        ctx.strokeStyle = '#10B981';
        ctx.lineWidth = 1.3;
        ctx.strokeRect(px + 5, py + 3, TILE_PX - 10, 5);
      }
    }
  }

  private drawLightingAndCones(ctx: CanvasRenderingContext2D, snap: WorldSnapshot): void {
    // Active dome cameras + volumetric beams + Rasmus (+1 turn forecast)
    for (const cam of snap.cameras) {
      const cpx = PAD_PX + cam.x * TILE_PX;
      const cpy = PAD_PX + cam.y * TILE_PX;
      const cx = cpx + TILE_PX / 2;
      const cy = cpy + TILE_PX / 2;

      const cells = cam.enabled && cam.phases.length > 0 ? cam.phases[cam.phaseIndex % cam.phases.length] : [];

      if (cam.enabled && cells.length > 0) {
        for (const cell of cells) {
          const px = PAD_PX + cell.x * TILE_PX;
          const py = PAD_PX + cell.y * TILE_PX;
          const tcx = px + TILE_PX / 2;
          const tcy = py + TILE_PX / 2;
          const grad = ctx.createRadialGradient(cx, cy, 4, tcx, tcy, TILE_PX * 1.1);
          grad.addColorStop(0, 'rgba(255, 0, 127, 0.34)');
          grad.addColorStop(1, 'rgba(255, 0, 127, 0.14)');
          ctx.fillStyle = grad;
          ctx.fillRect(px + 2, py + 2, TILE_PX - 4, TILE_PX - 4);
          ctx.strokeStyle = 'rgba(255, 0, 127, 0.72)';
          ctx.lineWidth = 1;
          ctx.strokeRect(px + 2, py + 2, TILE_PX - 4, TILE_PX - 4);
        }
      }

      if (cam.enabled && snap.mask === 'rasmus' && cam.phases.length > 1) {
        const nextCells = cam.phases[(cam.phaseIndex + 1) % cam.phases.length];
        for (const nc of nextCells) {
          const px = PAD_PX + nc.x * TILE_PX;
          const py = PAD_PX + nc.y * TILE_PX;
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.85)';
          ctx.lineWidth = 1.4;
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(px + 4, py + 4, TILE_PX - 8, TILE_PX - 8);
          ctx.setLineDash([]);
        }
      }

      // Dome camera housing pointed toward active cone centroid
      let aimAngle = 0;
      if (cells.length > 0) {
        const avgX = cells.reduce((s, c) => s + c.x, 0) / cells.length;
        const avgY = cells.reduce((s, c) => s + c.y, 0) / cells.length;
        aimAngle = Math.atan2(avgY - cam.y, avgX - cam.x);
      }
      ctx.save();
      ctx.translate(cx, cy);
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = cam.enabled ? '#F43F5E' : '#475569';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      ctx.rotate(aimAngle);
      ctx.fillStyle = cam.enabled ? '#334155' : '#1E293B';
      ctx.fillRect(0, -4, 10, 8);
      ctx.fillStyle = cam.enabled ? '#FF1E42' : '#64748B';
      ctx.beginPath();
      ctx.arc(8, 0, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3-layer Lasers
    for (const l of snap.lasers) {
      if (!l.enabled || l.cells.length === 0) continue;
      const vertical = l.cells.length > 1 && l.cells[0].x === l.cells[1].x;
      const first = l.cells[0];
      const last = l.cells[l.cells.length - 1];
      const sx = PAD_PX + first.x * TILE_PX + (vertical ? TILE_PX / 2 : 2);
      const sy = PAD_PX + first.y * TILE_PX + (vertical ? 2 : TILE_PX / 2);
      const ex = PAD_PX + last.x * TILE_PX + (vertical ? TILE_PX / 2 : TILE_PX - 2);
      const ey = PAD_PX + last.y * TILE_PX + (vertical ? TILE_PX - 2 : TILE_PX / 2);

      // Layer 1: Outer bloom
      ctx.strokeStyle = 'rgba(255, 30, 66, 0.28)';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Layer 2: Mid crimson beam
      ctx.strokeStyle = '#FF1E42';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Layer 3: Hot white-pink core
      ctx.strokeStyle = '#FFE4E6';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();

      // Emitter nodes
      ctx.fillStyle = '#0F172A';
      ctx.strokeStyle = '#FF1E42';
      ctx.lineWidth = 1.5;
      for (const pt of [
        { x: sx, y: sy },
        { x: ex, y: ey },
      ]) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    // Enemy telegraphed sight & next-step vectors
    for (const enemy of snap.enemies) {
      if (enemy.status !== 'active') continue;
      for (const cell of enemy.telegraphAttackCells) {
        const px = PAD_PX + cell.x * TILE_PX;
        const py = PAD_PX + cell.y * TILE_PX;
        ctx.fillStyle = enemy.isGbr ? 'rgba(255, 30, 66, 0.26)' : 'rgba(250, 204, 21, 0.16)';
        ctx.fillRect(px + 3, py + 3, TILE_PX - 6, TILE_PX - 6);
        ctx.strokeStyle = enemy.isGbr ? '#FF1E42' : '#FACC15';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 3, py + 3, TILE_PX - 6, TILE_PX - 6);
      }
      if (enemy.telegraphNext && (snap.mask === 'rasmus' || enemy.isGbr || enemy.patrolRoute.length > 1)) {
        const nx = PAD_PX + enemy.telegraphNext.x * TILE_PX + TILE_PX / 2;
        const ny = PAD_PX + enemy.telegraphNext.y * TILE_PX + TILE_PX / 2;
        const pos = this.getInterpolatedPos(enemy.id, enemy.x, enemy.y);
        const ex = PAD_PX + pos.x * TILE_PX + TILE_PX / 2;
        const ey = PAD_PX + pos.y * TILE_PX + TILE_PX / 2;
        ctx.strokeStyle = enemy.isGbr ? 'rgba(255, 30, 66, 0.65)' : 'rgba(0, 240, 255, 0.45)';
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(nx, ny);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  private drawGbrStreetPresence(ctx: CanvasRenderingContext2D, snap: WorldSnapshot): void {
    if (!snap.alarmTriggered && !snap.gbrSpawned) return;
    const gx = PAD_PX + snap.gbrSpawnPos.x * TILE_PX + TILE_PX / 2;
    const gy = PAD_PX + snap.gbrSpawnPos.y * TILE_PX + TILE_PX / 2;
    const redFirst = Math.floor(this.sirenPhase) % 2 === 0;
    const radius = snap.gbrSpawned ? 72 : Math.max(28, 66 - snap.gbrEtaTurns * 6);

    const grad = ctx.createRadialGradient(gx, gy, 4, gx, gy, radius);
    grad.addColorStop(0, redFirst ? 'rgba(255, 30, 66, 0.55)' : 'rgba(0, 168, 255, 0.55)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(gx - radius, gy - radius, radius * 2, radius * 2);

    // Armored GBR Van parked on street margin below spawn
    const vx = gx;
    const vy = gy + 24;
    ctx.save();
    ctx.translate(vx, vy);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    drawRoundedRect(ctx, -20, -9, 40, 18, 3);
    ctx.fill();

    ctx.fillStyle = '#0F172A';
    drawRoundedRect(ctx, -19, -10, 38, 17, 3);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // Windshield & roof lightbar
    ctx.fillStyle = '#1E293B';
    ctx.fillRect(-16, -7, 7, 11);
    ctx.fillStyle = redFirst ? '#FF1E42' : '#00A8FF';
    ctx.fillRect(-5, -8, 5, 6);
    ctx.fillStyle = redFirst ? '#00A8FF' : '#FF1E42';
    ctx.fillRect(-5, 0, 5, 6);

    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ГБР', 8, 2);
    ctx.restore();
  }

  private getInterpolatedPos(key: string, targetX: number, targetY: number): { x: number; y: number } {
    const anim = this.moveAnims.get(key);
    if (!anim || anim.duration <= 0) return { x: targetX, y: targetY };
    const t = Math.min(1, anim.elapsed / anim.duration);
    const eased = 1 - Math.pow(1 - t, 2);
    return {
      x: anim.fromX + (anim.toX - anim.fromX) * eased,
      y: anim.fromY + (anim.toY - anim.fromY) * eased,
    };
  }

  private drawDashTrails(ctx: CanvasRenderingContext2D): void {
    for (const trail of this.dashTrails) {
      const alpha = Math.max(0, trail.life / trail.maxLife) * 0.45;
      for (let i = 1; i <= 3; i++) {
        const f = i / 4;
        const x = trail.fromX + (trail.toX - trail.fromX) * f;
        const y = trail.fromY + (trail.toY - trail.fromY) * f;
        const cx = PAD_PX + x * TILE_PX + TILE_PX / 2;
        const cy = PAD_PX + y * TILE_PX + TILE_PX / 2;
        ctx.save();
        ctx.globalAlpha = alpha * (i / 3);
        ctx.translate(cx, cy);
        ctx.rotate(dirToAngle(trail.facing));
        ctx.fillStyle = '#00F0FF';
        ctx.beginPath();
        ctx.arc(0, 0, 9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  private drawTopDownAnatomy(
    ctx: CanvasRenderingContext2D,
    kind: MaskId | EnemyState['kind'],
    opts: { crouched?: boolean; shielded?: boolean; alpha?: number }
  ): void {
    const { crouched = false, shielded = false, alpha = 1 } = opts;
    ctx.save();
    ctx.globalAlpha = alpha;

    // Ground drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
    ctx.beginPath();
    ctx.ellipse(-1, 2, 12, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shoulders & torso palette
    const jacketMap: Record<MaskId | EnemyState['kind'], { body: string; trim: string; gear: string; wide: number }> = {
      richard: { body: '#0E7490', trim: '#F8FAFC', gear: '#00F0FF', wide: 10 },
      rasmus: { body: '#312E81', trim: '#818CF8', gear: '#38BDF8', wide: 10 },
      tony: { body: '#881337', trim: '#FB7185', gear: '#F43F5E', wide: 11 },
      sprint: { body: '#701A75', trim: '#F0ABFC', gear: '#FACC15', wide: 9.5 },
      patrol_rat: { body: '#1E293B', trim: '#64748B', gear: '#FACC15', wide: 10 },
      patrol_raven: { body: '#0F172A', trim: '#94A3B8', gear: '#FDE047', wide: 10.5 },
      gbr_dog: { body: '#0F172A', trim: '#38BDF8', gear: '#FF1E42', wide: 10.5 },
      gbr_boar: { body: '#1E1B4B', trim: '#A855F7', gear: '#F97316', wide: 12 },
      gbr_bear: { body: '#090D16', trim: '#1D4ED8', gear: '#38BDF8', wide: 13 },
    };
    const cfg = jacketMap[kind];

    // Arms & gear reaching forward (+x)
    ctx.fillStyle = cfg.body;
    drawRoundedRect(ctx, 2, 5, 9, 4, 2);
    ctx.fill();
    drawRoundedRect(ctx, 2, -9, 8, 4, 2);
    ctx.fill();

    // Gear item (baton/EMP wand/flashlight)
    ctx.fillStyle = cfg.gear;
    ctx.fillRect(8, 5, 6, 2.5);

    // Broad shoulders / jacket / vest
    ctx.fillStyle = cfg.body;
    drawRoundedRect(ctx, -8, -cfg.wide, 16, cfg.wide * 2, 5);
    ctx.fill();
    ctx.strokeStyle = cfg.trim;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Tactical vest plate on GBR units
    if (kind === 'gbr_dog' || kind === 'gbr_boar' || kind === 'gbr_bear') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      drawRoundedRect(ctx, -5, -cfg.wide + 3, 10, cfg.wide * 2 - 6, 2);
      ctx.fill();
    }

    // Head / Animal Mask
    if (kind === 'richard') {
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.ellipse(1, 0, 7.5, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FF1E42';
      ctx.fillRect(-3, -7.5, 6, 3.5);
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(7, -3);
      ctx.lineTo(13, 0);
      ctx.lineTo(7, 3);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'rasmus') {
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.arc(1, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#64748B';
      ctx.fillRect(-3, -7, 4, 2);
      ctx.fillRect(-3, 5, 4, 2);
      ctx.fillStyle = '#00F0FF';
      ctx.fillRect(3, -5, 4.5, 3.5);
      ctx.fillRect(3, 1.5, 4.5, 3.5);
    } else if (kind === 'tony') {
      ctx.fillStyle = '#FB7185';
      ctx.beginPath();
      ctx.arc(1, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#881337';
      ctx.fillRect(-1, -8, 4, 3);
      ctx.fillRect(-1, 5, 4, 3);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(6, -4, 4, 2);
      ctx.fillRect(6, 2, 4, 2);
    } else if (kind === 'sprint') {
      ctx.fillStyle = '#FF007F';
      ctx.beginPath();
      ctx.arc(1, 0, 7.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F0ABFC';
      ctx.beginPath();
      ctx.moveTo(-2, -7);
      ctx.lineTo(2, -10);
      ctx.lineTo(3, -5);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-2, 7);
      ctx.lineTo(2, 10);
      ctx.lineTo(3, 5);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(4, -4, 4, 2.2);
      ctx.fillRect(4, 1.8, 4, 2.2);
    } else if (kind === 'patrol_rat') {
      ctx.fillStyle = '#94A3B8';
      ctx.beginPath();
      ctx.arc(1, 0, 6.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#CBD5E1';
      ctx.beginPath();
      ctx.arc(-2, -6, 3, 0, Math.PI * 2);
      ctx.arc(-2, 6, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F472B6';
      ctx.beginPath();
      ctx.moveTo(6, -2.5);
      ctx.lineTo(12, 0);
      ctx.lineTo(6, 2.5);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'patrol_raven') {
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(1, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(6, -3);
      ctx.lineTo(14, 0);
      ctx.lineTo(6, 3);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'gbr_dog') {
      ctx.fillStyle = '#475569';
      ctx.beginPath();
      ctx.arc(1, 0, 7.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FF1E42';
      ctx.fillRect(4, -4.5, 5, 9);
    } else if (kind === 'gbr_boar') {
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.arc(1, 0, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(7, -6, 5.5, 2.2);
      ctx.fillRect(7, 3.8, 5.5, 2.2);
    } else if (kind === 'gbr_bear') {
      ctx.fillStyle = '#7C2D12';
      ctx.beginPath();
      ctx.arc(1, 0, 9.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#451A03';
      ctx.beginPath();
      ctx.arc(-3, -8, 3, 0, Math.PI * 2);
      ctx.arc(-3, 8, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(5, -4, 3, 8);
    }

    // Bear ballistic riot/energy shield
    if (shielded) {
      ctx.strokeStyle = '#00A8FF';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(3, 0, 14, -Math.PI * 0.38, Math.PI * 0.38);
      ctx.stroke();
      ctx.strokeStyle = '#E0F2FE';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(3, 0, 14, -Math.PI * 0.25, Math.PI * 0.25);
      ctx.stroke();
    }

    if (crouched) {
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, snap: WorldSnapshot): void {
    const pos = this.getInterpolatedPos('player', snap.player.x, snap.player.y);
    const cx = PAD_PX + pos.x * TILE_PX + TILE_PX / 2;
    const cy = PAD_PX + pos.y * TILE_PX + TILE_PX / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dirToAngle(snap.player.facing));
    if (snap.player.crouched) {
      ctx.scale(0.84, 0.84);
    }
    this.drawTopDownAnatomy(ctx, snap.mask, { crouched: snap.player.crouched });
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyState): void {
    const pos = this.getInterpolatedPos(enemy.id, enemy.x, enemy.y);
    const cx = PAD_PX + pos.x * TILE_PX + TILE_PX / 2;
    const cy = PAD_PX + pos.y * TILE_PX + TILE_PX / 2;

    ctx.save();
    ctx.translate(cx, cy);
    const baseAngle = dirToAngle(enemy.facing);
    if (enemy.status === 'stunned') {
      ctx.rotate(baseAngle + 0.55);
    } else if (enemy.status === 'offline') {
      ctx.rotate(baseAngle + 1.35);
    } else {
      ctx.rotate(baseAngle);
    }
    const alpha = enemy.status === 'offline' ? 0.42 : enemy.status === 'stunned' ? 0.65 : 1;
    this.drawTopDownAnatomy(ctx, enemy.kind, {
      shielded: enemy.shielded && enemy.status === 'active',
      alpha,
    });
    ctx.restore();

    if (enemy.status === 'stunned' || enemy.status === 'offline') {
      ctx.fillStyle = enemy.status === 'offline' ? '#10B981' : '#FACC15';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(enemy.status === 'offline' ? 'OFF' : 'ZZZ', cx, cy - 12);
    } else if (enemy.distractedTurns > 0) {
      ctx.fillStyle = '#00F0FF';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('?!', cx, cy - 12);
    }
  }

  private drawEffectsOverlay(ctx: CanvasRenderingContext2D): void {
    // Decoy parabolic throw arcs
    for (const arc of this.throwArcs) {
      const progress = 1 - arc.life / arc.maxLife;
      const start = tileCenter(arc.fromX, arc.fromY);
      const end = tileCenter(arc.toX, arc.toY);
      const midX = (start.cx + end.cx) / 2;
      const midY = (start.cy + end.cy) / 2 - 20;

      ctx.strokeStyle = 'rgba(0, 240, 255, 0.75)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(start.cx, start.cy);
      ctx.quadraticCurveTo(midX, midY, end.cx, end.cy);
      ctx.stroke();
      ctx.setLineDash([]);

      // Flying beacon orb along quadratic bezier
      const t = Math.min(1, progress * 1.4);
      const inv = 1 - t;
      const bx = inv * inv * start.cx + 2 * inv * t * midX + t * t * end.cx;
      const by = inv * inv * start.cy + 2 * inv * t * midY + t * t * end.cy;
      ctx.fillStyle = '#67E8F9';
      ctx.beginPath();
      ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Expanding shockwaves
    for (const sw of this.shockwaves) {
      const p = 1 - sw.life / sw.maxLife;
      const r = 6 + (sw.maxR - 6) * p;
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = Math.max(0, 1 - p);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Particles (splinters, shield shards, sparks)
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
    // Subtle red neon alarm border during ESCAPE_RACE / GBR_BREACH_COMBAT
    if (snap.alarmTriggered && snap.phase !== 'EXTRACTION') {
      ctx.strokeStyle = snap.phase === 'GBR_BREACH_COMBAT' ? 'rgba(255, 30, 66, 0.72)' : 'rgba(255, 0, 127, 0.48)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    }

    // Siren flash wash during active ALARM_PULSE FX
    if (this.fxKind === 'ALARM_PULSE' && this.fxTimerMs > 0) {
      const red = Math.floor(this.sirenPhase) % 2 === 0;
      ctx.fillStyle = red ? 'rgba(255, 30, 66, 0.10)' : 'rgba(0, 168, 255, 0.10)';
      ctx.fillRect(0, 0, w, h);
    }

    // Event-driven VHS horizontal glitch bars
    if (this.fxKind === 'GLITCH' && this.fxTimerMs > 0) {
      for (let i = 0; i < 4; i++) {
        const y = (this.fxTimerMs * (i + 3)) % Math.max(40, h - 20);
        ctx.fillStyle = i % 2 === 0 ? 'rgba(255, 0, 127, 0.25)' : 'rgba(0, 240, 255, 0.25)';
        ctx.fillRect(0, y, w, 6);
      }
    }

    // Crisp lightweight scanlines
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    for (let y = 0; y < h; y += 4) {
      ctx.fillRect(0, y, w, 1);
    }
  }
}

export type { AudioMood };
