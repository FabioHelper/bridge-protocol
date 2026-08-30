import { describe, expect, it } from 'vitest';

import type { SpritesheetEntry } from '../../src/config/AssetKeys';
import { AssetKeys, ASSET_MANIFEST, isSpritesheet } from '../../src/config/AssetKeys';
import { ANIMATIONS, AnimationKeys } from '../../src/config/Animations';
import { INVINCIBILITY, PLAYER, REACHABILITY, SCORING, TILE_SIZE, VIEWPORT, WORLD } from '../../src/config/Tuning';
import { INVINCIBILITY_TINTS, POWER_METER_RAMP } from '../../src/config/Palette';

describe('asset keys', () => {
  it('defines every key exactly once', () => {
    const values = Object.values(AssetKeys);
    expect(new Set(values).size).toBe(values.length);
  });

  it('covers every manifest entry with a known key', () => {
    const known = new Set<string>(Object.values(AssetKeys));
    for (const entry of ASSET_MANIFEST) {
      expect(known.has(entry.key)).toBe(true);
    }
    expect(ASSET_MANIFEST.length).toBe(Object.keys(AssetKeys).length);
  });

  it('gives every spritesheet a positive frame size and count', () => {
    for (const entry of ASSET_MANIFEST) {
      if (!isSpritesheet(entry)) continue;
      expect(entry.frameWidth).toBeGreaterThan(0);
      expect(entry.frameHeight).toBeGreaterThan(0);
      expect(entry.frameCount).toBeGreaterThan(0);
    }
  });

  it('matches the contracted frame geometry for the headline sheets', () => {
    const bySheetKey = new Map<string, SpritesheetEntry>(
      ASSET_MANIFEST.filter(isSpritesheet).map((entry) => [entry.key as string, entry]),
    );
    expect(bySheetKey.get(AssetKeys.HERO)).toMatchObject({ frameWidth: 32, frameHeight: 48, frameCount: 10 });
    expect(bySheetKey.get(AssetKeys.ALERT_DRONE)).toMatchObject({ frameWidth: 32, frameHeight: 32, frameCount: 4 });
    expect(bySheetKey.get(AssetKeys.INVINCIBILITY_AURA)).toMatchObject({
      frameWidth: 64,
      frameHeight: 64,
      frameCount: INVINCIBILITY.AURA_FRAME_COUNT,
    });
    expect(bySheetKey.get(AssetKeys.OPERATIONS_TILES)).toMatchObject({ frameCount: 12 });
    expect(bySheetKey.get(AssetKeys.GAMEPLAY_TILES)).toMatchObject({ frameCount: 9 });
  });
});

