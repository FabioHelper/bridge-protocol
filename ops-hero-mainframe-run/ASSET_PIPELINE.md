# ASSET_PIPELINE.md — Deterministic crop, chroma, normalization, packing and validation plan

Implemented in `tools/`. Python 3.11+, Pillow, NumPy, OpenCV (headless).
Authoritative dimensions live in **`assets/config/asset-contract.json`** (currently **v2**).
This document is the human-readable mirror; where they disagree, the JSON wins.

**Determinism rule:** identical `assets/source/` + `assets/config/*.json` must produce
byte-identical `public/assets/`. No randomness, no timestamps in image data, no network access.

**Verification status:** every mechanism described here has been executed end-to-end against
synthetic boards by `tools/selftest_pipeline.py` — 48 assets produced, 216 validation checks, 0
errors. It has **not** been run against the real artwork, because the boards are not yet on disk.

---

## 1. Entry points

| Command | Script | Purpose |
| --- | --- | --- |
| `npm run assets:inspect` | `tools/inspect_sources.py` | Read-only. Dimensions, chroma coverage, region counts, bounding-box overlays. Writes `build/reports/inspection-report.json`. |
| `npm run assets:process` | `tools/process_assets.py` | Full production run: chroma → detect → select → normalize → align → pack → contact sheets. |
| `npm run assets:validate` | `tools/validate_assets.py` | Independent re-verification of `public/assets`. Exit 1 on any ERROR. Deliberately shares no code path with the processor. |
| `npm run assets:placeholders` | `tools/make_placeholders.py` | Contract-shaped stand-in art so the game runs before the boards land. |
| `npm run assets:selftest` | `tools/selftest_pipeline.py` | Runs the real pipeline against synthetic boards. Proves mechanics without needing the artwork. |

## 2. Inviolable rules

1. **Never modify `assets/source/`.** Opened read-only; SHA-256 digests are recorded before and
   after every run and compared. A changed digest is a hard `ERROR`.
2. **Never redraw, in-paint or hallucinate.** Every output pixel originates from a source pixel via
   crop, nearest-neighbour scale, translate, horizontal mirror, alpha mask, or a *documented
   sampled* HUD fill (§7).
3. **Nearest-neighbour only.** `tools/pipeline/normalize.py` owns the only `resize()` call in the
   codebase. Bilinear, bicubic, Lanczos, area and antialias are forbidden.
4. **Chroma removal is connectivity-based** (§4), never a global colour delete.
5. **Hard alpha edges.** After every operation alpha is re-thresholded: `<128 → 0`, `>=128 → 255`.
   Colour under transparent pixels is zeroed so PNGs compress identically each run.
6. **Honest reporting.** Ambiguity is a `WARN` with the bbox and the reason. It is never silently
   resolved. A count mismatch is an `ERROR`, never a guess.

## 3. Source manifest

`assets/source/source-manifest.json` maps the nine logical names to filenames and records
`on_disk` / `seen_not_on_disk` / `pending`. Reference boards (`GAMEPLAY_REFERENCE`,
`VISTA_REFERENCE`) are flagged `reference_only` and are **excluded** from chroma processing and
region extraction — they are used only for palette sampling and design cross-checks.

## 4. Chroma keying — `tools/pipeline/chroma.py`

Key `#7CFFB2` = RGB `(124, 255, 178)`, per-channel tolerance **18**.

### 4.1 Default policy: `edge-connected`

1. `candidate = per-channel |rgb - key| <= tol`.
2. `cv2.connectedComponentsWithStats(candidate, connectivity=4)`.
3. A component is background **iff** it touches row 0, row H-1, col 0 or col W-1.
4. Alpha 0 for those components only. **Every other mint pixel survives untouched.**

### 4.2 Opt-in policy: `edge-and-enclosed`

Some artwork is **hollow**. The seven aura rings enclose mint that touches no board edge, so the
default policy leaves it opaque and the "aura centre must be transparent" gate fails. Setting
`chroma_policy: "edge-and-enclosed"` on a board also clears enclosed chroma.

- Currently enabled for **`EFFECTS_SOURCE` only**.
- Opting in is **audited**: the processor emits a `WARN` stating how much of the board was removed.
- Never enable it on a board whose artwork legitimately uses the key colour.

