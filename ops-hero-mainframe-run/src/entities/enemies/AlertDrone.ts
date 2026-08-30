/**
 * Airborne threat: gravity off, drifts between patrol bounds, sine-bobs vertically, and its
 * hover band descends toward the player's height once alerted.
 *
 * Vertical motion is driven by directly setting the sprite's Y each frame rather than through
 * velocity -- Arcade re-syncs the body from the game object's transform every frame
 * (`Body.preUpdate` -> `updateFromGameObject`), so this is the supported way to combine
 * velocity-driven horizontal patrol with fully kinematic vertical bobbing on the same body.
 */
import type Phaser from 'phaser';

import { AssetKeys } from '../../config/AssetKeys';
import { AnimationKeys } from '../../config/Animations';
import { ENEMY } from '../../config/Tuning';
import { Enemy } from './Enemy';

export class AlertDrone extends Enemy {
  private readonly spawnY: number;
  private baseY: number;
  private elapsedMs = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, patrolMinX: number, patrolMaxX: number) {
    const { BODY_WIDTH, BODY_HEIGHT } = ENEMY.ALERT_DRONE;
    super(scene, x, y, AssetKeys.ALERT_DRONE, BODY_WIDTH, BODY_HEIGHT, patrolMinX, patrolMaxX, null);
    (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.setOrigin(0.5, 0.5);
    this.spawnY = y;
    this.baseY = y;
    this.play(AnimationKeys.ALERT_DRONE_HOVER);
  }

  public override update(deltaMs: number, playerX: number, playerY: number): void {
    if (this.isDefeated) {
      return;
    }
    this.updateAggro(Math.abs(this.x - playerX), ENEMY.ALERT_DRONE.AGGRO_RANGE);
    this.elapsedMs += deltaMs;

    this.driftHorizontally();
    this.chaseVertically(deltaMs, playerY);

    const bob =
      Math.sin((this.elapsedMs / 1000) * ENEMY.ALERT_DRONE.SINE_SPEED_RAD_PER_S) * ENEMY.ALERT_DRONE.SINE_AMPLITUDE_PX;
    this.setY(this.baseY + bob);
  }

  private driftHorizontally(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    let direction: 1 | -1 = this.facingLeft ? -1 : 1;
    const atBound = direction > 0 ? this.x >= this.patrolMaxX : this.x <= this.patrolMinX;
    if (atBound) {
      direction = direction > 0 ? -1 : 1;
      this.facingLeft = direction < 0;
    }
    body.setVelocityX(ENEMY.ALERT_DRONE.SPEED * direction);
    this.setFlipX(this.facingLeft);
  }

  private chaseVertically(deltaMs: number, playerY: number): void {
    const targetY = this.alertState === 'alerted' ? playerY : this.spawnY;
    const maxStep = (ENEMY.ALERT_DRONE.SPEED * deltaMs) / 1000;
    const delta = targetY - this.baseY;
    this.baseY += Math.abs(delta) <= maxStep ? delta : Math.sign(delta) * maxStep;
  }
}
