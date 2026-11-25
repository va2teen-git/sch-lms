#!/usr/bin/env python3
"""
Procedural 16/32-bit pixel-art sprite atlas generator for Hotline KuMir.
Generates:
  - public/static/hotline-kumir/atlas.webp (lossless WebP)
  - src/lib/hotline-kumir/atlas-manifest.ts (typed sprite manifest)
"""

from __future__ import annotations

import json
import math
import os
from pathlib import Path
from typing import Dict, List, Tuple
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT_WEBP = ROOT / "public" / "static" / "hotline-kumir" / "atlas.webp"
OUT_MANIFEST = ROOT / "src" / "lib" / "hotline-kumir" / "atlas-manifest.ts"

RGBA = Tuple[int, int, int, int]
TILE = 24
OUTLINE: RGBA = (10, 6, 20, 255)  # #0A0614 crisp retro outline

BAYER_2X2 = [
    [0, 2],
    [3, 1],
]

BAYER_4X4 = [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5],
]


def hex_rgba(h: str, a: int = 255) -> RGBA:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def blend(c1: RGBA, c2: RGBA, t: float) -> RGBA:
    return (
        int(c1[0] + (c2[0] - c1[0]) * t),
        int(c1[1] + (c2[1] - c1[1]) * t),
        int(c1[2] + (c2[2] - c1[2]) * t),
        int(c1[3] + (c2[3] - c1[3]) * t),
    )


def hash2d(x: int, y: int, seed: int = 1337) -> int:
    n = (x * 374761393 + y * 668265263 + seed * 1442695041) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return (n ^ (n >> 16)) & 0xFF


def new_img(w: int, h: int, fill: RGBA = (0, 0, 0, 0)) -> Image.Image:
    return Image.new("RGBA", (w, h), fill)


def pset(img: Image.Image, x: int, y: int, col: RGBA) -> None:
    if 0 <= x < img.width and 0 <= y < img.height:
        if col[3] == 255:
            img.putpixel((x, y), col)
        elif col[3] > 0:
            bg = img.getpixel((x, y))
            a = col[3] / 255.0
            inv = 1.0 - a
            img.putpixel(
                (x, y),
                (
                    int(col[0] * a + bg[0] * inv),
                    int(col[1] * a + bg[1] * inv),
                    int(col[2] * a + bg[2] * inv),
                    min(255, int(col[3] + bg[3] * inv)),
                ),
            )


def rect(img: Image.Image, x: int, y: int, w: int, h: int, col: RGBA) -> None:
    for py in range(y, y + h):
        for px in range(x, x + w):
            pset(img, px, py, col)


def bayer_dither_rect(
    img: Image.Image,
    x: int,
    y: int,
    w: int,
    h: int,
    col_a: RGBA,
    col_b: RGBA,
    ratio: float = 0.5,
    use_4x4: bool = False,
) -> None:
    for py in range(y, y + h):
        for px in range(x, x + w):
            if use_4x4:
                thresh = (BAYER_4X4[py & 3][px & 3] + 0.5) / 16.0
            else:
                thresh = (BAYER_2X2[py & 1][px & 1] + 0.5) / 4.0
            pset(img, px, py, col_b if ratio > thresh else col_a)


def outlined_box(
    img: Image.Image,
    x: int,
    y: int,
    w: int,
    h: int,
    fill: RGBA,
    outline: RGBA = OUTLINE,
    highlight: RGBA | None = None,
    shadow: RGBA | None = None,
    rounded: bool = False,
) -> None:
    for py in range(y, y + h):
        for px in range(x, x + w):
            if rounded and (
                (px == x and py == y)
                or (px == x + w - 1 and py == y)
                or (px == x and py == y + h - 1)
                or (px == x + w - 1 and py == y + h - 1)
            ):
                continue
            is_edge = px == x or px == x + w - 1 or py == y or py == y + h - 1
            if rounded and not is_edge:
                if (
                    (px == x + 1 and py == y + 1)
                    or (px == x + w - 2 and py == y + 1)
                    or (px == x + 1 and py == y + h - 2)
                    or (px == x + w - 2 and py == y + h - 2)
                ):
                    is_edge = True
            if is_edge:
                pset(img, px, py, outline)
            else:
                pset(img, px, py, fill)
    if highlight and w > 4 and h > 4:
        for px in range(x + 2, x + w - 2):
            pset(img, px, y + 1, highlight)
        for py in range(y + 1, y + h - 2):
            pset(img, x + 1, py, highlight)
    if shadow and w > 4 and h > 4:
        for px in range(x + 2, x + w - 1):
            pset(img, px, y + h - 2, shadow)
        for py in range(y + 2, y + h - 1):
            pset(img, x + w - 2, py, shadow)


def pixel_ellipse(
    img: Image.Image,
    cx: float,
    cy: float,
    rx: float,
    ry: float,
    fill: RGBA,
    outline: RGBA | None = OUTLINE,
    highlight: RGBA | None = None,
    shadow: RGBA | None = None,
) -> None:
    x0 = int(math.floor(cx - rx - 1))
    x1 = int(math.ceil(cx + rx + 1))
    y0 = int(math.floor(cy - ry - 1))
    y1 = int(math.ceil(cy + ry + 1))
    for py in range(y0, y1 + 1):
        for px in range(x0, x1 + 1):
            dx = (px + 0.5 - cx) / max(0.5, rx)
            dy = (py + 0.5 - cy) / max(0.5, ry)
            d = dx * dx + dy * dy
            if d <= 1.0:
                if outline and d > 0.68 and (
                    ((px + 1.5 - cx) / rx) ** 2 + dy * dy > 1.0
                    or ((px - 0.5 - cx) / rx) ** 2 + dy * dy > 1.0
                    or dx * dx + ((py + 1.5 - cy) / ry) ** 2 > 1.0
                    or dx * dx + ((py - 0.5 - cy) / ry) ** 2 > 1.0
                ):
                    pset(img, px, py, outline)
                elif highlight and dx + dy < -0.55:
                    pset(img, px, py, highlight)
                elif shadow and dx + dy > 0.55:
                    pset(img, px, py, shadow)
                else:
                    pset(img, px, py, fill)


def shadow_drop(img: Image.Image, x: int, y: int, w: int, h: int, offset: int = 2, alpha: int = 115) -> None:
    rect(img, x + offset, y + offset, w, h, (6, 3, 14, alpha))