**This is not a theoretical concern.** `selftest_pipeline.py` reproduced the exact failure —
`chroma_residue: 15204 opaque pixels` and `aura_center_empty: frames [0..6] have opaque pixels` —
and confirmed both cleared once the policy was applied.

### 4.3 Correction from intake batch 1

The earlier spec allowed `bg-mid-mountains.png` to retain chroma, on the assumption its foothills
were mint. **Inspection disproved that**: the forest is dark desaturated green. Contract v2 sets
`chroma_allowed: []` so no real chroma leak can hide behind a bogus exception.

### 4.4 Validation check

No production PNG may contain an opaque pixel within tolerance of the key, with no exceptions.

## 5. Region detection — `tools/pipeline/regions.py`

1. Alpha → binary mask; 3x3 morphological CLOSE **on the mask only** (output pixels untouched).
2. `connectedComponentsWithStats`, connectivity 8.
3. Discard components below the board's `min_area`.
4. Merge boxes within `merge_gap` px — this reattaches a raised hand, an antenna, a rotor tip.
5. **Reading order:** cluster into rows by y-centroid against `0.5 x median component height`, then
   sort each row left-to-right. Stable ids `r0, r1, r2, …`.
6. Overrides from the crop config replace detected rects outright.

**Ambiguity reporting:** boxes overlapping by >15% of the smaller area → `WARN ambiguous_overlap`;
detected count ≠ expected → `ERROR region_count_mismatch` listing every bbox so a human can author
overrides.

## 5b. Feasibility verdict: does board-to-spritesheet actually work?

This was challenged directly, so it was **measured** rather than argued.
Reproduce with `npm run assets:demo-fidelity` (`tools/demo_pixelgrid.py`): it builds a known 32x48
sprite containing the most fragile details (1 px eyes, a 3x4 px ID badge, 3 px arms), renders it the
way an image model does, recovers it, and scores the result against ground truth.

### Result 1 — the feared catastrophe did not happen

The hypothesis was that non-integer downscaling of AI-rendered pixel art would produce mush.

| Source render | Plain nearest-neighbour | ID badge |
| --- | --- | --- |
| 2.00x, blurred + noisy | 86.3% pixels correct | survived |
| 3.72x, blurred + noisy | 93.3% pixels correct | survived |
| 5.15x, blurred + noisy | 95.1% pixels correct | survived |

**The workflow is viable.** Plain nearest-neighbour is already acceptable even on deliberately
degraded input.

### Result 2 — the obvious fix made things worse, so it was deleted

A "detect the fractional pixel period and resample by modal colour" stage scored **4 to 10
percentage points worse** than plain nearest-neighbour. It was removed rather than shipped.
`tools/pipeline/pixelgrid.py` keeps only the integer-grid detector, demoted to a diagnostic.

### Result 3 — crop precision is the real variable

On clean integer-scaled art, which is what a sharp pixel-art board is:

| Crop accuracy | Pixels recovered |
| --- | --- |
| Exact integer ratio | **100.0%** |
| Off by ~3 px (ratio 3.09) | 98.4% |
| Off by ~7 px (ratio 3.22) | 93.1% |
| Off by ~11 px (ratio 3.34) | 90.3% |

**So the risk was never the resampling filter. It is where the crop rectangle lands.**

### The fix that shipped

`normalize.snap_rect_to_integer_ratio` grows or shrinks each detected crop rect symmetrically so its
size is an exact integer multiple of the target frame, then downscales by that integer. Every output
pixel samples one whole source block. It is a pure translate-and-resize of the crop window: no pixel
is invented and nothing is redrawn.

It is wired into every frame-producing path (hero, all four enemy sheets, both item sheets, aura,
burst, stars, sparkles, both tilesets). When no integer factor fits within tolerance the pipeline
emits a `crop_snap` WARN naming the region, rather than silently accepting the loss.

## 6. Normalization and alignment — `tools/pipeline/normalize.py`

1. Trim to the tight alpha bbox.
2. Scale by `min(target_w/w, target_h/h)`, nearest-neighbour. **Never upscale beyond 1:1** — pad
   instead, and emit a `WARN`.
3. Paste into a fresh RGBA canvas per the alignment mode.
4. Re-threshold alpha.

