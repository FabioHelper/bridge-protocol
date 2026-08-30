"""Per-board processors: turn a keyed source board into contracted production assets.

Each processor is deterministic and reports honestly. When automatic grouping has to guess, it
emits a WARN naming the assumption and the config key a human should fill in to freeze it.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

import numpy as np
from PIL import Image

from .chroma import defringe
from .normalize import AlignMode, normalize_frame, snap_rect_to_integer_ratio
from .regions import Region
from .report import Report

REDUNDANT_SKIP_NOTE = "skipped as a documented redundant variant"


@dataclass
class BoardContext:
    """Everything a processor needs, so processors stay free of global state."""

    name: str
    board: Image.Image           # chroma-keyed RGBA board
    regions: list[Region]
    config: dict[str, Any]       # this board's entry from config/crops.json
    contract_by_file: dict[str, dict[str, Any]]
    report: Report
    emit: Callable[[str, Image.Image, list[Image.Image]], None]
    """emit(filename, packed_image, frames) -- writes the PNG and its contact sheet."""
    chroma_key: tuple[int, int, int] = (124, 255, 178)
    defringe_tolerance: int = 48
    defringe_passes: int = 2


def crop(board: Image.Image, region: Region) -> Image.Image:
    return board.crop((region.x, region.y, region.x + region.w, region.y + region.h))


def crop_for_target(ctx: "BoardContext", region: Region, target_w: int, target_h: int) -> Image.Image:
    """Crop a region, first snapping the rect so the downscale ratio is an exact integer.

    Measured in tools/demo_pixelgrid.py: an exact integer ratio recovers 100% of the source pixels,
    while a ratio off by ~0.35 drops to 90-95%. Snapping only moves the crop window -- it never
    invents or redraws a pixel.
    """
    rect, factor = snap_rect_to_integer_ratio(
        region.rect, target_w, target_h, ctx.board.width, ctx.board.height
    )
    if factor is None:
        ctx.report.warn(
            "crop_snap", f"{ctx.name}:{region.id}",
            f"no exact integer downscale to {target_w}x{target_h} within tolerance "
            f"(region is {region.w}x{region.h}); expect minor detail loss. Adjust the crop override "
            f"so the region is a whole multiple of the target.",
        )
    elif rect != region.rect:
        ctx.report.ok("crop_snap", f"{ctx.name}:{region.id}",
                      expected=f"{target_w * factor}x{target_h * factor}", actual=f"exact 1:{factor}")
    cropped = ctx.board.crop((rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3]))
    # Peel the anti-aliased mint halo now that the region is isolated. Boundary pixels only, so
    # green ARTWORK inside the sprite (a robot's screen) is never touched. Done here rather than
    # on the whole board because changing board alpha before detection shifts the region count.
    cleaned, _peeled = defringe(cropped, ctx.chroma_key, ctx.defringe_tolerance, ctx.defringe_passes)
    return cleaned


def crops_for(ctx: "BoardContext", filename: str, regions: list[Region]) -> list[Image.Image]:
    """Crop every region for an output, snapped to that output's native frame size."""
    spec = ctx.contract_by_file[filename]
    frame_w = int(spec.get("frame_width", spec.get("width", 16)))
    frame_h = int(spec.get("frame_height", spec.get("height", 16)))
    return [crop_for_target(ctx, region, frame_w, frame_h) for region in regions]


def regions_by_id(regions: list[Region]) -> dict[str, Region]:
    return {r.id: r for r in regions}


def normalize_all(
    ctx: BoardContext, images: list[Image.Image], w: int, h: int, align: AlignMode, label: str
) -> list[Image.Image]:
    frames: list[Image.Image] = []
    for index, image in enumerate(images):
        result = normalize_frame(image, w, h, align, label=f"{label}[{index}]")
        for warning in result.warnings:
            ctx.report.warn("normalize", f"{label}[{index}]", warning)
        frames.append(result.image)
    return frames


def auto_assign(
    ctx: BoardContext, order: list[tuple[str, int]], group_key: str = "groups"
) -> dict[str, list[Region]]:
    """Assign regions to outputs, preferring explicit config over reading-order consumption.

    `order` is [(output_filename, region_count), ...] in the board's documented layout order.
    """
    by_id = regions_by_id(ctx.regions)
    configured: dict[str, list[str]] = ctx.config.get(group_key, {}) or {}
    assigned: dict[str, list[Region]] = {}

    explicit_total = sum(len(v) for v in configured.values() if v)
    if explicit_total == 0:
        # No manual grouping yet: consume regions in reading order and say so loudly.
        needed = sum(count for _, count in order)
        if len(ctx.regions) != needed:
            ctx.report.error(
                "group_assignment", ctx.name,
                f"cannot auto-assign: fill in config/crops.json -> {ctx.name}.{group_key}",
                expected=f"{needed} regions", actual=f"{len(ctx.regions)} regions",
            )
            return {}
        ctx.report.warn(
            "group_assignment", ctx.name,
            f"no manual grouping configured; consumed {needed} regions in reading order. "
            f"Review the diagnostics and freeze the result into config/crops.json -> {ctx.name}.{group_key}",
        )
        cursor = 0
        for filename, count in order:
            assigned[filename] = ctx.regions[cursor : cursor + count]
            cursor += count
        return assigned

    for filename, count in order:
        ids = configured.get(filename) or []
        if len(ids) != count:
            ctx.report.error(
                "group_assignment", f"{ctx.name}:{filename}",
                f"config/crops.json -> {ctx.name}.{group_key}['{filename}'] must list exactly {count} region ids",
                expected=str(count), actual=str(len(ids)),
            )
            continue
        missing = [i for i in ids if i not in by_id]
        if missing:
            ctx.report.error("group_assignment", f"{ctx.name}:{filename}",
                             f"unknown region ids {missing}")
            continue
        assigned[filename] = [by_id[i] for i in ids]

    used = {r.id for group in assigned.values() for r in group}
    for region in ctx.regions:
        if region.id not in used:
            ctx.report.skipped("region_unused", f"{ctx.name}:{region.id}",
                               f"{REDUNDANT_SKIP_NOTE} (bbox {region.rect})")
    return assigned


