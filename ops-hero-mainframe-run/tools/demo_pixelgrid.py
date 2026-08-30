#!/usr/bin/env python3
"""Measure how much sprite fidelity each downscaling strategy preserves.

Builds a known 32x48 sprite, renders it the way an image model does (non-integer upscale, soft
edges, slight colour drift), then tries to recover the original three ways and scores each against
ground truth.

This is the experiment that decides whether the board-to-spritesheet workflow is viable at all.

Usage:  python3 tools/demo_pixelgrid.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from pipeline import PATHS
from pipeline.pixelgrid import detect_period, detect_pixel_grid, resample_by_period

NATIVE_W, NATIVE_H = 32, 48


def ground_truth() -> Image.Image:
    """A 32x48 sprite with the exact details most at risk: a badge, eyes, thin limbs."""
    img = Image.new("RGBA", (NATIVE_W, NATIVE_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([11, 6, 21, 17], fill=(232, 186, 148, 255))       # head
    d.rectangle([11, 4, 21, 8], fill=(72, 54, 44, 255))           # hair
    d.point([(14, 11), (18, 11)], fill=(20, 20, 30, 255))         # eyes: 1px each
    d.rectangle([10, 18, 22, 33], fill=(58, 104, 176, 255))       # torso
    d.rectangle([18, 24, 20, 27], fill=(245, 245, 250, 255))      # ID badge: 3x4px
    d.rectangle([12, 34, 16, 44], fill=(40, 44, 80, 255))         # legs
    d.rectangle([17, 34, 21, 44], fill=(40, 44, 80, 255))
    d.rectangle([11, 44, 17, 47], fill=(96, 62, 38, 255))         # shoes
    d.rectangle([16, 44, 22, 47], fill=(96, 62, 38, 255))
    d.rectangle([7, 20, 10, 28], fill=(232, 186, 148, 255))       # arms: 3px wide
    d.rectangle([22, 20, 25, 28], fill=(232, 186, 148, 255))
    return img


def render_like_an_image_model(sprite: Image.Image, scale: float, seed: int = 7) -> Image.Image:
    """Approximate what an image model emits: non-integer scale, soft edges, colour drift."""
    big = sprite.resize((int(NATIVE_W * scale), int(NATIVE_H * scale)), Image.Resampling.BICUBIC)
    big = big.filter(ImageFilter.GaussianBlur(radius=0.6))
    array = np.array(big).astype(np.int16)
    rng = np.random.RandomState(seed)
    array[:, :, :3] += rng.randint(-6, 7, array[:, :, :3].shape)
    return Image.fromarray(np.clip(array, 0, 255).astype(np.uint8), mode="RGBA")


def fidelity(recovered: Image.Image, truth: Image.Image) -> tuple[float, float]:
    """Returns (percent of pixels close to truth, mean absolute colour error)."""
    a = np.array(recovered.convert("RGBA").resize((NATIVE_W, NATIVE_H), Image.Resampling.NEAREST)).astype(np.int16)
    b = np.array(truth.convert("RGBA")).astype(np.int16)
    delta = np.abs(a - b).max(axis=2)
    return float((delta <= 24).mean() * 100.0), float(np.abs(a - b).mean())


def badge_survived(recovered: Image.Image) -> bool:
    """The ID badge is the single most fragile identity detail. Did any of it survive?"""
    a = np.array(recovered.convert("RGBA").resize((NATIVE_W, NATIVE_H), Image.Resampling.NEAREST))
    patch = a[23:29, 17:22, :3].astype(np.int16)
    return bool((patch.min(axis=2) > 200).any())


def main() -> int:
    truth = ground_truth()
    results: list[tuple[str, float, float, float, str, str]] = []

    for scale in (2.0, 3.72, 5.15):
        board = render_like_an_image_model(truth, scale)
        grid = detect_pixel_grid(board)
        px, cx = detect_period(board, axis=0)
        py, _cy = detect_period(board, axis=1)

        naive = board.resize((NATIVE_W, NATIVE_H), Image.Resampling.NEAREST)
        aware = resample_by_period(board, px, py)

        n_acc, n_err = fidelity(naive, truth)
        a_acc, a_err = fidelity(aware, truth)
        results.append((
            f"{scale:.2f}x", n_acc, a_acc, a_acc - n_acc,
            f"int={grid.scale} conf={grid.confidence:.2f}",
            f"period={px:.2f}x{py:.2f} conf={cx:.2f}",
        ))
        print(f"\nSource rendered at {scale:.2f}x  ({board.width}x{board.height})")
        print(f"  integer-grid detector : scale={grid.scale} confidence={grid.confidence:.2f} "
              f"clean={grid.is_clean}")
        print(f"  fractional period     : {px:.3f} x {py:.3f}")
        print(f"  naive nearest-neighbour : {n_acc:5.1f}% pixels correct, mean error {n_err:5.1f}, "
              f"badge {'SURVIVED' if badge_survived(naive) else 'LOST'}")
        print(f"  grid-aware modal resample: {a_acc:5.1f}% pixels correct, mean error {a_err:5.1f}, "
              f"badge {'SURVIVED' if badge_survived(aware) else 'LOST'}")

        strip = Image.new("RGBA", (NATIVE_W * 3 * 6 + 40, NATIVE_H * 6 + 20), (24, 24, 30, 255))
        for index, (img, _label) in enumerate([(truth, "truth"), (naive, "naive"), (aware, "grid-aware")]):
            zoomed = img.convert("RGBA").resize((NATIVE_W * 6, NATIVE_H * 6), Image.Resampling.NEAREST)
            strip.paste(zoomed, (10 + index * (NATIVE_W * 6 + 10), 10), zoomed)
        PATHS.diagnostics.mkdir(parents=True, exist_ok=True)
        strip.save(PATHS.diagnostics / f"pixelgrid-demo-{scale:.2f}x.png")

    print("\n" + "=" * 78)
    print(f"{'render':>8} {'naive':>9} {'grid-aware':>12} {'gain':>8}   detectors")
    for label, n, a, gain, gi, gf in results:
        print(f"{label:>8} {n:8.1f}% {a:11.1f}% {gain:+7.1f}pp   {gi} | {gf}")
    print("=" * 78)
    print(f"\nSide-by-side comparisons: {PATHS.diagnostics.relative_to(PATHS.root)}/pixelgrid-demo-*.png")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
