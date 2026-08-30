#!/usr/bin/env python3
"""PHASE 2/3 -- process the nine source boards into production assets.

Deterministic: identical inputs produce byte-identical output. Never modifies assets/source/.
Never redraws or invents artwork -- every output pixel comes from a source pixel via crop,
nearest-neighbour scale, translate, alpha mask, or a documented sampled HUD fill.

Usage:  npm run assets:process
"""

from __future__ import annotations

import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))

from PIL import Image

from pipeline import PATHS, load_contract, load_crops, load_sources
from pipeline.boards import (
    BoardContext, auto_assign, crop, crops_for, emit_sheet, normalize_all, select_protagonist,
)
from pipeline.chroma import (
    defringe, estimate_chroma_key, parse_hex_color, remove_edge_connected_chroma,
)
from pipeline.normalize import nearest_resize, trim_to_content
from pipeline.paths import write_json
from pipeline.regions import apply_overrides, detect_regions, find_ambiguous_overlaps
from pipeline.report import Report, sha256_file
from pipeline.sheets import contact_sheet, diagnostic_overlay, pack_horizontal, write_png

ENEMY_LAYOUT = [
    ("job-fail-bot.png", 4), ("alert-bot.png", 4), ("alert-drone.png", 4),
    ("spool-runaway.png", 4), ("command-token.png", 4), ("invincibility-pickup.png", 4),
]
EFFECT_LAYOUT = [("invincibility-aura.png", 7), ("stars", 5), ("sparkles", 8), ("impact-burst.png", 4)]
HUD_PANELS = ["hud-top.png", "hud-viewdata.png", "hud-minimap.png", "hud-bottom.png"]
ENV_FILES = [
    "env-rack.png", "env-tape-drive.png", "env-cabinet.png", "env-terminal-monitor.png",
    "env-keyboard.png", "env-desk.png", "env-chair.png", "env-warning-beacon.png",
    "env-wall-monitor.png", "env-freestanding-monitor.png", "env-cable-module.png",
    "env-machinery-module.png", "env-vent-grille.png",
    # Contract v2: batch-1 inspection found 17 props on the board, not 13.
    "env-rack-wide.png", "env-tape-drive-dials.png", "env-cabinet-double.png",
    "env-warning-beacon-tall.png",
]
BG_FILES = ["bg-far-sky.png", "bg-mid-mountains.png", "bg-near-datacenter.png"]


