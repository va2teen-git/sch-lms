export type CameraMode = 'FOLLOW' | 'OVERVIEW' | 'FREE';

export const TILE_PX = 48;

export class Camera2D {
  x = 0;
  y = 0;
  zoom = 1;
  viewW = 760;
  viewH = 560;
  mode: CameraMode = 'FOLLOW';

  private minX = 0;
  private minY = 0;
  private maxX = 1000;
  private maxY = 800;

  setViewport(viewW: number, viewH: number): void {
    this.viewW = Math.max(120, viewW);
    this.viewH = Math.max(120, viewH);
    if (this.mode === 'OVERVIEW') {
      this.fitOverview();
    } else {
      this.clamp();
    }
  }

  setWorldBounds(minX: number, minY: number, maxX: number, maxY: number): void {
    this.minX = minX;
    this.minY = minY;
    this.maxX = Math.max(minX + 64, maxX);
    this.maxY = Math.max(minY + 64, maxY);
    this.clamp();
  }

  setMode(mode: CameraMode, targetX?: number, targetY?: number): void {
    this.mode = mode;
    if (mode === 'OVERVIEW') {
      this.fitOverview();
    } else if (mode === 'FOLLOW') {
      this.zoom = Math.max(0.85, Math.min(1.15, this.zoom < 0.8 ? 1.0 : this.zoom));
      if (targetX !== undefined && targetY !== undefined) {
        this.x = targetX;
        this.y = targetY;
      }
      this.clamp();
    }
  }

  fitOverview(paddingPx = 18): void {
    const worldW = this.maxX - this.minX;
    const worldH = this.maxY - this.minY;
    const availW = Math.max(60, this.viewW - paddingPx * 2);
    const availH = Math.max(60, this.viewH - paddingPx * 2);
    const fitZoom = Math.min(availW / worldW, availH / worldH);
    this.zoom = Math.max(0.35, Math.min(1.25, fitZoom));
    this.x = (this.minX + this.maxX) / 2;
    this.y = (this.minY + this.maxY) / 2;
  }

  followTarget(wx: number, wy: number, dtMs: number, snapImmediate = false): boolean {
    if (this.mode !== 'FOLLOW') return false;
    if (snapImmediate) {
      this.x = wx;
      this.y = wy;
      this.clamp();
      return false;
    }
    const alpha = 1 - Math.exp(-dtMs * 0.014);
    this.x += (wx - this.x) * alpha;
    this.y += (wy - this.y) * alpha;
    this.clamp();
    const dist = Math.hypot(wx - this.x, wy - this.y);
    if (dist <= 0.75) {
      this.x = wx;
      this.y = wy;
      this.clamp();
      return false;
    }
    return true;
  }

  panBy(dxScreen: number, dyScreen: number): void {
    this.mode = 'FREE';
    this.x -= dxScreen / this.zoom;
    this.y -= dyScreen / this.zoom;
    this.clamp();
  }

  zoomAt(factor: number, sx?: number, sy?: number): void {
    const prevZoom = this.zoom;
    const nextZoom = Math.max(0.45, Math.min(1.6, prevZoom * factor));
    if (Math.abs(nextZoom - prevZoom) < 0.001) return;

    if (sx !== undefined && sy !== undefined) {
      const before = this.screenToWorld(sx, sy);
      this.zoom = nextZoom;
      const after = this.screenToWorld(sx, sy);
      this.x += before.wx - after.wx;
      this.y += before.wy - after.wy;
    } else {
      this.zoom = nextZoom;
    }
    if (this.mode === 'OVERVIEW') {
      this.mode = 'FREE';
    }
    this.clamp();
  }

  clamp(): void {
    const halfViewW = this.viewW / (2 * this.zoom);
    const halfViewH = this.viewH / (2 * this.zoom);
    const worldW = this.maxX - this.minX;
    const worldH = this.maxY - this.minY;

    if (halfViewW * 2 >= worldW) {
      this.x = (this.minX + this.maxX) / 2;
    } else {
      this.x = Math.max(this.minX + halfViewW, Math.min(this.maxX - halfViewW, this.x));
    }
    if (halfViewH * 2 >= worldH) {
      this.y = (this.minY + this.maxY) / 2;
    } else {
      this.y = Math.max(this.minY + halfViewH, Math.min(this.maxY - halfViewH, this.y));
    }
  }

  applyTransform(ctx: CanvasRenderingContext2D, dpr: number): void {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(this.viewW / 2, this.viewH / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  screenToWorld(sx: number, sy: number): { wx: number; wy: number } {
    return {
      wx: (sx - this.viewW / 2) / this.zoom + this.x,
      wy: (sy - this.viewH / 2) / this.zoom + this.y,
    };
  }

  screenToTile(sx: number, sy: number, tilePx = TILE_PX): { x: number; y: number } {
    const { wx, wy } = this.screenToWorld(sx, sy);
    return {
      x: Math.floor(wx / tilePx),
      y: Math.floor(wy / tilePx),
    };
  }

  getViewportRectWorld(): { x: number; y: number; w: number; h: number } {
    const w = this.viewW / this.zoom;
    const h = this.viewH / this.zoom;
    return {
      x: this.x - w / 2,
      y: this.y - h / 2,
      w,
      h,
    };
  }
}
