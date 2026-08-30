# GAMEPLAY_SPEC.md — Movement, enemies, objectives, invincibility, scoring, HUD runtime, level flow

All numbers here are mirrored verbatim in `src/config/Tuning.ts`. If they disagree, the code is
wrong, not this document.

**Status:** specified and frozen. Game implementation is **not started** — held deliberately until
the remaining four source boards arrive.

---

## 1. Units and screen budget

Positions in logical pixels; velocities px/s; accelerations px/s²; time ms. 1 tile = 16 px.

```
y=0    ┌───────────────────────────────────────────────┐
       │ HUD TOP   (hud-top.png, 480x30)               │   full width
y=30   ├───────────────────────────────────────────────┤
       │ GAMEPLAY CAMERA VIEWPORT 480 x 184            │
       │   MAP panel + VIEWDATA panel overlay right    │   <- confirmed by GAMEPLAY_REFERENCE
y=214  ├───────────────────────────────────────────────┤
       │ HUD BOTTOM (hud-bottom.png, 480x56)           │   full width
y=270  └───────────────────────────────────────────────┘
```

`LevelScene` calls `cameras.main.setViewport(0, 30, 480, 184)`, so gameplay is never drawn under
the HUD. `HudScene` runs in parallel at a higher depth using the default full-screen camera.

The reference confirms this budget: the hero occupies ~27% of the play field, which at 184 px is
≈50 px — matching the 32x48 native frame.

## 2. Player physics

| Constant | Value | Rationale |
| --- | --- | --- |
| `GRAVITY_Y` | 900 | Snappy arcade fall, not floaty |
| `MAX_RUN_SPEED` | 110 | ≈6.9 tiles/s |
| `RUN_ACCELERATION` | 900 | Top speed in ~0.12 s |
| `GROUND_DRAG` | 1200 | Short controllable skid |
| `AIR_DRAG` | 400 | Retains air momentum |
| `AIR_CONTROL_FACTOR` | 0.65 | Air steering weaker than ground |
| `JUMP_VELOCITY` | -300 | Apex = 300²/(2·900) = **50 px ≈ 3.1 tiles** |
| `JUMP_CUT_VELOCITY` | -120 | Clamp on early release → variable height |
| `MAX_FALL_SPEED` | 420 | Terminal velocity, keeps collisions stable |
| `COYOTE_TIME_MS` | **100** | Jump allowed after leaving a ledge; consumed on use so it can never grant a double jump |
| `JUMP_BUFFER_MS` | **120** | Jump pressed before landing still fires |
| `STOMP_BOUNCE_VELOCITY` | -210 | Lower than a full jump; chaining takes skill |
| `BODY_WIDTH` / `BODY_HEIGHT` | 14 / 40 | Inside the 32x48 frame |
| `BODY_OFFSET_X` / `Y` | 9 / 8 | Feet on the frame's bottom edge, matching `foot-baseline` |
| `HIT_INVULN_MS` | 1200 | Post-damage blink; distinct from golden-aura invincibility |
| `RESPAWN_DELAY_MS` | 700 | Death pause |

**Derived reachability budget:** airtime ≈ 0.667 s → max horizontal jump ≈ 73 px ≈ **4.5 tiles**.
Level rules: **no gap wider than 4 tiles**, no required step higher than **3 tiles**. Both asserted
by `tests/unit/level.test.ts` against the compiled grid.

**The collision body never changes** — not during invincibility, damage, or stomps.

## 3. Controls

| Action | Keys |
| --- | --- |
| Move left | `←` / `A` |
| Move right | `→` / `D` |
| Jump (variable height) | `Space` / `W` / `↑` |
| Pause | `P` / `Esc` |
| Restart level | `R` |
| Start / confirm | `Enter` |

## 4. Animation state machine

```
grounded && |vx| <  IDLE_SPEED_EPSILON (8) -> "hero-idle"  frames 0-1,  4 fps, loop
grounded && |vx| >= IDLE_SPEED_EPSILON     -> "hero-run"   frames 2-7, 12 fps, loop
!grounded && vy <  0                       -> "hero-jump"  frame 8
!grounded && vy >= 0                       -> "hero-fall"  frame 9
```

Facing uses `setFlipX`, never a second animation. Source poses face **right** (per
`PROTAGONIST_SOURCE` and the reference), so `flipX = true` means moving left.