def emit_sheet(
    ctx: BoardContext, filename: str, sources: list[Image.Image], align: AlignMode
) -> None:
    """Normalize, pack and emit a spritesheet or single image per the contract."""
    from .sheets import pack_horizontal  # local import keeps module import graph shallow

    spec = ctx.contract_by_file[filename]
    fw = int(spec.get("frame_width", spec.get("width", 16)))
    fh = int(spec.get("frame_height", spec.get("height", 16)))
    frames = normalize_all(ctx, sources, fw, fh, align, filename)
    packed = pack_horizontal(frames, fw, fh) if len(frames) > 1 else frames[0]
    ctx.emit(filename, packed, frames)


# --------------------------------------------------------------------------------------
# Protagonist
# --------------------------------------------------------------------------------------

def leg_split(image: Image.Image) -> int:
    """Count alpha runs across the bottom 25% of the sprite.

    2+ runs means the legs are apart (a striding/running pose); 1 run means feet together
    (a standing pose). This is the metric that distinguishes idle poses from run poses without
    relying on fragile fixed source indices (SPEC-01 s1.8).
    """
    alpha = np.array(image.convert("RGBA"))[:, :, 3]
    if alpha.shape[0] < 4:
        return 1
    band = alpha[int(alpha.shape[0] * 0.75) :, :]
    column_has_pixels = (band > 0).any(axis=0).astype(np.int8)
    runs = int(((column_has_pixels[1:] == 1) & (column_has_pixels[:-1] == 0)).sum())
    return runs + int(column_has_pixels[0] == 1) if column_has_pixels.size else 0


def select_protagonist(ctx: BoardContext) -> list[Region] | None:
    """Pick 10 of 12 poses, dropping the two redundant standing poses."""
    explicit: list[str] = ctx.config.get("selection") or []
    by_id = regions_by_id(ctx.regions)
    if explicit:
        if len(explicit) != 10:
            ctx.report.error("protagonist_selection", ctx.name,
                             "crops.json selection must list exactly 10 region ids in final frame order",
                             expected="10", actual=str(len(explicit)))
            return None
        unknown = [i for i in explicit if i not in by_id]
        if unknown:
            ctx.report.error("protagonist_selection", ctx.name, f"unknown region ids {unknown}")
            return None
        for region in ctx.regions:
            if region.id not in explicit:
                ctx.report.skipped("region_unused", f"{ctx.name}:{region.id}",
                                   f"redundant standing pose (bbox {region.rect})")
        return [by_id[i] for i in explicit]

    if len(ctx.regions) != 12:
        ctx.report.error("protagonist_selection", ctx.name,
                         "expected 12 poses; set config/crops.json -> PROTAGONIST_SOURCE.selection",
                         expected="12", actual=str(len(ctx.regions)))
        return None

    # Reading order gives us 6 top-row then 6 bottom-row regions.
    top, bottom = ctx.regions[:6], ctx.regions[6:]
    standing = [r for r in top if leg_split(crop(ctx.board, r)) <= 1]
    striding = [r for r in top if r not in standing]

    if len(standing) < 2:
        ctx.report.error("protagonist_selection", ctx.name,
                         "leg-split heuristic found fewer than 2 standing poses in the top row; "
                         "set PROTAGONIST_SOURCE.selection manually")
        return None
    standing_sorted = sorted(standing, key=lambda r: crop(ctx.board, r).getchannel("A").histogram()[-1],
                             reverse=True)
    idle = sorted(standing_sorted[:2], key=lambda r: r.x)
    dropped = standing_sorted[2:]
    run_top = (striding + [r for r in standing_sorted[2:]])[:4]
    run_top = sorted(run_top, key=lambda r: r.x)

    if len(run_top) < 4:
        ctx.report.error("protagonist_selection", ctx.name,
                         "could not find 4 top-row running poses; set the selection manually")
        return None

    ctx.report.warn(
        "protagonist_selection", ctx.name,
        "selection derived from the leg-split heuristic. Review "
        "build/asset-diagnostics/hero.png-contact.png and freeze the ids into "
        "config/crops.json -> PROTAGONIST_SOURCE.selection",
    )
    for region in dropped:
        ctx.report.skipped("region_unused", f"{ctx.name}:{region.id}",
                           f"redundant standing pose (bbox {region.rect})")

    # Bottom row layout per the handoff: opposite-foot phases, then jump, then compact fall at far right.
    selection = [idle[0], idle[1], *run_top, bottom[0], bottom[1], bottom[2], bottom[-1]]
    return selection[:10]
