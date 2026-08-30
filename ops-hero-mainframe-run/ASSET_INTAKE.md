# ASSET_INTAKE.md — Source-by-source intake record

**Intake batch 1 — five boards. Intake batch 2 — two boards + a full-fidelity reference.**
**Seven of nine boards received. Only `ICONS_SOURCE` still blocks extraction.**
Every observation below comes from **visual inspection of the images in conversation**. None of it
is measured from file bytes, because **none of the five boards exists as a file in
`assets/source/` yet** (see §0). Dimensions are stated as approximations and flagged as such.

---

## 0. Blocking issue and mapping correction — read this first

### 0.1 The files are not on disk

The five boards arrived as conversation attachments. They are **not** in `assets/source/`, so
`npm run assets:inspect` and `npm run assets:process` cannot run against them. Everything in this
document is a visual reading, and every crop coordinate in
`assets/config/crop-config.draft.json` is **provisional and explicitly unvalidated**.

To unblock extraction, the PNGs need to land in `assets/source/` under the manifest filenames
(committing them to the branch is the simplest route).

### 0.2 Four of the five boards are not what the request said they were

The request stated the five attachments were `01`, `02`, `03`, `04`, `05`. Identifying each image
by its **content** gives a different mapping. The content is authoritative:

| Arrived as | Request said it was | It is actually | Evidence |
| --- | --- | --- | --- |
| Attachment 1 | `01_gameplay_reference` | **`09_backgrounds_source`** | Three horizontal parallax strips (sky, mountains/forest, datacenter silhouettes) on mint, separated by mint bands |
| Attachment 2 | `02_vista_reference` | **`08_environment_source`** | 17 isolated datacenter props on mint: racks, tape units, cabinets, CRT, keyboard, desk, chair, beacons, monitors, cable and machinery modules, vent grille |
| Attachment 3 | `03_protagonist_source` | **`07_hud_blocks_source`** | 9 gameplay blocks plus the top HUD strip, VIEWDATA 3270 panel, MAP panel and bottom HUD strip |
| Attachment 4 | `04_icons_source` | **`01_gameplay_reference`** | Full gameplay mockup: populated HUD, hero mid-run, tokens, icon blocks, in-world z/OS and BATCH QUEUE panels |
| Attachment 5 | `05_enemies_items_source` | **`03_protagonist_source`** | Two rows of compact protagonist poses on mint |

### 0.3 Received / pending status after both batches

**Received (batch 1):** `GAMEPLAY_REFERENCE`, `PROTAGONIST_SOURCE`, `HUD_BLOCKS_SOURCE`,
`ENVIRONMENT_SOURCE`, `BACKGROUNDS_SOURCE`
**Received (batch 2):** `EFFECTS_SOURCE`, `ENEMIES_ITEMS_SOURCE`, plus a **full-fidelity replacement
for `GAMEPLAY_REFERENCE`** (see §8)

**Still pending:** `ICONS_SOURCE` (blocks `operations-tiles.png`) and `VISTA_REFERENCE`
(reference only — blocks nothing).

Machine-readable form: `assets/source/source-manifest.json`.

---

## 1. GAMEPLAY_REFERENCE — received (reference only, never cropped)

Approx. **1024 x 616**. This board carries the most information per pixel of any input, because it
shows the intended *result* rather than parts.

### 1.1 Layout actually observed

- **Top HUD**: full-width strip, ~10% of frame height (≈ **30 px** at 270 logical — the earlier
  estimate holds). Sections left to right: `OPS HERO` + portrait + `x 07` lives · `SCORE 0017350` ·
  `JOBS 04/20` · `ALERTS 01` · `COINS` + token icon + `x 48` · `PF KEYS` (a 2x6 grid, PF1–PF12) ·
  `SYS STATUS` / `ALL SYSTEMS GO` + a small green activity graph.
