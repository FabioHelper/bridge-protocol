/**
 * Declarative animation definitions. `registerAnimations` is the ONLY place anims.create is called,
 * so an animation can never be defined twice under different keys.
 */
import { AssetKeys } from './AssetKeys';
import { INVINCIBILITY } from './Tuning';

export const AnimationKeys = {
  HERO_IDLE: 'hero-idle',
  HERO_RUN: 'hero-run',
  HERO_JUMP: 'hero-jump',
  HERO_FALL: 'hero-fall',
  JOB_FAIL_BOT_MOVE: 'job-fail-bot-move',
  ALERT_BOT_MOVE: 'alert-bot-move',
  ALERT_DRONE_HOVER: 'alert-drone-hover',
  SPOOL_RUNAWAY_MOVE: 'spool-runaway-move',
  COMMAND_TOKEN_SPIN: 'command-token-spin',
  INVINCIBILITY_PICKUP_PULSE: 'invincibility-pickup-pulse',
  INVINCIBILITY_AURA_PULSE: 'invincibility-aura-pulse',
  IMPACT_BURST: 'impact-burst',
} as const;

export type AnimationKey = (typeof AnimationKeys)[keyof typeof AnimationKeys];

export interface AnimationDefinition {
  readonly key: AnimationKey;
  readonly texture: string;
  /** Explicit frame indices, so ping-pong and reordered sequences are expressed as data. */
  readonly frames: readonly number[];
  readonly frameRate: number;
  /** -1 loops forever, 0 plays once. */
  readonly repeat: number;
}

/** 0,1,2,...,n-1,n-2,...,1 -- forward then backward, without repeating either endpoint. */
function pingPong(frameCount: number): readonly number[] {
  const forward = Array.from({ length: frameCount }, (_, index) => index);
  const backward = forward.slice(1, -1).reverse();
  return [...forward, ...backward];
}

/**
 * Aura sequence, derived from Tuning so the frame count lives in exactly one place.
 *
 * The source rings already ramp small -> large -> small, so a complete pulse is baked into the
 * artwork and a straight loop is correct; ping-pong would replay the shrink and stutter. The
 * handoff's original ping-pong rule is kept available behind INVINCIBILITY.AURA_PLAYBACK.
 */
function auraSequence(): readonly number[] {
  const count = INVINCIBILITY.AURA_FRAME_COUNT;
  return INVINCIBILITY.AURA_PLAYBACK === 'pingpong'
    ? pingPong(count)
    : Array.from({ length: count }, (_, index) => index);
}

export const ANIMATIONS: readonly AnimationDefinition[] = [
  { key: AnimationKeys.HERO_IDLE, texture: AssetKeys.HERO, frames: [0, 1], frameRate: 4, repeat: -1 },
  { key: AnimationKeys.HERO_RUN, texture: AssetKeys.HERO, frames: [2, 3, 4, 5, 6, 7], frameRate: 12, repeat: -1 },
  { key: AnimationKeys.HERO_JUMP, texture: AssetKeys.HERO, frames: [8], frameRate: 1, repeat: 0 },
  { key: AnimationKeys.HERO_FALL, texture: AssetKeys.HERO, frames: [9], frameRate: 1, repeat: 0 },

  // Frame 3 of every enemy sheet is the deactivated pose and is deliberately excluded from the
  // movement loops -- it is shown explicitly on defeat.
  { key: AnimationKeys.JOB_FAIL_BOT_MOVE, texture: AssetKeys.JOB_FAIL_BOT, frames: [0, 1, 0, 2], frameRate: 6, repeat: -1 },
  { key: AnimationKeys.ALERT_BOT_MOVE, texture: AssetKeys.ALERT_BOT, frames: [0, 1, 0, 2], frameRate: 8, repeat: -1 },
  { key: AnimationKeys.ALERT_DRONE_HOVER, texture: AssetKeys.ALERT_DRONE, frames: [0, 1, 2], frameRate: 12, repeat: -1 },
  { key: AnimationKeys.SPOOL_RUNAWAY_MOVE, texture: AssetKeys.SPOOL_RUNAWAY, frames: [0, 1, 2], frameRate: 10, repeat: -1 },

  { key: AnimationKeys.COMMAND_TOKEN_SPIN, texture: AssetKeys.COMMAND_TOKEN, frames: [0, 1, 2, 3], frameRate: 8, repeat: -1 },
  { key: AnimationKeys.INVINCIBILITY_PICKUP_PULSE, texture: AssetKeys.INVINCIBILITY_PICKUP, frames: [0, 1, 2, 3], frameRate: 8, repeat: -1 },
  {
    key: AnimationKeys.INVINCIBILITY_AURA_PULSE,
    texture: AssetKeys.INVINCIBILITY_AURA,
    frames: auraSequence(),
    frameRate: INVINCIBILITY.AURA_FRAME_RATE,
    repeat: -1,
  },
  {
    key: AnimationKeys.IMPACT_BURST,
    texture: AssetKeys.IMPACT_BURST,
    frames: [0, 1, 2, 3],
    frameRate: INVINCIBILITY.IMPACT_BURST_FRAME_RATE,
    repeat: 0,
  },
];
