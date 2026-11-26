import { ATLAS_SPRITES } from './atlas-manifest.ts';
import { TILE_PX } from './camera.ts';
import type {
  CameraState,
  DoorState,
  EnemyState,
  InteractableCategory,
  InteractableState,
  SceneProp,
  WorldRect,
  WorldSnapshot,
} from './types.ts';

interface SpriteInsets {
  l: number;
  t: number;
  r: number;
  b: number;
}

const DEFAULT_INSETS: SpriteInsets = { l: 2 / 24, t: 2 / 24, r: 2 / 24, b: 2 / 24 };

export const SPRITE_CONTENT_INSETS: Record<string, SpriteInsets> = {
  locker_steel: { l: 3 / 24, t: 3 / 24, r: 3 / 24, b: 3 / 24 },
  armchair: { l: 3 / 24, t: 3 / 24, r: 3 / 24, b: 3 / 24 },
  vault_pillar: { l: 3 / 24, t: 3 / 24, r: 3 / 24, b: 3 / 24 },
  potted_palm: { l: 3 / 24, t: 3 / 24, r: 3 / 24, b: 3 / 24 },
  crate_wood: { l: 2 / 24, t: 2 / 24, r: 2 / 24, b: 2 / 24 },
  crate_mil: { l: 2 / 24, t: 2 / 24, r: 2 / 24, b: 2 / 24 },
  terminal_locked: { l: 2 / 24, t: 2 / 24, r: 2 / 24, b: 2 / 24 },
  terminal_hacked: { l: 2 / 24, t: 2 / 24, r: 2 / 24, b: 2 / 24 },
  fuse_cabinet: { l: 4 / 24, t: 3 / 24, r: 4 / 24, b: 3 / 24 },
  filing_cabinet: { l: 4 / 24, t: 3 / 24, r: 4 / 24, b: 3 / 24 },
  box_archive: { l: 4 / 24, t: 4 / 24, r: 4 / 24, b: 4 / 24 },
  sofa_leather: { l: 2 / 48, t: 3 / 24, r: 2 / 48, b: 3 / 24 },
  sofa_magenta: { l: 2 / 48, t: 3 / 24, r: 2 / 48, b: 3 / 24 },
  office_desk: { l: 2 / 48, t: 3 / 24, r: 2 / 48, b: 3 / 24 },
  planter_concrete: { l: 2 / 48, t: 3 / 24, r: 2 / 48, b: 3 / 24 },
  server_rack_h: { l: 2 / 48, t: 3 / 24, r: 2 / 48, b: 3 / 24 },
  chiller_unit: { l: 2 / 48, t: 3 / 24, r: 2 / 48, b: 3 / 24 },
  vending_machine: { l: 3 / 24, t: 3 / 48, r: 3 / 24, b: 3 / 48 },
  server_rack_v: { l: 3 / 24, t: 2 / 48, r: 3 / 24, b: 2 / 48 },
  server_rack_red: { l: 3 / 24, t: 2 / 48, r: 3 / 24, b: 2 / 48 },
  ops_console: { l: 2 / 72, t: 2 / 24, r: 2 / 72, b: 2 / 24 },
  reception_desk: { l: 2 / 72, t: 2 / 24, r: 2 / 72, b: 2 / 24 },
  kpp_desk: { l: 2 / 48, t: 3 / 24, r: 2 / 48, b: 3 / 24 },
  bookshelf: { l: 2 / 48, t: 4 / 24, r: 2 / 48, b: 4 / 24 },
  dumpster: { l: 2 / 48, t: 3 / 24, r: 2 / 48, b: 3 / 24 },
  coffee_table: { l: 4 / 48, t: 4 / 24, r: 4 / 48, b: 4 / 24 },
  printer_mfp: { l: 3 / 24, t: 3 / 24, r: 3 / 24, b: 3 / 24 },
  water_cooler: { l: 5 / 24, t: 4 / 24, r: 5 / 24, b: 4 / 24 },
  ac_unit: { l: 3 / 24, t: 3 / 24, r: 3 / 24, b: 3 / 24 },
  bush_hedge: { l: 3 / 24, t: 3 / 24, r: 3 / 24, b: 3 / 24 },
  relay_off: { l: 3 / 24, t: 3 / 24, r: 3 / 24, b: 3 / 24 },
  relay_on: { l: 3 / 24, t: 3 / 24, r: 3 / 24, b: 3 / 24 },
  generator: { l: 2 / 48, t: 2 / 48, r: 2 / 48, b: 2 / 48 },
};

