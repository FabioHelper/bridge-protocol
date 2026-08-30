# BUILD_BRIEF.md — Single-pass execution brief

**Read this file only.** It is self-contained: everything needed to implement the game is inline.
Open another doc only when this one points you there.

| Need | Doc | ~Tokens |
| --- | --- | --- |
| Build the game (this) | `BUILD_BRIEF.md` | ~3k |
| Why a design choice is what it is | `GDD.md` | ~3k |
| Exact physics / level / scoring numbers | `GAMEPLAY_SPEC.md` | ~4k |
| Architecture, HUD layout, harmony rules | `SPEC.md` | ~6k |
| Asset pipeline internals | `ASSET_PIPELINE.md` | ~5k |
| What artwork arrived and its quirks | `ASSET_INTAKE.md` | ~6k |

**Do not read all six.** Brief + GAMEPLAY_SPEC is enough for ~90% of the work.

---

## 0. State of the repo

Already done and green — **do not rebuild**:

- Vite + TS strict + ESLint + Vitest + Playwright, all passing.
- Python asset pipeline, verified end-to-end (`npm run assets:selftest`: 48 assets, 216 checks, 0 errors).
- `assets/config/asset-contract.json` (v3) — the dimension source of truth.
- `src/config/` — `AssetKeys.ts` (**generated**, do not hand-edit), `Animations.ts`, `Tuning.ts`,
  `Palette.ts`, `GameConfig.ts`, `AssetSource.ts`.
- 48 placeholder textures in `public/assets/` at exact contracted dimensions.
- Single-file artifact build, browser-verified.

**Your job:** implement `src/scenes/`, `src/entities/`, `src/systems/`, `src/level/`, `src/ui/`,
and the unit tests. Then delete `src/scenes/ScaffoldScene.ts`.

## 1. Non-negotiables

- Phaser **4.2.1**, Arcade physics, **480x270**, 16 px tiles, `pixelArt: true`, `roundPixels: true`.
- **No `any`.** ESLint fails the build on it. Also no god classes (`max-lines: 400`).
- **All numbers come from `src/config/Tuning.ts`.** Never write a literal.
- **All texture keys come from `src/config/AssetKeys.ts`.** Regenerate with `npm run gen:keys`.
- **`src/systems/` and `src/level/` must never `import ... from 'phaser'`.** A test enforces this.
  It is what makes the logic unit-testable with no mocking. Put Phaser-facing helpers in `src/ui/`.
- **Load textures via `resolveAssetUrl(filename)`** from `src/config/AssetSource.ts`, never a
  hardcoded path — that is what makes the artifact build work.

## 2. Build order

Work in this order; each step ends green.

1. **Systems first (pure, no Phaser).** `ScoreSystem`, `MissionSystem`, `InvincibilitySystem`,
   `HighScoreStore`, `RunState`. Write their unit tests as you go. This is the highest-value,
   lowest-risk work and it needs no engine.
2. **Level.** `LevelData.ts` (declarative blueprint) + `LevelBuilder.ts` (blueprint → tile grid +
   spawn lists), plus `level.test.ts` asserting no gap > 4 tiles and no step > 3 tiles.
3. **Scenes skeleton.** `BootScene` → `PreloadScene` → `MainMenuScene` → `LevelScene` + `HudScene`
   → `GameOverScene`. Get an empty level rendering with a controllable player.
4. **Player feel.** Acceleration, variable jump, coyote, jump buffer, animation state machine.
   **Stop and play it here.** If it does not feel good, nothing later will save it.
5. **Enemies.** Base `Enemy` + four subclasses. Stomp interaction. Alerts.
6. **HUD.** Panels, then dynamic fields.
7. **Invincibility.** Aura, orbiting stars, sparkles, tint cycle, impact burst, power meter.
8. **Juice pass.** Section 6 of `GDD.md`. Do not skip — it is most of the "artisan-grade" feel.
9. `npm run verify` then `npm run build:artifact`.

## 3. Physics (copy exactly — already in `Tuning.ts`)

