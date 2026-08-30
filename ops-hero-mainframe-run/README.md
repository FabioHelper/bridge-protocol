# OPS HERO: Mainframe Run

An original 16-bit side-scrolling browser platformer set inside a fictional mainframe datacenter.
Phaser 4.2.1 · TypeScript strict · Vite · Arcade physics · 480x270 logical · no backend, no React,
no runtime AI services.

> **Project status — scaffold + pipeline complete, game not yet implemented.**
> The asset pipeline, contract, schemas, validation and specifications are done and verified.
> Gameplay implementation is deliberately held until the remaining source boards arrive.
> See `ASSET_INTAKE.md` for exactly what has been received and what is blocked.

## Documentation

**Start with `BUILD_BRIEF.md`.** It is self-contained and is the only document an implementer needs
to read to build the game. The rest are reference; open them on demand.

| Doc | Contents | ~Tokens |
| --- | --- | --- |
| `BUILD_BRIEF.md` | Single-pass execution brief — build order, contracts, traps | ~3k |
| `GDD.md` | Game design: pillars, loop, difficulty curve, juice, success criteria | ~3k |
| `GAMEPLAY_SPEC.md` | Exact physics, enemies, level, scoring, invincibility numbers | ~4k |
| `SPEC.md` | Architecture, rendering, HUD layout, Cross-Asset Harmony Rules | ~6k |
| `ASSET_PIPELINE.md` | Deterministic crop, chroma, normalization, packing, validation | ~5k |
| `ASSET_INTAKE.md` | Source-by-source intake record, observations, ambiguities | ~6k |

## Installation

```bash
npm install
python3 -m pip install -r tools/requirements.txt
```

Requires Node 20+ and Python 3.11+.

## Development

```bash
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # Type-check then produce dist/
npm run preview      # Serve the production build on http://127.0.0.1:4173
```

## Assets

The nine approved source boards belong in `assets/source/` and are **never modified** by any tool.
Production textures are written to `public/assets/`.

```bash
npm run assets:inspect       # Read-only: dimensions, chroma coverage, region counts, overlays
npm run assets:process       # Full deterministic pipeline -> public/assets/
npm run assets:validate      # Independent verification; exits 1 on any error
npm run assets:placeholders  # Contract-shaped stand-in art so the project runs without the boards
npm run assets:selftest      # Runs the real pipeline against synthetic boards
npm run assets:schema        # Validates the crop config against its JSON Schema
npm run gen:keys             # Regenerates src/config/AssetKeys.ts from the asset contract
```

**Two-track design.** `assets:placeholders` generates all 48 contracted files at their exact
dimensions and frame counts. `assets:process` writes the same paths with the same dimensions from
real artwork. Because the contract drives the code, swapping in real assets needs **zero source
changes**. Placeholder PNGs carry a `phTrack` marker chunk, and validation reports which track the
current `public/assets` tree came from — the definition of done requires `production`.

### Order of operations once the boards land

1. Place all nine PNGs in `assets/source/` under the names in `assets/source/source-manifest.json`.
2. `npm run assets:inspect` — confirm real dimensions and region counts.
3. Reconcile `assets/config/crop-config.draft.json` against the real region ids, then promote it.
4. `npm run assets:process`
5. Review every contact sheet in `build/asset-diagnostics/`.
6. Correct crops deterministically — never regenerate artwork.
7. `npm run assets:validate` until 0 errors and `track == production`.

## Playable artifact build

```bash
npm run build:artifact           # -> build/ops-hero.html, self-contained
npm run build:artifact -- --cdn  # smaller page; loads Phaser from jsDelivr instead
```

Produces ONE HTML file with every texture inlined as a base64 data URI and (by default) Phaser
inlined too, so the page has zero external dependencies. Suitable for publishing directly as a
Claude artifact. Browser-verified: 48 textures inlined, no console errors, ~1.3 MB against the
16 MB artifact limit.

`src/config/AssetSource.ts` is what makes this work — scenes call `resolveAssetUrl(filename)`
instead of hardcoding a path, so the same code runs from `public/assets/` on the web and from
inlined data URIs in the artifact.

## Testing

```bash
npm run typecheck    # tsc --noEmit, strict
npm run lint         # ESLint, --max-warnings=0
npm run test         # Vitest unit tests
npm run test:e2e     # Playwright browser smoke test
npm run verify       # schema + typecheck + lint + test + build
```

**Browser smoke test.** `npm run test:e2e` requires a Chromium download:

```bash
npx playwright install chromium && npm run test:e2e
```

It is not part of `npm run verify` because the download is not always available in a sandboxed
environment. The production build never depends on it.

## Controls

| Action | Keys |
| --- | --- |
| Move | `←` `→` or `A` `D` |
| Jump (variable height) | `Space`, `W`, or `↑` |
| Pause | `P` or `Esc` |
| Restart | `R` |
| Start / confirm | `Enter` |

## Project layout

```
assets/source/     Nine approved boards + source-manifest.json (never modified)
assets/config/     asset-contract.json, crops.json, crop-config.schema.json, crop-config.draft.json
build/             Diagnostics (bbox overlays, contact sheets) and JSON reports
public/assets/     Production textures consumed by Phaser
tools/             Deterministic Python pipeline (Pillow + OpenCV + NumPy)
src/config/        Tuning, Palette, AssetKeys (generated), Animations, GameConfig
src/scenes/        Scenes (currently a scaffold scene only)
tests/unit/        Vitest, pure logic, zero Phaser imports
tests/e2e/         Playwright smoke test
```
