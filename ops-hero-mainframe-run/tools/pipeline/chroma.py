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
