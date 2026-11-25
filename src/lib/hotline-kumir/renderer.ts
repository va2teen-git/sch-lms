import type {
  AudioMood,
  Direction,
  EnemyState,
  MaskId,
  WorldEvent,
  WorldSnapshot,
} from './types.ts';

export interface RenderStats {
  rafFrames: number;
  lastFrameMs: number;
  isLoopRunning: boolean;
}

const TILE_PX = 36;
const PAD_PX = 28;

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
      for (const ev of events) {
        if (ev.type === 'DOOR_BROKEN' || ev.type === 'ENEMY_STUNNED' || ev.type === 'ENEMY_OFFLINE') {
          this.triggerFx('SHAKE', 240, 5);
        } else if (ev.type === 'WALL_CRASH' || ev.type === 'PLAYER_KO') {
          this.triggerFx('GLITCH', 300, 7);
        } else if (ev.type === 'ALERT_TRIGGERED' || ev.type === 'GBR_ARRIVED') {
          this.triggerFx('ALARM_PULSE', 340, 6);
        } else if (ev.type === 'ROBOT_DASHED' || ev.type === 'TILE_PAINTED' || ev.type === 'EXTRACTION') {
          this.triggerFx('SHAKE', 160, 2);
        }
      }
    }

    this.drawFrame();

    if (!this.fastAnim && this.fxTimerMs > 0) {
      this.startLoop();
    } else {
      this.stopLoop();
    }
  }

  flushAnimations(): void {
    this.fxTimerMs = 0;
    this.fxKind = 'NONE';
    this.shakeIntensity = 0;
    this.stopLoop();
    if (this.snapshot) {
      this.drawFrame();
    }
  }

  dispose(): void {
    this.stopLoop();
  }

  private triggerFx(kind: 'SHAKE' | 'GLITCH' | 'ALARM_PULSE', durationMs: number, intensity: number): void {
    this.fxKind = kind;
    this.fxTimerMs = Math.max(this.fxTimerMs, durationMs);
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
      this.sirenPhase = (this.sirenPhase + dt * 0.008) % 2;
      this.drawFrame();

      if (this.fxTimerMs > 0 && !(typeof document !== 'undefined' && document.hidden)) {
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
    const key = `${snap.levelId}:${snap.width}x${snap.height}`;
    if (this.backdropCanvas && this.backdropKey === key) return;
    if (typeof document === 'undefined') return;

    const logicalW = snap.width * TILE_PX + PAD_PX * 2;
    const logicalH = snap.height * TILE_PX + PAD_PX * 2;
    const off = document.createElement('canvas');
    off.width = logicalW;
    off.height = logicalH;
    const g = off.getContext('2d');
    if (!g) return;

    // L0: Night street wet asphalt outside building
    g.fillStyle = '#070312';
    g.fillRect(0, 0, logicalW, logicalH);

    // Neon asphalt streaks & street lamps
    g.strokeStyle = 'rgba(255, 0, 127, 0.14)';
    g.lineWidth = 1;
    for (let x = 0; x < logicalW; x += 18) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, logicalH);
      g.stroke();
    }
    for (let y = 0; y < logicalH; y += 18) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(logicalW, y);
      g.stroke();
    }

    // Street lamp pools at corners
    const lamps = [
      { x: 14, y: 14, color: 'rgba(0, 240, 255, 0.22)' },
      { x: logicalW - 14, y: 14, color: 'rgba(255, 0, 127, 0.22)' },
      { x: logicalW - 14, y: logicalH - 14, color: 'rgba(0, 168, 255, 0.22)' },
    ];
    for (const lamp of lamps) {
      const grad = g.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 44);
      grad.addColorStop(0, lamp.color);
      grad.addColorStop(1, 'rgba(7, 3, 18, 0)');
      g.fillStyle = grad;
      g.fillRect(lamp.x - 44, lamp.y - 44, 88, 88);
    }

    // Building floor & walls
    for (let y = 0; y < snap.height; y++) {
      for (let x = 0; x < snap.width; x++) {
        const px = PAD_PX + x * TILE_PX;
        const py = PAD_PX + y * TILE_PX;
        const tile = snap.tiles[y][x];
        if (tile === 'WALL') {
          g.fillStyle = '#180B30';
          g.fillRect(px, py, TILE_PX, TILE_PX);
          g.strokeStyle = '#FF007F';
          g.lineWidth = 1.5;
          g.strokeRect(px + 1, py + 1, TILE_PX - 2, TILE_PX - 2);
        } else {
          g.fillStyle = (x + y) % 2 === 0 ? '#0E0720' : '#120929';
          g.fillRect(px, py, TILE_PX, TILE_PX);
          g.strokeStyle = 'rgba(0, 240, 255, 0.12)';
          g.lineWidth = 1;
          g.strokeRect(px, py, TILE_PX, TILE_PX);
        }

        if (tile === 'COVER') {
          g.fillStyle = '#1D2B4A';
          g.fillRect(px + 5, py + 7, TILE_PX - 10, TILE_PX - 14);
          g.strokeStyle = '#00F0FF';
          g.lineWidth = 1.2;
          g.strokeRect(px + 5, py + 7, TILE_PX - 10, TILE_PX - 14);
        } else if (tile === 'GBR_SPAWN') {
          g.fillStyle = 'rgba(255, 30, 66, 0.16)';
          g.fillRect(px + 2, py + 2, TILE_PX - 4, TILE_PX - 4);
          g.strokeStyle = '#FF1E42';
          g.strokeRect(px + 3, py + 3, TILE_PX - 6, TILE_PX - 6);
          g.fillStyle = '#FF1E42';
          g.font = 'bold 10px monospace';
          g.textAlign = 'center';
          g.fillText('ГБР', px + TILE_PX / 2, py + TILE_PX / 2 + 4);
        }
      }
    }

    // Neon street sign banner
    g.fillStyle = '#0B0618';
    g.fillRect(PAD_PX, 4, 154, 18);
    g.strokeStyle = '#FF007F';
    g.lineWidth = 1;
    g.strokeRect(PAD_PX, 4, 154, 18);
    g.fillStyle = '#00F0FF';
    g.font = 'bold 10px monospace';
    g.textAlign = 'left';
    g.fillText(`SECTOR 0${snap.levelId} // NIGHT`, PAD_PX + 8, 16);

    this.backdropCanvas = off;
    this.backdropKey = key;
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
      const ratio = this.fxTimerMs / 320;
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

    // L3 (under characters): Camera rays, Lasers, Guard sight & Rasmus owl forecast
    this.drawLightingAndCones(ctx, snap);

    // L2: Characters in animal masks + GBR van lights
    this.drawGbrStreetPresence(ctx, snap);
    for (const enemy of snap.enemies) {
      this.drawEnemy(ctx, enemy);
    }
    this.drawPlayer(ctx, snap);

    // L4: Alarm vignette, Glitch slices & Scanlines
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
          ctx.fillStyle = 'rgba(0, 240, 255, 0.25)';
          ctx.fillRect(px + 3, py + 3, TILE_PX - 6, TILE_PX - 6);
          ctx.strokeStyle = '#00F0FF';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(px + 4, py + 4, TILE_PX - 8, TILE_PX - 8);
        }

        if (tile === 'RELAY') {
          ctx.strokeStyle = isPainted ? '#00F0FF' : '#FF007F';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 7, py + 7, TILE_PX - 14, TILE_PX - 14);
          ctx.fillStyle = isPainted ? '#00F0FF' : '#FF007F';
          ctx.font = 'bold 12px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('*', px + TILE_PX / 2, py + TILE_PX / 2 + 5);
        } else if (tile === 'TERMINAL') {
          ctx.fillStyle = snap.hackCompleted ? '#063B2D' : '#2D0A31';
          ctx.fillRect(px + 5, py + 5, TILE_PX - 10, TILE_PX - 10);
          ctx.strokeStyle = snap.hackCompleted ? '#10B981' : '#00F0FF';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 5, py + 5, TILE_PX - 10, TILE_PX - 10);
          ctx.fillStyle = snap.hackCompleted ? '#10B981' : '#00F0FF';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('ПК', px + TILE_PX / 2, py + TILE_PX / 2 + 4);
        } else if (tile === 'EXIT') {
          const open = snap.exitUnlocked;
          ctx.fillStyle = open ? 'rgba(16, 185, 129, 0.28)' : 'rgba(255, 30, 66, 0.16)';
          ctx.fillRect(px + 2, py + 2, TILE_PX - 4, TILE_PX - 4);
          ctx.strokeStyle = open ? '#10B981' : '#FF1E42';
          ctx.lineWidth = 2;
          ctx.strokeRect(px + 3, py + 3, TILE_PX - 6, TILE_PX - 6);
          ctx.fillStyle = open ? '#34D399' : '#FB7185';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText(open ? 'ВЫХ' : 'ЗАП', px + TILE_PX / 2, py + TILE_PX / 2 + 3);
        }
      }
    }

    // Doors
    for (const d of snap.doors) {
      const px = PAD_PX + d.x * TILE_PX;
      const py = PAD_PX + d.y * TILE_PX;
      if (!d.open) {
        ctx.fillStyle = '#3B0764';
        ctx.fillRect(px + 3, py + 3, TILE_PX - 6, TILE_PX - 6);
        ctx.strokeStyle = '#FF007F';
        ctx.lineWidth = 2;
        ctx.strokeRect(px + 3, py + 3, TILE_PX - 6, TILE_PX - 6);
        ctx.fillStyle = '#FF007F';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('D', px + TILE_PX / 2, py + TILE_PX / 2 + 4);
      } else {
        ctx.strokeStyle = d.broken ? '#F59E0B' : '#10B981';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(px + 4, py + 4, TILE_PX - 8, 5);
      }
    }
  }

  private drawLightingAndCones(ctx: CanvasRenderingContext2D, snap: WorldSnapshot): void {
    // Active camera cones + Rasmus (+1 turn forecast)
    for (const cam of snap.cameras) {
      const cpx = PAD_PX + cam.x * TILE_PX;
      const cpy = PAD_PX + cam.y * TILE_PX;
      ctx.fillStyle = cam.enabled ? '#F43F5E' : '#475569';
      ctx.fillRect(cpx + 10, cpy + 10, TILE_PX - 20, TILE_PX - 20);
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('K', cpx + TILE_PX / 2, cpy + TILE_PX / 2 + 3);

      if (!cam.enabled || cam.phases.length === 0) continue;
      const cells = cam.phases[cam.phaseIndex % cam.phases.length];
      for (const cell of cells) {
        const px = PAD_PX + cell.x * TILE_PX;
        const py = PAD_PX + cell.y * TILE_PX;
        ctx.fillStyle = 'rgba(255, 0, 127, 0.24)';
        ctx.fillRect(px + 2, py + 2, TILE_PX - 4, TILE_PX - 4);
        ctx.strokeStyle = 'rgba(255, 0, 127, 0.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 2, py + 2, TILE_PX - 4, TILE_PX - 4);
      }

      if (snap.mask === 'rasmus' && cam.phases.length > 1) {
        const nextCells = cam.phases[(cam.phaseIndex + 1) % cam.phases.length];
        for (const nc of nextCells) {
          const px = PAD_PX + nc.x * TILE_PX;
          const py = PAD_PX + nc.y * TILE_PX;
          ctx.strokeStyle = 'rgba(0, 240, 255, 0.75)';
          ctx.setLineDash([4, 3]);
          ctx.strokeRect(px + 4, py + 4, TILE_PX - 8, TILE_PX - 8);
          ctx.setLineDash([]);
        }
      }
    }

    // Lasers
    for (const l of snap.lasers) {
      if (!l.enabled) continue;
      for (const c of l.cells) {
        const px = PAD_PX + c.x * TILE_PX;
        const py = PAD_PX + c.y * TILE_PX;
        ctx.fillStyle = 'rgba(255, 30, 66, 0.22)';
        ctx.fillRect(px + 2, py + 12, TILE_PX - 4, 12);
        ctx.strokeStyle = '#FF1E42';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(px + 1, py + TILE_PX / 2);
        ctx.lineTo(px + TILE_PX - 1, py + TILE_PX / 2);
        ctx.stroke();
      }
    }

    // Enemy telegraphed sight & next-step vectors
    for (const enemy of snap.enemies) {
      if (enemy.status !== 'active') continue;
      for (const cell of enemy.telegraphAttackCells) {
        const px = PAD_PX + cell.x * TILE_PX;
        const py = PAD_PX + cell.y * TILE_PX;
        ctx.fillStyle = enemy.isGbr ? 'rgba(255, 30, 66, 0.28)' : 'rgba(250, 204, 21, 0.16)';
        ctx.fillRect(px + 3, py + 3, TILE_PX - 6, TILE_PX - 6);
        ctx.strokeStyle = enemy.isGbr ? '#FF1E42' : '#FACC15';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 3, py + 3, TILE_PX - 6, TILE_PX - 6);
      }
      if (enemy.telegraphNext && (snap.mask === 'rasmus' || enemy.isGbr || enemy.patrolRoute.length > 1)) {
        const nx = PAD_PX + enemy.telegraphNext.x * TILE_PX + TILE_PX / 2;
        const ny = PAD_PX + enemy.telegraphNext.y * TILE_PX + TILE_PX / 2;
        const ex = PAD_PX + enemy.x * TILE_PX + TILE_PX / 2;
        const ey = PAD_PX + enemy.y * TILE_PX + TILE_PX / 2;
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
    const radius = snap.gbrSpawned ? 66 : Math.max(26, 62 - snap.gbrEtaTurns * 6);

    const grad = ctx.createRadialGradient(gx, gy, 4, gx, gy, radius);
    grad.addColorStop(0, redFirst ? 'rgba(255, 30, 66, 0.55)' : 'rgba(0, 168, 255, 0.55)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(gx - radius, gy - radius, radius * 2, radius * 2);

    if (snap.gbrSpawned) {
      // Draw GBR armored van silhouette right at edge of spawn tile
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(gx - 15, gy + 6, 30, 12);
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(gx - 15, gy + 6, 30, 12);
      ctx.fillStyle = redFirst ? '#FF1E42' : '#00A8FF';
      ctx.fillRect(gx - 6, gy + 9, 5, 5);
      ctx.fillStyle = redFirst ? '#00A8FF' : '#FF1E42';
      ctx.fillRect(gx + 1, gy + 9, 5, 5);
    }
  }

  private drawMaskShape(
    ctx: CanvasRenderingContext2D,
    kind: MaskId | EnemyState['kind'],
    crouched = false
  ): void {
    if (kind === 'richard') {
      // Rooster mask: white oval + red crest + yellow beak
      ctx.fillStyle = '#00F0FF';
      ctx.fillRect(-10, -11, 20, 22);
      ctx.fillStyle = '#F8FAFC';
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FF1E42';
      ctx.fillRect(-4, -8, 6, 4);
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(7, -3);
      ctx.lineTo(14, 0);
      ctx.lineTo(7, 3);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'rasmus') {
      // Owl mask: slate-gold head + cyan goggles
      ctx.fillStyle = '#312E81';
      ctx.fillRect(-10, -11, 20, 22);
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#00F0FF';
      ctx.fillRect(2, -5, 5, 4);
      ctx.fillRect(2, 1, 5, 4);
    } else if (kind === 'tony') {
      // Wolf/Tiger: crimson jacket + pointed ears + fangs
      ctx.fillStyle = '#881337';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = '#FB7185';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(6, -4, 4, 2);
      ctx.fillRect(6, 2, 4, 2);
    } else if (kind === 'sprint') {
      // Neon fox/cat mask
      ctx.fillStyle = '#701A75';
      ctx.fillRect(-10, -10, 20, 20);
      ctx.fillStyle = '#FF007F';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FEF08A';
      ctx.fillRect(3, -4, 4, 2);
      ctx.fillRect(3, 2, 4, 2);
    } else if (kind === 'patrol_rat' || kind === 'patrol_raven') {
      ctx.fillStyle = '#1E293B';
      ctx.fillRect(-10, -10, 20, 20);
      ctx.fillStyle = kind === 'patrol_rat' ? '#94A3B8' : '#475569';
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.moveTo(6, -3);
      ctx.lineTo(13, 0);
      ctx.lineTo(6, 3);
      ctx.closePath();
      ctx.fill();
    } else if (kind === 'gbr_dog') {
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(-10, -11, 20, 22);
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FF1E42';
      ctx.fillRect(4, -4, 5, 8);
    } else if (kind === 'gbr_boar') {
      ctx.fillStyle = '#1E1B4B';
      ctx.fillRect(-12, -12, 24, 24);
      ctx.fillStyle = '#78350F';
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#F8FAFC';
      ctx.fillRect(7, -6, 5, 2);
      ctx.fillRect(7, 4, 5, 2);
    } else if (kind === 'gbr_bear') {
      ctx.fillStyle = '#090D16';
      ctx.fillRect(-13, -13, 26, 26);
      ctx.fillStyle = '#7C2D12';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1D4ED8';
      ctx.fillRect(-4, -4, 4, 8);
    }

    if (crouched) {
      ctx.strokeStyle = '#00F0FF';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-12, -12, 24, 24);
    }
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, snap: WorldSnapshot): void {
    const cx = PAD_PX + snap.player.x * TILE_PX + TILE_PX / 2;
    const cy = PAD_PX + snap.player.y * TILE_PX + TILE_PX / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dirToAngle(snap.player.facing));
    if (snap.player.crouched) {
      ctx.scale(0.84, 0.84);
    }
    this.drawMaskShape(ctx, snap.mask, snap.player.crouched);
    ctx.restore();
  }

  private drawEnemy(ctx: CanvasRenderingContext2D, enemy: EnemyState): void {
    const cx = PAD_PX + enemy.x * TILE_PX + TILE_PX / 2;
    const cy = PAD_PX + enemy.y * TILE_PX + TILE_PX / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dirToAngle(enemy.facing));
    if (enemy.status !== 'active') {
      ctx.globalAlpha = 0.45;
    }
    this.drawMaskShape(ctx, enemy.kind, false);
    if (enemy.shielded && enemy.status === 'active') {
      ctx.strokeStyle = '#00A8FF';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(2, 0, 14, -Math.PI / 3, Math.PI / 3);
      ctx.stroke();
    }
    ctx.restore();

    if (enemy.status === 'stunned' || enemy.status === 'offline') {
      ctx.fillStyle = enemy.status === 'offline' ? '#10B981' : '#FACC15';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(enemy.status === 'offline' ? 'OFF' : 'ZZZ', cx, cy - 11);
    }
  }

  private drawPostFx(ctx: CanvasRenderingContext2D, snap: WorldSnapshot, w: number, h: number): void {
    // Subtle red neon alarm border during ESCAPE_RACE / GBR_BREACH_COMBAT
    if (snap.alarmTriggered && snap.phase !== 'EXTRACTION') {
      ctx.strokeStyle = snap.phase === 'GBR_BREACH_COMBAT' ? 'rgba(255, 30, 66, 0.72)' : 'rgba(255, 0, 127, 0.48)';
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, w - 4, h - 4);
    }

    // Event-driven VHS horizontal glitch bars
    if (this.fxKind === 'GLITCH' && this.fxTimerMs > 0) {
      for (let i = 0; i < 4; i++) {
        const y = ((this.fxTimerMs * (i + 3)) % Math.max(40, h - 20));
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
