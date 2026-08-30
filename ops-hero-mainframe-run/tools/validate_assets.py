#!/usr/bin/env python3
"""PHASE 3 -- independently verify public/assets against config/asset-contract.json.

Deliberately does NOT import the processing code paths: it re-derives everything from the PNGs on
disk so a bug in the processor cannot mask itself. Exits 1 on any ERROR.

Usage:  npm run assets:validate
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

import numpy as np
from PIL import Image

from pipeline import PATHS, load_contract, load_sources
from pipeline.chroma import chroma_candidate_mask, parse_hex_color
from pipeline.paths import write_json
from pipeline.report import Report, sha256_file
from pipeline.sheets import is_placeholder

TILE_SEAM_DIFF_THRESHOLD = 0.40


def check_alpha_hard(report: Report, name: str, image: Image.Image) -> None:
    alpha = np.array(image.convert("RGBA"))[:, :, 3]
    soft = int(((alpha > 0) & (alpha < 255)).sum())
    if soft:
        report.error("alpha_hard_edges", name, f"{soft} semi-transparent pixels; hard edges required",
                     expected="0", actual=str(soft))
    else:
        report.ok("alpha_hard_edges", name)


def check_chroma(report: Report, name: str, image: Image.Image, key: tuple[int, int, int],
                 tolerance: int, allowed: set[str]) -> None:
    array = np.array(image.convert("RGBA"))
    opaque = array[:, :, 3] > 0
    residue = int((opaque & chroma_candidate_mask(array[:, :, :3], key, tolerance).astype(bool)).sum())
    if residue and name not in allowed:
        report.error("chroma_residue", name,
                     f"{residue} opaque pixels within tolerance of the chroma key",
                     expected="0", actual=str(residue))
    elif residue:
        report.ok("chroma_residue", name, actual=f"{residue} pixels (allowed: artwork mint)")
    else:
        report.ok("chroma_residue", name)


def check_dimensions(report: Report, name: str, image: Image.Image, spec: dict[str, Any]) -> bool:
    if spec.get("size_mode") == "exact_width_max_height":
        want_w, max_h = int(spec["width"]), int(spec["max_height"])
        if image.width != want_w or image.height > max_h:
            report.error("dimensions", name, "background layer must be exactly the logical width and "
                                             "no taller than the play viewport",
                         expected=f"{want_w}x<={max_h}", actual=f"{image.width}x{image.height}")
            return False
        report.ok("dimensions", name, expected=f"{want_w}x<={max_h}",
                  actual=f"{image.width}x{image.height}")
        return True

    if spec.get("size_mode") == "max":
        max_w, max_h = int(spec["max_width"]), int(spec["max_height"])
        if image.width > max_w or image.height > max_h:
            report.error("dimensions", name, "exceeds the contracted maximum",
                         expected=f"<={max_w}x{max_h}", actual=f"{image.width}x{image.height}")
            return False
        report.ok("dimensions", name, expected=f"<={max_w}x{max_h}",
                  actual=f"{image.width}x{image.height}")
        return True

    want = (int(spec["width"]), int(spec["height"]))
    if image.size != want:
        report.error("dimensions", name, "dimension mismatch",
                     expected=f"{want[0]}x{want[1]}", actual=f"{image.width}x{image.height}")
        return False
    report.ok("dimensions", name, expected=f"{want[0]}x{want[1]}", actual=f"{want[0]}x{want[1]}")
    return True


def check_frames(report: Report, name: str, image: Image.Image, spec: dict[str, Any]) -> None:
    if spec.get("kind") != "spritesheet":
        return
    fw, fh = int(spec["frame_width"]), int(spec["frame_height"])
    want = int(spec["frame_count"])
    if image.height != fh or image.width % fw != 0:
        report.error("frame_count", name, "sheet is not an exact multiple of the frame size",
                     expected=f"{want} x {fw}x{fh}", actual=f"{image.width}x{image.height}")
        return
    found = image.width // fw
    if found != want:
        report.error("frame_count", name, "frame count mismatch",
                     expected=str(want), actual=str(found))
    else:
        report.ok("frame_count", name, expected=str(want), actual=str(found))


def check_aura_centre(report: Report, image: Image.Image, rect: list[int]) -> None:
    """Every aura frame's centre must be fully transparent so the protagonist stays visible."""
    x, y, w, h = rect
    frames = image.width // 64
    offenders = []
    for index in range(frames):
        patch = image.crop((index * 64 + x, y, index * 64 + x + w, y + h))
        if np.array(patch.convert("RGBA"))[:, :, 3].any():
            offenders.append(index)
    if offenders:
        report.error("aura_center_empty", "invincibility-aura.png",
                     f"frames {offenders} have opaque pixels in the reserved centre {rect}")
    else:
        report.ok("aura_center_empty", "invincibility-aura.png", actual=f"{frames} frames clear")


