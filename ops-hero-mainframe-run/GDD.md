# GDD.md — OPS HERO: Mainframe Run — Game Design Document

Tech lives in `SPEC.md`. Numbers live in `GAMEPLAY_SPEC.md`. **This document is about why the game
is fun.** When a tuning decision is ambiguous, resolve it toward the pillars below.

---

## 1. Pitch

You are the last operator on the night shift. The batch window is closing, four jobs are stuck, and
the machine hall has started fighting back. Run the floor, clear the jobs, get out before the alert
board lights up.

A 60–90 second arcade platformer with a mainframe-operations skin that is played straight, not as a
joke. The comedy is in the sincerity: a man with a lanyard sprinting past a tape drive to fix a
print queue.

## 2. Design pillars

1. **Momentum is the fantasy.** The hero is competent. Controls are tight, acceleration is fast,
   and the level rewards never stopping. If a change makes the player hesitate, it is wrong.
2. **The HUD is the world.** Most platformers hide their UI. Here the giant operations console *is*
   the theme, and it should feel alive — the queue ticking, the graph twitching, PF keys lighting.
3. **Legibility over decoration.** 480x270 is small. Anything the player must react to reads
   instantly at that size, or it does not ship.
4. **One perfect minute.** This is a single level built to be replayed. Depth comes from mastery
   and score, not length.

## 3. Player fantasy and tone

Competent, slightly harried, unglamorous heroism. The hero never looks panicked — the run cycle is
confident. The world is hostile in a bureaucratic way: robots do not attack, they *malfunction*.
`JOB FAIL` is a status, not a threat.

Voice for all text: terse operator shorthand. `ALL SYSTEMS GO`. `QUEUE DEPTH 03`. `JOBS INCOMPLETE`.
Never chatty, never winking.

## 4. Core loop

```
run -> spot a job terminal -> route to it (jump / stomp / avoid) -> activate
     -> HUD reacts (JOB n COMPLETE, queue line, pip lights)
     -> collect on the way -> repeat x4 -> exit unlocks -> sprint to the terminal
```

Three interlocking currencies:

- **Jobs (4)** — the gate. You cannot leave without them. Pure objective.
- **Tokens** — the score. Optional, placed to pull you along riskier lines.
- **Alerts** — the anti-score. Rise when enemies notice you. Never blocks progress; it is the
  scoreboard's judgement of how cleanly you worked.

Alerts are the design's quiet centre: a player can always brute-force through, but a *good* player
threads the level without waking anything. That is the mastery axis.

## 5. Difficulty curve

| Section | ~Time | Teaches | Pressure |
| --- | --- | --- | --- |
| Cold start (0–38) | 0:00–0:12 | Run, jump, one 2-tile gap, first token, first terminal | None. Nothing can kill you here. |
| Tape library (39–95) | 0:12–0:30 | Stomping; ledge-aware enemies; 3–4 tile gaps | First real damage. One enemy at a time. |
| Cooling aisle (96–150) | 0:30–0:48 | Airborne threats; the invincibility pickup; checkpoint | Two threat planes at once. |
| Spool hall (151–205) | 0:48–1:05 | Charging enemies; breakable ceiling; reading a telegraph | Fastest enemy; tight corridor. |
| Power floor (206–265) | 1:05–1:20 | Everything combined; the level's hardest jump | Peak. Mixed enemy types. |
| Exit run (266–299) | 1:20–1:30 | Release | None. Descending stairs, token payout, victory. |

The shape is deliberate: **teach → test → combine → release.** The last section gives back speed and
a payout so the run *ends* on a high, not a failure. Nobody should die in the final 10 seconds.

**Checkpoint placement** sits at 150 — right after the hardest new mechanic (drones) and right
before the hardest execution (spool corridor). It is where a player has earned relief.

## 6. Moment-to-moment feel ("juice")

The MVP ships all of these. They are cheap and they are most of what makes a platformer feel
artisan rather than student-grade.

| Moment | Feedback |
| --- | --- |
| Jump | Squash 1 frame on takeoff (scaleY 0.9 for 60 ms) |
| Land | Stretch + 2-frame dust puff; heavier at high fall speed |
| Stomp | 4-frame freeze (~66 ms hitstop), enemy squash, bounce, chain number pops |
| Token collect | Token scales to 1.4 and fades over 150 ms; HUD count ticks with a 1-frame flash |
| Job complete | HUD status flips to `JOB n COMPLETE`, the job pip lights, a VIEWDATA line appends, screen-edge flash |
| Damage | 3-frame freeze, red screen vignette pulse, hero blinks for 1200 ms |
| Invincibility start | Aura pops in over 100 ms, stars fling out from the centre to orbit radius |
| Invincibility ending | Tint flash rate doubles for the final 2 s — the warning IS the feedback |
| Checkpoint | Beacon lights, `CHECKPOINT SAVED`, short chime cue reserved in `AudioSystem` |
| Exit (locked) | Terminal shakes 2 px, `JOBS INCOMPLETE` — never silently does nothing |

**Rule:** every player action gets a response inside 100 ms. If an input produces no visible change,
that is a bug, not a missing feature.

## 7. Camera

Follow with lerp (0.12 x, 0.08 y) and a deadzone of 80x60 so small hops do not swim. Look-ahead of
+24 px in the facing direction, eased over 300 ms — the player sees what they are running into.
Camera scroll is always floored to whole pixels; a sub-pixel camera destroys the art.

## 8. The invincibility moment

This is the game's set piece and the reference art leads with it. Eight seconds where the rules
invert: enemies become points, alerts stop mattering, and the player is encouraged to take the
dangerous line they were avoiding.

Design intent: place each pickup **just before a dense enemy cluster**, so the natural play is to
grab it and charge. The reward for good routing is a chain of impact bursts, not a safe walk.

The final two seconds flashing faster is the whole risk mechanic — it tells the player exactly how
much runway is left to commit.

## 9. Scoring and replay

Score is the reason to play again. The chain multiplier (1x→5x on consecutive airborne stomps) is
the skill expression: a player who can bounce four enemies without landing earns dramatically more
than one who plods. Time bonus rewards the confident line.

A run has a natural self-set goal: *all four jobs, zero alerts, one deathless pass.* The HUD shows
all three at once, so the player invents that challenge unprompted.

High score persists locally and is shown on the main menu — the only progression the MVP needs.

## 10. Difficulty and accessibility guardrails

- No enemy can kill a player who never leaves the ground in the first 12 seconds.
- Damage costs a life, never progress: jobs, tokens, alerts and score persist through death.
- Coyote time (100 ms) and jump buffering (120 ms) are non-negotiable — they are what makes a
  platformer feel fair rather than forgiving.
- No timed fail state. The par time only scales the bonus.
- Everything reactive is readable from silhouette alone; colour is never the only signal.

## 11. Explicitly out of scope for the MVP

Multiple levels · boss fight · saving mid-run · settings menu · remappable keys · gamepad ·
mobile touch · audio assets (the facade is wired, the cues are named, the files are absent) ·
enemy variety beyond the four families · any narrative beyond HUD text.

Each is a deliberate cut, not an oversight. The MVP is one polished minute.

## 12. Success criteria

The MVP is good if a first-time player:

1. completes a run without reading instructions;
2. dies at least once and does not feel cheated;
3. immediately plays again to beat their score.

If (3) does not happen, the problem is almost certainly pacing in the Power floor section or a
score readout that fails to celebrate the chain multiplier.
