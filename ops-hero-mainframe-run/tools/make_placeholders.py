#!/usr/bin/env python3
"""Generate contract-shaped PLACEHOLDER art so the game runs before the real boards arrive.

Every file produced here has exactly the dimensions and frame count that
config/asset-contract.json demands, so dropping in real assets later requires zero source-code
changes. Each PNG carries a `phTrack=placeholder` marker chunk, and validation reports the track.

This is stand-in art, deliberately simple and readable. It is NOT a substitute for the approved
boards and must never be shipped as final art.

Usage:  npm run assets:placeholders
"""

from __future__ import annotations

import math

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from PIL import Image, ImageDraw

from pipeline import PATHS, load_contract
from pipeline.paths import write_json
from pipeline.report import Report
from pipeline.sheets import pack_horizontal, write_png

RGBA = tuple[int, int, int, int]

# Palette deliberately avoids the #7CFFB2 chroma key and its tolerance band.
SKIN: RGBA = (232, 186, 148, 255)
SUIT: RGBA = (58, 104, 176, 255)
SUIT_HI: RGBA = (92, 148, 226, 255)
BADGE: RGBA = (250, 208, 78, 255)
SHOE: RGBA = (40, 44, 62, 255)
STONE: RGBA = (108, 112, 128, 255)
STONE_HI: RGBA = (146, 150, 168, 255)
STONE_LO: RGBA = (68, 72, 88, 255)
PANEL: RGBA = (18, 22, 34, 255)
PANEL_EDGE: RGBA = (76, 140, 116, 255)
GOLD: RGBA = (250, 208, 78, 255)
CYAN: RGBA = (96, 226, 240, 255)
MAGENTA: RGBA = (232, 104, 200, 255)
WHITE: RGBA = (245, 248, 250, 255)
LIME: RGBA = (168, 226, 76, 255)
RED: RGBA = (224, 76, 76, 255)


def blank(w: int, h: int) -> Image.Image:
    return Image.new("RGBA", (w, h), (0, 0, 0, 0))


# ---------------------------------------------------------------- characters