## 5. Enemies

`Enemy` is an abstract `Phaser.Physics.Arcade.Sprite` subclass; each family extends it.

| Class | Texture | Body | Speed | Aggro | Stomp score |
| --- | --- | --- | --- | --- | --- |
| `JobFailBot` | `job-fail-bot` | 20x22 | 30 | 90 | 200 |
| `AlertBot` | `alert-bot` | 22x24 | 45 → 70 alerted | 120 | 200 |
| `AlertDrone` | `alert-drone` | 22x18, gravity off | 40 horizontal + 22 px sine @ 1.6 rad/s | 140 | 250 |
| `SpoolRunaway` | `spool-runaway` | 24x24 | 0 idle → 95 charging after a 400 ms telegraph | 150 | 300 |

Shared rules:

- **Frame 3 of every enemy sheet is the deactivated pose**, shown on defeat.
- **Ledge-aware patrol:** ground enemies probe the tile ahead-and-below and reverse rather than walk
  off. Drones ignore this.
- **Stomp:** defeats an enemy when `player.body.velocity.y > 0` **and**
  `player.body.bottom <= enemy.body.top + STOMP_TOLERANCE_PX (8)`. Any other contact damages the
  player unless golden-aura invincible.
- **Alerts:** an enemy raises exactly **one** alert on first transition to `ALERTED`, and cannot
  raise another until it returns to `PATROL` and re-triggers. Taking damage also raises one.
  Cumulative for the run.

## 6. Level flow

`src/level/LevelData.ts` holds a declarative `LevelBlueprint`; `LevelBuilder.ts` compiles it to a
tile grid plus spawn lists. Deliberately not a hand-typed ASCII map — a blueprint is something a
test can reason about.

- Grid **300 x 24 tiles** = 4800 x 384 px.
- Pure-run traversal ≈ 44 s; with jumps, four terminals and enemies, measured play lands in the
  **60–90 s** target.
- Kill plane at `y = 384 + 32`.
- One **checkpoint** at tile 150.
- **Exit terminal** at tile 292, **locked until all four jobs are complete**. Walking into a locked
  exit shows `JOBS INCOMPLETE` rather than ending the level.

| Tiles | Section | Content |
| --- | --- | --- |
| 0–38 | Cold start | Flat ground, two icon-block formations, first tokens, one 2-tile gap. **JOB-01** on a 3-tile ledge. |
| 39–95 | Tape library | Stepped platforms, two `JobFailBot`s, 3- and 4-tile gaps, token arcs. **JOB-02** guarded by an `AlertBot`. |
| 96–150 | Cooling aisle | Two `AlertDrone`s over a 4-tile gap, floating icon-block bridges, an invincibility pickup on a high ledge. **Checkpoint.** |
| 151–205 | Spool hall | Two `SpoolRunaway`s in a corridor, breakable-block ceiling. **JOB-03** behind them. |
| 206–265 | Power floor | Mixed enemies, the tightest jumps, second invincibility pickup. **JOB-04**. |
| 266–299 | Exit run | Descending staircase, token payout row, **exit terminal**. |

### Tile index map (`gameplay-tiles.png`, +1 because Phaser reserves 0 for empty)

| Value | Tile | Collides |
| --- | --- | --- |
| 0 | empty | no |
| 1 | terminal_command | no (objective marker) |
| 2 | stone_left | yes |
| 3 | stone_center | yes |
| 4 | stone_right | yes |
| 5 | stone_under | yes |
| 6 | dark_inactive | yes |
| 7 | warning | yes |
| 8 | breakable | yes, destroyed by a head-bump |
| 9 | exit_terminal | no (overlap trigger) |

Operational icon blocks live on a **second tilemap layer** with its own collision set, keeping the
12 icon tiles on independent indices 1–12. The reference shows these metallic blocks used as
in-world platforms, which this layering supports directly.

## 7. Objectives — `MissionSystem`

Four job terminals. Each has an id, a mission line and an objective line for the HUD. Completing
all four unlocks the exit.

Mission text follows the reference's voice: `PROCESS END OF DAY REPORTS AND ARCHIVE`.
Objective text likewise: `COMPLETE ALL JOBS`, `AVOID ALERTS`.