```
GRAVITY_Y 900 · MAX_RUN_SPEED 110 · RUN_ACCELERATION 900
GROUND_DRAG 1200 · AIR_DRAG 400 · AIR_CONTROL_FACTOR 0.65
JUMP_VELOCITY -300 · JUMP_CUT_VELOCITY -120 · MAX_FALL_SPEED 420
COYOTE_TIME_MS 100 · JUMP_BUFFER_MS 120 · STOMP_BOUNCE_VELOCITY -210
BODY 14x40 at offset (9, 8) inside the 32x48 frame · 3 lives
```

Jump apex = 50 px (3.1 tiles). Horizontal reach = 73 px (4.5 tiles).
**Level rule: no gap > 4 tiles, no required step > 3 tiles.**

**The collision body never changes** — not during invincibility, damage, or stomps.

Coyote: allow a jump up to 100 ms after leaving ground, **consumed on use** so it can never grant a
double jump. Buffer: store the press timestamp; fire on landing if within 120 ms.

## 4. Screen budget

```
y 0–30    HUD top    (hud-top.png, 480x30, full width)
y 30–214  PLAY       cameras.main.setViewport(0, 30, 480, 184)
y 214–270 HUD bottom (hud-bottom.png, 480x56, full width)
```

MAP and VIEWDATA are **overlay panels inside the play area, top-right** — not in the bottom bar.
`HudScene` runs in parallel with `LevelScene` and consumes only a `RunState` snapshot; it must never
touch game objects.

## 5. Animations (defined in `Animations.ts` — just call them)

```
hero-idle  frames 0-1   4 fps loop      hero-run  frames 2-7  12 fps loop
hero-jump  frame  8                     hero-fall frame  9
```

Facing via `setFlipX` only. Source art faces **right**.

Enemy sheets are 4 frames; **frame 3 is always the deactivated pose** and is excluded from movement
loops. Aura playback is a **straight loop** (the source rings already ramp small→large→small, so
ping-pong would stutter) — this is already handled in `Animations.ts`.

## 6. Scoring

```
token 100 · stomp 200 x chain · invincible defeat 300
job 1000 · level complete 2500 · time bonus 10/second under 90 s par
```

Chain multiplier: consecutive **airborne** stomps → 1x, 2x, 3x… capped at **5x**. Landing resets it.
This is the game's skill expression — make sure the HUD celebrates it.

## 7. Enemies

| Class | Speed | Aggro | Behaviour |
| --- | --- | --- | --- |
| `JobFailBot` | 30 | 90 | Slow ledge-aware patrol; halts when alerted |
| `AlertBot` | 45 → 70 | 120 | Patrol, turns at walls and ledges; speeds up when alerted |
| `AlertDrone` | 40 | 140 | Airborne, gravity off, sine bob 22 px @ 1.6 rad/s; descends toward player |
| `SpoolRunaway` | 0 → 95 | 150 | Idle until aggro, 400 ms telegraph, then charges |

**Stomp:** `player.body.velocity.y > 0` AND `player.body.bottom <= enemy.body.top + 8`.
Anything else damages the player unless invincible.

**Alerts:** one per enemy per `PATROL → ALERTED` transition, never spammed. Taking damage adds one.
Cumulative for the run. Alerts never block progress — they are the scoreboard's judgement.

## 8. Invincibility (the set piece)

8000 ms. Aura **behind** the player (`DEPTH.AURA = DEPTH.PLAYER - 1`), 5 stars orbiting **in front**
at radius 26 px, ω 3.2 rad/s, phase `2π/5·i`, wobble ±4 px @ 2.1 rad/s — **computed per frame, never
baked**. Sparkle trail from the 8 sparkle textures. Tint cycles yellow/cyan/magenta/white every
100 ms, **50 ms during the final 2000 ms**. Enemy contact = instant defeat + 4-frame impact burst at
the contact point + 300 points. Re-pickup **refreshes** to 8000, never stacks.

## 9. HUD dynamic fields

Top: lives · score (7-digit) · jobs `X / 4` · alerts · tokens · PF1–PF12 highlight · status message ·
activity graph · power meter.
Bottom: mission text · objective text · item slot · automation cells · **segmented colour-graded
power meter** (red→orange→yellow→green→blue, ramp in `Palette.POWER_METER_RAMP`).
Overlays: MAP (player dot, enemy dots, checkpoint tick, 4 job pips) · VIEWDATA (4 scrolling
simulated 3270 lines).

