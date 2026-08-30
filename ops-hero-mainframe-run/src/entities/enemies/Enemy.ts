/**
 * Shared base for every enemy family. See GAMEPLAY_SPEC.md section 5.
 *
 * Owns: the PATROL / ALERTED / DEFEATED state machine (one `alerted` event per PATROL->ALERTED
 * transition, never spammed), ledge/wall-aware ground patrol, and the frame-3-on-defeat contract.
 * Subclasses own their own speed curve and movement shape.
 */
import Phaser from 'phaser';

import { DEPTH, ENEMY } from '../../config/Tuning';

export type EnemyState = 'patrol' | 'alerted' | 'defeated';

export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  protected enemyState: EnemyState = 'patrol';
  protected facingLeft = false;
  protected readonly collisionLayer: Phaser.Tilemaps.TilemapLayer | null;
  public readonly patrolMinX: number;
  public readonly patrolMaxX: number;

  protected constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey: string,
    bodyWidth: number,
    bodyHeight: number,
    patrolMinX: number,
    patrolMaxX: number,
    collisionLayer: Phaser.Tilemaps.TilemapLayer | null,
  ) {
    super(scene, x, y, textureKey, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setDepth(DEPTH.ENEMY);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(bodyWidth, bodyHeight);
    this.patrolMinX = patrolMinX;
    this.patrolMaxX = patrolMaxX;
    this.collisionLayer = collisionLayer;
  }

  public get alertState(): EnemyState {
    return this.enemyState;
  }

  public get isDefeated(): boolean {
    return this.enemyState === 'defeated';
  }

  public abstract override update(deltaMs: number, playerX: number, playerY: number): void;

  /** Instant defeat: frame 3, body disabled, animation stopped. Never resizes the body. */
  public defeat(): void {
    if (this.enemyState === 'defeated') {
      return;
    }
    this.enemyState = 'defeated';
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.enable = false;
    this.anims.stop();
    this.setFrame(ENEMY.DEACTIVATED_FRAME);
    this.emit('defeated');
  }

  /** Shared aggro threshold check -- raises `alerted` on the transition only, never repeatedly. */
  protected updateAggro(distanceToPlayer: number, aggroRange: number): void {
    if (this.enemyState === 'defeated') {
      return;
    }
    const inRange = distanceToPlayer <= aggroRange;
    if (inRange && this.enemyState === 'patrol') {
      this.enemyState = 'alerted';
      this.emit('alerted');
    } else if (!inRange && this.enemyState === 'alerted') {
      this.enemyState = 'patrol';
    }
  }

  /** True when there is no ground ahead-and-below the body in the given direction. */
  protected isLedgeAhead(direction: 1 | -1): boolean {
    if (!this.collisionLayer) {
      return false;
    }
    const body = this.body as Phaser.Physics.Arcade.Body;
    const probeX = direction > 0 ? body.right + ENEMY.LEDGE_PROBE_AHEAD_PX : body.left - ENEMY.LEDGE_PROBE_AHEAD_PX;
    const probeY = body.bottom + ENEMY.LEDGE_PROBE_DOWN_PX;
    const tile = this.collisionLayer.getTileAtWorldXY(probeX, probeY);
    return !tile || tile.index <= 0 || !tile.collides;
  }

  /** Ground patrol step shared by walking enemy families: reverses at walls, ledges and bounds. */
  protected stepGroundPatrol(speed: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    let direction: 1 | -1 = this.facingLeft ? -1 : 1;

    const atBound = direction > 0 ? this.x >= this.patrolMaxX : this.x <= this.patrolMinX;
    const blockedWall = direction > 0 ? body.blocked.right : body.blocked.left;
    if (atBound || blockedWall || this.isLedgeAhead(direction)) {
      direction = direction > 0 ? -1 : 1;
      this.facingLeft = direction < 0;
    }

    body.setVelocityX(speed * direction);
    this.setFlipX(this.facingLeft);
  }
}
