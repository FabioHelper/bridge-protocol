#!/usr/bin/env python3
"""PHASE 1 -- inspect the source boards. Read-only: never writes to public/assets.

Reports dimensions, chroma coverage and detected region counts for every board, and draws a
bounding-box overlay per board so a human can review the automatic crops before processing.

Usage:  npm run assets:inspect
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from PIL import Image

from pipeline import PATHS, load_contract, load_crops, load_sources
from pipeline.chroma import parse_hex_color, remove_edge_connected_chroma
from pipeline.paths import write_json
from pipeline.regions import apply_overrides, detect_regions, find_ambiguous_overlaps
from pipeline.report import Report, sha256_file
from pipeline.sheets import diagnostic_overlay


def main() -> int:
    contract = load_contract()
    crops = load_crops()
    sources = load_sources()["sources"]
    key = parse_hex_color(contract["chroma_color"])
    tolerance = int(contract["chroma_tolerance"])

    PATHS.ensure_output_dirs()
    report = Report("tools/inspect_sources.py")
    boards: dict[str, object] = {}
    digests: dict[str, str] = {}

    missing = [
        name for name, meta in sources.items()
        if not (PATHS.sources_dir / str(meta["file"])).exists()
    ]
    if missing:
        for name in missing:
            report.error("file_present", name, f"missing {sources[name]['file']} in assets/source/")
        print("\nMISSING SOURCE BOARDS -- drop the approved PNGs into assets/source/ first:")
        for name in missing:
            print(f"  - {sources[name]['file']}  ({name})")
        report.print_summary()
        write_json(PATHS.reports / "inspection-report.json", report.to_dict())
        return 1

    defaults = crops.get("defaults", {})
    for name, meta in sources.items():
        path = PATHS.sources_dir / str(meta["file"])
        digests[str(meta["file"])] = sha256_file(path)
        with Image.open(path) as opened:
            board = opened.convert("RGBA")

        entry: dict[str, object] = {
            "file": str(meta["file"]),
            "width": board.width,
            "height": board.height,
            "reference_only": bool(meta.get("reference_only", False)),
        }

        if meta.get("reference_only"):
            report.skipped("region_detect", name, "reference board: never cropped into game art")
            boards[name] = entry
            continue

        chroma = remove_edge_connected_chroma(board, key, tolerance)
        entry["chroma_removed_fraction"] = round(chroma.removed_fraction, 4)
        entry["interior_chroma_retained_fraction"] = round(chroma.interior_retained_fraction, 4)

        if chroma.removed_fraction < 0.01:
            report.warn(
                "chroma_coverage", name,
                "almost no edge-connected chroma found; is this board keyed with #7CFFB2?",
                expected=">1%", actual=f"{chroma.removed_fraction:.2%}",
            )
        if name != "BACKGROUNDS_SOURCE" and chroma.interior_chroma_retained_fraction > 0.02:
            report.warn(
                "interior_chroma", name,
                "significant mint retained inside artwork; verify no asset is chroma-coloured",
                actual=f"{chroma.interior_chroma_retained_fraction:.2%}",
            )

        board_cfg = crops.get(name, {})
        min_area = int(board_cfg.get("min_area", defaults.get("min_area", 64)))
        merge_gap = int(board_cfg.get("merge_gap", defaults.get("merge_gap", 4)))
        regions = apply_overrides(
            detect_regions(chroma.image, min_area, merge_gap), board_cfg.get("overrides", {})
        )
        entry["min_area"] = min_area
        entry["merge_gap"] = merge_gap
        entry["region_count"] = len(regions)
        entry["regions"] = [r.to_dict() for r in regions]

        expected = meta.get("expected_regions") or board_cfg.get("expected_regions")
        if expected is not None and len(regions) != int(expected):
            report.error(
                "region_count", name,
                "detected region count differs from the expected count; add overrides in config/crops.json",
                expected=str(expected), actual=str(len(regions)),
            )
        else:
            report.ok("region_count", name, actual=str(len(regions)))

        for a, b, ratio in find_ambiguous_overlaps(regions):
            report.warn("ambiguous_overlap", f"{name}:{a}~{b}",
                        f"bounding boxes overlap by {ratio:.0%} of the smaller region")

        overlay_path = PATHS.diagnostics / f"{name}-regions.png"
        diagnostic_overlay(board, list(regions)).save(overlay_path)
        entry["diagnostic"] = str(overlay_path.relative_to(PATHS.root))
        boards[name] = entry

    report.extra["boards"] = boards
    write_json(PATHS.reports / "inspection-report.json", report.to_dict())
    write_json(PATHS.reports / "source-digests.json", digests)
    report.print_summary()
    print(f"\nDiagnostics: {PATHS.diagnostics.relative_to(PATHS.root)}/<BOARD>-regions.png")
    return 1 if report.failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