- **Right-side overlay panels**: `MAP` sits top-right *below* the top bar (dotted grid, a green
  player dot, an orange room outline). `VIEWDATA 3270` is a **smaller panel below the map**
  showing `CONNECTED TO SCE.EON.PROD`.
- **In-world diegetic panels**: a `z/OS SYSTEM OPERATION` panel (`JOBS 004 ACTIVE`, `OUTPUT 002`,
  `SPOOL 001`, `UPTIME 15:32:27`) and a `BATCH QUEUE` panel (`PRINTQ OK`, `LOADLIB OK`,
  `BACKUP OK`, `REPORTS OK`) float **inside the play field**.
- **Bottom HUD**: full-width strip, ~9% of frame height (≈ **56 px** at 270 logical).
  `CURRENT MISSION: PROCESS END OF DAY REPORTS AND ARCHIVE` · `OBJECTIVE: COMPLETE ALL JOBS /
  AVOID ALERTS` · `ITEM` (a gold star in a box) · `AUTOMATION` (five robot glyphs above a dashed
  line) · `POWER` (a segmented meter running red → orange → yellow → green → blue, then empty cells).

### 1.2 Differences from the written specification

| Written spec said | Reference shows | Resolution |
| --- | --- | --- |
| Minimap and Viewdata live in the bottom bar | They are **right-side overlay panels** in the play area | Spec updated: HUD bottom is a full-width strip of mission/objective/item/automation/power; map and viewdata float right |
| `hud-bottom.png` is 160x56 | Full-width strip | Contract v2: **480x56** |
| Jobs shown as `X / 4` | `JOBS 04/20` | Gameplay contract keeps **4 job terminals**; the denominator is a named constant. The reference's `/20` is treated as mockup dressing |
| — | Power meter is a **colour-graded segmented bar**, not a plain fill | HUD spec updated to segmented cells with a colour ramp |
| — | In-world z/OS and BATCH QUEUE panels exist | Added as decorative diegetic props |

### 1.3 Scale relationships (the most valuable measurement here)

The hero occupies roughly **27% of the play-field height**. With a play viewport of 184 px that
gives ≈ 50 px — which confirms the **32x48** native hero frame and the 480x270 / 16 px tile
contract. No change needed.

The command tokens render at roughly **half the hero's width**, consistent with **16x16** tokens
against a 32-wide hero. The icon blocks read as one tile each, consistent with **16x16**.

### 1.4 Palette anchors sampled from this board

Dark HUD panel `#0E1526`-ish · panel border cyan/green `#3FA08A`-ish · heading and body text green
`#7CFF9E`-ish · gold accents `#F5C542`-ish · alert red `#E03C3C`-ish. These become
`src/config/Palette.ts` once the file is on disk and can be sampled exactly.

---

## 2. PROTAGONIST_SOURCE — received

Approx. **1024 x 613**, mint `#7CFFB2` field, two rows.

### 2.1 Pose count — an honest ambiguity

The top row clearly holds **6** poses. The bottom row visually reads as **6 or 7**: four
standing/walking figures on the left, then three clearly dynamic figures clustered on the right.
Total is therefore **12 or 13**.

This matters: every region id in the draft config assumes 12. **If detection reports 13, the whole
selection block must be rewritten**, and three poses get dropped rather than two. The pipeline
treats a count mismatch as a hard `ERROR` rather than guessing — this is exactly the case that rule
exists for.

### 2.2 Character description (controls what must survive cropping)

Dark messy/curly hair, full beard, **dark navy jacket over a lighter shirt**, a **white ID badge
on a lanyard** hanging at chest height, dark navy jeans, **brown shoes**. Roughly 4.5–5 heads
tall — compact but not chibi. Dark navy outline, hard pixel edges, highlights on the upper left
consistent with fixed top-left illumination.

### 2.3 Draft pose assignment (unvalidated)