class Pipeline:
    def __init__(self) -> None:
        self.contract = load_contract()
        self.crops = load_crops()
        self.sources = load_sources()["sources"]
        self.key = parse_hex_color(self.contract["chroma_color"])
        self.tolerance = int(self.contract["chroma_tolerance"])
        self.by_file: dict[str, dict[str, Any]] = {o["file"]: o for o in self.contract["outputs"]}
        self.report = Report("tools/process_assets.py")
        self.written: list[str] = []

    # ---------------- infrastructure ----------------

    def emit(self, filename: str, packed: Image.Image, frames: list[Image.Image]) -> None:
        path = PATHS.public_assets / filename
        write_png(packed, path)
        contact_sheet(frames, filename).save(PATHS.diagnostics / f"{filename}-contact.png")
        self.written.append(filename)
        self.report.ok("emitted", filename, actual=f"{packed.width}x{packed.height}")

    def context(self, name: str, board: Image.Image, regions: list) -> BoardContext:
        key, fringe_tol, fringe_passes = getattr(self, "_chroma", (self.key, self.tolerance + 30, 2))
        return BoardContext(
            name=name, board=board, regions=regions, config=self.crops.get(name, {}),
            contract_by_file=self.by_file, report=self.report, emit=self.emit,
            chroma_key=key, defringe_tolerance=fringe_tol, defringe_passes=fringe_passes,
        )

    def prepare(self, name: str) -> tuple[Image.Image, list] | None:
        """Load, chroma-key and region-detect one board; write its diagnostic overlay."""
        meta = self.sources[name]
        path = PATHS.sources_dir / str(meta["file"])
        if not path.exists():
            self.report.error("file_present", name, f"{meta['file']} not supplied; outputs skipped")
            return None
        with Image.open(path) as opened:
            raw = opened.convert("RGBA")
        cfg = self.crops.get(name, {})
        policy = str(cfg.get("chroma_policy", "edge-connected"))
        # Per-board chroma settings beat the nominal key. Necessary because a board re-encoded as
        # lossy WebP no longer has a flat #7CFFB2 field (measured drift up to 44 on the
        # protagonist board, versus a nominal tolerance of 18).
        if cfg.get("chroma_key") or cfg.get("chroma_tolerance"):
            key = tuple(cfg["chroma_key"]) if cfg.get("chroma_key") else self.key
            tol = int(cfg.get("chroma_tolerance", self.tolerance))
            self.report.ok("chroma_calibration", name, expected=str(key), actual=f"tol={tol}")
        else:
            key, tol = estimate_chroma_key(raw, self.key)
            if (key, tol) != (self.key, self.tolerance):
                self.report.warn("chroma_calibration", name,
                                 "auto-calibrated from the board's own border; freeze into "
                                 "crops.json as chroma_key/chroma_tolerance once reviewed",
                                 expected=str(key), actual=f"tol={tol}")
        chroma = remove_edge_connected_chroma(raw, key, tol, policy)
        keyed = chroma.image
        # Defringing happens PER CROPPED REGION (see boards.crop_for_target), never here:
        # altering board alpha before detection changes the region count.
        self._chroma = (key, int(cfg.get("defringe_tolerance", tol + 30)),
                        int(cfg.get("defringe_passes", 2)))
        if policy == "edge-and-enclosed":
            self.report.warn("chroma_policy", name,
                             "board opted into 'edge-and-enclosed': chroma enclosed by artwork was also "
                             f"removed ({chroma.removed_fraction:.2%} of the board). Required for hollow "
                             "shapes such as the aura rings; never enable it where mint is artwork.")

        defaults = self.crops.get("defaults", {})
        regions = apply_overrides(
            detect_regions(
                keyed,
                int(cfg.get("min_area", defaults.get("min_area", 64))),
                int(cfg.get("merge_gap", defaults.get("merge_gap", 4))),
            ),
            cfg.get("overrides", {}),
        )
        for a, b, ratio in find_ambiguous_overlaps(regions):
            self.report.warn("ambiguous_overlap", f"{name}:{a}~{b}",
                             f"boxes overlap by {ratio:.0%} of the smaller region; verify the crop")
        diagnostic_overlay(raw, list(regions)).save(PATHS.diagnostics / f"{name}-regions.png")
        if not regions:
            self.report.error("region_detect", name, "no regions detected after chroma removal")
            return None
        return keyed, regions

    # ---------------- boards ----------------

    def do_protagonist(self) -> None:
        prepared = self.prepare("PROTAGONIST_SOURCE")
        if prepared is None:
            return
        board, regions = prepared
        ctx = self.context("PROTAGONIST_SOURCE", board, regions)
        selection = select_protagonist(ctx)
        if selection is None:
            return
        images = crops_for(ctx, 'hero.png', selection)
        # Frames 0-7 share one foot baseline; frames 8-9 use the airborne rule.
        grounded = normalize_all(ctx, images[:8], 32, 48, "foot-baseline", "hero.png")
        airborne = normalize_all(ctx, images[8:], 32, 48, "airborne", "hero.png")
        frames = grounded + airborne
        self.emit("hero.png", pack_horizontal(frames, 32, 48), frames)

    def do_icons(self) -> None:
        prepared = self.prepare("ICONS_SOURCE")
        if prepared is None:
            return
        board, regions = prepared
        ctx = self.context("ICONS_SOURCE", board, regions)
        cfg = ctx.config
        selection: list[str] = cfg.get("selection") or []
        by_id = {r.id: r for r in regions}
        if selection:
            if len(selection) != 12:
                self.report.error("icon_selection", "operations-tiles.png",
                                  "ICONS_SOURCE.selection must list exactly 12 region ids in tile order",
                                  expected="12", actual=str(len(selection)))
                return
            chosen = [by_id[i] for i in selection if i in by_id]
        else:
            if len(regions) < 12:
                self.report.error("icon_selection", "operations-tiles.png",
                                  "fewer than 12 icon regions detected",
                                  expected=">=12", actual=str(len(regions)))
                return
            chosen = regions[:12]
            self.report.warn("icon_selection", "operations-tiles.png",
                             "no manual selection; took the first 12 regions in reading order. "
                             "Freeze the correct 12 into config/crops.json -> ICONS_SOURCE.selection "
                             "(ignore redundant landscape variants and the extra magenta object)")
        for region in regions:
            if region not in chosen:
                self.report.skipped("region_unused", f"ICONS_SOURCE:{region.id}",
                                    f"redundant icon variant (bbox {region.rect})")
        emit_sheet(ctx, "operations-tiles.png", crops_for(ctx, "operations-tiles.png", chosen), "tile")

    def do_enemies(self) -> None:
        prepared = self.prepare("ENEMIES_ITEMS_SOURCE")
        if prepared is None:
            return
        board, regions = prepared
        ctx = self.context("ENEMIES_ITEMS_SOURCE", board, regions)
        groups = auto_assign(ctx, ENEMY_LAYOUT)
        for filename, _count in ENEMY_LAYOUT:
            group = groups.get(filename)
            if not group:
                continue
            # Drones and pickups align to a common centre; grounded robots to a foot baseline.
            align = "center" if filename in {
                "alert-drone.png", "command-token.png", "invincibility-pickup.png"
            } else "foot-baseline"
            emit_sheet(ctx, filename, crops_for(ctx, filename, group), align)

    def do_effects(self) -> None:
        prepared = self.prepare("EFFECTS_SOURCE")
        if prepared is None:
            return
        board, regions = prepared
        ctx = self.context("EFFECTS_SOURCE", board, regions)
        groups = auto_assign(ctx, EFFECT_LAYOUT)

        if groups.get("invincibility-aura.png"):
            emit_sheet(ctx, "invincibility-aura.png",
                       crops_for(ctx, "invincibility-aura.png", groups["invincibility-aura.png"]), "center")
        if groups.get("impact-burst.png"):
            emit_sheet(ctx, "impact-burst.png",
                       crops_for(ctx, "impact-burst.png", groups["impact-burst.png"]), "center")
        for index, region in enumerate(groups.get("stars", [])):
            emit_sheet(ctx, f"star-{index}.png", crops_for(ctx, f"star-{index}.png", [region]), "center")
        for index, region in enumerate(groups.get("sparkles", [])):
            emit_sheet(ctx, f"sparkle-{index}.png", crops_for(ctx, f"sparkle-{index}.png", [region]), "center")

    def do_hud_blocks(self) -> None:
        prepared = self.prepare("HUD_BLOCKS_SOURCE")
        if prepared is None:
            return
        board, regions = prepared
        ctx = self.context("HUD_BLOCKS_SOURCE", board, regions)
        cfg = ctx.config

        tile_ids: list[str] = (cfg.get("groups") or {}).get("gameplay-tiles.png") or []
        by_id = {r.id: r for r in regions}
        if tile_ids:
            tiles = [by_id[i] for i in tile_ids if i in by_id]
        else:
            # Gameplay blocks are the small square regions; HUD panels are the large ones.
            squares = [r for r in regions if r.w <= 2.2 * r.h and r.h <= 2.2 * r.w and r.w * r.h < 20000]
            tiles = squares[:9]
            self.report.warn("tile_selection", "gameplay-tiles.png",
                             "no manual grouping; used the first 9 small square regions in reading order. "
                             "Freeze into config/crops.json -> HUD_BLOCKS_SOURCE.groups['gameplay-tiles.png']")
        if len(tiles) == 9:
            emit_sheet(ctx, "gameplay-tiles.png", crops_for(ctx, "gameplay-tiles.png", tiles), "tile")
        else:
            self.report.error("tile_selection", "gameplay-tiles.png",
                              "need exactly 9 gameplay block regions",
                              expected="9", actual=str(len(tiles)))

        self._emit_hud_panels(ctx, board, regions)

    def _emit_hud_panels(self, ctx: BoardContext, board: Image.Image, regions: list) -> None:
        panels: dict[str, Any] = ctx.config.get("panels") or {}
        clean_regions = ctx.config.get("clean_regions") or []
        if not clean_regions:
            self.report.warn("hud_clean", "HUD_BLOCKS_SOURCE",
                             "no clean_regions configured: baked dynamic values (score, lives, mission "
                             "text, meter fill) will still be visible. Fill in "
                             "config/crops.json -> HUD_BLOCKS_SOURCE.clean_regions")

        large = sorted([r for r in regions if r.w * r.h >= 20000], key=lambda r: -(r.w * r.h))
        for index, filename in enumerate(HUD_PANELS):
            rect = panels.get(filename)
            if rect:
                region_img = board.crop((rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3]))
            elif index < len(large):
                r = large[index]
                region_img = crop(board, r)
                self.report.warn("hud_panel", filename,
                                 f"auto-picked region {r.id} {r.rect} by area; set an explicit rect in "
                                 f"config/crops.json -> HUD_BLOCKS_SOURCE.panels['{filename}']")
            else:
                self.report.error("hud_panel", filename, "no rect configured and no large region available")
                continue
            cleaned = self._clean_panel(region_img, filename, clean_regions, rect)
            emit_sheet(ctx, filename, [cleaned], "center")

    def _clean_panel(
        self, panel: Image.Image, filename: str, clean_regions: list, panel_rect: Any
    ) -> Image.Image:
        """Cover baked dynamic values with a colour SAMPLED from the panel itself."""
        out = panel.convert("RGBA").copy()
        offset_x = panel_rect[0] if panel_rect else 0
        offset_y = panel_rect[1] if panel_rect else 0
        applied = 0
        for entry in clean_regions:
            if entry.get("panel") != filename:
                continue
            x, y, w, h = entry["rect"]
            sx, sy = entry.get("sample_at", [x - 4, y])
            local = (x - offset_x, y - offset_y, w, h)
            sample_box = (sx - offset_x, sy - offset_y)
            fill = self._sample_fill(out, sample_box)
            out.paste(Image.new("RGBA", (w, h), fill), (local[0], local[1]))
            applied += 1
        if applied:
            self.report.ok("hud_clean", filename, actual=f"{applied} regions cleaned")
        return out

    @staticmethod
    def _sample_fill(panel: Image.Image, at: tuple[int, int]) -> tuple[int, int, int, int]:
        """Median colour of a 6x6 patch: the fill is sampled from the art, never invented."""
        x, y = max(0, at[0]), max(0, at[1])
        patch = panel.crop((x, y, min(panel.width, x + 6), min(panel.height, y + 6)))
        pixels = list(patch.convert("RGBA").getdata()) or [(16, 18, 26, 255)]
        channels = [sorted(p[i] for p in pixels)[len(pixels) // 2] for i in range(4)]
        return (channels[0], channels[1], channels[2], 255)

    def do_environment(self) -> None:
        prepared = self.prepare("ENVIRONMENT_SOURCE")
        if prepared is None:
            return
        board, regions = prepared
        ctx = self.context("ENVIRONMENT_SOURCE", board, regions)
        selection: list[str] = ctx.config.get("selection") or []
        by_id = {r.id: r for r in regions}
        chosen = [by_id[i] for i in selection if i in by_id] if selection else regions[: len(ENV_FILES)]
        if not selection:
            self.report.warn("env_selection", "ENVIRONMENT_SOURCE",
                             f"no manual selection; took the first {len(ENV_FILES)} regions in reading order to match "
                             "the contract order. Freeze into config/crops.json -> ENVIRONMENT_SOURCE.selection")
        if len(chosen) != len(ENV_FILES):
            self.report.error("env_selection", "ENVIRONMENT_SOURCE",
                              f"need exactly {len(ENV_FILES)} environment regions",
                              expected=str(len(ENV_FILES)), actual=str(len(chosen)))
            return
        for filename, region in zip(ENV_FILES, chosen):
            spec = self.by_file[filename]
            content = trim_to_content(crop(board, region))
            max_w, max_h = int(spec["max_width"]), int(spec["max_height"])
            ratio = min(max_w / content.width, max_h / content.height, 1.0)
            target = (max(1, int(content.width * ratio)), max(1, int(content.height * ratio)))
            scaled = nearest_resize(content, *target) if target != content.size else content
            write_png(scaled, PATHS.public_assets / filename)
            self.written.append(filename)
            self.report.ok("emitted", filename, actual=f"{scaled.width}x{scaled.height}")

    def do_backgrounds(self) -> None:
        prepared = self.prepare("BACKGROUNDS_SOURCE")
        if prepared is None:
            return
        board, regions = prepared
        ctx = self.context("BACKGROUNDS_SOURCE", board, regions)
        strips: dict[str, Any] = ctx.config.get("strips") or {}
        seam_mode = str(ctx.config.get("seam_mode", "repeat"))
        ordered = sorted(regions, key=lambda r: r.y)
        if len(ordered) < 3 and not any(strips.values()):
            self.report.error("bg_strips", "BACKGROUNDS_SOURCE",
                              "expected 3 horizontal strips", expected="3", actual=str(len(ordered)))
            return

        for index, filename in enumerate(BG_FILES):
            spec = self.by_file[filename]
            target_w, max_h = int(spec["width"]), int(spec["max_height"])
            rect = strips.get(filename)
            if rect:
                strip = board.crop((rect[0], rect[1], rect[0] + rect[2], rect[1] + rect[3]))
            elif index < len(ordered):
                strip = crop(board, ordered[index])
                self.report.warn("bg_strips", filename,
                                 f"auto-picked strip {ordered[index].id} by vertical order; set an explicit "
                                 f"rect in config/crops.json -> BACKGROUNDS_SOURCE.strips['{filename}']")
            else:
                self.report.error("bg_strips", filename, "no strip available")
                continue
            # Background strips bypass crop_for_target, so they need the same halo removal.
            key, fringe_tol, fringe_passes = getattr(self, "_chroma", (self.key, self.tolerance + 30, 2))
            strip, _peeled = defringe(strip, key, fringe_tol, fringe_passes)
            layer = self._fit_strip(strip, target_w, max_h, seam_mode)
            write_png(layer, PATHS.public_assets / filename)
            self.written.append(filename)
            self.report.ok("emitted", filename, actual=f"{layer.width}x{layer.height}")
            if layer.height < max_h:
                self.report.warn("bg_height", filename,
                                 f"layer is {layer.height}px tall, shorter than the {max_h}px play "
                                 f"viewport. Anchor is '{spec.get('anchor', 'bottom')}'; the gap is filled "
                                 "by the sampled sky clear colour. This is correct: pixel art is never "
                                 "upscaled to fill.")

    @staticmethod
    def _fit_strip(strip: Image.Image, width: int, max_height: int, seam_mode: str) -> Image.Image:
        """Downscale the strip to the logical width, then repeat (or mirror) it to fill that width.

        Height follows the same ratio and is NEVER upscaled to reach the play viewport height:
        a ~945x170 source strip becomes roughly 480x86, and the shortfall is covered by the
        camera clear colour. Upscaling pixel art duplicates rows unevenly and looks wrong.
        """
        ratio = min(width / strip.width, max_height / strip.height, 1.0)
        height = max(1, int(strip.height * ratio))
        scaled = nearest_resize(strip, max(1, int(strip.width * ratio)), height)
        canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        flipped = scaled.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        x, tile_index = 0, 0
        while x < width:
            piece = flipped if (seam_mode == "mirror" and tile_index % 2 == 1) else scaled
            canvas.paste(piece, (x, 0))
            x += scaled.width
            tile_index += 1
        return canvas

    # ---------------- driver ----------------

    def run(self) -> int:
        PATHS.ensure_output_dirs()
        missing = [
            str(meta["file"]) for meta in self.sources.values()
            if not (PATHS.sources_dir / str(meta["file"])).exists()
        ]
        if missing:
            # Absent boards must not block the boards that ARE present: report and continue.
            for name in missing:
                self.report.error("file_present", name, "board not supplied; its outputs are skipped")
            print("NOTE: not supplied, their outputs will be skipped:")
            for name in missing:
                print(f"  - {name}")
            print()

        def _digests() -> dict[str, str]:
            """Digest only the boards that exist; absent ones are reported, not fatal."""
            out: dict[str, str] = {}
            for meta in self.sources.values():
                path = PATHS.sources_dir / str(meta["file"])
                if path.exists():
                    out[str(meta["file"])] = sha256_file(path)
            return out

        digests = _digests()

        self.do_protagonist()
        self.do_icons()
        self.do_enemies()
        self.do_effects()
        self.do_hud_blocks()
        self.do_environment()
        self.do_backgrounds()

        after = _digests()
        for name, digest in digests.items():
            if after.get(name) != digest:
                self.report.error("source_unmodified", name, "source board was modified during processing!")
            else:
                self.report.ok("source_unmodified", name)

        expected_files = {o["file"] for o in self.contract["outputs"]}
        for filename in sorted(expected_files - set(self.written)):
            self.report.error("file_present", filename, "contracted output was not produced")

        write_json(PATHS.reports / "source-digests.json", digests)
        write_json(PATHS.reports / "processing-report.json", self.report.to_dict())
        self.report.print_summary()
        print(f"\nWrote {len(self.written)} files to {PATHS.public_assets.relative_to(PATHS.root)}")
        print(f"Contact sheets: {PATHS.diagnostics.relative_to(PATHS.root)}/")
        return 1 if self.report.failed else 0


if __name__ == "__main__":
    raise SystemExit(Pipeline().run())
