/* ═══════════════════════════════════════════════════════════════════════════
   MAINFRAME: BREACH PROTOCOL — SMART INTENT MANIFEST  v2.0
   Single source of truth. Nothing downstream may invent an id that is not
   declared here. All derived lookup structures are built by SI.compile().
   ═══════════════════════════════════════════════════════════════════════════ */
export const SI = {
  version: '2.0.0',

  /* ── TILE REGISTRY ────────────────────────────────────────────────────────
     Replaces the hardcoded `BLOCKED = new Set([0,4,5,6])`. Collision, line of
     sight and rendering are now three columns of one table, so a solid-looking
     desk can never again be walk-through. */
  tiles: {
    0: { key:'VOID',     walkable:false, opaque:true,  mesh:null },
    1: { key:'FLOOR_NOC',walkable:true,  opaque:false, mesh:'floor.noc' },
    2: { key:'FLOOR_DC', walkable:true,  opaque:false, mesh:'floor.datacenter' },
    3: { key:'DESK',     walkable:false, opaque:false, mesh:'prop.desk',   emissive:'screen' },
    4: { key:'RACK',     walkable:false, opaque:true,  mesh:'prop.rack',   emissive:'led' },
    5: { key:'WALL',     walkable:false, opaque:true,  mesh:'prop.wall' },
    6: { key:'DOOR',     walkable:true,  opaque:false, mesh:'prop.door',   lockable:true },
    7: { key:'BRIDGE',   walkable:false, opaque:false, mesh:'prop.bridgeTable' },
    8: { key:'GLASS',    walkable:false, opaque:false, mesh:'prop.glass' },
    9: { key:'CHAIR',    walkable:true,  opaque:false, mesh:'prop.chair' }
  },

  map: {
    cols: 26, rows: 16,
    /* Rooms exist as data so lighting, audio reverb and "who was where" reports
       can all be derived instead of eyeballed. */
    rooms: [
      { id:'NOC',    label:'NOC FLOOR',      rect:[1,1,16,10], ambient:'#88bbdd', reverb:0.35 },
      { id:'DC',     label:'DATA CENTER',    rect:[18,1,7,9],  ambient:'#5577aa', reverb:0.75 },
      { id:'BRIDGE', label:'BRIDGE ALCOVE',  rect:[3,7,5,4],   ambient:'#aa8866', reverb:0.20 }
    ],
    grid: [
      [5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5],
      [5,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,5,6,2,2,2,2,2,2,5],
      [5,1,3,1,3,1,3,1,3,1,3,1,3,1,1,1,1,5,2,4,2,4,2,4,2,5],
      [5,1,9,1,9,1,9,1,9,1,9,1,9,1,1,1,1,5,2,4,2,4,2,4,2,5],
      [5,1,3,1,3,1,3,1,3,1,3,1,3,1,1,1,1,5,2,4,2,4,2,4,2,5],
      [5,1,9,1,9,1,9,1,9,1,9,1,9,1,1,1,1,6,2,2,2,2,2,2,2,5],
      [5,1,3,1,3,1,3,1,3,1,3,1,3,1,1,1,1,5,2,4,2,4,2,4,2,5],
      [5,1,9,1,9,1,9,1,9,1,9,1,9,1,1,1,1,5,2,4,2,4,2,4,2,5],
      [5,1,1,1,1,9,1,1,1,1,1,1,1,1,1,1,1,5,2,4,2,4,2,4,2,5],
      [5,1,1,1,9,7,9,1,1,1,1,1,1,1,1,1,1,5,2,2,2,2,2,2,2,5],
      [5,1,1,1,1,9,1,1,1,1,1,1,1,1,1,1,1,5,5,5,5,5,5,5,5,5],
      [5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5],
      [0,0,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]
    ]
  },

  /* ── INTERACTABLE ZONES ───────────────────────────────────────────────────
     `anchor` is the console tile (may be solid). `stand` is resolved by
     SI.compile() to the nearest walkable neighbour — no more `row-1` guesswork
     and no more hardcoded (5,8) for the Master IPL. */
  zones: [
    { id:'TZ-ACK1',  anchor:[2,2],  task:'ACK_ALERT',     room:'NOC', label:'Terminal NOC-A1' },
    { id:'TZ-ACK2',  anchor:[4,2],  task:'ACK_ALERT',     room:'NOC', label:'Terminal NOC-A2' },
    { id:'TZ-ACK3',  anchor:[6,2],  task:'ACK_ALERT',     room:'NOC', label:'Terminal NOC-A3' },
    { id:'TZ-ACK4',  anchor:[8,6],  task:'ACK_ALERT',     room:'NOC', label:'Terminal NOC-B1' },
    { id:'TZ-INC1',  anchor:[2,4],  task:'FILE_INCIDENT', room:'NOC', label:'Incident Stn 1' },
    { id:'TZ-INC2',  anchor:[6,4],  task:'FILE_INCIDENT', room:'NOC', label:'Incident Stn 2' },
    { id:'TZ-INC3',  anchor:[10,4], task:'FILE_INCIDENT', room:'NOC', label:'Incident Stn 3' },
    { id:'TZ-ROUTE1',anchor:[12,2], task:'ROUTE_CHECK',   room:'NOC', label:'Network Routing A' },
    { id:'TZ-ROUTE2',anchor:[12,6], task:'ROUTE_CHECK',   room:'NOC', label:'Network Routing B' },
    { id:'TZ-KILL1', anchor:[19,2], task:'KILL_ABEND',    room:'DC',  label:'Rack SYS-01' },
    { id:'TZ-KILL2', anchor:[21,4], task:'KILL_ABEND',    room:'DC',  label:'Rack SYS-02' },
    { id:'TZ-KILL3', anchor:[23,6], task:'KILL_ABEND',    room:'DC',  label:'Rack SYS-03' },
    { id:'TZ-IPL1',  anchor:[19,6], task:'REBOOT_LPAR',   room:'DC',  label:'LPAR Ctrl A' },
    { id:'TZ-IPL2',  anchor:[21,8], task:'REBOOT_LPAR',   room:'DC',  label:'LPAR Ctrl B' },
    /* Two-stage: start in the NOC, finish in the DC. Generates the cross-map
       movement that makes alibis meaningful. */
    { id:'TZ-TAPE-A',anchor:[14,2], task:'TAPE_RESTORE',  room:'NOC', label:'Backup Console', stage:1, pairs:'TZ-TAPE-B' },
    { id:'TZ-TAPE-B',anchor:[23,2], task:'TAPE_RESTORE',  room:'DC',  label:'Tape Library',   stage:2, pairs:'TZ-TAPE-A' },
    /* Fixed-function zones. Declared, not hardcoded. */
    { id:'ZX-BRIDGE',anchor:[5,9],  task:null, kind:'CALL_BRIDGE', room:'BRIDGE', label:'Bridge Table' },
    { id:'ZX-MASTER',anchor:[5,9],  task:'MASTER_IPL', kind:'MASTER_IPL', room:'BRIDGE', label:'Master Console', requires:'masterUnlock' }
  ],

  /* ── TASK DEFINITIONS ─────────────────────────────────────────────────────
     `gen` names a generator function in the TaskEngine registry. `seed:'round'`
     means the puzzle is randomised per round rather than fixed, killing the
     always-P1/Mainframe-Ops memorisation exploit. */
  tasks: {
    ACK_ALERT:     { label:'ACKNOWLEDGE ALERT',     gen:'ackFeed',    dur:9,  restore:12, seed:'round', juice:'stamp' },
    FILE_INCIDENT: { label:'FILE INCIDENT TICKET',  gen:'triageForm', dur:14, restore:18, seed:'round', juice:'stamp' },
    KILL_ABEND:    { label:'CANCEL ABENDING JOB',   gen:'jobSpool',   dur:11, restore:15, seed:'round', juice:'purge' },
    REBOOT_LPAR:   { label:'IPL RECOVERY SEQUENCE', gen:'sequence',   dur:16, restore:22, seed:'round', juice:'powerup' },
    ROUTE_CHECK:   { label:'VERIFY ROUTING TABLE',  gen:'routeMatch', dur:13, restore:15, seed:'round', juice:'stamp' },
    TAPE_RESTORE:  { label:'RESTORE FROM TAPE',     gen:'tapeSeek',   dur:12, restore:20, seed:'round', juice:'powerup', twoStage:true },
    MASTER_IPL:    { label:'EXECUTE MASTER REBOOT', gen:'masterIpl',  dur:10, restore:0,  seed:'none',  juice:'finale' }
  },

  /* ── ROLES ────────────────────────────────────────────────────────────────
     Every ability now names a modifier hook that the rules engine actually
     reads. No cosmetic perks. */
  roles: [
    { id:'SYS', name:'SYSADMIN',       color:'#ffb300', blurb:'Any zone. Any fix.',
      abilities:[{ hook:'fixSpeed',      mul:1.5 }, { hook:'canFixAnyZoneType', value:true }] },
    { id:'NOC', name:'NOC ANALYST',    color:'#00c8ff', blurb:'Sees the bleed before anyone else.',
      abilities:[{ hook:'revealDrainSource', value:true }, { hook:'sabotageAlertLead', sec:3 }] },
    { id:'DBA', name:'DATABASE ADMIN', color:'#00ff88', blurb:'Works twice as fast, alone.',
      abilities:[{ hook:'taskDuration',  mul:0.5 }] },
    { id:'MGR', name:'PROBLEM MGR',    color:'#9b5de5', blurb:'Can convene the bridge on demand.',
      abilities:[{ hook:'bridgeCooldown', mul:0.0 }, { hook:'voteWeight', add:1 }] }
  ],

  playerColors: ['#E74C3C','#3498DB','#2ECC71','#F39C12','#9B59B6','#1ABC9C','#E91E63','#FF5722'],

  /* ── SABOTAGE ─────────────────────────────────────────────────────────────
     Typed effects consumed by one reducer, and every sabotage names the zone
     type that counters it so the HUD can route the crew without a wiki. */
  sabotage: [
    { id:'SAB-ABEND',   icon:'⚠',  label:'TRIGGER ABEND',     cd:25, effect:'DRAIN',      drain:2.9,  counterTask:'REBOOT_LPAR', counterCount:1, alarm:'critical' },
    { id:'SAB-LOCKOUT', icon:'🔒', label:'CORRUPT ZONES',     cd:35, effect:'LOCK_ZONES', dur:40, count:3, counterTask:null,       alarm:'warn' },
    { id:'SAB-BOMB',    icon:'💣', label:'PLANT LOGIC BOMB',  cd:45, effect:'DRAIN',      drain:0.55, counterTask:'ACK_ALERT',   counterCount:2, alarm:'silent' },
    { id:'SAB-DOORS',   icon:'⛔', label:'SEAL BULKHEADS',    cd:30, effect:'LOCK_DOORS', dur:15,     counterTask:null,          alarm:'warn' },
    { id:'SAB-SPOOF',   icon:'📡', label:'SPOOF FALSE ALERT', cd:40, effect:'FAKE_ALARM', dur:12,     counterTask:null,          alarm:'critical' }
  ],

  /* ── RULES ────────────────────────────────────────────────────────────────*/
  rules: {
    slaIdleDrain: 0.12, slaMax: 100,
    tasksPerCrew: 4,
    playerSpeed: 5.0, botSpeed: 4.6,          /* was 3.2 — bots could never catch anyone */
    interactRange: 1.4, revokeRange: 1.6, reportRange: 4.0,
    revokeCooldown: 20, bridgeCooldown: 40,
    discussionDur: 15, votingDur: 30, ejectRevealDur: 5,
    minPlayersForSaboteur: 2,
    saboteurRatio: [ {upTo:6, count:1}, {upTo:10, count:2} ]
  },

  /* ── AI ───────────────────────────────────────────────────────────────────
     State ids declared before any entity exists (guardrail #1). The transition
     table is data, so an illegal transition is caught at compile time. */
  ai: {
    states: ['PATROL','PATH','WORK','FAKE_WORK','HUNT','FLEE','ALIBI'],
    transitions: {
      PATROL:   ['PATH','HUNT','ALIBI'],
      PATH:     ['WORK','FAKE_WORK','HUNT','FLEE','PATROL'],
      WORK:     ['PATH','FLEE','PATROL'],
      FAKE_WORK:['PATH','HUNT','FLEE'],
      HUNT:     ['FLEE','PATH','PATROL'],
      FLEE:     ['PATH','ALIBI','PATROL'],
      ALIBI:    ['PATH','PATROL']
    },
    count: 5,
    roster: [
      { id:'BOT-ALPHA',   name:'Δ ALPHA',   color:'#8a97a8', spawn:[8,5]  },
      { id:'BOT-BETA',    name:'Β BETA',    color:'#7c8a9c', spawn:[19,7] },
      { id:'BOT-DELTA',   name:'Δ DELTA',   color:'#96a3b4', spawn:[12,3] },
      { id:'BOT-GAMMA',   name:'Γ GAMMA',   color:'#6e7b8d', spawn:[4,8]  },
      { id:'BOT-EPSILON', name:'Ε EPSILON', color:'#5f6c7e', spawn:[20,3] }
    ],
    tuning: { workMin:4, workMax:8, huntPatience:9, fleeDur:6, reportChance:0.35, alibiDur:5 }
  },

  /* ── AUDIO ────────────────────────────────────────────────────────────────
     Cue ids are the ONLY names the engine accepts. `voice` maps to a
     pre-compiled synth allocated once at boot — never chained or disconnected
     at runtime (guardrail #2). `minGap` throttles per VOICE, not per cue, which
     is what actually prevents the "start time must be strictly greater"
     exception when two cues share a synth. */
  audio: {
    voices: {
      ui:      { type:'PolySynth', osc:'square',   env:[0.01,0.10,0.00,0.10], vol:-14, bus:'dry' },
      confirm: { type:'PolySynth', osc:'sine',     env:[0.01,0.20,0.20,0.50], vol:-10, bus:'verb' },
      fault:   { type:'FMSynth',   osc:'sawtooth', harmonicity:8, modIndex:10, vol:-8, bus:'dry' },
      siren:   { type:'MonoSynth', osc:'square',   env:[0.01,0.30,0.40,0.30], vol:-12, bus:'crush' },
      drone:   { type:'FMSynth',   osc:'sine',     harmonicity:0.5, modIndex:2, vol:-60, bus:'verb' }
    },
    /* Fixed buses. Built once; the sabotage transition crossfades WET AMOUNT
       on a pre-wired parallel path instead of re-patching the graph. */
    buses: { dry:[], verb:['reverb'], crush:['bitcrusher','distortion'] },
    cues: {
      ui_click:   { voice:'ui',      note:'C5',  dur:'32n', minGap:0.04 },
      ui_hover:   { voice:'ui',      note:'G4',  dur:'64n', minGap:0.03, vel:0.4 },
      task_ok:    { voice:'confirm', note:['C4','E4','G4'], dur:'8n', minGap:0.12 },
      task_fail:  { voice:'fault',   note:'C2',  dur:'8n',  minGap:0.12 },
      vote_cast:  { voice:'confirm', note:'C5',  dur:'16n', minGap:0.10 },
      alarm:      { voice:'siren',   note:'E3',  dur:'4n',  minGap:0.30, sweepTo:'A2' },
      revoke:     { voice:'fault',   note:'C3',  dur:'2n',  minGap:0.50, sweepTo:'C1' },
      sting:      { voice:'fault',   note:'C1',  dur:'2n',  minGap:0.60 },
      unlock:     { voice:'confirm', note:['G4','C5','E5'], dur:'4n', minGap:0.40 }
    },
    /* Drone volume ramps from silence AFTER attack — no 0 dB pop at boot. */
    drone: { note:'C2', calmVol:-20, alertVol:-10, calmNote:'C2', alertNote:'C1', rampSec:2 }
  },

  /* ── NETWORK ──────────────────────────────────────────────────────────────
     The redaction contract is the fix for the plaintext-saboteur leak, and the
     identity block is what stops a peer inheriting the host's `myId`/`isHost`. */
  net: {
    prefix: 'MFBP-',
    tickHz: 15,                      /* was every frame with a full deep clone */
    localIdentityKeys: ['myId','isHost','isOffline','peer','conns','hostConn'],
    snapshot: {
      broadcast: ['phase','sla','timer','callerName','tasksCompleted','totalTasksNeeded',
                  'masterUnlock','lockedZones','lockedDoors','activeEffects','votes','bridgeCooldown'],
      perPlayerPublic:  ['name','role','color','x','y','isLockedOut','doneCount','isWorking','workAnchor'],
      perPlayerPrivate: ['isSaboteur','tasks','done','sabCooldowns','revokeCooldown']
    },
    messages: {
      JOIN:    { from:'client', schema:{} },
      PROFILE: { from:'client', schema:{ name:'str12', role:'roleId', color:'hex' } },
      INTENT:  { from:'client', schema:{ ax:'unit', ay:'unit', seq:'int' }, validate:'speedAndCollision' },
      ACTION:  { from:'client', schema:{ action:'actionId', payload:'str' }, validate:'proximityAndOwnership' },
      SNAPSHOT:{ from:'host' }, PRIVATE:{ from:'host' }, CUE:{ from:'host' }, PHASE:{ from:'host' }
    },
    /* Host-side validators, named here so no action path can skip one. */
    validators: ['speedAndCollision','proximityAndOwnership','taskOwnership','phaseLegality','cooldownReady','notLockedOut']
  },

  /* ── PRESENTATION ─────────────────────────────────────────────────────────*/
  render: {
    bg:'#0c162d', fogNear:35, fogFar:65, fogSabotageFar:25,
    emissive: { screen:2.5, led:2.0, visor:1.5 },
    instanced: ['prop.wall','prop.rack','prop.desk','prop.chair','floor.noc','floor.datacenter'],
    camera: { orthoHalfHeight:12, offset:[20,20,20], followLerp:0.07 },
    shadowMapSize: 2048,
    frameBudgetMs: 16.6
  },

  phases: ['MENU','LOBBY','PROFILE','PLAYING','DISCUSSION','VOTING','EJECT_REVEAL','END'],

  endings: {
    CREW_IPL:      { title:'OPERATIONS NORMALIZED', reason:'Master IPL executed. SLA permanently stabilized.', side:'CREW' },
    CREW_REVOKED:  { title:'ROGUE ADMIN REVOKED',   reason:'Insider threat credentials revoked.',              side:'CREW' },
    SAB_SLA:       { title:'MAINFRAME COMPROMISED', reason:'SLA breached. Operations offline.',                side:'SABOTEUR' },
    SAB_LOCKOUT:   { title:'CREW LOCKED OUT',       reason:'Insufficient operators to maintain SLA.',          side:'SABOTEUR' }
  }
};