def check_tile_seam(report: Report, image: Image.Image) -> None:
    """stone_left|stone_center and stone_center|stone_right must join without an obvious seam."""
    def column(tile_index: int, x_in_tile: int) -> np.ndarray:
        return np.array(image.convert("RGBA"))[:, tile_index * 16 + x_in_tile, :3].astype(np.int16)

    pairs = [("stone_left|stone_center", column(1, 15), column(2, 0)),
             ("stone_center|stone_right", column(2, 15), column(3, 0)),
             ("stone_center|stone_center", column(2, 15), column(2, 0))]
    for label, a, b in pairs:
        differing = float((np.abs(a - b).max(axis=1) > 48).mean())
        if differing > TILE_SEAM_DIFF_THRESHOLD:
            report.warn("tile_seam", f"gameplay-tiles.png:{label}",
                        f"{differing:.0%} of edge pixels differ; check horizontal repetition",
                        expected=f"<={TILE_SEAM_DIFF_THRESHOLD:.0%}", actual=f"{differing:.0%}")
        else:
            report.ok("tile_seam", f"gameplay-tiles.png:{label}", actual=f"{differing:.0%}")


def main() -> int:
    contract = load_contract()
    key = parse_hex_color(contract["chroma_color"])
    tolerance = int(contract["chroma_tolerance"])
    allowed = set(contract.get("chroma_allowed", []))
    report = Report("tools/validate_assets.py")

    tracks: set[str] = set()
    for spec in contract["outputs"]:
        name = str(spec["file"])
        path = PATHS.public_assets / name
        if not path.exists():
            report.error("file_present", name, "contracted asset is missing from public/assets/")
            continue
        report.ok("file_present", name)
        with Image.open(path) as opened:
            image = opened.convert("RGBA")
            tracks.add("placeholder" if is_placeholder(path) else "production")

        if not check_dimensions(report, name, image, spec):
            continue
        check_frames(report, name, image, spec)
        check_alpha_hard(report, name, image)
        check_chroma(report, name, image, key, tolerance, allowed)
        if name == "invincibility-aura.png":
            check_aura_centre(report, image, list(contract["aura_center_rect"]))
        if name == "gameplay-tiles.png":
            check_tile_seam(report, image)

    # Sources must be byte-identical to what the last pipeline run recorded.
    digest_path = PATHS.reports / "source-digests.json"
    if digest_path.exists():
        import json
        recorded: dict[str, str] = json.loads(digest_path.read_text())
        for filename, digest in recorded.items():
            source = PATHS.sources_dir / filename
            if not source.exists():
                report.warn("source_unmodified", filename, "recorded source is no longer present")
            elif sha256_file(source) != digest:
                report.error("source_unmodified", filename,
                             "source board changed since the last run; re-run assets:process")
            else:
                report.ok("source_unmodified", filename)
    else:
        present = [
            str(m["file"]) for m in load_sources()["sources"].values()
            if (PATHS.sources_dir / str(m["file"])).exists()
        ]
        report.skipped("source_unmodified", "assets-source",
                       f"no digest baseline yet ({len(present)} source boards present)")

    track = "mixed" if len(tracks) > 1 else (tracks.pop() if tracks else "empty")
    report.extra["track"] = track
    write_json(PATHS.reports / "validation-report.json", report.to_dict())
    report.print_summary()
    print(f"\nAsset track: {track.upper()}")
    if track != "production":
        print("NOTE: the definition of done requires track == production (real processed boards).")
    return 1 if report.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