| Frame | Role | Draft region | Confidence |
| --- | --- | --- | --- |
| 0 | idle A | top row 1 | draft |
| 1 | idle B | top row 2 (near-duplicate of 1) | draft |
| 2–5 | run contact / compression / passing / extension | top row 3–6 | draft |
| 6 | opposite-foot contact | bottom row, striding pose with raised fists | **ambiguous** |
| 7 | airborne recovery | bottom row, leaping pose with trailing leg extended | **ambiguous** |
| 8 | raised-knee jump | bottom row, raised knee + raised arm — the clearest airborne pose | draft |
| 9 | compact fall | bottom row far right | **ambiguous** |

**Two likely redundant poses:** the bottom row's leftmost standing figures duplicate the top row's
idle poses closely. They are the natural drop candidates — but only the contact sheet can confirm
which two (or three) are genuinely redundant.

### 2.4 Facing

Run poses face **right**, matching the hero's direction in `GAMEPLAY_REFERENCE`. Some standing
poses read as three-quarter front. **Risk:** a pose that faces left would flicker mid-animation.
The crop schema therefore supports a per-frame `flip_h` flag — a deterministic mirror, which is a
transform, not a redraw.

### 2.5 Alignment strategy

- Frames 0–7: one shared **foot baseline**, alpha-bbox bottom pinned to canvas row 47.
- Frames 8–9: **airborne**, lifted by a constant 3 px applied identically to both, so jump and fall
  never jitter relative to each other.

### 2.6 Risks of normalizing to 32x48

The source figures are roughly **100–110 px tall**. Reaching 48 px is a **non-integer ~1:2.2
downscale**. Nearest-neighbour at a non-integer ratio drops rows unevenly, which specifically
threatens:

1. **The ID badge** — roughly 2x3 px after scaling. Most likely detail to vanish. It is also the
   character's clearest identity marker.
2. **Facial features** — beard and eyes may collapse into a single dark mass.
3. **Shoes** — the brown/navy boundary may merge; watch that feet stay readable against the baseline.
4. **Hair silhouette** — the messy outline may alias into a blob.

Mitigation is documented in `ASSET_PIPELINE.md` §6.3. There is no way to eliminate this loss
without redrawing, which is forbidden.

---

## 3. HUD_BLOCKS_SOURCE — received (arrived early)

Approx. **972 x 611**, mint field.

### 3.1 Gameplay blocks — 9 observed, in two rows (4 then 5)

| Order | Block | Confidence |
| --- | --- | --- |
| 0 | Gold block with a `>_` prompt glyph — the terminal-command block | **certain** |
| 1–3 | Three tan/brown stone variants, 2x2 brick arrangements | **ambiguous mapping** |
| 4 | A darker, more heavily cracked tan stone | **ambiguous mapping** |
| 5 | Flat dark grey panel with a plain border — dark inactive | **certain** |
| 6 | Yellow/black hazard stripes framing a red warning triangle | **certain** |
| 7 | Grey rubble stone, already cracked — breakable | **certain** |
| 8 | Green-screen terminal with an arrow-into-door glyph — exit terminal | **certain** |

**The key ambiguity:** the board supplies **four tan stone variants**, not an explicit
left/center/right/under set. Mapping them to those four roles is a guess by board order. The
resolution is mechanical rather than aesthetic: run the pipeline's `tile_seam` check across all
four candidates and pick as `stone_center` whichever tiles seamlessly against itself.

### 3.2 HUD frames — 4 observed

Full-width **top strip**, a **VIEWDATA 3270** panel, a **MAP** panel, and a full-width
**bottom strip**. This confirms the top/bottom bars are full width and corrects the earlier
assumption that the bottom bar was a narrow right-hand panel.

### 3.3 Cleaning is much lighter than the handoff assumed

Good news from inspection — these are **already clean** in the source and need no covering:

- the POWER meter is drawn **empty**;
- the VIEWDATA screen interior is **blank**;
- the MAP grid carries **no markers**;
- CURRENT MISSION and OBJECTIVE show **headings only**, no baked content text.

Still requires cleaning:

- the baked `ALL SYSTEMS GO` status string;
- the baked SYS STATUS activity graph;
- the baked gold star in the ITEM slot;
- the five baked robot glyphs in the AUTOMATION row.

**Must stay baked** (permanent decorative): `OPS HERO`, `SCORE`, `JOBS`, `ALERTS`, `COINS`,
`PF KEYS`, the `PF1`–`PF12` button labels themselves, `SYS STATUS`, `MAP`, `CURRENT MISSION`,
`OBJECTIVE`, `ITEM`, `AUTOMATION`, `POWER`, `VIEWDATA 3270`.

---

## 4. ENVIRONMENT_SOURCE — received (arrived early)

Approx. **1024 x 559**, mint field, three rows.

### 4.1 Seventeen props, not thirteen

| Row | Props |
| --- | --- |
| 1 (6) | tall rack with LEDs · **wide double rack** (widest prop) · rack with one large tape reel · rack with two round dials · small pedestal cabinet · **double-door cabinet** |
| 2 (6) | beige CRT terminal with a green screen · beige keyboard · desk with drawers · office chair · small red dome beacon · **tall red beacon on a stand** |
| 3 (5) | wall-mounted monitor on an arm · freestanding monitor on legs · horizontal cable/conduit bundle · machinery module with LEDs and vents · square ventilation grille |

The contract named **13**. Four good props were unaccounted for. **Contract v2 keeps all 17** —
they are decorative, validated by maximum size only, so the cost of keeping them is zero and
discarding them would waste approved artwork. The four additions are `env-rack-wide`,
`env-tape-drive-dials`, `env-cabinet-double`, `env-warning-beacon-tall`.

### 4.2 Notes

- Props are large in source (~60–160 px). Against a 16 px tile world a rack lands near 28x56
  native — under 2 tiles wide by 3.5 tall. Cross-check against `GAMEPLAY_REFERENCE` before freezing.
- The CRT, wall monitor and freestanding monitor all carry **baked green screen text**. Their
  interiors go into `screen_interior` metadata so a later pass can swap them for pixel symbols.
- Consistent dark navy outlines and top-left highlights across all 17 — they will composite
  together cleanly.

---

## 5. BACKGROUNDS_SOURCE — received (arrived early)

Approx. **976 x 610**, mint field, three strips stacked in parallax order.

| Strip | Content | Layer |
| --- | --- | --- |
| 1 (top) | Vivid blue vertical gradient, darker at top, scattered white pixel clouds | `bg-far-sky.png`, factor **0.10** |
| 2 (mid) | Layered blue-grey ranges, one prominent snow-capped peak right of centre, dark evergreen forest along the bottom | `bg-mid-mountains.png`, factor **0.35** |
| 3 (bottom) | Near-black datacenter silhouettes: racks, overhead pipe runs, three circular fan units, consoles, monitors, small red/orange LED dots | `bg-near-datacenter.png`, factor **0.65** |

### 5.1 Correction: there is no mint artwork on this board

The written spec carried a special case — "the green foothills are mint artwork and must be
preserved". **That is wrong for this board.** The forest is a dark desaturated green, nowhere near
`#7CFFB2`. Contract v2 therefore sets `chroma_allowed: []`, so a genuine chroma leak can no longer
hide behind a bogus exception. The connectivity rule itself stays — it is still the correct
general-purpose algorithm.

### 5.2 Correction: the strips are shorter than the play viewport

Each strip is roughly **945 x 170–190**. Mapping width 945 → 480 is a **~1:2 downscale**, giving
layers of roughly **480 x 86–96** — noticeably **shorter** than the 184 px play viewport.

The wrong fix is upscaling to fill, which duplicates rows unevenly and destroys the pixel grid.
The right fix, now implemented: scale to the logical width, keep the resulting height, **anchor**
each layer (sky top, mountains and datacenter bottom), and fill the remainder with the camera clear
colour sampled from the sky gradient's top. The contract models this as
`size_mode: "exact_width_max_height"` and the pipeline emits a `WARN` naming the shortfall so it
stays visible rather than silent.

