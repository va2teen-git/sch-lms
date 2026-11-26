import type { Camera2D } from './camera.ts';
import type { DoorState, TileKind, WorldSnapshot } from './types.ts';

function isRayBlocked(
  gx: number,
  gy: number,
  tiles: TileKind[][],
  closedDoorKeys: Set<string>,
  width: number,
  height: number
): boolean {
  if (gx < 0 || gy < 0 || gx >= width || gy >= height) return false;
  const tile = tiles[gy][gx];
  if (tile === 'WALL') return true;
  if (tile === 'WINDOW') return false; // light & vision look cleanly through glass windows
  if (closedDoorKeys.has(`${gx},${gy}`)) return true;
  return false;
}

export function buildClosedDoorSet(doors: DoorState[]): Set<string> {
  const s = new Set<string>();
  for (const d of doors) {
    if (!d.open) s.add(`${d.x},${d.y}`);
  }
  return s;
}

export function computeConePolygon(
  ox: number,
  oy: number,
  angleCenter: number,
  halfSpreadRad: number,
  maxRadiusPx: number,
  tiles: TileKind[][],
  closedDoors: Set<string>,
  width: number,
  height: number,
  tilePx: number,
  rayCount = 28
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [{ x: ox, y: oy }];
  const stepPx = 6;
  const steps = Math.ceil(maxRadiusPx / stepPx);

  for (let i = 0; i <= rayCount; i++) {
    const frac = rayCount === 0 ? 0.5 : i / rayCount;
    const ang = angleCenter - halfSpreadRad + frac * halfSpreadRad * 2;
    const dx = Math.cos(ang) * stepPx;
    const dy = Math.sin(ang) * stepPx;
    let rx = ox;
    let ry = oy;
    for (let s = 1; s <= steps; s++) {
      rx += dx;
      ry += dy;
      const gx = Math.floor(rx / tilePx);
      const gy = Math.floor(ry / tilePx);
      // Skip blocking on the emitter's own origin tile
      if ((gx !== Math.floor(ox / tilePx) || gy !== Math.floor(oy / tilePx)) &&
          isRayBlocked(gx, gy, tiles, closedDoors, width, height)) {
        break;
      }
    }
    pts.push({ x: rx, y: ry });
  }
  return pts;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function renderLightmap(
  lightCanvas: HTMLCanvasElement,
  camera: Camera2D,
  snap: WorldSnapshot,
  sirenPhase: number,
  tilePx: number,
  gbrVanWorldPos?: { x: number; y: number; rot: number } | null
): void {
  const lw = Math.max(1, Math.ceil(camera.viewW / 2));
  const lh = Math.max(1, Math.ceil(camera.viewH / 2));
  if (lightCanvas.width !== lw || lightCanvas.height !== lh) {
    lightCanvas.width = lw;
    lightCanvas.height = lh;
  }
  const lctx = lightCanvas.getContext('2d');
  if (!lctx) return;

  lctx.save();
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.clearRect(0, 0, lw, lh);

  // Ambient night veil (keeps all pixel furniture & exterior details sharp while letting lights pop)
  lctx.fillStyle = snap.alarmTriggered ? 'rgba(26, 4, 16, 0.38)' : 'rgba(7, 4, 21, 0.35)';
  lctx.fillRect(0, 0, lw, lh);

  // Half-res camera world transform
  lctx.setTransform(0.5, 0, 0, 0.5, 0, 0);
  lctx.translate(camera.viewW / 2, camera.viewH / 2);
  lctx.scale(camera.zoom, camera.zoom);
  lctx.translate(-camera.x, -camera.y);

  lctx.globalCompositeOperation = 'destination-out';

  const punchLight = (wx: number, wy: number, radiusPx: number, strength = 0.85) => {
    const grad = lctx.createRadialGradient(wx, wy, radiusPx * 0.08, wx, wy, radiusPx);
    grad.addColorStop(0, `rgba(0,0,0,${strength})`);
    grad.addColorStop(0.55, `rgba(0,0,0,${(strength * 0.55).toFixed(2)})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = grad;
    lctx.beginPath();
    lctx.arc(wx, wy, radiusPx, 0, Math.PI * 2);
    lctx.fill();
  };

  for (const light of snap.scene.lights) {
    punchLight(light.x * tilePx, light.y * tilePx, light.radius * tilePx, light.intensity ?? 0.8);
  }

  // Player tactical aura
  punchLight(
    snap.player.x * tilePx + tilePx / 2,
    snap.player.y * tilePx + tilePx / 2,
    tilePx * 3.2,
    0.88
  );

  // Terminal & Exit pools
  punchLight(
    snap.terminalPos.x * tilePx + tilePx / 2,
    snap.terminalPos.y * tilePx + tilePx / 2,
    tilePx * 2.5,
    0.85
  );
  punchLight(
    snap.exitPos.x * tilePx + tilePx / 2,
    snap.exitPos.y * tilePx + tilePx / 2,
    tilePx * 2.4,
    snap.exitUnlocked ? 0.92 : 0.65
  );

  // Window light spill
  for (let y = 0; y < snap.height; y++) {
    for (let x = 0; x < snap.width; x++) {
      if (snap.tiles[y][x] === 'WINDOW') {
        punchLight(x * tilePx + tilePx / 2, y * tilePx + tilePx / 2, tilePx * 1.9, 0.55);
      }
    }
  }

  // Hacker coupe headlights
  const coupe = snap.scene.coupePos;
  const cRad = ((coupe.rot - 90) * Math.PI) / 180;
  punchLight(
    coupe.x * tilePx + Math.cos(cRad) * tilePx * 1.8,
    coupe.y * tilePx + Math.sin(cRad) * tilePx * 1.8,
    tilePx * 3.0,
    0.82
  );

  // GBR van strobe & headlight cutout
  if (snap.alarmTriggered || snap.gbrSpawned) {
    const gx = gbrVanWorldPos ? gbrVanWorldPos.x : snap.scene.gbrVanPos.x * tilePx;
    const gy = gbrVanWorldPos ? gbrVanWorldPos.y : snap.scene.gbrVanPos.y * tilePx;
    const gRot = gbrVanWorldPos ? gbrVanWorldPos.rot : snap.scene.gbrVanPos.rot;
    const gRad = ((gRot - 90) * Math.PI) / 180;
    punchLight(gx, gy, tilePx * 4.2, 0.95);
    punchLight(
      gx + Math.cos(gRad) * tilePx * 1.9,
      gy + Math.sin(gRad) * tilePx * 1.9,
      tilePx * 3.1,
      0.9
    );
    const pulse = Math.floor(sirenPhase) % 2 === 0 ? 1 : 0.7;
    punchLight(snap.gbrSpawnPos.x * tilePx + tilePx / 2, snap.gbrSpawnPos.y * tilePx + tilePx / 2, tilePx * 3.2 * pulse, 0.85);
  }

  lctx.restore();
}

export function renderAdditiveGlows(
  ctx: CanvasRenderingContext2D,
  snap: WorldSnapshot,
  sirenPhase: number,
  tilePx: number,
  gbrVanWorldPos?: { x: number; y: number; rot: number } | null
): void {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (const light of snap.scene.lights) {
    const wx = light.x * tilePx;
    const wy = light.y * tilePx;
    const r = light.radius * tilePx * 0.72;
    const alpha = (light.intensity ?? 0.75) * 0.16;
    const grad = ctx.createRadialGradient(wx, wy, 2, wx, wy, r);
    grad.addColorStop(0, hexToRgba(light.color, alpha));
    grad.addColorStop(1, hexToRgba(light.color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(wx, wy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hacker coupe directional headlight beams
  const coupe = snap.scene.coupePos;
  const cx = coupe.x * tilePx;
  const cy = coupe.y * tilePx;
  const ang = ((coupe.rot - 90) * Math.PI) / 180;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  for (const side of [-8, 8]) {
    const beamGrad = ctx.createLinearGradient(16, side, 128, side);
    beamGrad.addColorStop(0, 'rgba(254, 240, 138, 0.28)');
    beamGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.moveTo(16, side - 3);
    ctx.lineTo(132, side - 24);
    ctx.lineTo(132, side + 24);
    ctx.lineTo(16, side + 3);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // GBR van directional headlights & siren glow wash
  if (snap.alarmTriggered || snap.gbrSpawned) {
    const vx = gbrVanWorldPos ? gbrVanWorldPos.x : snap.scene.gbrVanPos.x * tilePx;
    const vy = gbrVanWorldPos ? gbrVanWorldPos.y : snap.scene.gbrVanPos.y * tilePx;
    const vRot = gbrVanWorldPos ? gbrVanWorldPos.rot : snap.scene.gbrVanPos.rot;
    const vAng = ((vRot - 90) * Math.PI) / 180;
    ctx.save();
    ctx.translate(vx, vy);
    ctx.rotate(vAng);
    for (const side of [-9, 9]) {
      const beamGrad = ctx.createLinearGradient(22, side, 148, side);
      beamGrad.addColorStop(0, 'rgba(224, 242, 254, 0.34)');
      beamGrad.addColorStop(1, 'rgba(224, 242, 254, 0)');
      ctx.fillStyle = beamGrad;
      ctx.beginPath();
      ctx.moveTo(22, side - 3);
      ctx.lineTo(148, side - 26);
      ctx.lineTo(148, side + 26);
      ctx.lineTo(22, side + 3);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    const redFirst = Math.floor(sirenPhase) % 2 === 0;
    const r = tilePx * 3.8;
    const g1 = ctx.createRadialGradient(vx, vy, 4, vx, vy, r);
    g1.addColorStop(0, redFirst ? 'rgba(255, 30, 66, 0.42)' : 'rgba(0, 168, 255, 0.42)');
    g1.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g1;
    ctx.beginPath();
    ctx.arc(vx, vy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}
