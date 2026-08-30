/** Idle until aggro, a 400 ms telegraph, then a fast charge toward wherever the player was. */
import type Phaser from 'phaser';

import { AssetKeys } from '../../config/AssetKeys';
import { AnimationKeys } from '../../config/Animations';
import { ENEMY } from '../../config/Tuning';
import { Enemy } from './Enemy';

export class SpoolRunaway extends Enemy {
  private telegraphRemainingMs = 0;
  private charging = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    patrolMinX: number,
    patrolMaxX: number,
    collisionLayer: Phaser.Tilemaps.TilemapLayer | null,
  ) {
    const { BODY_WIDTH, BODY_HEIGHT } = ENEMY.SPOOL_RUNAWAY;
    super(scene, x, y, AssetKeys.SPOOL_RUNAWAY, BODY_WIDTH, BODY_HEIGHT, patrolMinX, patrolMaxX, collisionLayer);
    this.setFrame(0);
  }

  public override update(deltaMs: number, playerX: number): void {
    if (this.isDefeated) {
      return;
    }
    const body = this.body as Phaser.Physics.Arcade.Body;
    const wasPatrol = this.alertState === 'patrol';
    this.updateAggro(Math.abs(this.x - playerX), ENEMY.SPOOL_RUNAWAY.AGGRO_RANGE);

    if (this.alertState === 'patrol') {
      body.setVelocityX(0);
      if (!wasPatrol) {
        this.resetToIdle();
      }
      return;
    }

    if (wasPatrol) {
      this.telegraphRemainingMs = ENEMY.SPOOL_RUNAWAY.TELEGRAPH_MS;
      this.charging = false;
      this.facingLeft = playerX < this.x;
      body.setVelocityX(0);
    }

    if (!this.charging) {
      this.telegraphRemainingMs -= deltaMs;
      if (this.telegraphRemainingMs > 0) {
        return;
      }
      this.charging = true;
      this.play(AnimationKeys.SPOOL_RUNAWAY_MOVE);
    }

    this.stepGroundPatrol(ENEMY.SPOOL_RUNAWAY.CHARGE_SPEED);
  }

  private resetToIdle(): void {
    this.charging = false;
    this.telegraphRemainingMs = 0;
    this.anims.stop();
    this.setFrame(0);
  }
}
