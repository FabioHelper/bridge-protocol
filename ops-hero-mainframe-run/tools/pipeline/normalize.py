"""Frame normalization and alignment.

THIS MODULE OWNS THE ONLY RESIZE CALL IN THE PIPELINE. No other module may call .resize().
Nearest-neighbour only -- bilinear, bicubic, Lanczos, area and antialias are forbidden
(SPEC-01 s1.1 rule 3).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

import numpy as np
from PIL import Image

from .chroma import harden_alpha

AlignMode = Literal["foot-baseline", "airborne", "center", "tile", "none"]

AIRBORNE_LIFT_PX = 3
"""Airborne frames sit this many pixels above the grounded baseline, identically for every
airborne frame, so jump and fall never jitter relative to each other."""


def nearest_resize(image: Image.Image, width: int, height: int) -> Image.Image:
    """The one and only resize entry point. Nearest-neighbour, always."""
    if width <= 0 or height <= 0:
        raise ValueError(f"invalid resize target {width}x{height}")
    return image.resize((width, height), Image.Resampling.NEAREST)


def alpha_bbox(image: Image.Image) -> tuple[int, int, int, int] | None:
    """Tight bounding box of non-transparent pixels, or None if fully transparent."""
    alpha = np.array(image.convert("RGBA"))[:, :, 3]
    rows = np.where(alpha.any(axis=1))[0]
    cols = np.where(alpha.any(axis=0))[0]
    if rows.size == 0 or cols.size == 0:
        return None
    return (int(cols[0]), int(rows[0]), int(cols[-1] - cols[0] + 1), int(rows[-1] - rows[0] + 1))


def trim_to_content(image: Image.Image) -> Image.Image:
    box = alpha_bbox(image)
    if box is None:
        return image
    x, y, w, h = box
    return image.crop((x, y, x + w, y + h))


@dataclass(frozen=True)
class NormalizeResult:
    image: Image.Image
    scale_numerator: int
    scale_denominator: int
    upscaled: bool
    warnings: list[str]


def normalize_frame(
    source: Image.Image,
    target_w: int,
    target_h: int,
    align: AlignMode,
    *,
    label: str = "",
) -> NormalizeResult:
    """Scale a cropped region down to fit the target canvas and place it per the alignment rule."""
    warnings: list[str] = []
    content = trim_to_content(source.convert("RGBA"))
    if content.width == 0 or content.height == 0:
        return NormalizeResult(
            Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0)), 1, 1, False, [f"{label}: empty region"]
        )

    if align == "tile":
        # Tiles must fill the whole cell; a wildly non-square source is suspicious.
        aspect = content.width / content.height
        if not 0.9 <= aspect <= 1.11:
            warnings.append(f"{label}: tile source aspect {aspect:.2f} is not square within 10%")
        scaled = nearest_resize(content, target_w, target_h)
        canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
        canvas.paste(scaled, (0, 0))
        return NormalizeResult(harden_alpha(canvas), target_w, content.width, False, warnings)

    # Preserve aspect. Never upscale beyond 1:1 to fill the canvas -- pad instead.
    ratio = min(target_w / content.width, target_h / content.height)
    upscaled = ratio > 1.0
    if upscaled:
        ratio = 1.0
        warnings.append(
            f"{label}: source ({content.width}x{content.height}) is smaller than the "
            f"{target_w}x{target_h} target; padded at 1:1 instead of upscaling"
        )
    new_w = max(1, int(content.width * ratio))
    new_h = max(1, int(content.height * ratio))
    scaled = nearest_resize(content, new_w, new_h) if (new_w, new_h) != content.size else content

    canvas = Image.new("RGBA", (target_w, target_h), (0, 0, 0, 0))
    # floor everywhere, never round: alignment must be reproducible and never off-by-one.
    x = (target_w - new_w) // 2
    if align == "foot-baseline":
        y = target_h - new_h
    elif align == "airborne":
        y = target_h - new_h - AIRBORNE_LIFT_PX
    elif align == "center":
        y = (target_h - new_h) // 2
    else:  # "none"
        x, y = 0, 0
    canvas.paste(scaled, (x, max(0, y)))
    return NormalizeResult(harden_alpha(canvas), new_w, content.width, upscaled, warnings)