Rounding is always `floor`, never `round`, so alignment is reproducible and never off by one
between frames.

| Mode | Rule | Applied to |
| --- | --- | --- |
| `foot-baseline` | Horizontally centred; alpha-bbox bottom pinned to canvas row `H-1`, one shared baseline per family | hero 0–7, job-fail-bot, alert-bot, spool-runaway |
| `airborne` | Same, lifted by a constant **3 px**, identical for every airborne frame | hero 8–9 |
| `center` | Alpha-bbox centre pinned to canvas centre | alert-drone, tokens, pickups, aura, burst, stars, sparkles |
| `tile` | Scaled to exactly fill 16x16; non-square source within 10% → `WARN` | operations-tiles, gameplay-tiles |
| `none` | Pasted at origin | HUD panels |

### 6.3 The protagonist downscale problem (known, unavoidable)

Source figures are ~100–110 px tall; the target is 48 px — a **non-integer ~1:2.2 reduction**.
Nearest-neighbour drops rows unevenly. At risk, in order: the **ID badge** (~2x3 px after scaling),
facial features, the shoe/trouser boundary, the hair silhouette.

Mitigations, all deterministic and all short of redrawing:

1. Crop to the **complete silhouette**, never maximally tight — Phase 3 rule: silhouette beats
   tightness.
2. Prefer a crop whose height is close to an integer multiple of 48 so the ratio lands nearer a
   clean division.
3. Review `build/asset-diagnostics/hero.png-contact.png` at 4x zoom and, where a detail is lost,
   adjust the **crop rect** (which changes the effective ratio) rather than the pixels.
4. If the badge still disappears, that is a finding to report to the artist, **not** a licence to
   paint it back in.

### 6.5 Background layers

Strips are ~945x170–190. Scaling width 945 → 480 gives ~480x86–96 — **shorter** than the 184 px
play viewport.

