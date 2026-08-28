# MAINFRAME: BREACH PROTOCOL — Prototype v1 Architectural Audit

Audit of the single-file prototype. Severity: **S1** = breaks the game, **S2** = breaks a
system silently, **S3** = design/perf/polish debt.

## S1 — Game-breaking

| # | Finding | Location | Evidence |
|---|---|---|---|
| 1 | **Client identity annihilation.** `Object.assign(State, msg.state)` copies the host's `myId`, `isHost`, `isOffline` into every peer. On first SYNC every client believes it is the host, runs `hostTick`, and drives the host's avatar. | `Net._handleHostData` | Snapshot is `JSON.parse(JSON.stringify(State))` — includes identity fields. |
| 2 | **Host's own tasks never count.** `TaskEngine.complete` pushes to `me.done` locally, then `processAction` rejects with `if(!actor.done.includes(payload))` — same object reference. `tasksCompleted` never increments and SLA never restores for the host. | `TaskEngine.complete` → `Game.processAction` | Same-reference double-write. |
| 3 | **Bots freeze permanently.** `yukaTime.update()` is never called, so `yukaTime.getDelta()` returns 0. `WorkState.timer -= 0` never reaches zero. Bots arrive at a terminal and stop forever; global task tracker never advances; `FleeState` never exits. | `WorkState.execute`, `FleeState.execute` | `grep yukaTime.update` → no hits. |
| 4 | **Role identity broadcast in plaintext.** `isSaboteur` is in every snapshot sent to every peer. The hidden-role secret is readable from the network tab. | `Net.broadcast` | Full-state clone, no redaction. |
| 5 | **Unvalidated client actions.** `TASK_DONE` is not checked against `actor.tasks` or proximity; `INPUT` accepts arbitrary `x,y` with no speed or wall validation. A peer can teleport or instant-win. | `Net._handleClientData`, `Game.processAction` | Direct contradiction of the Zero-Trust directive. |

## S2 — Silent system failures

| # | Finding | Location |
|---|---|---|
| 6 | **NaN laundering.** `Math.max(0, Math.min(n, Math.floor(undefined)))` → `NaN` (verified). Guardrail-#3 clamps propagate NaN rather than blocking it. `PathState.enter` can leave `tx/ty` undefined → bot position NaN → broadcast NaN → avatar vanishes. | `findPath`, `PathState.enter` |
| 7 | **Bot flee-on-revoke is dead code.** `entityManager.entities.find(e => e.botId === p.id)` — player records have no `id` field, so the lookup always fails. | `Game.processAction` REVOKE |
| 8 | **Mutation during iteration.** `entityManager.entities.forEach(e => entityManager.remove(e))` splices the array being iterated; roughly half the bots survive a round reset. | `BotManager.init` |
| 9 | **Emergency Bridge unreachable from the table.** No task zone has `type:'MEETING'`, so `nearZ.type==='MEETING'` never matches. Meetings can only be called by reporting a body. | `SI.task_zones`, `UI.updateHUD` |
| 10 | **Master IPL interaction point is a hardcoded literal** `Math.hypot(me.x - 5, me.y - 8)`. The value itself is correct (the table at `(5,9)` is solid; `(5,8)` is its walkable neighbour) but it is duplicated, undocumented, and silently wrong the moment the table moves. | `UI.updateHUD` |
| 11 | **Pathfinding walks into geometry.** `findPath` returns the goal before testing whether the goal tile is blocked. `HuntState` sets `arrive.target` directly with no path — saboteur bots hunt straight through walls. | `findPath`, `HuntState.execute` |
| 12 | **Desks and chairs are not solid.** `BLOCKED = {0,4,5,6}` excludes tile `3` (desk) and `9` (chair), both rendered as solid meshes. Players walk through terminals. | `BLOCKED` |
| 13 | **Shared-material flicker.** All LED meshes share one `mLedR` instance and all screens share `mScrn`; per-mesh `emissiveIntensity` writes overwrite each other. The "individual flicker" is a single global value written N times per frame. | `Render.update` |
| 14 | **Audio guardrail self-violation.** `Aud.setSabotageMode` calls `drone.disconnect()` / `.chain()` mid-game — precisely what guardrail #2 forbids. | `Aud.setSabotageMode` |
| 15 | **Undisposed audio nodes.** `alarm` and `revoke_sfx` allocate a new `Tone.Oscillator` per call, started and stopped but never `.dispose()`d — unbounded node graph growth. | `Aud.play` |
| 16 | **Drone attack pop.** `triggerAttack("C2")` fires before `volume.value = -20`, so the drone starts at 0 dB. | `Aud.init` |
| 17 | **Same-timestamp retrigger.** `Net.sendSnd('sting')` and `sendSnd('alarm')` fire in the same tick; the per-cue 0.1s throttle does not protect a *shared* synth. `sting` and `task_ok` both hit `synths.success` → "Start time must be strictly greater than previous". | `Aud.play`, `CALL_MEETING` |
| 18 | **Tasks completable during meetings.** `applyPhase` does not close `#task-modal`; the task timer keeps running under the Bridge overlay. | `UI.applyPhase` |
| 19 | **Locked-out players can still act.** `REVOKE` and `CALL_MEETING` never check `actor.isLockedOut`. | `Game.processAction` |
| 20 | **`.dead` CSS class does not exist.** `renderVote` emits `class="vote-row dead"`; the stylesheet defines `.locked`. Locked-out operators are not struck out in the vote list, and are still votable. | `UI.renderVote` |
| 21 | **Interval leak.** `TaskEngine.open` nulls `_cleanup` before assigning; opening a task while one is live orphans the `_renderAck` interval. | `TaskEngine.open` |
| 22 | **Keyboard leaks into `<select>`.** Keydown only guards `tagName === 'INPUT'`; WASD during a dropdown task both moves the player and changes the selection. | keydown listener |
| 23 | **Bots can win the game remotely.** `WorkState` fires `MASTER_IPL` with no proximity check to the bridge table. | `WorkState.execute` |
| 24 | **`catch(e) {}`** swallows every render exception silently. | `Render.update` |

## S3 — Design & performance debt

- **`SI.sounds` is entirely unused.** The audio engine hardcodes `'click'`, `'hover'`, `'vote'`. The manifest's sound registry is decorative — a DRY violation at the heart of the SMART INTENT contract.
- **Role abilities are unimplemented.** "DBA: tasks run 2× speed", "MGR: no meeting cooldown", "NOC: SLA drain visibility" appear nowhere in the logic. Roles are cosmetic.
- **60 fps full-state broadcast.** `JSON.parse(JSON.stringify(State))` per frame per peer. No tick rate, no delta encoding, no dirty flagging.
- **60 fps innerHTML rebuild.** `updateHUD` re-renders the task list, sabotage panel and the entire vote list every frame.
- **Trivial minigames.** `FILE_INCIDENT` answer is always `P1 / Mainframe-Ops` (both first options); `ROUTE_CHECK` answer is always `[0,1]` with identical option lists. Zero replay value.
- **Crew get no abend warning.** `#hud-sab-status` is saboteur-only.
- **Saboteur bots cannot catch anyone.** Bot `maxSpeed 3.2` vs `player_speed 5.0`.
- **No instancing.** ~150+ individual meshes for static map geometry.
- **Wander behavior is allocated and permanently disabled** — dead steering weight on every bot.
