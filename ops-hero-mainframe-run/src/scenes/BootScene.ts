/** Immediate hand-off to PreloadScene. pixelArt/roundPixels/scale are already set in GameConfig. */
import Phaser from 'phaser';

import { SceneKeys } from '../config/GameConfig';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SceneKeys.BOOT);
  }

  public create(): void {
    this.scene.start(SceneKeys.PRELOAD);
  }
}