`_fit_strip` therefore: scales by `min(480/w, max_h/h, 1.0)`; keeps the resulting height; tiles
horizontally (or mirrors, if `seam_mode: "mirror"`) to reach exactly 480 wide; and emits a `WARN`
naming the shortfall. Layers are then **anchored** in engine — sky top, mountains and datacenter
bottom — with the camera clear colour (sampled from the sky gradient's top) filling the gap.
**Upscaling to fill is forbidden.**

## 7. HUD cleaning — sampled fills only

Fill colour is the **median RGB of a 6x6 patch** at a configured `sample_at` point *inside the same
panel*. The fill is sampled from the artwork; it is never invented.

Regions are declared in `crop-config` → `clean_regions[]` as
`{ id, panel, rect, sample_at, reason }`.

Per intake §3.3, the real board needs **far less cleaning than assumed**. Already clean: the POWER
meter (drawn empty), the VIEWDATA screen, the MAP grid, and the MISSION/OBJECTIVE bodies. Still to
clean: the baked `ALL SYSTEMS GO` string, the SYS STATUS graph, the ITEM slot's gold star, and the
five AUTOMATION robot glyphs.

Baked decorative headings are **preserved**: `OPS HERO`, `SCORE`, `JOBS`, `ALERTS`, `COINS`,
`PF KEYS`, the `PF1`–`PF12` labels, `SYS STATUS`, `MAP`, `CURRENT MISSION`, `OBJECTIVE`, `ITEM`,
`AUTOMATION`, `POWER`, `VIEWDATA 3270`.

Enemy screen interiors keep their baked text for the MVP; their rects are stored under
`screen_interior` so a later pass can swap them for pixel symbols without redoing crops.

## 8. Crop configuration

- **Schema:** `assets/config/crop-config.schema.json` (JSON Schema 2020-12, validated in CI by
  `npm run assets:schema`).
- **Draft:** `assets/config/crop-config.draft.json` — provisional, `validated: false`,
  `coordinate_space: "normalized"`, every frame carrying an explicit `confidence` of
  `draft_unvalidated` or `ambiguous`. **No coordinate here has been visually validated.**
- **Working config:** `assets/config/crops.json` — what the tools read today.
- After each run the resolved rects land in `build/reports/resolved-crops.json`; a human reviews the
  contact sheets, copies the good values across, and flips `confidence` to `visually_validated`.

`coordinate_space: "normalized"` exists precisely because the boards are not yet on disk: fractions
of board width/height can be authored honestly before dimensions are known, and are resolved to
pixels at run time.

## 9. Production output contract (v2)

Full machine-readable form in `assets/config/asset-contract.json`.

| File | Frames | Frame | Final | Alignment |
| --- | --- | --- | --- | --- |
| `hero.png` | 10 | 32x48 | **320x48** | foot-baseline (0–7), airborne (8–9) |
| `job-fail-bot.png` | 4 | 32x32 | **128x32** | foot-baseline |
| `alert-bot.png` | 4 | 32x32 | **128x32** | foot-baseline |
| `alert-drone.png` | 4 | 32x32 | **128x32** | center (no wobble) |
| `spool-runaway.png` | 4 | 32x32 | **128x32** | foot-baseline |
| `command-token.png` | 4 | 16x16 | **64x16** | center |
| `invincibility-pickup.png` | 4 | 16x16 | **64x16** | center |
| `invincibility-aura.png` | 7 | 64x64 | **448x64** | center; centre 20x20 must be transparent |
| `impact-burst.png` | 4 | 32x32 | **128x32** | center |
| `star-0..4.png` | 1 each | 8x8 | 8x8 | center |
| `sparkle-0..7.png` | 1 each | 8x8 | 8x8 | center |
| `operations-tiles.png` | 12 | 16x16 | **192x16** | tile |
| `gameplay-tiles.png` | 9 | 16x16 | **144x16** | tile |
| `hud-top.png` | 1 | — | **480x30** | none |
| `hud-bottom.png` | 1 | — | **480x56** | none (corrected in v2 from 160x56) |
| `hud-viewdata.png` | 1 | — | ≤200x64 | none (provisional) |
| `hud-minimap.png` | 1 | — | ≤160x72 | none (provisional) |
| `env-*.png` (**17**) | 1 each | — | ≤96x96 | center |
| `bg-far-sky.png` | 1 | — | 480 x ≤184, anchor **top** | none |
| `bg-mid-mountains.png` | 1 | — | 480 x ≤184, anchor **bottom** | none |
| `bg-near-datacenter.png` | 1 | — | 480 x ≤184, anchor **bottom** | none |

**Tile orders.**
`operations-tiles.png`: silver, red, yellow, green, cyan, blue, magenta, black, palm, evergreen,
green_hills, snowy_mountain.
`gameplay-tiles.png`: terminal_command, stone_left, stone_center, stone_right, stone_under,
dark_inactive, warning, breakable, exit_terminal.

## 10. Diagnostics and reports

| Artefact | Content |
| --- | --- |
| `build/asset-diagnostics/<BOARD>-regions.png` | Source board with numbered bounding boxes; overrides drawn in a different colour |
| `build/asset-diagnostics/<output>-contact.png` | Every normalized frame at 4x zoom on a checkerboard, indexed |
| `build/reports/inspection-report.json` | Dimensions, chroma coverage, region counts |
| `build/reports/resolved-crops.json` | The rects actually used — copy back to freeze |
| `build/reports/processing-report.json` | Every OK / WARN / ERROR / SKIPPED from the run |
| `build/reports/validation-report.json` | Independent verification result |
| `build/reports/source-digests.json` | SHA-256 per board, proving sources were not modified |

## 11. Validation gates

`file_present`, `dimensions`, `frame_count`, `alpha_hard_edges`, `chroma_residue`,
`aura_center_empty`, `tile_seam`, `source_unmodified`.

Report schema carries `track: "placeholder" | "production" | "mixed"`, derived from a `phTrack`
iTXt chunk present in placeholder PNGs only. **The definition of done requires
`track == "production"`.**

## 12. Order of operations once the boards land

1. Place all nine PNGs in `assets/source/`.
2. `npm run assets:inspect` — confirm real dimensions and region counts. **Expect the protagonist
   count to resolve the 12-vs-13 question.**
3. Reconcile `crop-config.draft.json` against the real region ids; promote it to `crops.json`.
4. `npm run assets:process`.
5. Review every contact sheet in `build/asset-diagnostics/`.
6. Correct crops deterministically. Never regenerate artwork.
7. `npm run assets:validate` until 0 errors and `track == production`.
