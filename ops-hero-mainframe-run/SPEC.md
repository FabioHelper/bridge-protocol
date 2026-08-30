# SPEC.md — OPS HERO: Mainframe Run — Master Engineering, Rendering and Visual Specification

**Version 2** — updated from intake batch 1 (five source boards inspected).
Companion documents: `ASSET_INTAKE.md`, `ASSET_PIPELINE.md`, `GAMEPLAY_SPEC.md`.

---

## 1. Current state

| Area | State |
| --- | --- |
| Repository, build tooling, lint, type config | **Done and green** |
| Asset pipeline (chroma, detect, normalize, align, pack, validate) | **Done and verified end-to-end against synthetic boards** — 48 assets, 216 checks, 0 errors |
| Asset contract v2 | **Done**, corrected from real artwork |
| Crop schema + provisional draft config | **Done**, explicitly unvalidated |
| Placeholder asset track | **Done** — 48 contract-shaped stand-ins so the project stays runnable |
| Specifications | **Done** (this set) |
| Real asset extraction | **Blocked** — source PNGs are not on disk |
| Phaser game implementation | **Not started, deliberately** — held until the remaining four boards arrive |

## 2. Hard environment contract

| Concern | Value |
| --- | --- |
| Engine | Phaser **4.2.1** (exact pin, no `^`) |
| Language | TypeScript **strict** + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` |
| Bundler | Vite 7 |
| Physics | Phaser **Arcade** (never Matter) |
| Logical resolution | **480 x 270**, 16:9, `Scale.FIT` + `CENTER_BOTH` |
| Native tile | **16 x 16** |
| `pixelArt` / `roundPixels` | `true` / `true` |
| Upscale filter | nearest-neighbour only (engine + CSS `image-rendering: pixelated`) |
| React / UI framework | none |
| Backend | none |
| Runtime AI services | none |
| Asset loading | local files under `public/assets/` only |
| Persistence | `localStorage` high score only |

**Banned in source:** `any` (ESLint `no-explicit-any` plus all `no-unsafe-*` rules); god classes
(`max-lines: 400`); unexplained magic numbers (all tuning in `src/config/Tuning.ts`); duplicated
asset keys (each defined once in `src/config/AssetKeys.ts`); scene-specific global state.

## 3. Repository layout

```
ops-hero-mainframe-run/
├─ SPEC.md  ASSET_INTAKE.md  ASSET_PIPELINE.md  GAMEPLAY_SPEC.md  README.md
├─ assets/
│  ├─ source/            # The nine boards + source-manifest.json. NEVER modified by any tool.
│  └─ config/            # asset-contract.json, crops.json, crop-config.schema.json, crop-config.draft.json
├─ build/
│  ├─ asset-diagnostics/ # Bounding-box overlays + normalized contact sheets
│  └─ reports/           # inspection, processing, validation, resolved-crops, source-digests
├─ public/assets/        # PRODUCTION textures consumed by Phaser
├─ tools/                # Deterministic Python pipeline (Pillow + OpenCV + NumPy)
├─ src/
│  ├─ config/  scenes/  entities/  systems/  level/  ui/
├─ tests/unit/           # Vitest, pure logic, zero Phaser imports
└─ tests/e2e/            # Playwright browser smoke test
```

## 4. Rendering contract

- Fixed **top-left illumination** across every asset.
- Hard pixel edges; no soft gradients, no blur, no semi-transparent pixels in production art.
- Integer camera scroll (`camera.setRoundPixels(true)`) and `Math.floor` on every parallax
  `tilePositionX` — this, plus `roundPixels`, is what prevents fractional-pixel blur.
- HUD text drawn at integer coordinates via a `PixelText` helper.

### 4.1 Parallax

| Layer | Texture | Scroll factor | Anchor | Depth |
| --- | --- | --- | --- | --- |
| Camera clear colour | sampled sky top colour | — | — | — |
| Far sky | `bg-far-sky` | **0.10** | top | -30 |
| Mid mountains & forest | `bg-mid-mountains` | **0.35** | bottom | -20 |
| Near datacenter | `bg-near-datacenter` | **0.65** | bottom | -10 |
| Playable foreground | tilemap layers | **1.00** | — | 0 |

Each layer is a `TileSprite` sized to the camera viewport, pinned with `setScrollFactor(0)`, and
scrolled by setting `tilePositionX = Math.floor(camera.scrollX * factor)`. Using `tilePositionX`
rather than object scroll gives seamless horizontal repetition regardless of strip width, with no
duplicated sprites.

**The layers are shorter than the viewport** (see `ASSET_INTAKE.md` §5.2). They are anchored, never
upscaled, and the clear colour fills the remainder. Vertical parallax is intentionally omitted.

## 5. Code architecture

### 5.1 Layering rule

```
scenes/   -> may import config, entities, systems, level, ui, phaser
entities/ -> may import config, system types, phaser
systems/  -> may import config ONLY.  MUST NOT import phaser.
level/    -> may import config ONLY.  MUST NOT import phaser.
ui/       -> may import config, systems (read-only), phaser
config/   -> imports nothing except Phaser types in GameConfig.ts
```

The no-Phaser rule on `systems/` and `level/` is load-bearing: it is what makes score, mission,
invincibility and level geometry unit-testable in plain Node with zero mocking.
`tests/unit/architecture.test.ts` enforces it by scanning for `from 'phaser'`.

### 5.2 Scenes

| Scene | Responsibility | Not its job |
| --- | --- | --- |
| `BootScene` | Texture filter, placeholder generator registration, hand off | Gameplay |
| `PreloadScene` | Load `ASSET_MANIFEST`, progress bar, `loaderror` → generated placeholder texture at the correct size, `registerAnimations` | Deciding what to load |
| `MainMenuScene` | Title, high score, controls legend, Enter to start | Holding run state |
| `LevelScene` | Tilemap, entities, colliders, camera, systems, HUD events | Drawing HUD pixels |
| `HudScene` | Runs in parallel; renders cleaned frames + dynamic values from a `RunState` snapshot | Mutating game state |
| `GameOverScene` | Results, high-score write, retry | Level teardown |

Flow: `Boot → Preload → MainMenu → (Level ‖ Hud) → GameOver → MainMenu`.

### 5.3 Systems

`ScoreSystem`, `MissionSystem`, `InvincibilitySystem`, `AudioSystem` (placeholder facade with an
injectable sink), `HighScoreStore` (injectable storage), `InputSystem` (key map → pure
`InputIntent`), and `RunState` — a plain serialisable snapshot that is **the only thing crossing
the Level → Hud boundary**.

Run-persistent values survive a life loss via the Phaser registry under
`REGISTRY_KEYS.RUN_STATE`. There is no module-level mutable singleton anywhere in `src/`.

### 5.4 Graceful missing assets

Two independent layers:

1. **Build time** — `npm run assets:placeholders` writes all 48 contracted files at exact
   dimensions, so the project is always runnable.
2. **Run time** — `PreloadScene` catches `loaderror`, looks the expected dimensions up in
   `ASSET_MANIFEST`, and generates a magenta/black checkerboard texture of exactly that size and
   frame layout. The game boots with visibly-wrong-but-correctly-sized art and `console.warn`s
   every substituted key.

## 6. HUD specification

Layout confirmed against `GAMEPLAY_REFERENCE` (see `ASSET_INTAKE.md` §1.1).

| Panel | Texture | Rect |
| --- | --- | --- |
| Top bar | `hud-top` | 0, 0, 480, 30 |
| Bottom bar | `hud-bottom` | 0, 214, 480, 56 |
| MAP | `hud-minimap` | right-side overlay inside the play viewport, top-right |
| VIEWDATA 3270 | `hud-viewdata` | right-side overlay, directly below MAP |

### 6.1 Dynamic fields — top bar

Lives value · score (7-digit zero-padded) · jobs `X / 4` · alert count · command-token count ·
PF1–PF12 active highlight · system-status message · decorative activity graph ·
invincibility power meter.

### 6.2 Dynamic fields — bottom bar

Current mission text · objective text · active item icon · automation state cells ·
**segmented colour-graded power meter** (red → orange → yellow → green → blue).

### 6.3 Overlay panels

MAP draws a track line, a bright player dot at `playerProgress01`, enemy dots, a checkpoint tick,
and four job pips that light on completion. VIEWDATA draws four scrolling lines of simulated 3270
output appended on real game events (`> JOB02 RUNNING`, `> QUEUE DEPTH 03`) — cosmetic only.

### 6.4 In-world diegetic panels

The reference shows `z/OS SYSTEM OPERATION` and `BATCH QUEUE` panels floating **inside** the play
field. These are decorative world props drawn at scroll factor 1.00, not HUD elements.

## 7. Cross-Asset Harmony Rules

> **Note:** the instruction defining this section arrived truncated mid-sentence
> ("This section must define,"). The rules below are what a cross-asset harmony contract needs to
> cover for this project. Tell me what you intended and I will replace them.

These rules exist because the nine boards were authored separately. Without them, assets that are
individually correct will not read as one game.

### 7.1 Authority hierarchy

When two assets disagree, resolve in this order:

1. **`GAMEPLAY_REFERENCE`** — overall appearance, composition, visual density, protagonist scale in
   the viewport, HUD-to-play relationship, in-game fidelity target.
2. **`PROTAGONIST_SOURCE`** — the character's exact poses, proportions, clothing, crop boundaries.
3. **`VISTA_REFERENCE`** — conceptual identity and ordering of the operational icons.
4. **`ICONS_SOURCE`** — the actual game-ready icon artwork and which variants are redundant.
5. **`ENEMIES_ITEMS_SOURCE`** — the actual enemy and item artwork, variants, alignment needs.

Never invent a visual detail that contradicts the artwork.

### 7.2 Illumination

Fixed **top-left** light on every asset, no exceptions. Highlights on upper-left faces, shadows on
lower-right. Any asset that reads as lit from another direction is a crop or selection error, not a
style choice — report it rather than correcting it by painting.

### 7.3 Outline weight

All families use a **1 px dark outline at native resolution**, in a dark navy consistent with the
character's outline rather than pure black. Because sources are at different working scales, outline
weight is a *post-normalization* property: check it on the contact sheets, not the boards. An
outline that survives at 2 px after downscaling makes that asset read as closer to camera than its
neighbours and must be re-cropped to a ratio that yields 1 px.

### 7.4 Palette discipline

One palette, sampled from `GAMEPLAY_REFERENCE`, shared by every asset and by `src/config/Palette.ts`:
HUD panel `#0E1526`-ish · panel border `#3FA08A`-ish · UI text green `#7CFF9E`-ish · gold accent
`#F5C542`-ish · alert red `#E03C3C`-ish · stone tan and machine navy from the blocks board.
Introducing a hue that appears on no board is forbidden.