def wood_grain(img: Image.Image, x: int, y: int, w: int, h: int, base: RGBA, dark: RGBA, light: RGBA, seed: int = 1) -> None:
    rect(img, x, y, w, h, base)
    for py in range(y, y + h):
        for px in range(x, x + w):
            n = hash2d(px // 2, py, seed)
            if py % 4 == 0 and n > 140:
                pset(img, px, py, dark)
            elif n < 35:
                pset(img, px, py, light)


def asphalt_noise(img: Image.Image, seed: int = 10) -> None:
    c0 = hex_rgba("#121024")
    c1 = hex_rgba("#17142C")
    c2 = hex_rgba("#0D0B1A")
    c3 = hex_rgba("#1E1B38")
    rect(img, 0, 0, img.width, img.height, c0)
    for py in range(img.height):
        for px in range(img.width):
            v = hash2d(px, py, seed)
            if v < 38:
                pset(img, px, py, c2)
            elif v > 215:
                pset(img, px, py, c1)
            elif v > 246:
                pset(img, px, py, c3)


def carpet_weave(img: Image.Image, x: int, y: int, w: int, h: int, c_base: RGBA, c_dark: RGBA, c_hi: RGBA) -> None:
    for py in range(y, y + h):
        for px in range(x, x + w):
            if (px + py) % 2 == 0:
                pset(img, px, py, c_base)
            elif (px % 4 == 0 and py % 4 == 1):
                pset(img, px, py, c_hi)
            else:
                pset(img, px, py, c_dark)


def marble_checker(img: Image.Image, c_a: RGBA, c_b: RGBA, c_vein: RGBA, c_grout: RGBA, seed: int = 7) -> None:
    half = img.width // 2
    for py in range(img.height):
        for px in range(img.width):
            if px == 0 or py == 0 or px == half or py == half:
                pset(img, px, py, c_grout)
                continue
            bx = px // half
            by = py // half
            base = c_a if (bx + by) % 2 == 0 else c_b
            n = hash2d(px, py, seed)
            if (px + py * 2 + (n & 3)) % 11 == 0 and n > 150:
                pset(img, px, py, c_vein)
            else:
                pset(img, px, py, base)


def glass_pane(img: Image.Image, x: int, y: int, w: int, h: int) -> None:
    bayer_dither_rect(img, x, y, w, h, hex_rgba("#0E4A6E", 205), hex_rgba("#1C7BA8", 215), 0.35)
    for i in range(min(w, h) - 2):
        pset(img, x + 1 + i, y + 1 + i, hex_rgba("#A5F3FC", 200))
        if i + 3 < w:
            pset(img, x + 3 + i, y + 1 + i, hex_rgba("#67E8F9", 140))


def metallic_sheen(img: Image.Image, x: int, y: int, w: int, h: int, base: RGBA, hi: RGBA, dark: RGBA) -> None:
    for py in range(y, y + h):
        t = (py - y) / max(1, h - 1)
        col = hi if t < 0.25 else (dark if t > 0.78 else base)
        for px in range(x, x + w):
            if (px - x + py - y) == 3:
                pset(img, px, py, hi)
            else:
                pset(img, px, py, col)


# ---------------------------------------------------------------------------
# 1. FLOORS & EXTERIOR (24x24)
# ---------------------------------------------------------------------------

def build_floors() -> Dict[str, Image.Image]:
    out: Dict[str, Image.Image] = {}

    for i in (0, 1):
        im = new_img(TILE, TILE)
        asphalt_noise(im, seed=10 + i * 17)
        out[f"asphalt_{i}"] = im

    im = new_img(TILE, TILE)
    asphalt_noise(im, seed=44)
    for k in range(4, 20):
        pset(im, k, 8 + ((k * 3) // 7) % 3, hex_rgba("#07050F"))
        if k > 9:
            pset(im, k, 10 + (k % 2), hex_rgba("#090714"))
    out["asphalt_crack"] = im

    im = new_img(TILE, TILE)
    asphalt_noise(im, seed=55)
    rect(im, 4, 10, 14, 3, hex_rgba("#FACC15"))
    rect(im, 5, 11, 12, 1, hex_rgba("#FEF08A"))
    out["road_dash_h"] = im

    im = new_img(TILE, TILE)
    asphalt_noise(im, seed=56)
    rect(im, 10, 4, 3, 14, hex_rgba("#FACC15"))
    rect(im, 11, 5, 1, 12, hex_rgba("#FEF08A"))
    out["road_dash_v"] = im

    im = new_img(TILE, TILE)
    asphalt_noise(im, seed=60)
    for y0 in (2, 10, 18):
        rect(im, 2, y0, 20, 4, hex_rgba("#CBD5E1"))
        rect(im, 3, y0 + 1, 18, 2, hex_rgba("#F1F5F9"))
    out["crosswalk_h"] = im

    im = new_img(TILE, TILE)
    asphalt_noise(im, seed=61)
    for x0 in (2, 10, 18):
        rect(im, x0, 2, 4, 20, hex_rgba("#CBD5E1"))
        rect(im, x0 + 1, 3, 2, 18, hex_rgba("#F1F5F9"))
    out["crosswalk_v"] = im

    for i in (0, 1):
        im = new_img(TILE, TILE)
        rect(im, 0, 0, TILE, TILE, hex_rgba("#383454"))
        for y in range(0, TILE, 12):
            for x in range(0, TILE, 12):
                outlined_box(
                    im,
                    x,
                    y,
                    12,
                    12,
                    hex_rgba("#454066" if (x + y + i * 12) % 24 == 0 else "#3D385C"),
                    outline=hex_rgba("#27233D"),
                    highlight=hex_rgba("#585280"),
                )
        out[f"sidewalk_{i}"] = im

    for i in (0, 1):
        im = new_img(TILE, TILE)
        carpet_weave(im, 0, 0, TILE, TILE, hex_rgba("#123828"), hex_rgba("#0C281C"), hex_rgba("#1B523B"))
        for k in range(18):
            gx = hash2d(k, i, 71) % 22 + 1
            gy = hash2d(i, k, 73) % 22 + 1
            pset(im, gx, gy, hex_rgba("#22C55E" if k % 4 == 0 else "#15803D"))
            pset(im, gx, gy - 1, hex_rgba("#4ADE80" if k % 5 == 0 else "#166534"))
        out[f"grass_{i}"] = im

    im = new_img(TILE, TILE)
    rect(im, 0, 0, TILE, TILE, hex_rgba("#252338"))
    for py in range(TILE):
        for px in range(TILE):
            v = hash2d(px, py, 91)
            if v > 205:
                pset(img=im, x=px, y=py, col=hex_rgba("#3B3854"))
            elif v < 45:
                pset(im, px, py, hex_rgba("#171524"))
    out["gravel_0"] = im

    # KPP Concrete
    for i in (0, 1):
        im = new_img(TILE, TILE)
        rect(im, 0, 0, TILE, TILE, hex_rgba("#26223A"))
        bayer_dither_rect(im, 1, 1, 22, 22, hex_rgba("#2A2642"), hex_rgba("#231F36"), 0.35 + i * 0.15)
        for p in range(TILE):
            pset(im, p, 0, hex_rgba("#1A1629"))
            pset(im, 0, p, hex_rgba("#1A1629"))
        if i == 1:
            pset(im, 6, 7, hex_rgba("#3E385E"))
            pset(im, 16, 15, hex_rgba("#161324"))
        out[f"floor_kpp_{i}"] = im

    # Lobby marble
    for i in (0, 1):
        im = new_img(TILE, TILE)
        marble_checker(
            im,
            hex_rgba("#4C386E" if i == 0 else "#463266"),
            hex_rgba("#2A1D42"),
            hex_rgba("#7C5FA8"),
            hex_rgba("#180E29"),
            seed=100 + i * 11,
        )
        out[f"floor_lobby_marble_{i}"] = im

    im = new_img(TILE, TILE)
    carpet_weave(im, 0, 0, TILE, TILE, hex_rgba("#831843"), hex_rgba("#500724"), hex_rgba("#BE185D"))
    out["floor_lobby_rug"] = im

    # Office carpet
    for i in (0, 1):
        im = new_img(TILE, TILE)
        carpet_weave(
            im,
            0,
            0,
            TILE,
            TILE,
            hex_rgba("#1E2B4D" if i == 0 else "#1B2747"),
            hex_rgba("#16203B"),
            hex_rgba("#2A3D6B"),
        )
        rect(im, 0, 0, TILE, 1, hex_rgba("#121A30"))
        rect(im, 0, 0, 1, TILE, hex_rgba("#121A30"))
        out[f"floor_office_carpet_{i}"] = im

    # Wood parquet
    for i in (0, 1):
        im = new_img(TILE, TILE)
        wood_grain(im, 0, 0, TILE, TILE, hex_rgba("#5C3A28"), hex_rgba("#3D2418"), hex_rgba("#7A4E36"), seed=20 + i)
        for y in (0, 6, 12, 18):
            rect(im, 0, y, TILE, 1, hex_rgba("#2A170E"))
            jx = (y * 2 + i * 6) % TILE
            rect(im, jx, y, 1, 6, hex_rgba("#2A170E"))
        out[f"floor_wood_{i}"] = im

    # Server raised floor grate
    for i in (0, 1):
        im = new_img(TILE, TILE)
        outlined_box(
            im,
            0,
            0,
            TILE,
            TILE,
            hex_rgba("#102238"),
            outline=hex_rgba("#091424"),
            highlight=hex_rgba("#1C3B5E"),
        )
        for gy in range(4, 20, 4):
            for gx in range(4, 20, 4):
                rect(im, gx, gy, 2, 2, hex_rgba("#060E1A"))
        if i == 1:
            rect(im, 3, 3, 2, 2, hex_rgba("#00F0FF", 160))
            rect(im, 19, 19, 2, 2, hex_rgba("#00F0FF", 160))
        out[f"floor_server_grate_{i}"] = im

    # Vault obsidian & crimson
    for i in (0, 1):
        im = new_img(TILE, TILE)
        outlined_box(
            im,
            0,
            0,
            TILE,
            TILE,
            hex_rgba("#1C0E1E" if i == 0 else "#170B1A"),
            outline=hex_rgba("#0E0611"),
            highlight=hex_rgba("#331836"),
        )
        if i == 1:
            rect(im, 9, 9, 6, 6, hex_rgba("#2B132E"))
        out[f"floor_vault_{i}"] = im

    im = new_img(TILE, TILE)
    carpet_weave(im, 0, 0, TILE, TILE, hex_rgba("#6E102B"), hex_rgba("#47081B"), hex_rgba("#A61C41"))
    rect(im, 1, 1, TILE - 2, 1, hex_rgba("#FB7185", 140))
    out["floor_vault_crimson"] = im

    im = new_img(TILE, TILE)
    marble_checker(im, hex_rgba("#CBD5E1"), hex_rgba("#94A3B8"), hex_rgba("#E2E8F0"), hex_rgba("#475569"), seed=88)
    out["floor_bathroom"] = im

    return out


# ---------------------------------------------------------------------------
# 2. VEHICLES & EXTERIOR PROPS
# ---------------------------------------------------------------------------

def draw_topdown_car(
    w: int,
    h: int,
    body_main: str,
    body_hi: str,
    body_dark: str,
    stripe_col: str | None = None,
    is_coupe: bool = False,
    is_van: bool = False,
) -> Image.Image:
    im = new_img(w, h)
    # Soft drop shadow
    rect(im, 4, 4, w - 4, h - 4, (6, 3, 14, 130))
    # Underglow if hacker coupe
    if is_coupe:
        rect(im, 1, 2, w - 2, h - 4, hex_rgba("#00F0FF", 45))
        rect(im, 2, 1, w - 4, h - 2, hex_rgba("#FF007F", 40))

    # Wheels protruding slightly
    for wy in (14, h - 24):
        rect(im, 2, wy, 4, 11, OUTLINE)
        rect(im, w - 7, wy, 4, 11, OUTLINE)

    bx, by, bw, bh = 4, 3, w - 9, h - 7
    outlined_box(im, bx, by, bw, bh, hex_rgba(body_main), OUTLINE, hex_rgba(body_hi), hex_rgba(body_dark), rounded=True)

    # Hood crease & side bevels
    rect(im, bx + 3, by + 3, bw - 6, bh - 6, hex_rgba(body_main))
    rect(im, bx + 2, by + 4, 2, bh - 8, hex_rgba(body_dark))
    rect(im, bx + bw - 4, by + 4, 2, bh - 8, hex_rgba(body_hi))

    if stripe_col:
        cx = bx + bw // 2
        rect(im, cx - 2, by + 2, 4, bh - 4, hex_rgba(stripe_col))

    if is_coupe:
        # Pop-up headlights (top = front facing UP)
        rect(im, bx + 4, by + 1, 7, 4, hex_rgba("#FEF08A"))
        rect(im, bx + bw - 11, by + 1, 7, 4, hex_rgba("#FEF08A"))
        # Sloped windshield
        outlined_box(im, bx + 4, by + 22, bw - 8, 14, hex_rgba("#0B162E"), OUTLINE, hex_rgba("#38BDF8"))
        for i in range(9):
            pset(im, bx + 7 + i, by + 24 + i, hex_rgba("#BAE6FD", 210))
        # Cabin roof
        outlined_box(im, bx + 5, by + 36, bw - 10, 22, hex_rgba(body_hi), OUTLINE, hex_rgba("#FFFFFF", 180))
        # Louvered rear window
        for ly in range(by + 60, by + 76, 3):
            rect(im, bx + 5, ly, bw - 10, 2, hex_rgba("#090D1C"))
        # Glowing neon tailbar
        rect(im, bx + 3, by + bh - 4, bw - 6, 3, hex_rgba("#FF1E42"))
        rect(im, bx + 5, by + bh - 3, bw - 10, 1, hex_rgba("#FDA4AF"))
        # Side mirrors
        rect(im, bx - 2, by + 25, 3, 4, hex_rgba(body_hi))
        rect(im, bx + bw - 1, by + 25, 3, 4, hex_rgba(body_hi))
    elif is_van:
        # Armored SWAT van ("ГБР")
        rect(im, bx + 4, by + 1, 7, 3, hex_rgba("#E0F2FE"))
        rect(im, bx + bw - 11, by + 1, 7, 3, hex_rgba("#E0F2FE"))
        # Heavy bumper
        rect(im, bx + 2, by - 1, bw - 4, 3, hex_rgba("#475569"))
        # Windshield
        outlined_box(im, bx + 4, by + 13, bw - 8, 12, hex_rgba("#0F172A"), OUTLINE, hex_rgba("#38BDF8"))
        for i in range(7):
            pset(im, bx + 7 + i, by + 15 + i, hex_rgba("#7DD3FC", 200))
        # Roof hatch + lightbar
        outlined_box(im, bx + 5, by + 28, bw - 10, 52, hex_rgba("#1E293B"), OUTLINE, hex_rgba("#475569"))
        # Lightbar red/blue housing
        rect(im, bx + 6, by + 29, 13, 5, hex_rgba("#FF1E42"))
        rect(im, bx + 20, by + 29, 13, 5, hex_rgba("#00A8FF"))
        rect(im, bx + 18, by + 29, 3, 5, hex_rgba("#E2E8F0"))
        # Roof escape hatch
        outlined_box(im, bx + 11, by + 44, bw - 22, 16, hex_rgba("#334155"), OUTLINE, hex_rgba("#64748B"))
        # Rear doors seam
        rect(im, bx + bw // 2, by + bh - 6, 1, 5, OUTLINE)
        rect(im, bx + 4, by + bh - 3, 6, 2, hex_rgba("#FF1E42"))
        rect(im, bx + bw - 10, by + bh - 3, 6, 2, hex_rgba("#FF1E42"))
    else:
        # Standard street sedan / service van
        rect(im, bx + 4, by + 1, 6, 3, hex_rgba("#FEF08A"))
        rect(im, bx + bw - 10, by + 1, 6, 3, hex_rgba("#FEF08A"))
        outlined_box(im, bx + 4, by + 18, bw - 8, 12, hex_rgba("#0B162E"), OUTLINE, hex_rgba("#38BDF8"))
        for i in range(7):
            pset(im, bx + 7 + i, by + 20 + i, hex_rgba("#BAE6FD", 180))
        outlined_box(im, bx + 5, by + 31, bw - 10, 26, hex_rgba(body_hi), OUTLINE)
        outlined_box(im, bx + 5, by + 58, bw - 10, 9, hex_rgba("#0B162E"), OUTLINE)
        rect(im, bx + 4, by + bh - 3, 6, 2, hex_rgba("#FF1E42"))
        rect(im, bx + bw - 10, by + bh - 3, 6, 2, hex_rgba("#FF1E42"))

    return im


def build_exterior_props() -> Dict[str, Image.Image]:
    out: Dict[str, Image.Image] = {}
    out["car_hacker_coupe"] = draw_topdown_car(48, 96, "#D8E4F8", "#FFFFFF", "#7B8EB8", "#00F0FF", is_coupe=True)
    out["car_sedan_teal"] = draw_topdown_car(44, 84, "#0F766E", "#2DD4BF", "#115E59")
    out["car_sedan_crimson"] = draw_topdown_car(44, 84, "#881337", "#FB7185", "#4C0519")
    out["car_van_service"] = draw_topdown_car(44, 84, "#475569", "#94A3B8", "#334155", "#FACC15")
    out["van_gbr_swat"] = draw_topdown_car(48, 96, "#0F172A", "#334155", "#020617", None, is_van=True)

    # Palm tree (48x48 overhead lush curved Miami fronds)
    im = new_img(48, 48)
    cx, cy = 24, 24
    pixel_ellipse(im, cx + 3, cy + 3, 17, 17, (6, 3, 14, 75), outline=None)
    for ang_deg in range(0, 360, 45):
        rad = math.radians(ang_deg + 12)
        for dist in range(3, 21):
            curve = (dist / 20.0) ** 2 * 0.25
            r_cur = rad + curve
            fx = cx + math.cos(r_cur) * dist
            fy = cy + math.sin(r_cur) * dist
            spread = max(1, int(4.4 - abs(dist - 10) * 0.3))
            px_perp = -math.sin(r_cur)
            py_perp = math.cos(r_cur)
            for s in range(-spread, spread + 1):
                tx = int(round(fx + px_perp * s))
                ty = int(round(fy + py_perp * s))
                # Serrated leaflet gap every 3 px along frond
                if dist > 6 and dist % 3 == 0 and abs(s) >= spread - 1:
                    continue
                if abs(s) == spread or dist >= 19:
                    pset(im, tx, ty, hex_rgba("#064E3B"))
                elif abs(s) == 0:
                    pset(im, tx, ty, hex_rgba("#6EE7B7" if dist < 14 else "#34D399"))
                elif s < 0:
                    pset(im, tx, ty, hex_rgba("#10B981"))
                else:
                    pset(im, tx, ty, hex_rgba("#047857"))
    pixel_ellipse(im, cx, cy, 3.8, 3.8, hex_rgba("#78350F"), OUTLINE, hex_rgba("#D97706"))
    out["tree_palm"] = im

    # City tree (48x48 overhead lush canopy)
    im = new_img(48, 48)
    pixel_ellipse(im, 27, 27, 17, 17, (6, 3, 14, 80), outline=None)
    clusters = [(24, 24, 15), (17, 20, 10), (31, 20, 10), (19, 30, 10), (30, 29, 9)]
    for lx, ly, lr in clusters:
        pixel_ellipse(im, lx, ly, lr, lr, hex_rgba("#166534"), hex_rgba("#052E16"), hex_rgba("#4ADE80"), hex_rgba("#14532D"))
    out["tree_city"] = im

    # Bush hedge (24x24)
    im = new_img(24, 24)
    pixel_ellipse(im, 13, 14, 9, 8, (6, 3, 14, 90), outline=None)
    for lx, ly, lr in [(12, 12, 8), (8, 11, 5), (16, 13, 5)]:
        pixel_ellipse(im, lx, ly, lr, lr, hex_rgba("#15803D"), hex_rgba("#052E16"), hex_rgba("#4ADE80"), hex_rgba("#14532D"))
    out["bush_hedge"] = im

    # Concrete planter (48x24)
    im = new_img(48, 24)
    shadow_drop(im, 2, 3, 44, 18)
    outlined_box(im, 2, 3, 44, 18, hex_rgba("#64748B"), OUTLINE, hex_rgba("#94A3B8"), hex_rgba("#334155"))
    rect(im, 5, 6, 38, 12, hex_rgba("#3F271E"))
    for bx in (12, 24, 36):
        pixel_ellipse(im, bx, 12, 5, 5, hex_rgba("#16A34A"), hex_rgba("#052E16"), hex_rgba("#4ADE80"))
    out["planter_concrete"] = im

    # Streetlamp (24x24)
    im = new_img(24, 24)
    pixel_ellipse(im, 13, 14, 6, 6, (6, 3, 14, 110), outline=None)
    pixel_ellipse(im, 12, 12, 5, 5, hex_rgba("#334155"), OUTLINE, hex_rgba("#94A3B8"))
    pixel_ellipse(im, 12, 12, 3, 3, hex_rgba("#FEF08A"), None, hex_rgba("#FFFFFF"))
    out["streetlamp"] = im

    # Dumpster (48x24)
    im = new_img(48, 24)
    shadow_drop(im, 3, 3, 42, 18)
    outlined_box(im, 3, 3, 42, 18, hex_rgba("#14532D"), OUTLINE, hex_rgba("#22C55E"), hex_rgba("#052E16"))
    # Open left lid & trash bags
    outlined_box(im, 5, 5, 18, 14, hex_rgba("#1E293B"), OUTLINE, hex_rgba("#475569"))
    pixel_ellipse(im, 11, 11, 4, 4, hex_rgba("#0F172A"), OUTLINE, hex_rgba("#334155"))
    pixel_ellipse(im, 18, 13, 4, 4, hex_rgba("#334155"), OUTLINE, hex_rgba("#64748B"))
    # Closed right lid with ribs
    outlined_box(im, 24, 4, 19, 16, hex_rgba("#1E293B"), OUTLINE, hex_rgba("#475569"))
    for rx in range(27, 41, 4):
        rect(im, rx, 6, 1, 12, hex_rgba("#0F172A"))
    out["dumpster"] = im

    # Bollard (24x24)
    im = new_img(24, 24)
    pixel_ellipse(im, 13, 14, 5, 5, (6, 3, 14, 120), outline=None)
    pixel_ellipse(im, 12, 12, 4, 4, hex_rgba("#FACC15"), OUTLINE, hex_rgba("#FEF08A"))
    rect(im, 11, 11, 2, 2, hex_rgba("#0F172A"))
    out["bollard"] = im

    # KPP Boom Barrier Arm (48x24)
    im = new_img(48, 24)
    shadow_drop(im, 2, 6, 44, 10)
    outlined_box(im, 2, 4, 12, 16, hex_rgba("#F59E0B"), OUTLINE, hex_rgba("#FDE047"))
    for sx in range(13, 46, 6):
        col = hex_rgba("#EF4444") if ((sx - 13) // 6) % 2 == 0 else hex_rgba("#F8FAFC")
        outlined_box(im, sx, 9, 6, 5, col, OUTLINE)
    out["barrier_arm"] = im

    # AC Unit (24x24)
    im = new_img(24, 24)
    shadow_drop(im, 3, 3, 18, 18)
    outlined_box(im, 3, 3, 18, 18, hex_rgba("#475569"), OUTLINE, hex_rgba("#94A3B8"), hex_rgba("#1E293B"))
    pixel_ellipse(im, 12, 12, 6, 6, hex_rgba("#0F172A"), hex_rgba("#334155"))
    for a in range(0, 360, 60):
        px = int(12 + math.cos(math.radians(a)) * 4)
        py = int(12 + math.sin(math.radians(a)) * 4)
        pset(im, px, py, hex_rgba("#64748B"))
        pset(im, 12, 12, hex_rgba("#94A3B8"))
    out["ac_unit"] = im

    # Backup Diesel Generator (48x48)
    im = new_img(48, 48)
    shadow_drop(im, 4, 5, 40, 38)
    outlined_box(im, 4, 5, 40, 38, hex_rgba("#B45309"), OUTLINE, hex_rgba("#FBBF24"), hex_rgba("#78350F"))
    outlined_box(im, 8, 9, 22, 30, hex_rgba("#334155"), OUTLINE, hex_rgba("#64748B"))
    for gy in range(12, 36, 4):
        rect(im, 11, gy, 16, 2, hex_rgba("#0F172A"))
    outlined_box(im, 32, 10, 9, 12, hex_rgba("#1E293B"), OUTLINE)
    rect(im, 34, 12, 4, 3, hex_rgba("#10B981"))
    rect(im, 34, 17, 4, 2, hex_rgba("#FACC15"))
    out["generator"] = im

    # Neon puddles (48x24)
    for name, c_out, c_in in [("puddle_cyan", "#00F0FF", "#67E8F9"), ("puddle_pink", "#FF007F", "#F472B6")]:
        im = new_img(48, 24)
        pixel_ellipse(im, 24, 12, 19, 8, hex_rgba(c_out, 55), outline=None)
        pixel_ellipse(im, 22, 11, 13, 5, hex_rgba(c_in, 85), outline=None)
        rect(im, 14, 10, 12, 1, hex_rgba("#FFFFFF", 130))
        out[name] = im

    # Manhole (24x24)
    im = new_img(24, 24)
    pixel_ellipse(im, 12, 12, 8, 8, hex_rgba("#334155"), OUTLINE, hex_rgba("#64748B"))
    for k in range(7, 17, 3):
        rect(im, k, 7, 1, 10, hex_rgba("#1E293B"))
    out["manhole"] = im

    # Jersey Barrier (48x24)
    im = new_img(48, 24)
    shadow_drop(im, 2, 6, 44, 12)
    outlined_box(im, 2, 6, 44, 12, hex_rgba("#64748B"), OUTLINE, hex_rgba("#CBD5E1"), hex_rgba("#334155"))
    rect(im, 6, 8, 10, 3, hex_rgba("#FACC15"))
    rect(im, 32, 8, 10, 3, hex_rgba("#FACC15"))
    out["jersey_barrier"] = im

    return out


# ---------------------------------------------------------------------------
# 3. INTERIOR FURNITURE & ARCHITECTURE PROPS
# ---------------------------------------------------------------------------

def build_interior_props() -> Dict[str, Image.Image]:
    out: Dict[str, Image.Image] = {}

    # KPP Desk (48x24)
    im = new_img(48, 24)
    shadow_drop(im, 2, 3, 44, 18)
    wood_grain(im, 3, 4, 42, 16, hex_rgba("#475569"), hex_rgba("#334155"), hex_rgba("#64748B"), seed=5)
    outlined_box(im, 2, 3, 44, 18, (0, 0, 0, 0), OUTLINE)
    # CRT Monitors
    outlined_box(im, 6, 5, 14, 9, hex_rgba("#0F172A"), OUTLINE, hex_rgba("#38BDF8"))
    rect(im, 8, 7, 10, 5, hex_rgba("#064E3B"))
    rect(im, 9, 8, 6, 1, hex_rgba("#34D399"))
    outlined_box(im, 24, 5, 12, 9, hex_rgba("#0F172A"), OUTLINE, hex_rgba("#38BDF8"))
    rect(im, 26, 7, 8, 5, hex_rgba("#1E1B4B"))
    rect(im, 10, 15, 12, 3, hex_rgba("#CBD5E1"))  # keyboard
    pixel_ellipse(im, 40, 12, 2.5, 2.5, hex_rgba("#F8FAFC"), OUTLINE)  # coffee mug
    pset(im, 40, 12, hex_rgba("#451A03"))
    out["kpp_desk"] = im

    # Steel Locker (24x24)
    im = new_img(24, 24)
    shadow_drop(im, 3, 3, 18, 18)
    outlined_box(im, 3, 3, 18, 18, hex_rgba("#475569"), OUTLINE, hex_rgba("#94A3B8"), hex_rgba("#1E293B"))
    rect(im, 12, 4, 1, 16, OUTLINE)
    rect(im, 5, 6, 5, 2, hex_rgba("#1E293B"))
    rect(im, 14, 6, 5, 2, hex_rgba("#1E293B"))
    out["locker_steel"] = im

    # Wood Crate (24x24)
    im = new_img(24, 24)
    shadow_drop(im, 2, 2, 20, 20)
    outlined_box(im, 2, 2, 20, 20, hex_rgba("#92400E"), OUTLINE, hex_rgba("#D97706"), hex_rgba("#451A03"))
    wood_grain(im, 4, 4, 16, 16, hex_rgba("#78350F"), hex_rgba("#451A03"), hex_rgba("#B45309"), seed=31)
    for i in range(4, 19):
        pset(im, i, i, hex_rgba("#451A03"))
        pset(im, 22 - i, i, hex_rgba("#451A03"))
    out["crate_wood"] = im

    # Military / Tactical Cover Crate (24x24)
    im = new_img(24, 24)
    shadow_drop(im, 2, 2, 20, 20)
    outlined_box(im, 2, 2, 20, 20, hex_rgba("#365314"), OUTLINE, hex_rgba("#65A30D"), hex_rgba("#1A2E05"))
    rect(im, 5, 5, 14, 14, hex_rgba("#3F6212"))
    rect(im, 2, 8, 20, 2, hex_rgba("#1E293B"))
    rect(im, 2, 14, 20, 2, hex_rgba("#1E293B"))
    rect(im, 9, 10, 6, 4, hex_rgba("#FACC15"))
    out["crate_mil"] = im

    # Fuse Cabinet (24x24)
    im = new_img(24, 24)
    shadow_drop(im, 4, 3, 16, 18)
    outlined_box(im, 4, 3, 16, 18, hex_rgba("#334155"), OUTLINE, hex_rgba("#94A3B8"))
    rect(im, 7, 6, 4, 4, hex_rgba("#FACC15"))
    rect(im, 14, 7, 3, 2, hex_rgba("#EF4444"))
    rect(im, 14, 11, 3, 2, hex_rgba("#10B981"))
    out["fuse_cabinet"] = im

    # Traffic Cone (24x24)
    im = new_img(24, 24)
    pixel_ellipse(im, 13, 14, 6, 6, (6, 3, 14, 90), outline=None)
    outlined_box(im, 6, 6, 12, 12, hex_rgba("#EA580C"), OUTLINE, hex_rgba("#FB923C"))
    pixel_ellipse(im, 12, 12, 4, 4, hex_rgba("#F8FAFC"), OUTLINE)
    pixel_ellipse(im, 12, 12, 2, 2, hex_rgba("#F97316"), None)
    out["traffic_cone"] = im

    # Reception Desk (72x24)
    im = new_img(72, 24)
    shadow_drop(im, 2, 2, 68, 20)
    outlined_box(im, 2, 2, 68, 20, hex_rgba("#4A1D4D"), OUTLINE, hex_rgba("#A21CAF"), hex_rgba("#2E1030"))
    # Marble top lip
    rect(im, 4, 4, 64, 5, hex_rgba("#E2E8F0"))
    rect(im, 4, 9, 64, 2, hex_rgba("#94A3B8"))
    # Two monitors + binder + lamp
    outlined_box(im, 10, 11, 13, 8, hex_rgba("#0F172A"), OUTLINE, hex_rgba("#00F0FF"))
    outlined_box(im, 28, 11, 13, 8, hex_rgba("#0F172A"), OUTLINE, hex_rgba("#00F0FF"))
    outlined_box(im, 46, 12, 9, 7, hex_rgba("#F43F5E"), OUTLINE)
    pixel_ellipse(im, 61, 14, 4, 4, hex_rgba("#FEF08A"), OUTLINE, hex_rgba("#FFFFFF"))
    out["reception_desk"] = im

    # Sofas (48x24)
    for name, c_main, c_hi, c_dark in [
        ("sofa_magenta", "#9D174D", "#F472B6", "#500724"),
        ("sofa_leather", "#115E59", "#2DD4BF", "#042F2E"),
    ]:
        im = new_img(48, 24)
        shadow_drop(im, 2, 3, 44, 18)
        outlined_box(im, 2, 3, 44, 18, hex_rgba(c_main), OUTLINE, hex_rgba(c_hi), hex_rgba(c_dark), rounded=True)
        # Backrest
        outlined_box(im, 3, 3, 42, 6, hex_rgba(c_dark), OUTLINE, hex_rgba(c_main))
        # Armrests
        outlined_box(im, 2, 3, 6, 18, hex_rgba(c_main), OUTLINE, hex_rgba(c_hi))
        outlined_box(im, 40, 3, 6, 18, hex_rgba(c_main), OUTLINE, hex_rgba(c_hi))
        # Cushion seams
        rect(im, 18, 9, 1, 11, OUTLINE)
        rect(im, 30, 9, 1, 11, OUTLINE)
        out[name] = im

    # Armchair (24x24)
    im = new_img(24, 24)
    shadow_drop(im, 3, 3, 18, 18)
    outlined_box(im, 3, 3, 18, 18, hex_rgba("#7E22CE"), OUTLINE, hex_rgba("#C084FC"), hex_rgba("#3B0764"), rounded=True)
    outlined_box(im, 4, 4, 16, 5, hex_rgba("#581C87"), OUTLINE)
    out["armchair"] = im

    # Coffee Table (48x24)
    im = new_img(48, 24)
    shadow_drop(im, 4, 4, 40, 16)
    outlined_box(im, 4, 4, 40, 16, hex_rgba("#1E293B"), OUTLINE, hex_rgba("#64748B"))
    glass_pane(im, 7, 6, 34, 12)
    outlined_box(im, 12, 8, 8, 6, hex_rgba("#F43F5E"), OUTLINE)  # magazine
    outlined_box(im, 27, 9, 6, 5, hex_rgba("#FACC15"), OUTLINE)  # magazine
    out["coffee_table"] = im

    # Potted Palm (24x24)
    im = new_img(24, 24)
    pixel_ellipse(im, 13, 14, 7, 7, (6, 3, 14, 90), outline=None)
    pixel_ellipse(im, 12, 12, 6, 6, hex_rgba("#B45309"), OUTLINE, hex_rgba("#F59E0B"))
    for ang in range(0, 360, 60):
        r = math.radians(ang)
        for d in range(2, 9):
            pset(im, int(12 + math.cos(r) * d), int(12 + math.sin(r) * d), hex_rgba("#10B981" if d < 6 else "#4ADE80"))
    out["potted_palm"] = im

    # Water Cooler (24x24)
    im = new_img(24, 24)
    shadow_drop(im, 5, 4, 14, 16)
    outlined_box(im, 5, 4, 14, 16, hex_rgba("#CBD5E1"), OUTLINE, hex_rgba("#FFFFFF"))
    pixel_ellipse(im, 12, 12, 5, 5, hex_rgba("#06B6D4"), OUTLINE, hex_rgba("#A5F3FC"))
    out["water_cooler"] = im

    # Vending Machine (24x48)
    im = new_img(24, 48)
    shadow_drop(im, 3, 3, 18, 42)
    outlined_box(im, 3, 3, 18, 42, hex_rgba("#991B1B"), OUTLINE, hex_rgba("#F87171"), hex_rgba("#450A0A"))
    rect(im, 16, 6, 4, 34, hex_rgba("#00F0FF"))  # glowing neon front strip
    rect(im, 17, 10, 2, 26, hex_rgba("#E0F2FE"))
    out["vending_machine"] = im

    # Turnstile (24x24)
    im = new_img(24, 24)
    shadow_drop(im, 4, 2, 16, 20)
    outlined_box(im, 4, 2, 16, 6, hex_rgba("#475569"), OUTLINE, hex_rgba("#CBD5E1"))
    outlined_box(im, 4, 16, 16, 6, hex_rgba("#475569"), OUTLINE, hex_rgba("#CBD5E1"))
    rect(im, 10, 8, 4, 8, hex_rgba("#F43F5E"))
    rect(im, 11, 3, 2, 2, hex_rgba("#10B981"))
    out["turnstile"] = im

    # Rug Runner H (48x24)
    im = new_img(48, 24)
    carpet_weave(im, 2, 3, 44, 18, hex_rgba("#9D174D"), hex_rgba("#500724"), hex_rgba("#F472B6"))
    outlined_box(im, 2, 3, 44, 18, (0, 0, 0, 0), OUTLINE)
    rect(im, 5, 5, 38, 2, hex_rgba("#FDE047"))
    rect(im, 5, 17, 38, 2, hex_rgba("#FDE047"))
    out["rug_runner_h"] = im

    # Office Desk (48x24)
    im = new_img(48, 24)
    shadow_drop(im, 2, 3, 44, 18)
    wood_grain(im, 3, 4, 42, 16, hex_rgba("#854D0E"), hex_rgba("#422006"), hex_rgba("#CA8A04"), seed=42)
    outlined_box(im, 2, 3, 44, 18, (0, 0, 0, 0), OUTLINE)
    # Dual monitor + keyboard + papers + mug
    outlined_box(im, 8, 5, 13, 6, hex_rgba("#0F172A"), OUTLINE, hex_rgba("#38BDF8"))
    outlined_box(im, 23, 5, 13, 6, hex_rgba("#0F172A"), OUTLINE, hex_rgba("#38BDF8"))
    rect(im, 15, 13, 12, 3, hex_rgba("#1E293B"))
    outlined_box(im, 37, 11, 6, 7, hex_rgba("#F8FAFC"), OUTLINE)  # notepad
    pixel_ellipse(im, 6, 15, 2, 2, hex_rgba("#F43F5E"), OUTLINE)  # cup
    out["office_desk"] = im

    # Office Chair (24x24)
    im = new_img(24, 24)
    pixel_ellipse(im, 13, 14, 7, 7, (6, 3, 14, 95), outline=None)
    for dx, dy in [(-5, -5), (5, -5), (-5, 5), (5, 5)]:
        rect(im, 12 + dx, 12 + dy, 2, 2, hex_rgba("#334155"))
    pixel_ellipse(im, 12, 12, 6, 6, hex_rgba("#1E293B"), OUTLINE, hex_rgba("#475569"))
    outlined_box(im, 6, 5, 12, 4, hex_rgba("#0F172A"), OUTLINE, hex_rgba("#38BDF8"))
    out["office_chair"] = im

    # Conference Table (72x48)
    im = new_img(72, 48)
    shadow_drop(im, 5, 9, 62, 30)
    # Chairs tucked around top & bottom
    for cx in (14, 32, 50):
        outlined_box(im, cx, 3, 10, 8, hex_rgba("#1E293B"), OUTLINE, hex_rgba("#475569"))
        outlined_box(im, cx, 37, 10, 8, hex_rgba("#1E293B"), OUTLINE, hex_rgba("#475569"))
    wood_grain(im, 6, 10, 60, 28, hex_rgba("#7C2D12"), hex_rgba("#431407"), hex_rgba("#B45309"), seed=99)
    outlined_box(im, 5, 9, 62, 30, (0, 0, 0, 0), OUTLINE, hex_rgba("#D97706"))
    # Laptops & center phone
    for lx in (14, 33, 49):
        outlined_box(im, lx, 14, 8, 6, hex_rgba("#0F172A"), OUTLINE, hex_rgba("#38BDF8"))
    pixel_ellipse(im, 36, 24, 3, 3, hex_rgba("#0F172A"), OUTLINE, hex_rgba("#94A3B8"))
    out["conference_table"] = im

    # Filing Cabinet (24x24)
    im = new_img(24, 24)
    shadow_drop(im, 4, 3, 16, 18)
    outlined_box(im, 4, 3, 16, 18, hex_rgba("#64748B"), OUTLINE, hex_rgba("#CBD5E1"), hex_rgba("#334155"))
    rect(im, 7, 17, 10, 2, hex_rgba("#1E293B"))
    out["filing_cabinet"] = im

    # Printer MFP (24x24)
    im = new_img(24, 24)
    shadow_drop(im, 3, 3, 18, 18)
    outlined_box(im, 3, 3, 18, 18, hex_rgba("#CBD5E1"), OUTLINE, hex_rgba("#FFFFFF"), hex_rgba("#64748B"))
    rect(im, 6, 6, 10, 8, hex_rgba("#1E293B"))
    rect(im, 17, 15, 2, 2, hex_rgba("#10B981"))
    out["printer_mfp"] = im

    # Bookshelf (48x24)
    im = new_img(48, 24)
    shadow_drop(im, 2, 4, 44, 16)
    outlined_box(im, 2, 4, 44, 16, hex_rgba("#78350F"), OUTLINE, hex_rgba("#B45309"))
    book_cols = ["#EF4444", "#38BDF8", "#FACC15", "#10B981", "#F472B6", "#CBD5E1"]
    for i, bx in enumerate(range(5, 41, 3)):
        rect(im, bx, 7, 2, 10, hex_rgba(book_cols[i % len(book_cols)]))
    out["bookshelf"] = im

    # Paper clutter (24x24 floor decal)
    im = new_img(24, 24)
    outlined_box(im, 4, 5, 7, 9, hex_rgba("#E2E8F0"), OUTLINE)
    outlined_box(im, 12, 9, 8, 7, hex_rgba("#CBD5E1"), OUTLINE)
    rect(im, 6, 8, 3, 1, hex_rgba("#64748B"))
    rect(im, 14, 12, 4, 1, hex_rgba("#64748B"))
    out["paper_clutter"] = im

    # Archive Box (24x24)
    im = new_img(24, 24)
    shadow_drop(im, 4, 4, 16, 16)
    outlined_box(im, 4, 4, 16, 16, hex_rgba("#D6D3D1"), OUTLINE, hex_rgba("#FFFFFF"), hex_rgba("#78716C"))
    rect(im, 7, 10, 10, 4, hex_rgba("#A8A29E"))
    out["box_archive"] = im

    # Server racks
    for name, edge_c, led_a, led_b in [
        ("server_rack_v", "#1E3A5F", "#00F0FF", "#10B981"),
        ("server_rack_red", "#4C0519", "#FF1E42", "#FACC15"),
    ]:
        im = new_img(24, 48)
        shadow_drop(im, 3, 2, 18, 44)
        outlined_box(im, 3, 2, 18, 44, hex_rgba("#0F172A"), OUTLINE, hex_rgba(edge_c))
        for ry in range(5, 41, 6):
            rect(im, 5, ry, 14, 4, hex_rgba("#1E293B"))
            rect(im, 6, ry + 1, 2, 2, hex_rgba(led_a))
            rect(im, 10, ry + 1, 2, 2, hex_rgba(led_b))
            rect(im, 14, ry + 1, 4, 2, hex_rgba("#090D1C"))
        out[name] = im

    im = new_img(48, 24)
    shadow_drop(im, 2, 3, 44, 18)
    outlined_box(im, 2, 3, 44, 18, hex_rgba("#0F172A"), OUTLINE, hex_rgba("#1E3A5F"))
    for rx in range(5, 41, 6):
        rect(im, rx, 5, 4, 14, hex_rgba("#1E293B"))
        rect(im, rx + 1, 6, 2, 2, hex_rgba("#00F0FF"))
        rect(im, rx + 1, 10, 2, 2, hex_rgba("#10B981"))
    out["server_rack_h"] = im

    # Ops Console (72x24)
    im = new_img(72, 24)
    shadow_drop(im, 2, 2, 68, 20)
    outlined_box(im, 2, 2, 68, 20, hex_rgba("#0F172A"), OUTLINE, hex_rgba("#00F0FF"))
    for sx in (6, 26, 46):
        outlined_box(im, sx, 4, 18, 9, hex_rgba("#082F49"), OUTLINE, hex_rgba("#38BDF8"))
        rect(im, sx + 2, 6, 12, 2, hex_rgba("#22D3EE"))
        rect(im, sx + 2, 9, 8, 2, hex_rgba("#10B981"))
    rect(im, 14, 15, 44, 4, hex_rgba("#1E293B"))
    out["ops_console"] = im

    # Chiller unit (48x24)
    im = new_img(48, 24)
    shadow_drop(im, 2, 3, 44, 18)
    outlined_box(im, 2, 3, 44, 18, hex_rgba("#0C4A6E"), OUTLINE, hex_rgba("#38BDF8"), hex_rgba("#082F49"))
    for cx in (14, 34):
        pixel_ellipse(im, cx, 12, 7, 7, hex_rgba("#0F172A"), hex_rgba("#7DD3FC"))
        pixel_ellipse(im, cx, 12, 2, 2, hex_rgba("#38BDF8"), None)
    out["chiller_unit"] = im

    # Cable trays (24x24)
    im = new_img(24, 24)
    rect(im, 0, 8, 24, 8, hex_rgba("#091424"))
    rect(im, 0, 9, 24, 2, hex_rgba("#00F0FF", 160))
    rect(im, 0, 13, 24, 2, hex_rgba("#FF007F", 160))
    out["cable_tray_h"] = im

    im = new_img(24, 24)
    rect(im, 8, 0, 8, 24, hex_rgba("#091424"))
    rect(im, 9, 0, 2, 24, hex_rgba("#00F0FF", 160))
    rect(im, 13, 0, 2, 24, hex_rgba("#FF007F", 160))
    out["cable_tray_v"] = im

    # Vault pillar (24x24)
    im = new_img(24, 24)
    shadow_drop(im, 3, 3, 18, 18)
    outlined_box(im, 3, 3, 18, 18, hex_rgba("#3F1D2B"), OUTLINE, hex_rgba("#FB7185"), hex_rgba("#1F0A14"))
    outlined_box(im, 7, 7, 10, 10, hex_rgba("#1E293B"), OUTLINE, hex_rgba("#94A3B8"))
    out["vault_pillar"] = im

    # Terminals (24x24)
    for name, glow, screen, line_col in [
        ("terminal_locked", "#00F0FF", "#082F49", "#38BDF8"),
        ("terminal_hacked", "#10B981", "#064E3B", "#34D399"),
    ]:
        im = new_img(24, 24)
        shadow_drop(im, 2, 2, 20, 20)
        outlined_box(im, 2, 2, 20, 20, hex_rgba("#0F172A"), OUTLINE, hex_rgba(glow))
        outlined_box(im, 4, 4, 16, 10, hex_rgba(screen), OUTLINE)
        rect(im, 6, 6, 8, 2, hex_rgba(line_col))
        rect(im, 6, 9, 11, 2, hex_rgba(line_col))
        rect(im, 6, 16, 12, 3, hex_rgba("#334155"))
        rect(im, 17, 16, 2, 2, hex_rgba(glow))
        out[name] = im

    # Relays (24x24)
    for name, outer, coil, core in [
        ("relay_off", "#FF007F", "#831843", "#F472B6"),
        ("relay_on", "#00F0FF", "#0E7490", "#A5F3FC"),
    ]:
        im = new_img(24, 24)
        shadow_drop(im, 3, 3, 18, 18)
        outlined_box(im, 3, 3, 18, 18, hex_rgba("#110824"), OUTLINE, hex_rgba(outer))
        pixel_ellipse(im, 12, 12, 6, 6, hex_rgba(coil), hex_rgba(outer), hex_rgba(core))
        pixel_ellipse(im, 12, 12, 2, 2, hex_rgba("#FFFFFF"), None)
        out[name] = im

    return out


# ---------------------------------------------------------------------------
# 4. MULTI-LAYER TOP-DOWN CHARACTERS (32x32, facing RIGHT +x)
# ---------------------------------------------------------------------------

def build_characters() -> Dict[str, Image.Image]:
    out: Dict[str, Image.Image] = {}

    # 4-frame animated legs (32x32 facing RIGHT +x)
    leg_offsets = [(0, 0), (4, -3), (0, 0), (-3, 4)]
    for idx, (lx_off, rx_off) in enumerate(leg_offsets):
        im = new_img(32, 32)
        # Left foot (y ~ 11)
        outlined_box(im, 13 + lx_off, 9, 7, 5, hex_rgba("#1E293B"), OUTLINE, hex_rgba("#475569"))
        rect(im, 17 + lx_off, 10, 2, 3, hex_rgba("#0F172A"))
        # Right foot (y ~ 18)
        outlined_box(im, 13 + rx_off, 18, 7, 5, hex_rgba("#1E293B"), OUTLINE, hex_rgba("#475569"))
        rect(im, 17 + rx_off, 19, 2, 3, hex_rgba("#0F172A"))
        out[f"legs_{idx}"] = im

    specs = {
        "richard": ("#A16207", "#FDE047", "#713F12", "#FEF3C7", "#00F0FF", "beak_rooster"),
        "rasmus": ("#312E81", "#6366F1", "#1E1B4B", "#E2E8F0", "#00F0FF", "owl"),
        "tony": ("#9F1239", "#FB7185", "#4C0519", "#F43F5E", "#FACC15", "wolf"),
        "sprint": ("#86198F", "#F0ABFC", "#4A044E", "#EC4899", "#FDE047", "fox"),
        "patrol_rat": ("#1E293B", "#64748B", "#0F172A", "#CBD5E1", "#FACC15", "rat"),
        "patrol_raven": ("#0F172A", "#475569", "#020617", "#334155", "#FACC15", "raven"),
        "gbr_dog": ("#0F172A", "#38BDF8", "#020617", "#64748B", "#FF1E42", "dog"),
        "gbr_boar": ("#1E1B4B", "#A855F7", "#090D16", "#78350F", "#F97316", "boar"),
        "gbr_bear": ("#090D16", "#38BDF8", "#020617", "#7C2D12", "#00A8FF", "bear"),
    }

    for kind, (j_main, j_hi, j_dark, h_main, gear_col, mask_type) in specs.items():
        # STANDING POSE
        im = new_img(32, 32)
        cx, cy = 15, 16
        # Drop shadow
        pixel_ellipse(im, cx - 1, cy + 1, 10, 10, (6, 3, 14, 105), outline=None)

        # Arms reaching right (+x)
        outlined_box(im, 14, 6, 10, 5, hex_rgba(j_main), OUTLINE, hex_rgba(j_hi))
        outlined_box(im, 14, 21, 10, 5, hex_rgba(j_main), OUTLINE, hex_rgba(j_hi))
        # Hands
        rect(im, 22, 7, 3, 3, hex_rgba("#FCA5A5" if "gbr" not in kind else "#1E293B"))
        rect(im, 22, 22, 3, 3, hex_rgba("#FCA5A5" if "gbr" not in kind else "#1E293B"))

        # Weapon / EMP / Flashlight in right hand
        if kind.startswith("patrol"):
            outlined_box(im, 23, 21, 7, 4, hex_rgba("#334155"), OUTLINE)
            rect(im, 28, 22, 2, 2, hex_rgba("#FEF08A"))
        elif kind.startswith("gbr"):
            outlined_box(im, 21, 18, 9, 4, hex_rgba("#1E293B"), OUTLINE, hex_rgba(gear_col))
        else:
            outlined_box(im, 22, 20, 8, 4, hex_rgba("#0F172A"), OUTLINE, hex_rgba(gear_col))

        # Broad Shoulders / Jacket / SWAT Vest
        wide = 10 if kind in ("gbr_boar", "gbr_bear") else 9
        outlined_box(im, 8, cy - wide, 13, wide * 2, hex_rgba(j_main), OUTLINE, hex_rgba(j_hi), hex_rgba(j_dark), rounded=True)
        # Collar / Vest detail
        if kind.startswith("gbr"):
            outlined_box(im, 10, cy - wide + 3, 8, wide * 2 - 6, hex_rgba("#1E293B"), OUTLINE, hex_rgba(j_hi))
        else:
            rect(im, 11, cy - 3, 3, 6, hex_rgba(j_hi))

        # Head + Expressive Animal Mask
        hx, hy = 17, 16
        head_base = hex_rgba(h_main)
        head_hi = blend(head_base, (255, 255, 255, 255), 0.25)
        head_sh = blend(head_base, OUTLINE, 0.30)
        pixel_ellipse(im, hx, hy, 6.5, 6.2, head_base, OUTLINE, head_hi, head_sh)

        if mask_type == "beak_rooster":
            rect(im, hx - 4, hy - 2, 6, 4, hex_rgba("#DC2626"))  # red comb
            rect(im, hx - 3, hy - 1, 4, 2, hex_rgba("#FCA5A5"))
            rect(im, hx + 5, hy - 3, 5, 6, hex_rgba("#EAB308"))  # yellow beak
            rect(im, hx + 9, hy - 1, 3, 2, hex_rgba("#FEF08A"))
            pset(im, hx + 3, hy - 3, OUTLINE)
            pset(im, hx + 3, hy + 2, OUTLINE)
        elif mask_type == "owl":
            rect(im, hx - 3, hy - 6, 4, 2, hex_rgba("#475569"))
            rect(im, hx - 3, hy + 4, 4, 2, hex_rgba("#475569"))
            rect(im, hx + 2, hy - 4, 3, 3, hex_rgba("#00F0FF"))
            rect(im, hx + 2, hy + 1, 3, 3, hex_rgba("#00F0FF"))
            rect(im, hx + 5, hy - 1, 3, 2, hex_rgba("#F59E0B"))
        elif mask_type == "wolf":
            rect(im, hx - 2, hy - 7, 5, 3, hex_rgba("#881337"))
            rect(im, hx - 2, hy + 4, 5, 3, hex_rgba("#881337"))
            rect(im, hx + 4, hy - 3, 6, 6, hex_rgba("#BE123C"))
            rect(im, hx + 8, hy - 1, 2, 2, OUTLINE)
            rect(im, hx + 2, hy - 3, 2, 2, hex_rgba("#FEF08A"))
            rect(im, hx + 2, hy + 1, 2, 2, hex_rgba("#FEF08A"))
        elif mask_type == "fox":
            rect(im, hx - 2, hy - 7, 5, 3, hex_rgba("#F0ABFC"))
            rect(im, hx - 2, hy + 4, 5, 3, hex_rgba("#F0ABFC"))
            rect(im, hx + 5, hy - 2, 6, 4, hex_rgba("#F472B6"))
            rect(im, hx + 9, hy - 1, 2, 2, OUTLINE)
            rect(im, hx + 2, hy - 3, 2, 2, hex_rgba("#FEF08A"))
            rect(im, hx + 2, hy + 1, 2, 2, hex_rgba("#FEF08A"))
        elif mask_type == "rat":
            pixel_ellipse(im, hx - 2, hy - 6, 2.5, 2.5, hex_rgba("#F472B6"), OUTLINE)
            pixel_ellipse(im, hx - 2, hy + 6, 2.5, 2.5, hex_rgba("#F472B6"), OUTLINE)
            rect(im, hx + 5, hy - 2, 5, 4, hex_rgba("#94A3B8"))
            pset(im, hx + 9, hy, hex_rgba("#F472B6"))
        elif mask_type == "raven":
            rect(im, hx + 5, hy - 2, 6, 4, hex_rgba("#FACC15"))
            rect(im, hx + 2, hy - 3, 2, 2, hex_rgba("#EF4444"))
            rect(im, hx + 2, hy + 1, 2, 2, hex_rgba("#EF4444"))
        elif mask_type == "dog":
            rect(im, hx + 2, hy - 4, 4, 8, hex_rgba("#FF1E42"))  # tactical red visor
            rect(im, hx + 3, hy - 3, 2, 6, hex_rgba("#FCA5A5"))
        elif mask_type == "boar":
            rect(im, hx + 5, hy - 5, 5, 2, hex_rgba("#F8FAFC"))  # tusks
            rect(im, hx + 5, hy + 3, 5, 2, hex_rgba("#F8FAFC"))
            rect(im, hx + 2, hy - 2, 3, 4, hex_rgba("#F97316"))
        elif mask_type == "bear":
            pixel_ellipse(im, hx - 3, hy - 7, 2.5, 2.5, hex_rgba("#451A03"), OUTLINE)
            pixel_ellipse(im, hx - 3, hy + 7, 2.5, 2.5, hex_rgba("#451A03"), OUTLINE)
            rect(im, hx + 3, hy - 4, 3, 8, hex_rgba("#38BDF8"))

        out[f"char_{kind}_stand"] = im

        # DOWNED / STUNNED POSE (sprawled top-down body)
        im_down = new_img(32, 32)
        pixel_ellipse(im_down, 16, 16, 13, 8, (6, 3, 14, 95), outline=None)
        outlined_box(im_down, 3, 11, 8, 4, hex_rgba("#1E293B"), OUTLINE)
        outlined_box(im_down, 4, 17, 8, 4, hex_rgba("#1E293B"), OUTLINE)
        outlined_box(im_down, 9, 9, 13, 14, hex_rgba(j_main), OUTLINE, hex_rgba(j_hi), hex_rgba(j_dark), rounded=True)
        outlined_box(im_down, 15, 5, 8, 4, hex_rgba(j_dark), OUTLINE)
        outlined_box(im_down, 14, 23, 8, 4, hex_rgba(j_dark), OUTLINE)
        pixel_ellipse(im_down, 23, 16, 5.5, 5.5, head_base, OUTLINE, head_hi, head_sh)
        out[f"char_{kind}_down"] = im_down

    # Bear ballistic shield FX (32x32)
    im = new_img(32, 32)
    for ang in range(-62, 63, 4):
        r = math.radians(ang)
        sx = int(17 + math.cos(r) * 12)
        sy = int(16 + math.sin(r) * 12)
        rect(im, sx - 1, sy - 1, 3, 3, hex_rgba("#0284C7"))
        pset(im, sx, sy, hex_rgba("#BAE6FD"))
    out["bear_shield_fx"] = im

    return out


# ---------------------------------------------------------------------------
# 5. HOTLINE MIAMI VHS PORTRAITS (48x48)
# ---------------------------------------------------------------------------

def draw_portrait(kind: str) -> Image.Image:
    im = new_img(48, 48)
    # Synthwave dark gradient background + scanlines
    bg_map = {
        "richard": ("#1B082E", "#4C0519", "#FF007F"),
        "rasmus": ("#081B33", "#1E1B4B", "#00F0FF"),
        "tony": ("#2B0615", "#7F1D1D", "#F43F5E"),
        "sprint": ("#240836", "#701A75", "#FACC15"),
        "gbr": ("#090D16", "#1E293B", "#FF1E42"),
    }
    bg_a, bg_b, rim = bg_map[kind]
    for y in range(48):
        t = y / 47.0
        col = blend(hex_rgba(bg_a), hex_rgba(bg_b), t)
        if y % 3 == 0:
            col = blend(col, OUTLINE, 0.25)
        rect(im, 0, y, 48, 1, col)

    # Neon side rim bar
    rect(im, 1, 1, 2, 46, hex_rgba(rim, 180))
    rect(im, 45, 1, 2, 46, hex_rgba("#00F0FF" if kind != "rasmus" else "#FF007F", 150))

    # Shoulders / Jacket bust with varsity collar & shading
    j_cols = {
        "richard": ("#A16207", "#FDE047", "#713F12"),
        "rasmus": ("#312E81", "#818CF8", "#1E1B4B"),
        "tony": ("#9F1239", "#FB7185", "#4C0519"),
        "sprint": ("#86198F", "#F0ABFC", "#4A044E"),
        "gbr": ("#0F172A", "#38BDF8", "#020617"),
    }[kind]
    outlined_box(im, 6, 32, 36, 16, hex_rgba(j_cols[0]), OUTLINE, hex_rgba(j_cols[1]), hex_rgba(j_cols[2]), rounded=True)
    # Lapels & inner dark shirt
    for row in range(13):
        rect(im, 19 + row // 4, 33 + row, 10 - (row // 4) * 2, 1, hex_rgba("#090414"))
    outlined_box(im, 16, 32, 4, 8, hex_rgba(j_cols[1]), OUTLINE)
    outlined_box(im, 28, 32, 4, 8, hex_rgba(j_cols[1]), OUTLINE)
    # Neck shadow
    rect(im, 19, 30, 10, 4, hex_rgba("#1F0B1E"))

    # Head/Mask silhouette
    if kind == "richard":
        # Scalloped rooster comb
        pixel_ellipse(im, 20, 7, 4, 5, hex_rgba("#DC2626"), OUTLINE, hex_rgba("#FCA5A5"))
        pixel_ellipse(im, 25, 5, 4, 5, hex_rgba("#EF4444"), OUTLINE, hex_rgba("#FCA5A5"))
        pixel_ellipse(im, 29, 8, 3, 4, hex_rgba("#B91C1C"), OUTLINE)
        pixel_ellipse(im, 24, 21, 12, 12, hex_rgba("#F1F5F9"), OUTLINE, hex_rgba("#FFFFFF"), hex_rgba("#94A3B8"))
        # Feather cheek tufts
        rect(im, 12, 22, 3, 5, hex_rgba("#CBD5E1"))
        rect(im, 33, 22, 3, 5, hex_rgba("#CBD5E1"))
        # Brow + intense shaded eyes
        rect(im, 15, 16, 6, 2, OUTLINE)
        rect(im, 27, 16, 6, 2, OUTLINE)
        rect(im, 16, 18, 4, 3, OUTLINE)
        rect(im, 28, 18, 4, 3, OUTLINE)
        pset(im, 18, 19, hex_rgba("#00F0FF"))
        pset(im, 30, 19, hex_rgba("#00F0FF"))
        # Pointed beak with upper/lower shading
        outlined_box(im, 19, 21, 10, 4, hex_rgba("#FACC15"), OUTLINE, hex_rgba("#FEF08A"))
        outlined_box(im, 20, 25, 8, 4, hex_rgba("#CA8A04"), OUTLINE)
    elif kind == "rasmus":
        outlined_box(im, 10, 6, 6, 9, hex_rgba("#475569"), OUTLINE, hex_rgba("#CBD5E1"))
        outlined_box(im, 32, 6, 6, 9, hex_rgba("#475569"), OUTLINE, hex_rgba("#CBD5E1"))
        pixel_ellipse(im, 24, 21, 12, 12, hex_rgba("#E2E8F0"), OUTLINE, hex_rgba("#FFFFFF"), hex_rgba("#64748B"))
        # Owl facial disc rings
        pixel_ellipse(im, 18, 19, 5, 5, hex_rgba("#0F172A"), OUTLINE)
        pixel_ellipse(im, 30, 19, 5, 5, hex_rgba("#0F172A"), OUTLINE)
        rect(im, 17, 18, 3, 3, hex_rgba("#00F0FF"))
        rect(im, 29, 18, 3, 3, hex_rgba("#00F0FF"))
        pset(im, 18, 19, hex_rgba("#FFFFFF"))
        pset(im, 30, 19, hex_rgba("#FFFFFF"))
        outlined_box(im, 22, 23, 4, 6, hex_rgba("#F59E0B"), OUTLINE, hex_rgba("#FEF08A"))
    elif kind == "tony":
        outlined_box(im, 11, 5, 6, 10, hex_rgba("#881337"), OUTLINE, hex_rgba("#FB7185"))
        outlined_box(im, 31, 5, 6, 10, hex_rgba("#881337"), OUTLINE, hex_rgba("#FB7185"))
        pixel_ellipse(im, 24, 21, 12, 12, hex_rgba("#E11D48"), OUTLINE, hex_rgba("#FB7185"), hex_rgba("#881337"))
        # Fur brow & fierce slanted eyes
        rect(im, 15, 16, 6, 2, OUTLINE)
        rect(im, 27, 16, 6, 2, OUTLINE)
        rect(im, 16, 18, 5, 3, hex_rgba("#FEF08A"))
        rect(im, 27, 18, 5, 3, hex_rgba("#FEF08A"))
        # Snout + fangs
        outlined_box(im, 18, 24, 12, 7, hex_rgba("#881337"), OUTLINE, hex_rgba("#BE123C"))
        rect(im, 22, 24, 4, 2, OUTLINE)
        rect(im, 19, 27, 2, 3, hex_rgba("#FFFFFF"))
        rect(im, 27, 27, 2, 3, hex_rgba("#FFFFFF"))
    elif kind == "sprint":
        outlined_box(im, 9, 4, 7, 11, hex_rgba("#F0ABFC"), OUTLINE, hex_rgba("#FFFFFF"))
        outlined_box(im, 32, 4, 7, 11, hex_rgba("#F0ABFC"), OUTLINE, hex_rgba("#FFFFFF"))
        pixel_ellipse(im, 24, 21, 11, 12, hex_rgba("#EC4899"), OUTLINE, hex_rgba("#F472B6"), hex_rgba("#9D174D"))
        # White fox cheek fur
        rect(im, 14, 24, 5, 5, hex_rgba("#FCE7F3"))
        rect(im, 29, 24, 5, 5, hex_rgba("#FCE7F3"))
        rect(im, 16, 18, 5, 3, hex_rgba("#FEF08A"))
        rect(im, 27, 18, 5, 3, hex_rgba("#FEF08A"))
        outlined_box(im, 21, 24, 6, 6, hex_rgba("#FDF2F8"), OUTLINE)
        rect(im, 22, 27, 4, 2, OUTLINE)
    else:  # gbr tactical helmet
        pixel_ellipse(im, 24, 19, 13, 12, hex_rgba("#1E293B"), OUTLINE, hex_rgba("#64748B"), hex_rgba("#090D16"))
        outlined_box(im, 13, 14, 22, 9, hex_rgba("#7F1D1D"), OUTLINE, hex_rgba("#FF1E42"))
        rect(im, 15, 16, 18, 3, hex_rgba("#FCA5A5"))
        outlined_box(im, 17, 24, 14, 8, hex_rgba("#0F172A"), OUTLINE, hex_rgba("#334155"))
        rect(im, 20, 27, 8, 2, hex_rgba("#475569"))

    # Subtle frame border
    outlined_box(im, 0, 0, 48, 48, (0, 0, 0, 0), OUTLINE)
    return im


def build_portraits() -> Dict[str, Image.Image]:
    return {k: draw_portrait(k.replace("portrait_", "")) for k in (
        "portrait_richard",
        "portrait_rasmus",
        "portrait_tony",
        "portrait_sprint",
        "portrait_gbr",
    )}


# ---------------------------------------------------------------------------
# PACKING & MANIFEST GENERATION
# ---------------------------------------------------------------------------

def pack_sprites(sprites: Dict[str, Image.Image]) -> Tuple[Image.Image, Dict[str, dict]]:
    pad = 1
    # Sort descending by height then width for tight shelf packing
    items = sorted(sprites.items(), key=lambda kv: (-kv[1].height, -kv[1].width, kv[0]))
    max_w = 512

    x = pad
    y = pad
    shelf_h = 0
    placements: Dict[str, Tuple[int, int, Image.Image]] = {}

    for name, im in items:
        if x + im.width + pad > max_w:
            x = pad
            y += shelf_h + pad
            shelf_h = 0
        placements[name] = (x, y, im)
        x += im.width + pad
        if im.height > shelf_h:
            shelf_h = im.height

    total_h = y + shelf_h + pad
    atlas = new_img(max_w, total_h)
    manifest: Dict[str, dict] = {}
    for name, (px, py, im) in placements.items():
        atlas.paste(im, (px, py))
        manifest[name] = {
            "x": px,
            "y": py,
            "w": im.width,
            "h": im.height,
            "tilesW": round(im.width / TILE, 2),
            "tilesH": round(im.height / TILE, 2),
        }
    return atlas, manifest


def main() -> None:
    sprites: Dict[str, Image.Image] = {}
    sprites.update(build_floors())
    sprites.update(build_exterior_props())
    sprites.update(build_interior_props())
    sprites.update(build_characters())
    sprites.update(build_portraits())

    atlas, manifest = pack_sprites(sprites)
    OUT_WEBP.parent.mkdir(parents=True, exist_ok=True)
    atlas.save(OUT_WEBP, format="WEBP", lossless=True, method=6)

    OUT_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    ts_body = [
        "// Auto-generated by scripts/build-hotline-atlas.py. Do not edit by hand.",
        "export interface AtlasSpriteRect {",
        "  x: number;",
        "  y: number;",
        "  w: number;",
        "  h: number;",
        "  tilesW: number;",
        "  tilesH: number;",
        "}",
        "",
        f"export const ATLAS_WIDTH = {atlas.width};",
        f"export const ATLAS_HEIGHT = {atlas.height};",
        f"export const ATLAS_TILE_TEXELS = {TILE};",
        "export const ATLAS_URL = '/static/hotline-kumir/atlas.webp';",
        "",
        "export const ATLAS_SPRITES: Record<string, AtlasSpriteRect> = " + json.dumps(manifest, indent=2) + ";",
        "",
    ]
    OUT_MANIFEST.write_text("\n".join(ts_body), encoding="utf-8")

    size_kb = OUT_WEBP.stat().st_size / 1024.0
    print(f"Generated {OUT_WEBP} ({atlas.width}x{atlas.height}, {len(manifest)} sprites, {size_kb:.2f} KB)")


if __name__ == "__main__":
    main()