`complete(id)` is **idempotent** — completing a job twice never double-scores.
The `/ 4` denominator is the named constant `MISSION.TOTAL_JOBS`. (`GAMEPLAY_REFERENCE` displays
`JOBS 04/20`; that is treated as mockup dressing, and the constant makes it a one-line change if a
20-job variant is ever wanted.)

## 8. Scoring — `ScoreSystem`

| Event | Points |
| --- | --- |
| Command token | 100 |
| Enemy stomp | `200 x chainMultiplier` |
| Enemy defeated while invincible | 300 |
| Job terminal completed | 1000 |
| Level complete | 2500 |
| Time bonus | `10 x ceil(remainingMs / 1000)` against a 90 000 ms par |

**Chain multiplier:** consecutive stomps without touching the ground multiply 1x, 2x, 3x…, capped
at **5x**. Landing resets it. Score is monotonic and never negative.

High score persists in `localStorage` under `opshero.highscore.v1`, read through an injectable
storage interface so tests use a fake and a corrupt value degrades to 0.

## 9. Lives, damage, respawn

- **3 lives.** Damage costs one. Zero → `GameOverScene` with `reason: 'out-of-lives'`.
- Damage sources: non-stomp enemy contact; falling below the kill plane.
- Respawn at the checkpoint once reached, otherwise at level start. **Score, tokens, alerts and
  completed jobs are retained** — only position resets. A 60–90 s level should not be punishing.
- `HIT_INVULN_MS` (1200 ms) of blink invulnerability after respawn.

## 10. Invincibility — `InvincibilitySystem`

| Property | Value |
| --- | --- |
| Duration | **8000 ms** |
| Aura frames | 7, **ping-pong**: `0,1,2,3,4,5,6,5,4,3,2,1` at 14 fps |
| Aura depth | **behind** the player (`DEPTH.AURA = DEPTH.PLAYER - 1`) |
| Orbiting stars | 5 independent sprites, radius 26 px, ω = 3.2 rad/s, phase `2π/5 · i`, radius wobble ±4 px @ 2.1 rad/s — **computed per frame in Phaser, never baked** |
| Sparkle trail | Emitter behind the player, random pick of the 8 sparkle textures, 40 ms interval, 350 ms lifespan |
| Tint cycle | `#FFE066` yellow, `#66F2FF` cyan, `#FF6BD6` magenta, `#FFFFFF` white |
| Tint interval | 100 ms; **50 ms during the final 2000 ms** |
| Enemy contact | Instant defeat, `impact-burst` (4 frames, 20 fps) at the contact midpoint, +300 |
| Collision body | **Unchanged** — asserted by unit test |
| HUD | Power meter fills `remainingMs / 8000` |

Picking up a second pickup while active **refreshes** to a full 8000 ms rather than stacking.

The aura's centre 20x20 must be transparent (pipeline-validated) so the protagonist stays visible
behind it.

## 11. HUD runtime behaviour

Static artwork supplies frames, borders and permanent headings. Phaser renders everything that
changes. Full field list in `SPEC.md` §6.

Text fields refresh at **10 Hz** (`HUD_TEXT_REFRESH_MS = 100`) to avoid per-frame string
allocation; the power meter and minimap redraw every frame.

**System status messages:** `ALL SYSTEMS GO` (default) · `JOB {n} COMPLETE` · `ALERT RAISED` ·
`CHECKPOINT SAVED` · `POWER SURGE ACTIVE` · `JOBS INCOMPLETE` · `LIFE LOST` · `PAUSED`.
Non-default messages hold 1800 ms then revert.

The **POWER meter is a segmented colour-graded bar** (red → orange → yellow → green → blue), not a
plain fill — as drawn in `GAMEPLAY_REFERENCE`. The source frame ships with the meter empty, so
Phaser only draws filled cells on top.

## 12. Pause, restart, end states

- `P` / `Esc` pauses `LevelScene` physics; `HudScene` draws a `PAUSED` overlay.
- `R` restarts the level: lives to 3, score to 0, jobs cleared.
- **Level complete:** exit terminal touched with `jobsComplete === 4` → `GameOverScene`
  (`reason: 'complete'`) with the score breakdown, time bonus and high-score status.
- **Game over:** lives exhausted → `GameOverScene` (`reason: 'out-of-lives'`).