### 7.5 Scale relationships (the ratios that must hold)

| Relationship | Required ratio | Source of truth |
| --- | --- | --- |
| Hero height : tile | 48 : 16 = **3 : 1** | contract |
| Hero height : play viewport | 48 : 184 ≈ **26%** | matches the reference's ~27% |
| Token : hero width | 16 : 32 = **1 : 2** | reference |
| Ground enemy : hero height | 32 : 48 = **2 : 3** | contract |
| Icon block : tile | 16 : 16 = **1 : 1** | reference shows them as platforms |
| Env rack : hero height | ≈56 : 48 ≈ **1.2 : 1** | environment board, needs confirming against the reference |

Any asset breaking its ratio is re-cropped, never rescaled away from its native canvas.

### 7.6 Shading depth by parallax layer

Contrast and saturation must **decrease with distance**: foreground tiles and characters carry full
contrast; `bg-near-datacenter` is near-black with only LED accents; `bg-mid-mountains` is
desaturated blue-grey; `bg-far-sky` is a flat gradient with no detail beyond clouds. If a
background layer reads as sharply as the foreground, it will fight the parallax and must be
re-selected, not blurred — blurring is forbidden.

### 7.7 Facing convention

Every directional asset faces **right** in its stored texture; leftward motion uses `setFlipX`.
Where a source pose faces left, the pipeline applies a deterministic `flip_h` at crop time. This is
a transform, not a redraw.

