/** Patrol, turning at walls and ledges; speeds up once it notices the player. */
import type Phaser from 'phaser';

import { AssetKeys } from '../../config/AssetKeys';
import { AnimationKeys } from '../../config/Animations';
import { ENEMY } from '../../config/Tuning';
import { Enemy } from './Enemy';

export class AlertBot extends Enemy {
  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    patrolMinX: number,
    patrolMaxX: number,
    collisionLayer: Phaser.Tilemaps.TilemapLayer | null,
  ) {
    const { BODY_WIDTH, BODY_HEIGHT } = ENEMY.ALERT_BOT;
    super(scene, x, y, AssetKeys.ALERT_BOT, BODY_WIDTH, BODY_HEIGHT, patrolMinX, patrolMaxX, collisionLayer);
    this.play(AnimationKeys.ALERT_BOT_MOVE);
  }

  public override update(_deltaMs: number, playerX: number): void {
    if (this.isDefeated) {
      return;
    }
    this.updateAggro(Math.abs(this.x - playerX), ENEMY.ALERT_BOT.AGGRO_RANGE);
    const speed = this.alertState === 'alerted' ? ENEMY.ALERT_BOT.ALERTED_SPEED : ENEMY.ALERT_BOT.SPEED;
    this.stepGroundPatrol(speed);
  }
}
