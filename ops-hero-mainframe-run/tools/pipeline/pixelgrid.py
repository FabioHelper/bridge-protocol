"""Detect the TRUE pixel size of AI-generated 'pixel art'.

THE PROBLEM THIS SOLVES
-----------------------
An image model does not emit pixel art. It emits a high-resolution *rendering* of pixel art: a
1024px-wide board whose apparent blocks are, say, 3.7 screen pixels across, with soft edges and
colour drift inside each block.

Downscaling that with plain nearest-neighbour to a 32x48 native frame samples one arbitrary screen
pixel per output pixel. Sample points drift across block boundaries, so edges break up, thin details
(an ID badge, an eye) vanish, and the result reads as mush -- even though every rule about
"nearest-neighbour only" was obeyed.

WHAT THE MEASUREMENTS ACTUALLY SHOWED  (tools/demo_pixelgrid.py, reproducible)
-----------------------------------------------------------------------------
The feared catastrophe did not appear, and the obvious fix made things worse:

  * On simulated soft/noisy AI renders, plain nearest-neighbour recovered 86-95% of pixels and the
    ID badge survived every time. A "resample on the detected fractional period" strategy scored
    4-10 percentage points WORSE, so it was removed rather than shipped.
  * On CLEAN integer-scaled art -- which is what sharp pixel-art boards are -- an exact-ratio crop
    is 100% lossless. Crops off by a few pixels degrade gracefully: 90-100%.

Conclusion: the downscale filter was never the risk. CROP PRECISION is. That is why this module is
a DIAGNOSTIC only, and why the actual fix lives in normalize.snap_rect_to_integer_ratio.

Method: collect horizontal and vertical runs of constant colour, then score each candidate S by the
fraction of runs whose length is a multiple of S. The largest S that scores above the threshold is
the source's pixel size. S=1 trivially scores 1.0, so larger candidates are preferred.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from PIL import Image

MAX_CANDIDATE_SCALE = 16
MIN_RUN_LENGTH = 2
MAX_RUN_LENGTH = 64
CONFIDENCE_THRESHOLD = 0.80


@dataclass(frozen=True)
class PixelGrid:
    """Detected source pixel size and how strongly the evidence supports it."""

    scale: int
    confidence: float
    horizontal_scale: int
    vertical_scale: int
    run_sample_size: int

    @property
    def is_clean(self) -> bool:
        """True when the art sits on a consistent integer grid we can downscale losslessly."""
        return self.scale > 1 and self.confidence >= CONFIDENCE_THRESHOLD

    @property
    def axes_agree(self) -> bool:
        return self.horizontal_scale == self.vertical_scale


def _runs_along_axis(rgb: np.ndarray, tolerance: int = 6) -> list[int]:
    """Lengths of consecutive near-identical colour runs along each row."""
    runs: list[int] = []
    height, width = rgb.shape[:2]
    # Sample rows rather than all of them: the estimate is stable and this stays fast on big boards.
    step = max(1, height // 160)
    for y in range(0, height, step):
        row = rgb[y].astype(np.int16)
        changed = np.abs(np.diff(row, axis=0)).max(axis=1) > tolerance
        boundaries = np.flatnonzero(changed)
        if boundaries.size < 2:
            continue
        lengths = np.diff(boundaries)
        runs.extend(int(v) for v in lengths if MIN_RUN_LENGTH <= v <= MAX_RUN_LENGTH)
    return runs


def _best_scale(runs: list[int]) -> tuple[int, float]:
    """Largest S where most run lengths are multiples of S."""
    if len(runs) < 20:
        return 1, 0.0
    array = np.asarray(runs)
    best_scale, best_confidence = 1, 1.0
    for candidate in range(2, MAX_CANDIDATE_SCALE + 1):
        share = float(np.mean(array % candidate == 0))
        if share >= CONFIDENCE_THRESHOLD:
            best_scale, best_confidence = candidate, share
    return best_scale, best_confidence


def detect_pixel_grid(image: Image.Image) -> PixelGrid:
    """Detect the source artwork's own pixel size along both axes."""
    rgb = np.array(image.convert("RGB"))
    horizontal_runs = _runs_along_axis(rgb)
    vertical_runs = _runs_along_axis(np.transpose(rgb, (1, 0, 2)))

    h_scale, h_confidence = _best_scale(horizontal_runs)
    v_scale, v_confidence = _best_scale(vertical_runs)

    # Both axes must agree before we trust a grid; a mismatch means the art is not on a clean grid.
    if h_scale == v_scale:
        scale, confidence = h_scale, min(h_confidence, v_confidence)
    else:
        scale, confidence = min(h_scale, v_scale), 0.0

    return PixelGrid(
        scale=scale,
        confidence=confidence,
        horizontal_scale=h_scale,
        vertical_scale=v_scale,
        run_sample_size=len(horizontal_runs) + len(vertical_runs),
    )


def snap_to_grid(image: Image.Image, grid: PixelGrid) -> Image.Image:
    """Collapse the source to its own pixel grid: one output pixel per source block.

    Uses the MODAL colour of each block, not a corner sample, so anti-aliased block edges and
    colour drift inside a block cannot decide the output pixel.
    """
    if not grid.is_clean:
        return image
    rgba = image.convert("RGBA")
    array = np.array(rgba)
    scale = grid.scale
    height = array.shape[0] // scale
    width = array.shape[1] // scale
    if height < 1 or width < 1:
        return image

    cropped = array[: height * scale, : width * scale]
    blocks = cropped.reshape(height, scale, width, scale, 4).transpose(0, 2, 1, 3, 4)
    flat = blocks.reshape(height, width, scale * scale, 4)

    # Modal colour per block, computed on a packed uint32 key so it is one pass.
    packed = (
        flat[..., 0].astype(np.uint32) << 24
        | flat[..., 1].astype(np.uint32) << 16
        | flat[..., 2].astype(np.uint32) << 8
        | flat[..., 3].astype(np.uint32)
    )
    out = np.zeros((height, width, 4), dtype=np.uint8)
    for y in range(height):
        for x in range(width):
            values, counts = np.unique(packed[y, x], return_counts=True)
            winner = int(values[int(np.argmax(counts))])
            out[y, x] = (
                (winner >> 24) & 0xFF,
                (winner >> 16) & 0xFF,
                (winner >> 8) & 0xFF,
                winner & 0xFF,
            )
    return Image.fromarray(out, mode="RGBA")
