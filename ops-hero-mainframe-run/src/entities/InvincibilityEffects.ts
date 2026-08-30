/**
 * The golden-aura set piece: an aura sprite behind the player, 5 orbiting stars in front, a
 * sparkle trail, and the tint cycle. See BUILD_BRIEF.md section 8 and GAMEPLAY_SPEC.md section 10.
 *
 * The sparkle trail is a small hand-rolled spawner rather than `Phaser.GameObjects.Particles`:
 * the spec wants a *random pick* of 8 independent single-frame textures per spawn, which the
 * particle emitter's per-particle texture/frame ops are not a good fit for, whereas a plain
 * timer + sprite pool matches the spec exactly and keeps this file simple.
 *
 * Orbit position is computed fresh every frame from elapsed active time -- never baked into a
 * tween -- per BUILD_BRIEF's explicit requirement.
 */
import type Phaser from 'phaser';

import { AssetKeys } from '../config/AssetKeys';
import { AnimationKeys } from '../config/Animations';
import { DEPTH, INVINCIBILITY, JUICE } from '../config/Tuning';
import type { InvincibilitySystem } from '../systems/InvincibilitySystem';
import type { Player } from './Player';

const STAR_KEYS: readonly string[] = [
  AssetKeys.STAR_0,
  AssetKeys.STAR_1,
  AssetKeys.STAR_2,
  AssetKeys.STAR_3,
  AssetKeys.STAR_4,
];

const SPARKLE_KEYS: readonly string[] = [
  AssetKeys.SPARKLE_0,
  AssetKeys.SPARKLE_1,
  AssetKeys.SPARKLE_2,
  AssetKeys.SPARKLE_3,
  AssetKeys.SPARKLE_4,
  AssetKeys.SPARKLE_5,
  AssetKeys.SPARKLE_6,
  AssetKeys.SPARKLE_7,
];

/** Vertical offset from the player's feet-anchored origin to its visual centre. */
const PLAYER_CENTER_OFFSET_Y = -24;

export class InvincibilityEffects {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly aura: Phaser.GameObjects.Sprite;
  private readonly stars: Phaser.GameObjects.Sprite[];
  private wasActive = false;
  private elapsedActiveMs = 0;
  private sparkleAccumulatorMs = 0;

  constructor(scene: Phaser.Scene, player: Player) {
    this.scene = scene;
    this.player = player;

    this.aura = scene.add.sprite(player.x, player.y, AssetKeys.INVINCIBILITY_AURA, 0);
    this.aura.setDepth(DEPTH.AURA);
    this.aura.setVisible(false);
    this.aura.play(AnimationKeys.INVINCIBILITY_AURA_PULSE);

    this.stars = STAR_KEYS.map((key) => {
      const star = scene.add.sprite(player.x, player.y, key);
      star.setDepth(DEPTH.STARS);
      star.setVisible(false);
      return star;
    });
  }

  public update(deltaMs: number, invincibility: InvincibilitySystem): void {
    const active = invincibility.isActive;
    if (active && !this.wasActive) {
      this.elapsedActiveMs = 0;
      this.show();
    } else if (!active && this.wasActive) {
      this.hide();
    }
    this.wasActive = active;

    if (!active) {
      return;
    }

    this.elapsedActiveMs += deltaMs;
    this.player.setTint(invincibility.currentTint);
    this.updateAuraAndStars();
    this.updateSparkleTrail(deltaMs);
  }

  private show(): void {
    this.aura.setVisible(true);
    this.aura.setScale(0);
    this.scene.tweens.add({ targets: this.aura, scale: 1, duration: JUICE.AURA_POPIN_DURATION_MS });
    for (const star of this.stars) {
      star.setVisible(true);
    }
  }

  private hide(): void {
    this.aura.setVisible(false);
    for (const star of this.stars) {
      star.setVisible(false);
    }
    this.player.clearTint();
  }

  private centerX(): number {
    return this.player.x;
  }

  private centerY(): number {
    return this.player.y + PLAYER_CENTER_OFFSET_Y;
  }

  private updateAuraAndStars(): void {
    this.aura.setPosition(this.centerX(), this.centerY());

    const popInProgress = Math.min(1, this.elapsedActiveMs / JUICE.AURA_POPIN_DURATION_MS);
    const elapsedS = this.elapsedActiveMs / 1000;
    const baseRadius = INVINCIBILITY.STAR_ORBIT_RADIUS_PX * popInProgress;
    const wobble =
      Math.sin(elapsedS * INVINCIBILITY.STAR_WOBBLE_SPEED_RAD_PER_S) * INVINCIBILITY.STAR_RADIUS_WOBBLE_PX * popInProgress;
    const radius = baseRadius + wobble;

    this.stars.forEach((star, index) => {
      const phase = ((2 * Math.PI) / INVINCIBILITY.STAR_COUNT) * index;
      const angle = phase + elapsedS * INVINCIBILITY.STAR_ANGULAR_SPEED_RAD_PER_S;
      star.setPosition(this.centerX() + Math.cos(angle) * radius, this.centerY() + Math.sin(angle) * radius);
    });
  }

  private updateSparkleTrail(deltaMs: number): void {
    this.sparkleAccumulatorMs += deltaMs;
    if (this.sparkleAccumulatorMs < INVINCIBILITY.SPARKLE_EMIT_INTERVAL_MS) {
      return;
    }
    this.sparkleAccumulatorMs -= INVINCIBILITY.SPARKLE_EMIT_INTERVAL_MS;

    const key = SPARKLE_KEYS[Math.floor(Math.random() * SPARKLE_KEYS.length)] ?? SPARKLE_KEYS[0];
    if (!key) {
      return;
    }
    const jitterX = (Math.random() - 0.5) * INVINCIBILITY.SPARKLE_SIZE_PX;
    const jitterY = (Math.random() - 0.5) * INVINCIBILITY.SPARKLE_SIZE_PX;
    const sparkle = this.scene.add.sprite(this.centerX() + jitterX, this.centerY() + jitterY, key);
    sparkle.setDepth(DEPTH.AURA);
    this.scene.tweens.add({
      targets: sparkle,
      alpha: 0,
      y: sparkle.y - INVINCIBILITY.SPARKLE_SIZE_PX,
      duration: INVINCIBILITY.SPARKLE_LIFESPAN_MS,
      onComplete: () => sparkle.destroy(),
    });
  }
}
