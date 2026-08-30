/**
 * Every gameplay number in one place. No magic numbers anywhere else in the codebase.
 * Mirrored in GAMEPLAY_SPEC.md -- if they disagree, this file is wrong.
 *
 * Units: distance px, velocity px/s, acceleration px/s^2, time ms, angles rad.
 */

/** Native tile size. The whole world is authored on this grid. */
export const TILE_SIZE = 16;

export const WORLD = {
  /** Level grid in tiles: 300 x 24 = 4800 x 384 px. */
  WIDTH_IN_TILES: 300,
  HEIGHT_IN_TILES: 24,
  GRAVITY_Y: 900,
  /** Falling this far below the level bottom costs a life. */
  KILL_PLANE_MARGIN_PX: 32,
  /** Par time for the end-of-level time bonus. */
  PAR_TIME_MS: 90_000,
} as const;

export const VIEWPORT = {
  LOGICAL_WIDTH: 480,
  LOGICAL_HEIGHT: 270,
  HUD_TOP_HEIGHT: 42,
  HUD_BOTTOM_HEIGHT: 47,
  /** 270 - 42 - 47. The gameplay camera occupies exactly this band. */
  PLAY_HEIGHT: 181,
  PLAY_Y: 42,
} as const;

export const PLAYER = {
  MAX_RUN_SPEED: 110,
  RUN_ACCELERATION: 900,
  GROUND_DRAG: 1200,
  AIR_DRAG: 400,
  /** Air steering is weaker than ground steering. */
  AIR_CONTROL_FACTOR: 0.65,
  /** Apex = 300^2 / (2 * 900) = 50 px, just over 3 tiles. */
  JUMP_VELOCITY: -300,
  /** On early release, upward velocity is clamped to this -- the variable-height jump. */
  JUMP_CUT_VELOCITY: -120,
  MAX_FALL_SPEED: 420,
  COYOTE_TIME_MS: 100,
  JUMP_BUFFER_MS: 120,
  STOMP_BOUNCE_VELOCITY: -210,
  /** Body inside the 32x48 frame. Feet sit on the frame's bottom edge (foot-baseline alignment). */
  BODY_WIDTH: 14,
  BODY_HEIGHT: 40,
  BODY_OFFSET_X: 9,
  BODY_OFFSET_Y: 8,
  HIT_INVULN_MS: 1200,
  /** Visibility toggle period while hit-invulnerable. */
  HIT_BLINK_INTERVAL_MS: 80,
  RESPAWN_DELAY_MS: 700,
  START_LIVES: 3,
  /** Below this horizontal speed the player is considered idle rather than running. */
  IDLE_SPEED_EPSILON: 8,
} as const;

/**
 * Derived reachability budget, used by the level tests.
 * airtime = 2 * |JUMP_VELOCITY| / GRAVITY_Y ~= 0.667 s
 * reach   = airtime * MAX_RUN_SPEED ~= 73 px ~= 4.5 tiles
 */
export const REACHABILITY = {
  MAX_GAP_TILES: 4,
  MAX_STEP_TILES: 3,
} as const;

export const ENEMY = {
  /** Player must be falling AND land within this many px of the enemy's top to stomp. */
  STOMP_TOLERANCE_PX: 8,
  /** Frame index of the deactivated pose in every 4-frame enemy sheet. */
  DEACTIVATED_FRAME: 3,
  /** Ledge-aware patrol: how far ahead of the body, and how far below its feet, to probe for ground. */
  LEDGE_PROBE_AHEAD_PX: 4,
  LEDGE_PROBE_DOWN_PX: 6,
  JOB_FAIL_BOT: { SPEED: 30, AGGRO_RANGE: 90, BODY_WIDTH: 20, BODY_HEIGHT: 22, SCORE: 200 },
  ALERT_BOT: { SPEED: 45, ALERTED_SPEED: 70, AGGRO_RANGE: 120, BODY_WIDTH: 22, BODY_HEIGHT: 24, SCORE: 200 },
  ALERT_DRONE: {
    SPEED: 40,
    AGGRO_RANGE: 140,
    BODY_WIDTH: 22,
    BODY_HEIGHT: 18,
    SINE_AMPLITUDE_PX: 22,
    SINE_SPEED_RAD_PER_S: 1.6,
    SCORE: 250,
  },
  SPOOL_RUNAWAY: {
    IDLE_SPEED: 0,
    CHARGE_SPEED: 95,
    AGGRO_RANGE: 150,
    TELEGRAPH_MS: 400,
    BODY_WIDTH: 24,
    BODY_HEIGHT: 24,
    SCORE: 300,
  },
} as const;

export const SCORING = {
  TOKEN: 100,
  STOMP_BASE: 200,
  INVINCIBLE_DEFEAT: 300,
  JOB_COMPLETE: 1000,
  LEVEL_COMPLETE: 2500,
  /** Points per whole second remaining against WORLD.PAR_TIME_MS. */
  TIME_BONUS_PER_SECOND: 10,
  /** Consecutive airborne stomps multiply 1x, 2x, 3x... up to this cap. */
  MAX_STOMP_CHAIN_MULTIPLIER: 5,
} as const;

