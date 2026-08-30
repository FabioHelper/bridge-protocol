#!/usr/bin/env python3
"""Self-test: run the REAL processing pipeline against SYNTHETIC source boards.

Purpose: prove that chroma removal, region detection, reading order, selection, normalization,
alignment and packing all work end-to-end, without needing the approved artwork. The synthetic
boards mimic the documented layout of each real board (mint chroma background, correct region
counts, larger-than-native working scale).

This does NOT validate artistic correctness -- only pipeline mechanics.

Usage:  python3 tools/selftest_pipeline.py
"""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageDraw

MINT = (124, 255, 178, 255)
TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent


def board(width: int, height: int) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGBA", (width, height), MINT)
    return image, ImageDraw.Draw(image)


def blob(d: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, colour: tuple[int, int, int, int],
         *, legs: int = 0) -> None:
    d.rectangle([x, y, x + w, y + h], fill=colour)
    if legs == 1:
        d.rectangle([x + w // 2 - 6, y + h, x + w // 2 + 6, y + h + 30], fill=colour)
    elif legs == 2:
        d.rectangle([x + 4, y + h, x + 20, y + h + 30], fill=colour)
        d.rectangle([x + w - 20, y + h, x + w - 4, y + h + 30], fill=colour)


def grid_board(rows: list[int], cell: int, colour: tuple[int, int, int, int],
               gap: int = 40) -> Image.Image:
    """One row per list entry; entry value is the number of regions in that row."""
    cols = max(rows)
    image, d = board(gap + cols * (cell + gap), gap + len(rows) * (cell + gap))
    for r, count in enumerate(rows):
        for c in range(count):
            x = gap + c * (cell + gap)
            y = gap + r * (cell + gap)
            d.ellipse([x, y, x + cell, y + cell], fill=colour)
            d.rectangle([x + cell // 4, y + cell // 4, x + 3 * cell // 4, y + 3 * cell // 4],
                        fill=(255, 255, 255, 255))
    return image


def make_sources(target: Path) -> None:
    target.mkdir(parents=True, exist_ok=True)

    for name in ("01_gameplay_reference.png", "02_vista_reference.png"):
        ref, d = board(320, 180)
        d.rectangle([10, 10, 310, 170], fill=(18, 22, 34, 255))
        ref.save(target / name)

    # PROTAGONIST: 12 poses, 2 rows of 6. Top row: 2 feet-together (idle) then 4 striding.
    hero, d = board(40 + 6 * 140, 40 + 2 * 220)
    for row in range(2):
        for col in range(6):
            x = 40 + col * 140
            y = 40 + row * 220
            feet_together = row == 0 and col < 2
            blob(d, x, y, 70, 110, (58, 104, 176, 255), legs=1 if feet_together else 2)
            d.ellipse([x + 18, y - 34, x + 52, y], fill=(232, 186, 148, 255))
    hero.save(target / "03_protagonist_source.png")

    grid_board([6, 6], 96, (198, 130, 60, 255)).save(target / "04_icons_source.png")

    # ENEMIES: 6 rows of 4 so reading order matches the documented group layout.
    enemies, d = board(40 + 4 * 140, 40 + 6 * 180)
    for row in range(6):
        for col in range(4):
            x, y = 40 + col * 140, 40 + row * 180
            blob(d, x, y, 96, 96, (188 - row * 18, 78 + row * 20, 120, 255), legs=2 if row < 4 else 0)
    enemies.save(target / "05_enemies_items_source.png")

    # EFFECTS: rows of 7 aura, 5 stars, 8 sparkles, 4 impact bursts.
    effects, d = board(40 + 8 * 130, 40 + 4 * 180)
    for row, count in enumerate((7, 5, 8, 4)):
        for col in range(count):
            x, y = 40 + col * 130, 40 + row * 180
            if row == 0:
                d.ellipse([x, y, x + 110, y + 110], outline=(250, 208, 78, 255), width=10)
            else:
                d.ellipse([x + 20, y + 20, x + 80, y + 80], fill=(96, 226, 240, 255))
    effects.save(target / "06_effects_source.png")

    # HUD BLOCKS: 9 small square tiles, then 4 large panels.
    hud, d = board(40 + 9 * 140, 40 + 130 + 40 + 4 * 200)
    for col in range(9):
        x = 40 + col * 140
        d.rectangle([x, 40, x + 110, 150], fill=(108, 112, 128, 255))
    for row in range(4):
        y = 220 + row * 200
        d.rectangle([40, y, 40 + 1100, y + 150], fill=(18, 22, 34, 255))
    hud.save(target / "07_hud_blocks_source.png")

    grid_board([6, 6, 5], 110, (60, 90, 140, 255)).save(target / "08_environment_source.png")

    # BACKGROUNDS: 3 wide horizontal strips.
    bgs, d = board(1000, 40 + 3 * 240)
    for row, colour in enumerate([(40, 60, 110, 255), (52, 62, 92, 255), (20, 26, 40, 255)]):
        y = 40 + row * 240
        d.rectangle([40, y, 960, y + 200], fill=colour)
    bgs.save(target / "09_backgrounds_source.png")


def main() -> int:
    workspace = Path(tempfile.mkdtemp(prefix="opshero-selftest-"))
    try:
        sources = workspace / "sources"
        make_sources(sources)
        env = dict(os.environ)
        env.update({
            "OPSHERO_SOURCES_DIR": str(sources),
            "OPSHERO_PUBLIC_DIR": str(workspace / "assets"),
            "OPSHERO_DIAGNOSTICS_DIR": str(workspace / "diagnostics"),
            "OPSHERO_REPORTS_DIR": str(workspace / "reports"),
        })

        print("=== inspect_sources.py against synthetic boards ===")
        inspect = subprocess.run([sys.executable, str(TOOLS / "inspect_sources.py")],
                                 env=env, capture_output=True, text=True)
        print(inspect.stdout[-1500:] or inspect.stderr[-1500:])

        print("=== process_assets.py against synthetic boards ===")
        process = subprocess.run([sys.executable, str(TOOLS / "process_assets.py")],
                                 env=env, capture_output=True, text=True)
        print(process.stdout[-3000:] or process.stderr[-3000:])

        print("=== validate_assets.py against the synthetic output ===")
        validate = subprocess.run([sys.executable, str(TOOLS / "validate_assets.py")],
                                  env=env, capture_output=True, text=True)
        print(validate.stdout[-3000:] or validate.stderr[-3000:])

        produced = sorted(p.name for p in (workspace / "assets").glob("*.png"))
        print(f"\nSELF-TEST produced {len(produced)} assets from synthetic boards.")
        # The pipeline must at minimum produce a correctly shaped hero sheet and enemy sheets.
        critical = ["hero.png", "job-fail-bot.png", "alert-drone.png", "invincibility-aura.png",
                    "operations-tiles.png", "gameplay-tiles.png", "bg-far-sky.png"]
        failures: list[str] = []
        missing = [c for c in critical if c not in produced]
        if missing:
            failures.append(f"missing critical outputs {missing}")
        with Image.open(workspace / "assets" / "hero.png") as hero:
            if hero.size != (320, 48):
                failures.append(f"hero.png is {hero.size}, expected (320, 48)")
        if validate.returncode != 0:
            failures.append("validate_assets.py reported errors against the synthetic output "
                            "(see the validation section above)")
        if failures:
            print("SELF-TEST FAILED:")
            for item in failures:
                print(f"  - {item}")
            return 1
        print("SELF-TEST PASSED: chroma keying, region detection, reading order, selection, "
              "normalization, alignment, packing and validation all verified end-to-end "
              "against synthetic boards.")
        return 0
    finally:
        shutil.rmtree(workspace, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