### 7.8 Alpha and edge convention

Hard alpha everywhere: a pixel is fully opaque or fully transparent. No anti-aliased rims, no drop
shadows baked into sprites. Contact shadows, if ever wanted, are a separate sprite.

### 7.9 Static artwork vs dynamic Phaser rendering

| Must stay **static artwork** | Must be **rendered dynamically** |
| --- | --- |
| HUD frames, borders, casings, bevels | Lives, score, jobs, alerts, token count |
| Permanent headings (`OPS HERO`, `SCORE`, `JOBS`, `ALERTS`, `COINS`, `PF KEYS`, `SYS STATUS`, `MAP`, `CURRENT MISSION`, `OBJECTIVE`, `ITEM`, `AUTOMATION`, `POWER`, `VIEWDATA 3270`) | System-status message text |
| `PF1`–`PF12` button labels and their bezels | PF active-key highlight |
| The empty POWER meter cells | Filled power segments and their colour ramp |
| The empty VIEWDATA screen and MAP grid | Viewdata runtime lines; minimap player/enemy/job markers |
| Tile and block artwork | Breakable-block destruction, block bump animation |
| Enemy bodies, including baked screen text (MVP) | Enemy movement, alert state, defeat |
| Aura ring frames | Aura ping-pong playback, star orbits, sparkle emission, tint cycling |

