/** Slow ledge-aware patrol; halts in place when it notices the player. */
import type Phaser from 'phaser';

import { AssetKeys } from '../../config/AssetKeys';
import { AnimationKeys } from '../../config/Animations';
import { ENEMY } from '../../config/Tuning';
import { Enemy } from './Enemy';

export class JobFailBot extends Enemy {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    patrolMinX: number,
    patrolMaxX: number,
    collisionLayer: Phaser.Tilemaps.TilemapLayer | null,
  ) {
    const { BODY_WIDTH, BODY_HEIGHT } = ENEMY.JOB_FAIL_BOT;
    super(scene, x, y, AssetKeys.JOB_FAIL_BOT, BODY_WIDTH, BODY_HEIGHT, patrolMinX, patrolMaxX, collisionLayer);
    this.play(AnimationKeys.JOB_FAIL_BOT_MOVE);
  }

  public override update(_deltaMs: number, playerX: number): void {
    if (this.isDefeated) {
      return;
    }
    this.updateAggro(Math.abs(this.x - playerX), ENEMY.JOB_FAIL_BOT.AGGRO_RANGE);
    if (this.alertState === 'alerted') {
      (this.body as Phaser.Physics.Arcade.Body).setVelocityX(0);
      this.anims.pause();
      return;
    }
    if (this.anims.isPaused) {
      this.anims.resume();
    }
    this.stepGroundPatrol(ENEMY.JOB_FAIL_BOT.SPEED);
  }
}