describe('animations', () => {
  it('defines every animation key exactly once', () => {
    const keys = ANIMATIONS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('never references a frame outside its sheet', () => {
    const frameCounts = new Map<string, number>(
      ASSET_MANIFEST.filter(isSpritesheet).map((entry) => [entry.key as string, entry.frameCount]),
    );
    for (const definition of ANIMATIONS) {
      const count = frameCounts.get(definition.texture);
      expect(count, `${definition.key} targets a non-spritesheet`).toBeDefined();
      for (const frame of definition.frames) {
        expect(frame, `${definition.key} frame out of range`).toBeGreaterThanOrEqual(0);
        expect(frame, `${definition.key} frame out of range`).toBeLessThan(count ?? 0);
      }
    }
  });

  it('derives the aura sequence from the frame count and never repeats an endpoint', () => {
    const aura = ANIMATIONS.find((a) => a.key === AnimationKeys.INVINCIBILITY_AURA_PULSE);
    const frames = aura?.frames ?? [];
    // The source rings already ramp small -> large -> small, so a straight loop is correct.
    // If the effects board turns out to hold 8 rings, only AURA_FRAME_COUNT changes and this
    // test keeps passing -- that is the point of deriving rather than hard-coding.
    const expected =
      INVINCIBILITY.AURA_PLAYBACK === 'pingpong'
        ? INVINCIBILITY.AURA_FRAME_COUNT * 2 - 2
        : INVINCIBILITY.AURA_FRAME_COUNT;
    expect(frames).toHaveLength(expected);
    expect(new Set(frames).size).toBe(INVINCIBILITY.AURA_FRAME_COUNT);
    expect(frames.at(0)).not.toBe(frames.at(-1));
  });

  it('excludes the deactivated frame from every enemy movement loop', () => {
    const movementLoops = [
      AnimationKeys.JOB_FAIL_BOT_MOVE,
      AnimationKeys.ALERT_BOT_MOVE,
      AnimationKeys.ALERT_DRONE_HOVER,
      AnimationKeys.SPOOL_RUNAWAY_MOVE,
    ];
    for (const key of movementLoops) {
      const definition = ANIMATIONS.find((a) => a.key === key);
      expect(definition?.frames).not.toContain(3);
    }
  });
});

describe('tuning invariants', () => {
  it('splits the logical height exactly between HUD and play area', () => {
    expect(VIEWPORT.HUD_TOP_HEIGHT + VIEWPORT.PLAY_HEIGHT + VIEWPORT.HUD_BOTTOM_HEIGHT).toBe(
      VIEWPORT.LOGICAL_HEIGHT,
    );
    expect(VIEWPORT.PLAY_Y).toBe(VIEWPORT.HUD_TOP_HEIGHT);
  });

  it('keeps the logical resolution at 16:9', () => {
    expect(VIEWPORT.LOGICAL_WIDTH / VIEWPORT.LOGICAL_HEIGHT).toBeCloseTo(16 / 9, 5);
  });

  it('derives a jump that clears the level design limits', () => {
    // Apex height from v^2 / 2g, and horizontal reach from full airtime at top speed.
    const apexPx = PLAYER.JUMP_VELOCITY ** 2 / (2 * WORLD.GRAVITY_Y);
    const airtimeS = (2 * Math.abs(PLAYER.JUMP_VELOCITY)) / WORLD.GRAVITY_Y;
    const reachPx = airtimeS * PLAYER.MAX_RUN_SPEED;

    expect(apexPx / TILE_SIZE).toBeGreaterThan(REACHABILITY.MAX_STEP_TILES);
    expect(reachPx / TILE_SIZE).toBeGreaterThan(REACHABILITY.MAX_GAP_TILES);
  });

  it('keeps the player body inside the 32x48 frame', () => {
    expect(PLAYER.BODY_OFFSET_X + PLAYER.BODY_WIDTH).toBeLessThanOrEqual(32);
    expect(PLAYER.BODY_OFFSET_Y + PLAYER.BODY_HEIGHT).toBe(48);
  });

  it('cuts the jump short rather than reversing it', () => {
    expect(PLAYER.JUMP_CUT_VELOCITY).toBeLessThan(0);
    expect(PLAYER.JUMP_CUT_VELOCITY).toBeGreaterThan(PLAYER.JUMP_VELOCITY);
  });

  it('gives the invincibility expiry warning room inside the duration', () => {
    expect(INVINCIBILITY.EXPIRING_WINDOW_MS).toBeLessThan(INVINCIBILITY.DURATION_MS);
    expect(INVINCIBILITY.TINT_INTERVAL_EXPIRING_MS).toBeLessThan(INVINCIBILITY.TINT_INTERVAL_MS);
    expect(INVINCIBILITY.DURATION_MS).toBe(8000);
  });

  it('matches star and sparkle counts to the contracted sprite files', () => {
    const starKeys = Object.values(AssetKeys).filter((k) => k.startsWith('star-'));
    const sparkleKeys = Object.values(AssetKeys).filter((k) => k.startsWith('sparkle-'));
    expect(starKeys.length).toBe(INVINCIBILITY.STAR_COUNT);
    expect(sparkleKeys.length).toBe(INVINCIBILITY.SPARKLE_TEXTURE_COUNT);
  });

  it('scores an invincible defeat above a single stomp but below a chained one', () => {
    expect(SCORING.INVINCIBLE_DEFEAT).toBeGreaterThan(SCORING.STOMP_BASE);
    expect(SCORING.INVINCIBLE_DEFEAT).toBeLessThan(
      SCORING.STOMP_BASE * SCORING.MAX_STOMP_CHAIN_MULTIPLIER,
    );
  });
});

describe('palette', () => {
  it('cycles four bright invincibility tints', () => {
    expect(INVINCIBILITY_TINTS).toHaveLength(4);
    for (const tint of INVINCIBILITY_TINTS) {
      expect(tint).toBeGreaterThanOrEqual(0x000000);
      expect(tint).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('ramps the power meter from red to blue', () => {
    expect(POWER_METER_RAMP.length).toBeGreaterThan(1);
    const first = POWER_METER_RAMP[0] ?? 0;
    const last = POWER_METER_RAMP[POWER_METER_RAMP.length - 1] ?? 0;
    // Red channel dominates at the empty end; blue dominates at the full end.
    expect((first >> 16) & 0xff).toBeGreaterThan(first & 0xff);
    expect(last & 0xff).toBeGreaterThan((last >> 16) & 0xff);
  });
});