const PROP_CATEGORY_HINTS: Record<string, InteractableCategory> = {
  crate_wood: 'crate',
  crate_mil: 'crate',
  box_archive: 'crate',
  locker_steel: 'crate',
  filing_cabinet: 'crate',
  server_rack_v: 'crate',
  server_rack_red: 'crate',
  server_rack_h: 'crate',
  potted_palm: 'plant',
  planter_concrete: 'plant',
  bush_hedge: 'plant',
  dumpster: 'urn',
  sofa_leather: 'furniture',
  sofa_magenta: 'furniture',
  armchair: 'furniture',
  office_desk: 'furniture',
  conference_table: 'furniture',
  coffee_table: 'furniture',
  bookshelf: 'furniture',
  vending_machine: 'item',
  fuse_cabinet: 'item',
  ops_console: 'item',
  printer_mfp: 'item',
  chiller_unit: 'item',
  ac_unit: 'item',
  generator: 'item',
};

function rotateInsets(insets: SpriteInsets, rot: 0 | 90 | 180 | 270): SpriteInsets {
  switch (rot) {
    case 90:
      return { l: insets.b, t: insets.l, r: insets.t, b: insets.r };
    case 180:
      return { l: insets.r, t: insets.b, r: insets.l, b: insets.t };
    case 270:
      return { l: insets.t, t: insets.r, r: insets.b, b: insets.l };
    default:
      return insets;
  }
}

export function getPropDrawRect(prop: SceneProp): WorldRect {
  const rect = ATLAS_SPRITES[prop.sprite];
  if (!rect) {
    return { x: prop.x * TILE_PX, y: prop.y * TILE_PX, w: TILE_PX, h: TILE_PX };
  }
  const sw = prop.w ? prop.w * TILE_PX : rect.w * 2;
  const sh = prop.h ? prop.h * TILE_PX : rect.h * 2;
  const rot = prop.rot || 0;
  const rotated = rot === 90 || rot === 270;
  return {
    x: prop.x * TILE_PX,
    y: prop.y * TILE_PX,
    w: rotated ? sh : sw,
    h: rotated ? sw : sh,
  };
}

export function getPropVisualBounds(prop: SceneProp): WorldRect {
  const draw = getPropDrawRect(prop);
  const raw = SPRITE_CONTENT_INSETS[prop.sprite] ?? DEFAULT_INSETS;
  const ins = rotateInsets(raw, prop.rot || 0);
  const pad = 1.5;
  const x = draw.x + draw.w * ins.l - pad;
  const y = draw.y + draw.h * ins.t - pad;
  const w = Math.max(14, draw.w * (1 - ins.l - ins.r) + pad * 2);
  const h = Math.max(14, draw.h * (1 - ins.t - ins.b) + pad * 2);
  return { x, y, w, h };
}