Status messages: `ALL SYSTEMS GO` (default) · `JOB n COMPLETE` · `ALERT RAISED` · `CHECKPOINT SAVED` ·
`POWER SURGE ACTIVE` · `JOBS INCOMPLETE` · `LIFE LOST` · `PAUSED`. Non-default holds 1800 ms.

Text refreshes at **10 Hz**; meter and minimap every frame.

## 10. Level

300 x 24 tiles (4800 x 384 px). Four job terminals, one checkpoint at tile 150, exit at 292
**locked until 4/4 jobs**. Kill plane 32 px below the grid. Section plan and tile index map:
`GAMEPLAY_SPEC.md` §6. Build it from a declarative blueprint, not a hand-typed ASCII map, so
`level.test.ts` can verify reachability.

Two tilemap layers: gameplay tiles (collision) and operational icon blocks (own collision set).

## 11. Definition of done

```bash
npm run verify          # schema + typecheck + lint + test + build
npm run test:e2e        # browser smoke test
npm run build:artifact  # build/ops-hero.html, self-contained, opens and plays
```

Plus: a human plays start to finish in 60–90 s with all four jobs completable.

## 11b. Is this workflow sound? (measured, not assumed)

Challenged and tested — reproduce with `npm run assets:demo-fidelity`:

- Plain nearest-neighbour recovers **86–95%** of pixels even from blurred, noisy AI-style renders,
  and the most fragile detail (a 3x4 px ID badge) survives every time.
- On clean integer-scaled art, an **exact-ratio crop is 100% lossless**; off by ~11 px drops to 90%.
- A fractional-period resampling stage was built, measured **4–10 pp worse**, and deleted.

**Conclusion: the resampling filter was never the risk — crop precision is.** The pipeline now snaps
every crop rect to an exact integer multiple of the target frame
(`normalize.snap_rect_to_integer_ratio`) and WARNs when it cannot.

**Phaser is not the constraint.** Any engine needs the same board-to-spritesheet step, and that step
is a solved Python problem here. Phaser supplies everything this game needs natively: spritesheet
loading with frame dimensions, tilemaps from plain arrays, Arcade physics, particle emitters,
`TileSprite` parallax, and `pixelArt`/`roundPixels`. The artifact path is browser-verified.

**One real Phaser risk:** version 4 is new, so most examples online are Phaser 3. Do not copy Phaser 3
idioms blindly — the API surface used here was checked against the 4.2.1 type definitions.

## 12. Assets — current reality

`public/assets/` holds **placeholders** at correct dimensions, so you can build and play the whole
game today. They are deliberately stamped with magenta hatching and a `PLACEHOLDER` label so no
screenshot can be mistaken for finished artwork. When real artwork lands, `npm run assets:process` overwrites the same paths at the same
dimensions and **no source code changes**.

Check which track is live: `npm run assets:validate` prints `Asset track: PLACEHOLDER|PRODUCTION`.

Still missing: `ICONS_SOURCE` (blocks `operations-tiles.png`) and `VISTA_REFERENCE` (reference only,
blocks nothing). And critically — **none of the received boards is on disk yet**; they arrived as
conversation attachments. See `ASSET_INTAKE.md` §0.

## 13. Shipping as a playable artifact

```bash
npm run build:artifact        # -> build/ops-hero.html  (self-contained, ~1.3 MB + textures)
npm run build:artifact -- --cdn   # smaller page, loads Phaser from jsDelivr
```

Default inlines Phaser so the page has **zero external dependencies**. Verified in a real browser:
48 textures inlined, no console errors. Publish `build/ops-hero.html` as the artifact.

## 14. Traps that will cost you a cycle

1. Writing a number instead of importing it from `Tuning.ts` — lint will not catch it, review will.
2. Importing Phaser into `src/systems/` — `architecture.test.ts` fails immediately.
3. Hardcoding `assets/foo.png` instead of `resolveAssetUrl('foo.png')` — the artifact silently
   loses every texture.
4. Hand-editing `AssetKeys.ts` — it is generated; your change vanishes on the next `gen:keys`.
5. Letting the camera scroll land on a fractional pixel — the art goes blurry. Floor everything.
6. Changing the player's collision body during invincibility — explicitly forbidden.
7. Forgetting that enemy frame 3 is the deactivated pose and animating through it.
