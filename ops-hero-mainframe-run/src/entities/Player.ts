/**
 * The hero. Owns movement, jump feel (coyote + buffer + variable height), the animation state
 * machine and hit-invulnerability blinking. Scoring, damage bookkeeping and golden-aura
 * invincibility are owned by `LevelScene`, which reacts to the events this class emits --
 * that keeps Player a movement/feel module rather than a god class that knows about lives.
 *
 * The collision body is sized once in the constructor and NEVER touched again -- not by
 * animation frame changes, not by damage, not by golden-aura invincibility. That is a
 * non-negotiable rule from BUILD_BRIEF.md section 14.
 */
import Phaser from 'phaser';

import { AssetKeys } from '../config/AssetKeys';
import { AnimationKeys } from '../config/Animations';
import { PLAYER } from '../config/Tuning';

type Key = Phaser.Input.Keyboard.Key;

interface Keymap {
  readonly left: Key;
  readonly leftAlt: Key;
  readonly right: Key;
  readonly rightAlt: Key;
  readonly jump: Key;
  readonly jumpAlt: Key;
  readonly jumpAlt2: Key;
}

function bindKeys(scene: Phaser.Scene): Keymap {
  const keyboard = scene.input.keyboard;
  if (!keyboard) {
    throw new Error('keyboard plugin unavailable');
  }
  const codes = Phaser.Input.Keyboard.KeyCodes;
  return {
    left: keyboard.addKey(codes.LEFT),
    leftAlt: keyboard.addKey(codes.A),
    right: keyboard.addKey(codes.RIGHT),
    rightAlt: keyboard.addKey(codes.D),
    jump: keyboard.addKey(codes.SPACE),
    jumpAlt: keyboard.addKey(codes.W),
    jumpAlt2: keyboard.addKey(codes.UP),
  };
}

export class Player extends Phaser.Physics.Arcade.Sprite {
  private readonly keys: Keymap;
  private coyoteRemainingMs = 0;
  private jumpBufferRemainingMs = 0;
  private hitInvulnRemainingMs = 0;
  private blinkAccumulatorMs = 0;
  private wasGrounded = false;
  private facingLeft = false;
  private justLandedFlag = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, AssetKeys.HERO, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setDepth(30);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setSize(PLAYER.BODY_WIDTH, PLAYER.BODY_HEIGHT);
    body.setOffset(PLAYER.BODY_OFFSET_X, PLAYER.BODY_OFFSET_Y);
    body.setMaxVelocity(PLAYER.MAX_RUN_SPEED, PLAYER.MAX_FALL_SPEED);
    body.setCollideWorldBounds(false);