/* ── COMPILER ───────────────────────────────────────────────────────────────
   Builds every derived structure ONCE at boot and freezes the result. Any
   lookup used at runtime comes from here, so there is exactly one place where
   a bad id can be caught — and it throws loudly at boot instead of producing
   NaN at frame 4000. */
export function compile(si = SI) {
  const D = { walkable:new Set(), opaque:new Set(), zoneById:new Map(), zonesByTask:new Map(), roleById:new Map(), sabById:new Map(), cueById:new Map() };

  for (const [code, t] of Object.entries(si.tiles)) {
    if (t.walkable) D.walkable.add(Number(code));
    if (t.opaque)   D.opaque.add(Number(code));
  }

  const tileAt = (c, r) => si.map.grid[r]?.[c] ?? 0;
  const isWalkable = (c, r) => D.walkable.has(tileAt(c, r));

  /* Resolve each zone's standing tile from its anchor — the fix for the
     `row-1` assumption and the hardcoded Master IPL coordinate. */
  const NEIGHBOURS = [[0,-1],[0,1],[-1,0],[1,0],[-1,-1],[1,-1],[-1,1],[1,1]];
  for (const z of si.zones) {
    const [ac, ar] = z.anchor;
    z.stand = isWalkable(ac, ar) ? [ac, ar]
      : (NEIGHBOURS.map(([dc,dr]) => [ac+dc, ar+dr]).find(([c,r]) => isWalkable(c, r)) || null);
    if (!z.stand) throw new Error(`[SI] Zone ${z.id} anchor ${z.anchor} has no walkable neighbour.`);
    if (z.task && !si.tasks[z.task]) throw new Error(`[SI] Zone ${z.id} references unknown task ${z.task}.`);
    if (z.pairs && !si.zones.some(o => o.id === z.pairs)) throw new Error(`[SI] Zone ${z.id} pairs with unknown ${z.pairs}.`);
    D.zoneById.set(z.id, z);
    if (z.task) { if (!D.zonesByTask.has(z.task)) D.zonesByTask.set(z.task, []); D.zonesByTask.get(z.task).push(z); }
  }

  for (const r of si.roles) {
    for (const a of r.abilities) if (!HOOKS.has(a.hook)) throw new Error(`[SI] Role ${r.id} uses unknown hook ${a.hook}.`);
    D.roleById.set(r.id, r);
  }
  for (const s of si.sabotage) {
    if (s.counterTask && !si.tasks[s.counterTask]) throw new Error(`[SI] Sabotage ${s.id} counters unknown task ${s.counterTask}.`);
    D.sabById.set(s.id, s);
  }
  for (const [id, c] of Object.entries(si.audio.cues)) {
    if (!si.audio.voices[c.voice]) throw new Error(`[SI] Cue ${id} uses unknown voice ${c.voice}.`);
    D.cueById.set(id, c);
  }
  for (const from in si.ai.transitions) {
    if (!si.ai.states.includes(from)) throw new Error(`[SI] Unknown AI state ${from}.`);
    for (const to of si.ai.transitions[from]) if (!si.ai.states.includes(to)) throw new Error(`[SI] ${from} -> unknown ${to}.`);
  }

  D.tileAt = tileAt;
  D.isWalkable = isWalkable;
  D.isOpaque = (c, r) => D.opaque.has(tileAt(c, r));
  return Object.freeze(D);
}

/* Every ability hook the rules engine implements. A role perk that is not in
   this set fails the boot compile rather than silently doing nothing — the fix
   for "DBA works 2x faster" existing only in a tooltip. */
export const HOOKS = new Set([
  'fixSpeed','canFixAnyZoneType','revealDrainSource','sabotageAlertLead',
  'taskDuration','bridgeCooldown','voteWeight'
]);
