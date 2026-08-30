"""Chroma keying: remove ONLY the #7CFFB2 background regions connected to a board boundary.

The rule that matters (SPEC-01 s1.3): mint pixels that belong to the artwork -- the green
foothills in BACKGROUNDS_SOURCE, a mint LED inside a robot -- must survive untouched. A global
"delete every mint pixel" pass would destroy them, so connectivity decides, never colour alone.
"""

from __future__ import annotations

from dataclasses import dataclass

import cv2
import numpy as np
from PIL import Image

ALPHA_HARD_THRESHOLD = 128


def parse_hex_color(value: str) -> tuple[int, int, int]:
    text = value.lstrip("#")
    return (int(text[0:2], 16), int(text[2:4], 16), int(text[4:6], 16))


@dataclass(frozen=True)
class ChromaResult:
    image: Image.Image
    removed_fraction: float
    interior_retained_fraction: float
    background_component_count: int


def chroma_candidate_mask(
    rgb: np.ndarray, key: tuple[int, int, int], tolerance: int
) -> np.ndarray:
    """Per-channel tolerance around the key colour. Returns uint8 mask (0 or 1)."""
    diff = np.abs(rgb.astype(np.int16) - np.array(key, dtype=np.int16))
    return (diff.max(axis=2) <= tolerance).astype(np.uint8)


def remove_edge_connected_chroma(
    image: Image.Image, key: tuple[int, int, int], tolerance: int, policy: str = "edge-connected"
) -> ChromaResult:
    """Alpha-out chroma components that touch the board boundary; keep all interior ones.

    policy="edge-and-enclosed" additionally clears chroma fully enclosed by artwork. This is
    REQUIRED for hollow shapes such as the seven aura rings: the mint inside a ring touches no
    board edge, so the default policy would leave it as opaque mint and the aura's centre would
    never be transparent. Opting in is audited -- the caller sees how much interior was removed.
    Never enable it for a board whose artwork legitimately uses the key colour.
    """
    rgba = image.convert("RGBA")
    array = np.array(rgba)
    rgb = array[:, :, :3]
    height, width = rgb.shape[:2]

    candidate = chroma_candidate_mask(rgb, key, tolerance)
    total_candidate = int(candidate.sum())
    if total_candidate == 0:
        return ChromaResult(rgba, 0.0, 0.0, 0)

    count, labels, _stats, _centroids = cv2.connectedComponentsWithStats(candidate, connectivity=4)

    # A component is background iff it touches any board edge.
    edge_labels = set()
    for band in (labels[0, :], labels[height - 1, :], labels[:, 0], labels[:, width - 1]):
        edge_labels.update(int(v) for v in np.unique(band))
    edge_labels.discard(0)

    background = np.isin(labels, list(edge_labels)) if edge_labels else np.zeros_like(candidate, bool)
    if policy == "edge-and-enclosed":
        background = candidate.astype(bool)
    elif policy != "edge-connected":
        raise ValueError(f"unknown chroma policy: {policy!r}")

    out = array.copy()
    out[background, 3] = 0
    out[:, :, 3] = np.where(out[:, :, 3] >= ALPHA_HARD_THRESHOLD, 255, 0).astype(np.uint8)

    removed = int(background.sum())
    retained = total_candidate - removed
    return ChromaResult(
        image=Image.fromarray(out, mode="RGBA"),
        removed_fraction=removed / float(height * width),
        interior_retained_fraction=retained / float(height * width),
        background_component_count=max(0, count - 1 - (count - 1 - len(edge_labels))),
    )


def harden_alpha(image: Image.Image) -> Image.Image:
    """Re-threshold alpha so no semi-transparent pixel ever reaches production output."""
    array = np.array(image.convert("RGBA"))
    array[:, :, 3] = np.where(array[:, :, 3] >= ALPHA_HARD_THRESHOLD, 255, 0).astype(np.uint8)
    # Zero out colour under fully transparent pixels so PNGs compress identically every run.
    transparent = array[:, :, 3] == 0
    array[transparent, 0:3] = 0
    return Image.fromarray(array, mode="RGBA")


def residual_chroma_pixels(
    image: Image.Image, key: tuple[int, int, int], tolerance: int
) -> int:
    """Count opaque pixels still within tolerance of the chroma key (validation check)."""
    array = np.array(image.convert("RGBA"))
    opaque = array[:, :, 3] > 0
    candidate = chroma_candidate_mask(array[:, :, :3], key, tolerance).astype(bool)
    return int((opaque & candidate).sum())