    this.keys = bindKeys(scene);
  }

  public get isGrounded(): boolean {
    return (this.body as Phaser.Physics.Arcade.Body).blocked.down;
  }

  public get isHitInvulnerable(): boolean {
    return this.hitInvulnRemainingMs > 0;
  }

  /** True for exactly the one frame the player transitions from airborne to grounded. */
  public get justLanded(): boolean {
    return this.justLandedFlag;
  }

  public override update(deltaMs: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    this.justLandedFlag = false;

    this.updateHorizontal(body);
    this.updateJump(body, deltaMs);
    this.updateGroundedTransition(body);
    this.updateHitInvulnerability(deltaMs);
    this.updateAnimation(body);
  }

  private updateHorizontal(body: Phaser.Physics.Arcade.Body): void {
    const leftHeld = this.keys.left.isDown || this.keys.leftAlt.isDown;
    const rightHeld = this.keys.right.isDown || this.keys.rightAlt.isDown;
    const direction = (rightHeld ? 1 : 0) - (leftHeld ? 1 : 0);
    const grounded = this.isGrounded;
    const controlFactor = grounded ? 1 : PLAYER.AIR_CONTROL_FACTOR;

    body.setAccelerationX(direction * PLAYER.RUN_ACCELERATION * controlFactor);
    body.setDragX(grounded ? PLAYER.GROUND_DRAG : PLAYER.AIR_DRAG);

    if (direction !== 0) {
      this.facingLeft = direction < 0;
    }
    this.setFlipX(this.facingLeft);
  }

  private jumpPressedThisFrame(): boolean {
    return (
      Phaser.Input.Keyboard.JustDown(this.keys.jump) ||
      Phaser.Input.Keyboard.JustDown(this.keys.jumpAlt) ||
      Phaser.Input.Keyboard.JustDown(this.keys.jumpAlt2)
    );
  }

  private jumpHeld(): boolean {
    return this.keys.jump.isDown || this.keys.jumpAlt.isDown || this.keys.jumpAlt2.isDown;
  }

  private updateJump(body: Phaser.Physics.Arcade.Body, deltaMs: number): void {
    if (this.isGrounded) {
      this.coyoteRemainingMs = PLAYER.COYOTE_TIME_MS;
    } else {
      this.coyoteRemainingMs = Math.max(0, this.coyoteRemainingMs - deltaMs);
    }

    if (this.jumpPressedThisFrame()) {
      this.jumpBufferRemainingMs = PLAYER.JUMP_BUFFER_MS;
    } else {
      this.jumpBufferRemainingMs = Math.max(0, this.jumpBufferRemainingMs - deltaMs);
    }

    if (this.jumpBufferRemainingMs > 0 && this.coyoteRemainingMs > 0) {
      body.setVelocityY(PLAYER.JUMP_VELOCITY);
      this.jumpBufferRemainingMs = 0;
      this.coyoteRemainingMs = 0; // consumed -- can never grant a double jump
      this.emit('jumped');
    } else if (!this.jumpHeld() && body.velocity.y < PLAYER.JUMP_CUT_VELOCITY) {
      // Early release clamps upward speed -- the variable-height jump.
      body.setVelocityY(PLAYER.JUMP_CUT_VELOCITY);
    }
  }

  private updateGroundedTransition(body: Phaser.Physics.Arcade.Body): void {
    const grounded = body.blocked.down;
    if (grounded && !this.wasGrounded) {
      this.justLandedFlag = true;
      this.emit('landed', Math.abs(body.velocity.y));
    }
    this.wasGrounded = grounded;
  }

  private updateHitInvulnerability(deltaMs: number): void {
    if (this.hitInvulnRemainingMs <= 0) {
      this.setVisible(true);
      return;
    }
    this.hitInvulnRemainingMs -= deltaMs;
    this.blinkAccumulatorMs += deltaMs;
    if (this.blinkAccumulatorMs >= PLAYER.HIT_BLINK_INTERVAL_MS) {
      this.blinkAccumulatorMs -= PLAYER.HIT_BLINK_INTERVAL_MS;
      this.setVisible(!this.visible);
    }
    if (this.hitInvulnRemainingMs <= 0) {
      this.hitInvulnRemainingMs = 0;
      this.setVisible(true);
    }
  }

  private updateAnimation(body: Phaser.Physics.Arcade.Body): void {
    const grounded = this.isGrounded;
    const speed = Math.abs(body.velocity.x);
    let key: string;
    if (grounded) {
      key = speed >= PLAYER.IDLE_SPEED_EPSILON ? AnimationKeys.HERO_RUN : AnimationKeys.HERO_IDLE;
    } else {
      key = body.velocity.y < 0 ? AnimationKeys.HERO_JUMP : AnimationKeys.HERO_FALL;
    }
    this.play(key, true);
  }

  /** Applied by LevelScene after a confirmed stomp. */
  public bounce(): void {
    (this.body as Phaser.Physics.Arcade.Body).setVelocityY(PLAYER.STOMP_BOUNCE_VELOCITY);
  }

  /** Starts the post-damage blink window. Does not touch the collision body. */
  public startHitInvulnerability(): void {
    this.hitInvulnRemainingMs = PLAYER.HIT_INVULN_MS;
    this.blinkAccumulatorMs = 0;
  }

  public respawnAt(x: number, y: number): void {
    this.setPosition(x, y);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    this.startHitInvulnerability();
  }
}