export const MISSION = {
  /** The HUD's "JOBS X / 4" denominator. */
  TOTAL_JOBS: 4,
} as const;

export const INVINCIBILITY = {
  DURATION_MS: 8_000,
  /** Final stretch where the tint flashes twice as fast to signal expiry. */
  EXPIRING_WINDOW_MS: 2_000,
  TINT_INTERVAL_MS: 100,
  TINT_INTERVAL_EXPIRING_MS: 50,
  /**
   * OPEN QUESTION until assets:inspect runs: the effects board reads as 7 OR 8 rings.
   * If it reports 8, change this and asset-contract.json's frame_count together -- nothing else.
   */
  AURA_FRAME_COUNT: 7,
  AURA_FRAME_RATE: 14,
  /**
   * The source rings already ramp small -> large -> small, so a full pulse is baked into the
   * frames. Ping-pong would replay the shrink and stutter, hence a straight loop.
   */
  AURA_PLAYBACK: 'loop' as 'loop' | 'pingpong',
  STAR_COUNT: 5,
  STAR_SIZE_PX: 12,
  STAR_ORBIT_RADIUS_PX: 26,
  STAR_ANGULAR_SPEED_RAD_PER_S: 3.2,
  STAR_RADIUS_WOBBLE_PX: 4,
  STAR_WOBBLE_SPEED_RAD_PER_S: 2.1,
  SPARKLE_EMIT_INTERVAL_MS: 40,
  SPARKLE_LIFESPAN_MS: 350,
  SPARKLE_TEXTURE_COUNT: 8,
  SPARKLE_SIZE_PX: 12,
  IMPACT_BURST_FRAME_RATE: 20,
} as const;

export const CAMERA = {
  LERP_X: 0.12,
  LERP_Y: 0.08,
  /** Deadzone keeps small hops from nudging the camera. */
  DEADZONE_WIDTH: 80,
  DEADZONE_HEIGHT: 60,
} as const;

export const PARALLAX = {
  FAR_SKY_FACTOR: 0.1,
  MID_MOUNTAINS_FACTOR: 0.35,
  NEAR_DATACENTER_FACTOR: 0.65,
} as const;

export const DEPTH = {
  BG_FAR: -30,
  BG_MID: -20,
  BG_NEAR: -10,
  TILEMAP: 0,
  DECORATION: 5,
  ITEM: 10,
  ENEMY: 20,
  AURA: 29,
  PLAYER: 30,
  STARS: 31,
  EFFECT: 40,
  WORLD_PANEL: 45,
} as const;

export const HUD = {
  /** Text fields refresh at 10 Hz to avoid per-frame string allocation. */
  TEXT_REFRESH_MS: 100,
  /** How long a non-default system-status message holds before reverting. */
  STATUS_MESSAGE_HOLD_MS: 1800,
  PF_KEY_COUNT: 12,
  SCORE_DIGITS: 7,
  COUNTER_DIGITS: 3,
  FONT_SIZE_PX: 8,
  HEADING_FONT_SIZE_PX: 8,
  POWER_METER_SEGMENTS: 10,
} as const;

export const STORAGE = {
  HIGH_SCORE_KEY: 'opshero.highscore.v1',
} as const;

/**
 * Moment-to-moment feedback timings from GDD.md section 6. The GDD names the feel ("squash 1
 * frame on takeoff", "4-frame freeze"); the millisecond values below convert those frame counts
 * at 60 fps and are the numbers actually used at runtime.
 */
export const JUICE = {
  JUMP_SQUASH_SCALE_Y: 0.9,
  JUMP_SQUASH_DURATION_MS: 60,
  LAND_STRETCH_SCALE_Y: 1.15,
  LAND_STRETCH_DURATION_MS: 90,
  /** ~66 ms, i.e. 4 frames at 60 fps. */
  STOMP_FREEZE_MS: 66,
  STOMP_SQUASH_SCALE_Y: 0.6,
  STOMP_SQUASH_DURATION_MS: 120,
  CHAIN_POPUP_RISE_PX: 14,
  CHAIN_POPUP_DURATION_MS: 500,
  TOKEN_COLLECT_SCALE: 1.4,
  TOKEN_COLLECT_DURATION_MS: 150,
  PICKUP_COLLECT_SCALE: 1.6,
  PICKUP_COLLECT_DURATION_MS: 200,
  HUD_COUNT_FLASH_MS: 120,
  JOB_COMPLETE_FLASH_MS: 200,
  /** ~50 ms, i.e. 3 frames at 60 fps. */
  DAMAGE_FREEZE_MS: 50,
  DAMAGE_VIGNETTE_DURATION_MS: 320,
  AURA_POPIN_DURATION_MS: 100,
  EXIT_SHAKE_PX: 2,
  EXIT_SHAKE_DURATION_MS: 220,
  CAMERA_LOOKAHEAD_PX: 24,
  CAMERA_LOOKAHEAD_EASE_MS: 300,
} as const;