def hero_frame(index: int) -> Image.Image:
    """32x48 operator: head, torso with badge, arms, legs. Feet on the canvas bottom edge."""
    img = blank(32, 48)
    d = ImageDraw.Draw(img)
    airborne = index >= 8
    lift = 3 if airborne else 0
    base = 47 - lift

    d.rectangle([11, 6, 21, 17], fill=SKIN)          # head
    d.rectangle([11, 4, 21, 8], fill=(72, 54, 44, 255))  # hair
    d.rectangle([10, 18, 22, 33], fill=SUIT)         # torso
    d.rectangle([10, 18, 22, 21], fill=SUIT_HI)      # top-left illumination band
    d.rectangle([18, 24, 20, 26], fill=BADGE)        # badge

    run_cycle = [0, 0, 4, 2, 0, -2, -4, -2, 0, 0]
    swing = run_cycle[index % len(run_cycle)]
    if index == 8:      # raised-knee jump
        d.rectangle([12, 34, 16, base - 8], fill=SUIT); d.rectangle([11, base - 10, 17, base - 6], fill=SHOE)
        d.rectangle([17, 34, 21, base - 2], fill=SUIT); d.rectangle([16, base - 4, 22, base], fill=SHOE)
        d.rectangle([6, 18, 10, 24], fill=SKIN)      # raised arm
    elif index == 9:    # compact fall
        d.rectangle([12, 34, 16, base - 4], fill=SUIT); d.rectangle([11, base - 6, 17, base - 2], fill=SHOE)
        d.rectangle([17, 34, 21, base - 4], fill=SUIT); d.rectangle([16, base - 6, 22, base - 2], fill=SHOE)
        d.rectangle([22, 20, 26, 26], fill=SKIN)
    else:
        d.rectangle([12 - swing // 2, 34, 16 - swing // 2, base - 3], fill=SUIT)
        d.rectangle([11 - swing // 2, base - 3, 17 - swing // 2, base], fill=SHOE)
        d.rectangle([17 + swing // 2, 34, 21 + swing // 2, base - 3], fill=SUIT)
        d.rectangle([16 + swing // 2, base - 3, 22 + swing // 2, base], fill=SHOE)
        d.rectangle([7 + swing // 2, 20, 10 + swing // 2, 28], fill=SKIN)
        d.rectangle([22 - swing // 2, 20, 25 - swing // 2, 28], fill=SKIN)
    return img


def robot_frame(index: int, body: RGBA, accent: RGBA, *, flying: bool = False) -> Image.Image:
    """32x32 robot. Frame 3 is always the deactivated pose (SPEC-03 s3.5)."""
    img = blank(32, 32)
    d = ImageDraw.Draw(img)
    dead = index == 3
    fill = (90, 92, 104, 255) if dead else body
    bob = 0 if flying else [0, -1, 0, 1][index]
    top = 8 + bob + (6 if dead else 0)

    d.rectangle([7, top, 24, top + 14], fill=fill)
    d.rectangle([7, top, 24, top + 3], fill=accent if not dead else fill)
    d.rectangle([10, top + 5, 21, top + 10], fill=(16, 20, 30, 255))   # screen interior
    if not dead:
        d.rectangle([12, top + 7, 19, top + 8], fill=accent)
    if flying:
        span = 11 if index % 2 == 0 else 13
        d.rectangle([16 - span, top - 3, 16 + span, top - 1], fill=accent)  # rotors
        d.rectangle([13, top + 15, 19, top + 17], fill=(70, 74, 92, 255))   # thruster
    else:
        stride = [0, 3, -3, 0][index]
        legs = 31 if not dead else 31
        d.rectangle([9 + stride, top + 15, 13 + stride, legs], fill=(70, 74, 92, 255))
        d.rectangle([18 - stride, top + 15, 22 - stride, legs], fill=(70, 74, 92, 255))
    return img


def spool_frame(index: int) -> Image.Image:
    """32x32 tape-spool robot: two visible reels that rotate across the frames."""
    img = blank(32, 32)
    d = ImageDraw.Draw(img)
    dead = index == 3
    body = (90, 92, 104, 255) if dead else (146, 96, 196, 255)
    top = 10 + (5 if dead else 0)
    d.rectangle([5, top, 26, top + 12], fill=body)
    for cx in (11, 20):
        d.ellipse([cx - 4, top + 2, cx + 4, top + 10], fill=(28, 32, 44, 255))
        if not dead:
            angle = index % 3
            d.rectangle([cx - 1 + angle - 1, top + 3, cx + 1 + angle - 1, top + 9], fill=CYAN)
    if not dead:
        d.rectangle([7, top + 13, 11, 31], fill=(70, 74, 92, 255))
        d.rectangle([20, top + 13, 24, 31], fill=(70, 74, 92, 255))
    return img


def token_frame(index: int) -> Image.Image:
    """16x16 command token seen rotating: widths 10, 6, 2, 6 give a seamless spin."""
    img = blank(16, 16)
    d = ImageDraw.Draw(img)
    half = [5, 3, 1, 3][index]
    d.ellipse([8 - half, 3, 7 + half, 12], fill=GOLD)
    if half >= 3:
        d.ellipse([8 - half + 1, 5, 7 + half - 1, 10], fill=(255, 238, 160, 255))
    return img


def pickup_frame(index: int) -> Image.Image:
    """16x16 invincibility pickup pulsing through cyan / magenta / lime / white."""
    img = blank(16, 16)
    d = ImageDraw.Draw(img)
    colour = [CYAN, MAGENTA, LIME, WHITE][index]
    r = 5 + (index % 2)
    d.ellipse([8 - r, 8 - r, 7 + r, 7 + r], fill=GOLD)
    d.ellipse([8 - r + 2, 8 - r + 2, 7 + r - 2, 7 + r - 2], fill=colour)
    return img


# ---------------------------------------------------------------- effects

def aura_frame(index: int) -> Image.Image:
    """64x64 golden ring. The centre 20x20 stays fully transparent (validated)."""
    img = blank(64, 64)
    d = ImageDraw.Draw(img)
    outer = 20 + index * 2
    thickness = 3 + (index % 2)
    alpha_colour = (250, 208, 78, 255) if index % 2 == 0 else (255, 232, 150, 255)
    d.ellipse([32 - outer, 32 - outer, 31 + outer, 31 + outer], outline=alpha_colour, width=thickness)
    inner = 14 + index
    d.ellipse([32 - inner, 32 - inner, 31 + inner, 31 + inner], outline=(255, 244, 200, 255), width=2)
    # Enforce the empty centre so the protagonist stays visible.
    d.rectangle([22, 22, 41, 41], fill=(0, 0, 0, 0))
    return img


def burst_frame(index: int) -> Image.Image:
    img = blank(32, 32)
    d = ImageDraw.Draw(img)
    r = 4 + index * 5
    colour = [WHITE, GOLD, (255, 168, 64, 255), (200, 96, 40, 255)][index]
    d.ellipse([16 - r, 16 - r, 15 + r, 15 + r], outline=colour, width=3)
    for dx, dy in ((0, -1), (0, 1), (-1, 0), (1, 0)):
        d.line([16, 16, 16 + dx * (r + 3), 16 + dy * (r + 3)], fill=colour, width=2)
    return img


SPRITE_CANVAS = 12
"""Contract v3: stars and sparkles use a 12x12 canvas so the source art's thick outline survives."""


def dot(colour: RGBA, radius: int) -> Image.Image:
    """A sparkle particle: a four-point spark, matching the source board's shapes."""
    c = SPRITE_CANVAS // 2
    img = blank(SPRITE_CANVAS, SPRITE_CANVAS)
    d = ImageDraw.Draw(img)
    reach = radius + 2
    d.line([c, c - reach, c, c + reach], fill=colour)
    d.line([c - reach, c, c + reach, c], fill=colour)
    d.ellipse([c - radius, c - radius, c + radius - 1, c + radius - 1], fill=colour)
    return img


def star(colour: RGBA) -> Image.Image:
    """A chunky five-point star with a dark outline, matching the source board."""
    c = SPRITE_CANVAS / 2
    img = blank(SPRITE_CANVAS, SPRITE_CANVAS)
    d = ImageDraw.Draw(img)
    points = []
    for i in range(10):
        angle = -math.pi / 2 + i * math.pi / 5
        r = 5.5 if i % 2 == 0 else 2.4
        points.append((c + r * math.cos(angle), c + r * math.sin(angle)))
    d.polygon(points, fill=colour, outline=(24, 22, 30, 255))
    return img


# ---------------------------------------------------------------- tiles

def stone_tile(kind: str) -> Image.Image:
    """Stone tiles. `center` has no vertical edge detail so it repeats seamlessly."""
    img = Image.new("RGBA", (16, 16), STONE)
    d = ImageDraw.Draw(img)
    d.line([0, 0, 15, 0], fill=STONE_HI)
    d.line([0, 15, 15, 15], fill=STONE_LO)
    d.point([(3, 5), (9, 4), (12, 9), (5, 11)], fill=STONE_LO)
    if kind == "left":
        d.line([0, 0, 0, 15], fill=STONE_HI)
        d.line([1, 1, 1, 15], fill=STONE_LO)
    elif kind == "right":
        d.line([15, 0, 15, 15], fill=STONE_LO)
        d.line([14, 1, 14, 15], fill=STONE_HI)
    elif kind == "under":
        img.paste(Image.new("RGBA", (16, 16), STONE_LO))
        d = ImageDraw.Draw(img)
        d.line([0, 0, 15, 0], fill=STONE)
        d.point([(4, 7), (11, 10)], fill=(52, 56, 70, 255))
    return img


def gameplay_tile(index: int) -> Image.Image:
    if index == 0:  # terminal command block
        img = Image.new("RGBA", (16, 16), (206, 168, 46, 255))
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, 15, 15], outline=(246, 214, 96, 255))
        d.rectangle([3, 5, 12, 10], fill=(60, 44, 12, 255))
        d.line([4, 7, 7, 7], fill=(246, 214, 96, 255))
        return img
    if index in (1, 2, 3, 4):
        return stone_tile({1: "left", 2: "center", 3: "right", 4: "under"}[index])
    if index == 5:  # dark inactive
        img = Image.new("RGBA", (16, 16), (34, 38, 52, 255))
        ImageDraw.Draw(img).rectangle([0, 0, 15, 15], outline=(52, 58, 76, 255))
        return img
    if index == 6:  # warning
        img = Image.new("RGBA", (16, 16), (36, 32, 20, 255))
        d = ImageDraw.Draw(img)
        for i in range(-16, 16, 6):
            d.line([i, 15, i + 15, 0], fill=(226, 176, 40, 255), width=3)
        d.rectangle([0, 0, 15, 15], outline=(80, 64, 20, 255))
        return img
    if index == 7:  # breakable, cracked state
        img = stone_tile("center")
        d = ImageDraw.Draw(img)
        d.line([3, 2, 7, 8], fill=STONE_LO, width=1)
        d.line([7, 8, 5, 14], fill=STONE_LO, width=1)
        d.line([9, 3, 12, 11], fill=STONE_LO, width=1)
        return img
    img = Image.new("RGBA", (16, 16), (22, 30, 44, 255))  # exit terminal
    d = ImageDraw.Draw(img)
    d.rectangle([1, 1, 14, 12], fill=(14, 20, 30, 255), outline=(96, 226, 240, 255))
    d.line([3, 4, 10, 4], fill=CYAN)
    d.line([3, 7, 8, 7], fill=LIME)
    d.rectangle([5, 13, 10, 15], fill=(60, 66, 84, 255))
    return img


ICON_COLOURS: list[RGBA] = [
    (198, 202, 214, 255), (216, 72, 68, 255), (232, 196, 60, 255), (72, 186, 112, 255),
    (86, 208, 226, 255), (74, 118, 214, 255), (208, 88, 190, 255), (44, 48, 62, 255),
]


def operations_tile(index: int) -> Image.Image:
    img = blank(16, 16)
    d = ImageDraw.Draw(img)
    if index < 8:  # metallic symbol icons
        base = ICON_COLOURS[index]
        d.rectangle([1, 1, 14, 14], fill=base, outline=(240, 240, 246, 255))
        d.line([2, 2, 13, 2], fill=(255, 255, 255, 255))
        d.rectangle([5, 5, 10, 10], fill=(255, 255, 255, 200))
        return img
    d.rectangle([0, 10, 15, 15], fill=(64, 150, 96, 255))       # ground
    d.rectangle([0, 0, 15, 9], fill=(110, 186, 226, 255))       # sky
    if index == 8:    # palm
        d.line([8, 10, 8, 4], fill=(120, 84, 44, 255), width=2)
        d.line([8, 4, 3, 2], fill=(58, 158, 92, 255), width=2)
        d.line([8, 4, 13, 2], fill=(58, 158, 92, 255), width=2)
    elif index == 9:  # evergreen
        d.polygon([(8, 2), (3, 10), (13, 10)], fill=(38, 128, 76, 255))
        d.rectangle([7, 10, 9, 13], fill=(120, 84, 44, 255))
    elif index == 10:  # green hills
        d.ellipse([-4, 6, 8, 14], fill=(56, 160, 96, 255))
        d.ellipse([7, 7, 19, 15], fill=(44, 138, 84, 255))
    else:              # snowy mountain
        d.polygon([(8, 1), (1, 12), (15, 12)], fill=(96, 106, 132, 255))
        d.polygon([(8, 1), (5, 6), (11, 6)], fill=(238, 244, 250, 255))
    return img


# ---------------------------------------------------------------- HUD / env / backgrounds

def hud_panel(width: int, height: int, labels: list[tuple[int, int, str]]) -> Image.Image:
    img = Image.new("RGBA", (width, height), PANEL)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, width - 1, height - 1], outline=PANEL_EDGE)
    d.rectangle([1, 1, width - 2, height - 2], outline=(30, 38, 54, 255))
    for x, y, text in labels:
        d.text((x, y), text, fill=(126, 198, 168, 255))
    return img


def env_prop(width: int, height: int, body: RGBA, accent: RGBA, lights: int) -> Image.Image:
    img = blank(width, height)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, width - 1, height - 1], fill=body, outline=accent)
    d.line([1, 1, width - 2, 1], fill=(255, 255, 255, 60))
    for i in range(lights):
        y = 4 + i * max(4, (height - 8) // max(1, lights))
        if y < height - 3:
            d.rectangle([3, y, width - 4, y + 1], fill=accent)
    return img


def background_layer(kind: str, width: int, height: int) -> Image.Image:
    img = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if kind == "sky":
        for y in range(height):
            t = y / max(1, height - 1)
            d.line([0, y, width, y],
                   fill=(int(16 + 34 * t), int(24 + 52 * t), int(56 + 60 * t), 255))
        for x in range(11, width, 67):
            d.point([(x, 12 + (x % 29)), (x + 23, 30 + (x % 17))], fill=(210, 226, 246, 255))
    elif kind == "mountains":
        for i in range(0, width + 120, 120):
            d.polygon([(i - 20, height), (i + 40, height - 96), (i + 100, height)],
                      fill=(52, 62, 92, 255))
            d.polygon([(i + 40, height - 96), (i + 24, height - 68), (i + 56, height - 68)],
                      fill=(196, 210, 232, 255))
        # Dark evergreen forest band. Batch-1 inspection confirmed the real strip uses dark
        # desaturated greens and contains NO mint artwork, so nothing here may approach the chroma key.
        for i in range(0, width + 14, 14):
            d.polygon([(i, height), (i + 7, height - 30), (i + 14, height)], fill=(28, 54, 44, 255))
        d.rectangle([0, height - 6, width, height], fill=(20, 40, 33, 255))
    else:  # datacenter silhouettes
        for i in range(0, width + 60, 60):
            h = 60 + (i % 3) * 22
            d.rectangle([i, height - h, i + 40, height], fill=(20, 26, 40, 255))
            for row in range(4, h - 6, 12):
                d.rectangle([i + 5, height - h + row, i + 34, height - h + row + 3],
                            fill=(46, 92, 118, 255))
    return img


# ---------------------------------------------------------------- driver

def build() -> dict[str, Image.Image]:
    out: dict[str, Image.Image] = {}
    out["hero.png"] = pack_horizontal([hero_frame(i) for i in range(10)], 32, 48)
    out["job-fail-bot.png"] = pack_horizontal(
        [robot_frame(i, (188, 78, 72, 255), RED) for i in range(4)], 32, 32)
    out["alert-bot.png"] = pack_horizontal(
        [robot_frame(i, (206, 148, 52, 255), GOLD) for i in range(4)], 32, 32)
    out["alert-drone.png"] = pack_horizontal(
        [robot_frame(i, (78, 128, 190, 255), CYAN, flying=True) for i in range(4)], 32, 32)
    out["spool-runaway.png"] = pack_horizontal([spool_frame(i) for i in range(4)], 32, 32)
    out["command-token.png"] = pack_horizontal([token_frame(i) for i in range(4)], 16, 16)
    out["invincibility-pickup.png"] = pack_horizontal([pickup_frame(i) for i in range(4)], 16, 16)
    out["invincibility-aura.png"] = pack_horizontal([aura_frame(i) for i in range(7)], 64, 64)
    out["impact-burst.png"] = pack_horizontal([burst_frame(i) for i in range(4)], 32, 32)
    for i, colour in enumerate([GOLD, CYAN, MAGENTA, LIME, WHITE]):
        out[f"star-{i}.png"] = star(colour)
    for i, (colour, radius) in enumerate(
        [(GOLD, 1), (GOLD, 2), (CYAN, 1), (CYAN, 2), (MAGENTA, 1), (MAGENTA, 2), (WHITE, 1), (WHITE, 2)]
    ):
        out[f"sparkle-{i}.png"] = dot(colour, radius)
    out["operations-tiles.png"] = pack_horizontal([operations_tile(i) for i in range(12)], 16, 16)
    out["gameplay-tiles.png"] = pack_horizontal([gameplay_tile(i) for i in range(9)], 16, 16)

    out["hud-top.png"] = hud_panel(480, 30, [
        (4, 2, "OPS HERO"), (56, 2, "SCORE"), (140, 2, "JOBS"), (196, 2, "ALERTS"),
        (248, 2, "COINS"), (4, 17, "PF KEYS"), (196, 17, "SYS STATUS"), (392, 10, "POWER"),
    ])
    out["hud-viewdata.png"] = hud_panel(196, 56, [(4, 2, "VIEWDATA 3270")])
    out["hud-minimap.png"] = hud_panel(124, 56, [(4, 2, "MAP")])
    # Full-width bottom strip, matching the section layout observed on the real HUD board.
    out["hud-bottom.png"] = hud_panel(480, 56, [
        (4, 2, "CURRENT MISSION"), (128, 2, "OBJECTIVE"), (244, 2, "ITEM"),
        (288, 2, "AUTOMATION"), (392, 2, "POWER"),
    ])

    env_specs: list[tuple[str, int, int, RGBA, RGBA, int]] = [
        ("rack", 28, 56, (44, 50, 68, 255), CYAN, 6),
        ("tape-drive", 34, 44, (56, 60, 78, 255), GOLD, 3),
        ("cabinet", 30, 48, (40, 46, 62, 255), (150, 158, 178, 255), 2),
        ("terminal-monitor", 26, 22, (52, 58, 76, 255), LIME, 1),
        ("keyboard", 28, 8, (60, 66, 84, 255), (150, 158, 178, 255), 1),
        ("desk", 46, 20, (86, 64, 44, 255), (128, 98, 66, 255), 1),
        ("chair", 20, 26, (48, 52, 68, 255), (96, 102, 122, 255), 1),
        ("warning-beacon", 12, 20, (60, 40, 30, 255), RED, 2),
        ("wall-monitor", 36, 20, (34, 40, 56, 255), CYAN, 2),
        ("freestanding-monitor", 24, 30, (44, 50, 68, 255), MAGENTA, 2),
        ("cable-module", 24, 16, (38, 42, 56, 255), (168, 120, 60, 255), 3),
        ("machinery-module", 40, 34, (58, 62, 80, 255), (150, 158, 178, 255), 4),
        ("vent-grille", 26, 26, (46, 52, 68, 255), (110, 118, 138, 255), 5),
        # Contract v2: the environment board supplies 17 props, not 13.
        ("rack-wide", 48, 58, (42, 48, 66, 255), LIME, 8),
        ("tape-drive-dials", 34, 46, (54, 58, 76, 255), CYAN, 2),
        ("cabinet-double", 40, 50, (38, 44, 60, 255), (150, 158, 178, 255), 2),
        ("warning-beacon-tall", 14, 32, (58, 38, 28, 255), RED, 3),
    ]
    for name, w, h, body, accent, lights in env_specs:
        out[f"env-{name}.png"] = env_prop(w, h, body, accent, lights)

    # Heights reflect the real ~1:2 downscale: a 945px-wide strip maps to 480 wide and stays
    # SHORTER than the 184px play viewport. Layers are anchored, never upscaled to fill.
    out["bg-far-sky.png"] = background_layer("sky", 480, 96)
    out["bg-mid-mountains.png"] = background_layer("mountains", 480, 96)
    out["bg-near-datacenter.png"] = background_layer("datacenter", 480, 112)
    return out


def main() -> int:
    contract = load_contract()
    PATHS.ensure_output_dirs()
    report = Report("tools/make_placeholders.py")
    images = build()

    expected = {o["file"]: o for o in contract["outputs"]}
    for filename in sorted(expected):
        image = images.get(filename)
        if image is None:
            report.error("file_present", filename, "placeholder generator produced no image")
            continue
        write_png(image, PATHS.public_assets / filename, placeholder=True)
        report.ok("emitted", filename, actual=f"{image.width}x{image.height}")
    for filename in sorted(set(images) - set(expected)):
        report.warn("uncontracted", filename, "generated but not present in asset-contract.json")

    write_json(PATHS.reports / "placeholder-report.json", report.to_dict())
    report.print_summary()
    print(f"\nPlaceholder assets written to {PATHS.public_assets.relative_to(PATHS.root)}")
    print("These are STAND-INS. Run `npm run assets:process` once the real boards are in assets/source/.")
    return 1 if report.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
