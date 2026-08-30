"""Connected-region detection on the alpha channel, in stable reading order.

Ambiguity is reported, never silently resolved (SPEC-01 s1.4).
"""

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any

import cv2
import numpy as np
from PIL import Image


@dataclass(frozen=True)
class Region:
    id: str
    x: int
    y: int
    w: int
    h: int
    area: int
    source: str  # "auto" or "override"

    @property
    def rect(self) -> tuple[int, int, int, int]:
        return (self.x, self.y, self.w, self.h)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


def _boxes_overlap_or_near(a: Region, b: Region, gap: int) -> bool:
    return not (
        a.x > b.x + b.w + gap
        or b.x > a.x + a.w + gap
        or a.y > b.y + b.h + gap
        or b.y > a.y + a.h + gap
    )


def _merge(a: Region, b: Region) -> Region:
    x0, y0 = min(a.x, b.x), min(a.y, b.y)
    x1, y1 = max(a.x + a.w, b.x + b.w), max(a.y + a.h, b.y + b.h)
    return Region("", x0, y0, x1 - x0, y1 - y0, a.area + b.area, "auto")


def detect_regions(image: Image.Image, min_area: int, merge_gap: int) -> list[Region]:
    """Detect asset regions and return them in reading order (rows top-to-bottom, then L-to-R)."""
    alpha = np.array(image.convert("RGBA"))[:, :, 3]
    mask = (alpha > 0).astype(np.uint8)
    # Close 1px gaps in the MASK only. Output pixels are never altered by this.
    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

    count, _labels, stats, _centroids = cv2.connectedComponentsWithStats(mask, connectivity=8)
    raw: list[Region] = []
    for index in range(1, count):
        x, y, w, h, area = (int(stats[index, k]) for k in range(5))
        if area < min_area:
            continue
        raw.append(Region("", x, y, w, h, area, "auto"))

    merged = _merge_pass(raw, merge_gap)
    return _assign_reading_order(merged)


def _merge_pass(regions: list[Region], gap: int) -> list[Region]:
    """Reattach detached parts (an antenna, a raised hand) to their parent bounding box."""
    result = list(regions)
    changed = True
    while changed:
        changed = False
        for i in range(len(result)):
            for j in range(i + 1, len(result)):
                if _boxes_overlap_or_near(result[i], result[j], gap):
                    combined = _merge(result[i], result[j])
                    result = [r for k, r in enumerate(result) if k not in (i, j)] + [combined]
                    changed = True
                    break
            if changed:
                break
    return result


def _assign_reading_order(regions: list[Region]) -> list[Region]:
    if not regions:
        return []
    heights = sorted(r.h for r in regions)
    median_h = heights[len(heights) // 2]
    row_threshold = max(4, int(0.5 * median_h))

    by_y = sorted(regions, key=lambda r: (r.y + r.h / 2))
    rows: list[list[Region]] = [[by_y[0]]]
    for region in by_y[1:]:
        current_row = rows[-1]
        row_centre = sum(r.y + r.h / 2 for r in current_row) / len(current_row)
        if abs((region.y + region.h / 2) - row_centre) <= row_threshold:
            current_row.append(region)
        else:
            rows.append([region])

    ordered: list[Region] = []
    index = 0
    for row in rows:
        for region in sorted(row, key=lambda r: r.x):
            ordered.append(
                Region(f"r{index}", region.x, region.y, region.w, region.h, region.area, region.source)
            )
            index += 1
    return ordered


def apply_overrides(regions: list[Region], overrides: dict[str, Any]) -> list[Region]:
    """Manual JSON overrides replace the detected rect for a region id."""
    if not overrides:
        return regions
    result: list[Region] = []
    for region in regions:
        override = overrides.get(region.id)
        if isinstance(override, dict):
            result.append(
                Region(
                    region.id,
                    int(override["x"]),
                    int(override["y"]),
                    int(override["w"]),
                    int(override["h"]),
                    region.area,
                    "override",
                )
            )
        else:
            result.append(region)
    return result


def find_ambiguous_overlaps(regions: list[Region], threshold: float = 0.15) -> list[tuple[str, str, float]]:
    """Report region pairs whose boxes overlap significantly -- a human must disambiguate."""
    findings: list[tuple[str, str, float]] = []
    for i, a in enumerate(regions):
        for b in regions[i + 1 :]:
            ox = max(0, min(a.x + a.w, b.x + b.w) - max(a.x, b.x))
            oy = max(0, min(a.y + a.h, b.y + b.h) - max(a.y, b.y))
            if ox <= 0 or oy <= 0:
                continue
            smaller = min(a.w * a.h, b.w * b.h)
            ratio = (ox * oy) / float(smaller) if smaller else 0.0
            if ratio > threshold:
                findings.append((a.id, b.id, round(ratio, 3)))
    return findings