export function findPropForInteractable(obj: InteractableState, snap: WorldSnapshot): SceneProp | null {
  if (obj.drawIcon === 'urn') return null;
  const cx = (obj.x + 0.5) * TILE_PX;
  const cy = (obj.y + 0.5) * TILE_PX;
  const tol = TILE_PX * 0.35;

  const candidates = snap.scene.props.filter((prop) => {
    if (prop.layer === 'floor' || prop.layer === 'overhead') return false;
    if (!ATLAS_SPRITES[prop.sprite]) return false;
    const r = getPropDrawRect(prop);
    return cx >= r.x - tol && cx <= r.x + r.w + tol && cy >= r.y - tol && cy <= r.y + r.h + tol;
  });

  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const catMatches = candidates.filter((p) => PROP_CATEGORY_HINTS[p.sprite] === obj.category);
  const pool = catMatches.length > 0 ? catMatches : candidates;

  let best = pool[0];
  let bestDist = Infinity;
  for (const p of pool) {
    const r = getPropDrawRect(p);
    const pcx = r.x + r.w / 2;
    const pcy = r.y + r.h / 2;
    const d = Math.hypot(cx - pcx, cy - pcy);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

export function getInteractableVisualBounds(obj: InteractableState, snap: WorldSnapshot): WorldRect {
  if (obj.drawIcon === 'urn') {
    return {
      x: obj.x * TILE_PX + 14,
      y: obj.y * TILE_PX + 14,
      w: 20,
      h: 20,
    };
  }
  const prop = findPropForInteractable(obj, snap);
  if (prop) {
    return getPropVisualBounds(prop);
  }
  return {
    x: obj.x * TILE_PX + 8,
    y: obj.y * TILE_PX + 8,
    w: 32,
    h: 32,
  };
}

function isWallOrWindow(gx: number, gy: number, snap: WorldSnapshot): boolean {
  if (gx < 0 || gy < 0 || gx >= snap.width || gy >= snap.height) return false;
  const t = snap.tiles[gy][gx];
  return t === 'WALL' || t === 'WINDOW';
}

export function getDoorVisualBounds(door: DoorState, snap: WorldSnapshot): WorldRect {
  const px = door.x * TILE_PX;
  const py = door.y * TILE_PX;
  const horiz = isWallOrWindow(door.x - 1, door.y, snap) || isWallOrWindow(door.x + 1, door.y, snap);
  if (horiz) {
    return {
      x: px + 1,
      y: py + TILE_PX / 2 - 9,
      w: TILE_PX - 2,
      h: 18,
    };
  }
  return {
    x: px + TILE_PX / 2 - 9,
    y: py + 1,
    w: 18,
    h: TILE_PX - 2,
  };
}

export function getTerminalVisualBounds(snap: WorldSnapshot): WorldRect {
  return {
    x: snap.terminalPos.x * TILE_PX + 4,
    y: snap.terminalPos.y * TILE_PX + 4,
    w: TILE_PX - 8,
    h: TILE_PX - 8,
  };
}

export function getRelayVisualBounds(x: number, y: number): WorldRect {
  return {
    x: x * TILE_PX + 6,
    y: y * TILE_PX + 6,
    w: TILE_PX - 12,
    h: TILE_PX - 12,
  };
}

export function getCoverVisualBounds(x: number, y: number, snap: WorldSnapshot): WorldRect {
  const cx = (x + 0.5) * TILE_PX;
  const cy = (y + 0.5) * TILE_PX;
  const prop = snap.scene.props.find((p) => {
    if (p.layer === 'floor' || p.layer === 'overhead') return false;
    if (!ATLAS_SPRITES[p.sprite]) return false;
    const r = getPropDrawRect(p);
    return cx >= r.x - 4 && cx <= r.x + r.w + 4 && cy >= r.y - 4 && cy <= r.y + r.h + 4;
  });
  if (prop) return getPropVisualBounds(prop);
  return {
    x: x * TILE_PX + 6,
    y: y * TILE_PX + 6,
    w: TILE_PX - 12,
    h: TILE_PX - 12,
  };
}

export function getExitFenceHoleVisualBounds(snap: WorldSnapshot): WorldRect {
  const { x, y } = snap.exitPos;
  const holeX =
    x === snap.width - 2
      ? (snap.width - 1) * TILE_PX + TILE_PX / 2 - 11
      : x * TILE_PX + TILE_PX - 18;
  return {
    x: holeX,
    y: y * TILE_PX + 4,
    w: 22,
    h: 40,
  };
}

export function getCameraVisualBounds(cam: CameraState): WorldRect {
  return {
    x: cam.x * TILE_PX + 11,
    y: cam.y * TILE_PX + 11,
    w: 26,
    h: 26,
  };
}

export function getEnemyVisualBounds(enemy: EnemyState): WorldRect {
  return {
    x: enemy.x * TILE_PX + 8,
    y: enemy.y * TILE_PX + 8,
    w: 32,
    h: 32,
  };
}

export type HoveredObjectKind =
  | 'enemy'
  | 'door'
  | 'terminal'
  | 'interactable'
  | 'relay'
  | 'camera'
  | 'exit'
  | 'cover'
  | 'gbr_spawn';

export interface HoveredObjectInfo {
  kind: HoveredObjectKind;
  rect: WorldRect;
  label: string;
  tileX: number;
  tileY: number;
}

function pointInRect(wx: number, wy: number, r: WorldRect): boolean {
  return wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h;
}

export function findHoveredObject(wx: number, wy: number, snap: WorldSnapshot): HoveredObjectInfo | null {
  for (const enemy of snap.enemies) {
    if (enemy.status === 'offline') continue;
    const rect = getEnemyVisualBounds(enemy);
    if (pointInRect(wx, wy, rect)) {
      return {
        kind: 'enemy',
        rect,
        label: enemy.status === 'stunned' ? 'Оглушён → «обезвредить»' : 'Охрана → «бросить» / «оглушить»',
        tileX: enemy.x,
        tileY: enemy.y,
      };
    }
  }

  for (const door of snap.doors) {
    const rect = getDoorVisualBounds(door, snap);
    if (pointInRect(wx, wy, rect)) {
      return {
        kind: 'door',
        rect,
        label: door.open ? 'Проход открыт' : 'Электродверь (D) → ПК или «выбить дверь»',
        tileX: door.x,
        tileY: door.y,
      };
    }
  }

  const termRect = getTerminalVisualBounds(snap);
  if (pointInRect(wx, wy, termRect)) {
    return {
      kind: 'terminal',
      rect: termRect,
      label: snap.hackCompleted ? 'Служебный ПК (взломан ✓)' : 'Служебный ПК → «подключиться»',
      tileX: snap.terminalPos.x,
      tileY: snap.terminalPos.y,
    };
  }

  for (const obj of snap.interactables) {
    const rect = getInteractableVisualBounds(obj, snap);
    if (pointInRect(wx, wy, rect)) {
      return {
        kind: 'interactable',
        rect,
        label: obj.inspected ? `${obj.name} (осмотрено ✓)` : `${obj.name} → «осмотреть»`,
        tileX: obj.x,
        tileY: obj.y,
      };
    }
  }

  for (let y = 0; y < snap.height; y++) {
    for (let x = 0; x < snap.width; x++) {
      if (snap.tiles[y][x] === 'RELAY') {
        const rect = getRelayVisualBounds(x, y);
        if (pointInRect(wx, wy, rect)) {
          return {
            kind: 'relay',
            rect,
            label: 'ЭМИ-реле (*) → «пометить»',
            tileX: x,
            tileY: y,
          };
        }
      }
    }
  }

  for (const cam of snap.cameras) {
    const rect = getCameraVisualBounds(cam);
    if (pointInRect(wx, wy, rect)) {
      return {
        kind: 'camera',
        rect,
        label: cam.enabled ? 'Камера (K) → «отключить»' : 'Камера отключена',
        tileX: cam.x,
        tileY: cam.y,
      };
    }
  }

  const exitRect = getExitFenceHoleVisualBounds(snap);
  if (pointInRect(wx, wy, exitRect)) {
    return {
      kind: 'exit',
      rect: exitRect,
      label: snap.exitUnlocked
        ? 'Лаз в заборе (выход) открыт!'
        : 'Лаз в заборе (выход) — откроется после выполнения целей',
      tileX: snap.exitPos.x,
      tileY: snap.exitPos.y,
    };
  }

  for (let y = 0; y < snap.height; y++) {
    for (let x = 0; x < snap.width; x++) {
      if (snap.tiles[y][x] === 'COVER') {
        const rect = getCoverVisualBounds(x, y, snap);
        if (pointInRect(wx, wy, rect)) {
          return {
            kind: 'cover',
            rect,
            label: 'Укрытие (C) → «укрыться»',
            tileX: x,
            tileY: y,
          };
        }
      }
    }
  }

  const gbrTileRect: WorldRect = {
    x: snap.gbrSpawnPos.x * TILE_PX + 4,
    y: snap.gbrSpawnPos.y * TILE_PX + 4,
    w: TILE_PX - 8,
    h: TILE_PX - 8,
  };
  if (pointInRect(wx, wy, gbrTileRect)) {
    return {
      kind: 'gbr_spawn',
      rect: gbrTileRect,
      label: 'Главный вход',
      tileX: snap.gbrSpawnPos.x,
      tileY: snap.gbrSpawnPos.y,
    };
  }

  return null;
}