---

## 6. Pending boards — what is already known

No crop data may be authored for these. What the received boards tell us in advance:

| Board | Advance knowledge from batch 1 |
| --- | --- |
| `ICONS_SOURCE` | `GAMEPLAY_REFERENCE` shows nine icon blocks in play — silver, red, yellow, green, cyan on one row; magenta, blue, blue, black on another — each a bevelled metallic square with a **downward chevron**. Confirms the metallic family doubles as in-world platform blocks and fixes their visual language. |
| `ENEMIES_ITEMS_SOURCE` | The reference shows the command token as a **gold rounded square carrying the same `>_` glyph** as the terminal-command block. Token frames must read as that object rotating. The AUTOMATION row's robot glyphs hint at the enemy silhouette language. |
| `EFFECTS_SOURCE` | The reference's ITEM slot holds a **gold five-pointed star** — the invincibility pickup's HUD representation. Critically, this board **must** use `chroma_policy: "edge-and-enclosed"`: the aura rings are hollow, so mint inside a ring touches no board edge and the default policy would leave it opaque, breaking the "aura centre must be empty" gate. This was **proven by `tools/selftest_pipeline.py`**, which reproduced the failure and then confirmed the fix. |
| `VISTA_REFERENCE` | Reference only. Will confirm the metallic colour sequence and the four landscape subjects. |

---

## 7. Processing status summary

| Board | Status | Crops | Extraction |
| --- | --- | --- | --- |
| GAMEPLAY_REFERENCE | seen, not on disk | n/a (reference) | never cropped |
| VISTA_REFERENCE | **pending** | n/a (reference) | blocked, blocks nothing |
| PROTAGONIST_SOURCE | seen, not on disk | draft, unvalidated | blocked on file |
| ICONS_SOURCE | **pending** | none | **blocks operations-tiles.png** |
| ENEMIES_ITEMS_SOURCE | seen, not on disk | draft, unvalidated | blocked on file |
| EFFECTS_SOURCE | seen, not on disk | draft, unvalidated | blocked on file |
| HUD_BLOCKS_SOURCE | seen, not on disk | draft, unvalidated | blocked on file |
| ENVIRONMENT_SOURCE | seen, not on disk | draft, unvalidated | blocked on file |
| BACKGROUNDS_SOURCE | seen, not on disk | draft, unvalidated | blocked on file |

**No board has had a single crop coordinate visually validated.** Every `confidence` field in
`crop-config.draft.json` reads `draft_unvalidated` or `ambiguous`, and
`crop-config.draft.json → validated` is `false`.


---

## 8. Intake batch 2 — effects, enemies/items, and the real reference

### 8.1 `EFFECTS_SOURCE` — received

Approx. **1024 x 559**, mint field, three bands.

| Band | Contents | Contract |
| --- | --- | --- |
| Row 1 | Golden aura rings ramping **small → large → small** | 7 frames @ 64x64 |
| Row 2 left | 5 chunky outlined stars: yellow, cyan, magenta, lime, white | 5 sprites |
| Row 2 right | 8 particles alternating x-cross and 4-point spark, in orange, gold, blue, cyan, magenta, magenta, white, white | 8 sprites |
| Row 3 | 4 impact bursts growing left to right, already in playback order | 4 frames @ 32x32 |

Stars, sparkles and bursts match the contract exactly. **Two findings:**

**(a) Ring count is 7 or 8.** Visual reading is not conclusive. This is the single most important
thing `assets:inspect` must settle. The code is already structured so it costs two values to
change: `frame_count` in the contract and `INVINCIBILITY.AURA_FRAME_COUNT` in `Tuning.ts`.
`Animations.ts` derives its sequence from that constant and `contract.test.ts` asserts they agree.

