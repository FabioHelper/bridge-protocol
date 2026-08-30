/** The two pickup types: command tokens (score) and the invincibility power-up. */
import Phaser from 'phaser';

import { AssetKeys } from '../config/AssetKeys';
import { AnimationKeys } from '../config/Animations';
import { DEPTH, JUICE } from '../config/Tuning';

export class CommandToken extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, AssetKeys.COMMAND_TOKEN, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setDepth(DEPTH.ITEM);
    (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.play(AnimationKeys.COMMAND_TOKEN_SPIN);
  }

  /** Pop-and-fade collect juice; the sprite is destroyed once the tween finishes. */
  public collect(onComplete: () => void): void {
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.scene.tweens.add({
      targets: this,
      scale: JUICE.TOKEN_COLLECT_SCALE,
      alpha: 0,
      duration: JUICE.TOKEN_COLLECT_DURATION_MS,
      onComplete: () => {
        this.destroy();
        onComplete();
      },
    });
  }
}

export class InvincibilityPickup extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, AssetKeys.INVINCIBILITY_PICKUP, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setOrigin(0.5, 1);
    this.setDepth(DEPTH.ITEM);
    (this.body as Phaser.Physics.Arcade.Body).setAllowGravity(false);
    this.play(AnimationKeys.INVINCIBILITY_PICKUP_PULSE);
  }

  public collect(onComplete: () => void): void {
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.scene.tweens.add({
      targets: this,
      scale: JUICE.PICKUP_COLLECT_SCALE,
      alpha: 0,
      duration: JUICE.PICKUP_COLLECT_DURATION_MS,
      onComplete: () => {
        this.destroy();
        onComplete();
      },
    });
  }
}