The dividing principle: **anything whose value changes during play is drawn by Phaser**; anything
that is a fixed decorative surface stays in the texture.

### 7.10 Consistency checks the pipeline can actually enforce

`tile_seam` (stone tiles repeat cleanly) · `aura_center_empty` (protagonist stays visible) ·
`alpha_hard_edges` (no soft rims anywhere) · `chroma_residue` (no mint leaks) · `dimensions` and
`frame_count` (scale ratios hold by construction). Everything else in this section is a **human
review item against the contact sheets** and is honestly labelled as such.

## 8. Testing and validation

| Command | Gate |
| --- | --- |
| `npm run assets:inspect` | Board inspection |
| `npm run assets:placeholders` | Contract-shaped stand-in art |
| `npm run assets:process` | Full deterministic pipeline |
| `npm run assets:validate` | Independent verification, exit 1 on ERROR |
| `npm run assets:selftest` | Pipeline mechanics against synthetic boards |
| `npm run assets:schema` | Validate crop config against its JSON Schema |
| `npm run typecheck` / `lint` / `test` / `test:e2e` / `build` | Standard gates |
| `npm run verify` | typecheck + lint + test + build |

**Unit test matrix** (`tests/unit/`): `score.test.ts` (token value, stomp chain 1x→5x and its cap,
chain reset on landing, invincible-defeat value, job and level bonuses, time-bonus rounding,
monotonic non-negative score, high-score store with a fake `Storage` including corrupt-value
recovery) · `mission.test.ts` (four jobs, idempotent completion, exit stays locked until 4/4,
objective advance, unknown id throws) · `invincibility.test.ts` (exactly 8000 ms, boundary at
t=8000 not 8001, meter clamped 1→0, `isExpiring` only in the final 2000 ms, tint cycles at 100 ms
and 50 ms while expiring, aura ping-pong index sequence never out of range, re-activation refreshes
rather than stacks) · `level.test.ts` (grid 300x24, no gap > 4 tiles, no step > 3 tiles, terminals
and exit on solid ground, no enemy inside solid tile) · `architecture.test.ts` (no Phaser import in
`systems/` or `level/`).

**Browser smoke test** (`tests/e2e/smoke.spec.ts`): loads the production preview, asserts a canvas
at 16:9, waits for `window.__OPS_HERO__.scene === 'MainMenu'`, presses Enter, asserts scene
`Level` and `lives === 3` and `errors.length === 0`, and screenshots both states.

## 9. Definition of done

1. `npm run assets:process` — zero ERRORs.
2. `npm run assets:validate` — exit 0 **and `track == "production"`**.
3. `npm run typecheck` / `lint` / `test` — clean.
4. `npm run test:e2e` — reaches MainMenu and starts a level.
5. `npm run build` — bundle emitted.
6. A human plays start-to-finish in 60–90 s with all four jobs completable.

## 10. Known limitations

1. HUD text uses `Phaser.GameObjects.Text` at 8 px monospace rather than a generated bitmap font.
2. No audio assets; `AudioSystem` is a wired placeholder facade.
3. Enemy screen interiors keep baked text per the MVP constraint.
4. The protagonist's ~1:2.2 downscale will cost fine detail, most likely the ID badge
   (`ASSET_PIPELINE.md` §6.3). This cannot be fixed without redrawing, which is forbidden.
5. No crop coordinate has been visually validated against real artwork yet.