**(b) Playback must be a straight loop, not ping-pong.** The rings already ramp small → large →
small, so a complete symmetric pulse is baked into the artwork. Ping-pong would replay the shrink
and visibly stutter. Contract v3 changes the rule and records why;
`INVINCIBILITY.AURA_PLAYBACK` keeps the original behaviour available.

**(c) Aura interiors are mint.** Confirmed: `chroma_policy: "edge-and-enclosed"` is mandatory for
this board, exactly as the pipeline self-test predicted.

Star and sparkle art carries thick dark outlines that an 8x8 canvas clips. Reference scale puts an
orbiting star near 10 px against a 48 px hero, so **contract v3 raises both canvases to 12x12**.

### 8.2 `ENEMIES_ITEMS_SOURCE` — received

Approx. **1024 x 745**, mint field, laid out in blocks rather than a uniform grid — so plain reading
order may not produce the region ids the draft assumes. Confirm with `assets:inspect`.

| Group | Poses on board | Selected | Note |
| --- | --- | --- | --- |
| Job Fail robot | **6** (3 red screen, 3 green, last tipped over) | 4 | Two redundant |
| Alert ground robot | 4 | 4 | Fourth raises both arms with a flashing beacon |
| Alert flying drone | 4 | 4 | Top rotor + twin thrusters |
| Spool Runaway | 4 | 4 | See typo below |
| Command token | 4 (3 coin views + 1 thin bar) | 4 | Needs reordering |
| Invincibility pickup | 4 | 4 | All four pulse accents present |

**Findings:**

1. **Job Fail has red- and green-screen variants.** The red trio is not junk — it is ready-made
   artwork for an *alerted* visual state. Recorded as `SKIPPED` rather than discarded, and noted as
   a natural post-MVP enhancement. MVP selects the green trio plus the tipped-over pose for a
   visually consistent walk cycle.
2. **One Spool Runaway screen reads `SPDOOL RUNAWAY` — a typo baked into the artwork.** The MVP
   keeps baked screen text, so that frame would ship the typo. Prefer the correctly-spelled poses
   plus the tape-symbol-screen pose, or clean that one screen interior.
3. **The command token needs reordering.** The thin vertical bar is the edge-on view, and reading
   order will not produce a smooth spin. Correct order: front, angled, **edge**, angled.
4. **Drone rotor width varies between frames.** This is precisely why common-centre alignment is
   mandatory — bounding-box alignment would make the drone wobble in flight.
5. The invincibility pickup is a **gold chevron badge**, reusing the operational icon chevron. Nice
   visual tie between pickup and icon blocks. Note the HUD `ITEM` slot shows a gold *star*; use the
   pickup sprite there for consistency, or keep the star as its HUD symbol.

### 8.3 `GAMEPLAY_REFERENCE` — full-fidelity replacement

The batch-2 reference is far richer than batch 1's and is now authoritative. It confirms:

- **The invincibility set piece**: golden aura renders **behind** the hero with coloured stars
  orbiting **in front** — exactly the composition `InvincibilitySystem` must reproduce.
- **Full parallax in situ**: blue sky with clouds, snow-capped mountains, dark evergreen forest,
  datacenter machinery — matching the three strips of `BACKGROUNDS_SOURCE`.
- **Icon blocks are platforms.** Both the metallic chevron family *and* all four landscape icons
  (palm, evergreen, green hills, snowy mountain) appear as in-world blocks. So the icon family's
  design is already known even though the croppable board has not arrived.
- All four enemy families in place, the in-world `z/OS` and `BATCH QUEUE` panels, and the MAP /
  VIEWDATA overlays.

**New ambiguity raised:** ground platforms here read as **grey stone brick**, while
`HUD_BLOCKS_SOURCE` supplies **tan/brown** stone variants plus one grey rubble block. Resolve which
variant is `stone_center` on the contact sheet before freezing `gameplay-tiles.png`. The mechanical
tie-breaker already exists: run the `tile_seam` check across all four candidates and pick the one
that repeats against itself cleanly.