def estimate_chroma_key(
    image: Image.Image, nominal: tuple[int, int, int], floor: int = 18, ceiling: int = 60
) -> tuple[tuple[int, int, int], int]:
    """Measure a board's ACTUAL background colour and the tolerance needed to catch all of it.

    Why this is necessary: a board re-encoded as lossy WebP no longer has a flat #7CFFB2 field.
    Measured on the real protagonist board, border pixels deviate from the nominal key by a median
    of 15 and a maximum of 44 -- so a fixed tolerance of 18 caught only 37% of the background and
    left a connected mesh of stray pixels that welded all 12 poses into a single region.

    Method: take the outer border, find the modal colour there (robust to panels that legitimately
    reach the edge, as on the HUD board), then size the tolerance from the spread of border pixels
    that belong to that mode. Falls back to the nominal key when the border is not dominated by a
    single colour.
    """
    array = np.array(image.convert("RGB"))
    band = max(1, min(3, array.shape[0] // 8, array.shape[1] // 8))
    border = np.concatenate([
        array[:band].reshape(-1, 3),
        array[-band:].reshape(-1, 3),
        array[:, :band].reshape(-1, 3),
        array[:, -band:].reshape(-1, 3),
    ]).astype(np.int16)
    if border.size == 0:
        return nominal, floor

    # Modal colour of the border, found on a coarse 16-level-per-channel grid.
    quantised = (border // 16).astype(np.int32)
    keys = quantised[:, 0] * 4096 + quantised[:, 1] * 64 + quantised[:, 2]
    values, counts = np.unique(keys, return_counts=True)
    dominant = int(values[int(np.argmax(counts))])
    share = float(counts.max() / counts.sum())
    if share < 0.25:
        # Border is not dominated by any one colour: trust the nominal key rather than guess.
        return nominal, floor

    member = keys == dominant
    measured = tuple(int(v) for v in np.median(border[member], axis=0))
    spread = np.abs(border[member] - np.array(measured)).max(axis=1)
    tolerance = int(np.clip(np.percentile(spread, 98) + 8, floor, ceiling))

    # Only adopt the measured colour if it really is the intended key; otherwise keep the nominal
    # one and just widen the tolerance to cover the drift.
    if max(abs(measured[i] - nominal[i]) for i in range(3)) > ceiling:
        return nominal, floor
    drift = max(abs(measured[i] - nominal[i]) for i in range(3))
    return (measured[0], measured[1], measured[2]), int(np.clip(tolerance + drift, floor, ceiling))


def defringe(
    image: Image.Image, key: tuple[int, int, int], tolerance: int, passes: int = 2
) -> tuple[Image.Image, int]:
    """Strip the chroma halo left around a keyed sprite's edges.

    Anti-aliasing (and lossy WebP) blends sprite colour with the mint field, producing a rim of
    part-green pixels that the flat key test misses. Those rims are clearly visible as green
    outlines on every extracted sprite.

    Only pixels ON THE BOUNDARY -- opaque and touching transparency -- are considered, so genuinely
    green ARTWORK in a sprite's interior (a robot's green screen, the forest strip) is never
    touched. Each pass peels one pixel of rim.
    """
    array = np.array(image.convert("RGBA"))
    key_arr = np.array(key, dtype=np.int16)
    removed = 0
    for _ in range(passes):
        alpha = array[:, :, 3]
        opaque = alpha > 0
        # A boundary pixel is opaque with at least one transparent 4-neighbour.
        transparent = (~opaque).astype(np.uint8)
        neighbours = cv2.dilate(transparent, np.ones((3, 3), np.uint8), iterations=1)
        boundary = opaque & (neighbours > 0)
        if not boundary.any():
            break
        # How much does the pixel lean toward the key relative to its own saturation?
        distance = np.abs(array[:, :, :3].astype(np.int16) - key_arr).max(axis=2)
        fringe = boundary & (distance <= tolerance)
        count = int(fringe.sum())
        if count == 0:
            break
        array[fringe, 3] = 0
        array[fringe, 0:3] = 0
        removed += count
    return Image.fromarray(array, mode="RGBA"), removed
