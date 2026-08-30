/**
 * Job terminals, the checkpoint beacon and the exit terminal. Represented as static physics
 * sprites (not tiles) so overlap detection is a plain `physics.add.overlap`, not per-tile
 * scanning. See SPEC.md section 6.4 for the diegetic-panel framing these stand in for.
 */
import Phaser from 'phaser';

import { DEPTH, JUICE } from '../config/Tuning';
import { Palette } from '../config/Palette';

export type MarkerKind = 'job' | 'checkpoint' | 'exit';

export class ObjectiveMarker extends Phaser.Physics.Arcade.Sprite {
  public readonly kind: MarkerKind;
  public readonly jobId: number | null;

  constructor(scene: Phaser.Scene, x: number, y: number, textureKey: string, kind: MarkerKind, jobId: number | null = null) {
    super(scene, x, y, textureKey, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this, true);
    this.setOrigin(0.5, 1);
    this.setDepth(DEPTH.DECORATION);
    this.kind = kind;
    this.jobId = jobId;
  }

  /** Job complete / checkpoint saved feedback: a brief bright tint. */
  public flashLit(): void {
    this.setTint(Palette.ACCENT_GOLD);
    this.scene.time.delayedCall(JUICE.JOB_COMPLETE_FLASH_MS, () => this.clearTint());
  }

  /** Locked-exit feedback: a small shake, never silently doing nothing. */
  public shake(): void {
    const originX = this.x;
    this.scene.tweens.add({
      targets: this,
      x: { from: originX - JUICE.EXIT_SHAKE_PX, to: originX + JUICE.EXIT_SHAKE_PX },
      duration: JUICE.EXIT_SHAKE_DURATION_MS / 4,
      yoyo: true,
      repeat: 3,
      onComplete: () => this.setX(originX),
    });
  }
}
