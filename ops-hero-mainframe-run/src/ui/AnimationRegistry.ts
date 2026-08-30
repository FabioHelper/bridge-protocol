/**
 * The one place `anims.create` is called, driven entirely by the declarative `ANIMATIONS` table
 * -- so an animation can never be defined twice under different keys. See Animations.ts.
 */
import type Phaser from 'phaser';

import { ANIMATIONS } from '../config/Animations';

export function registerAnimations(scene: Phaser.Scene): void {
  for (const definition of ANIMATIONS) {
    if (scene.anims.exists(definition.key) || !scene.textures.exists(definition.texture)) {
      continue;
    }
    scene.anims.create({
      key: definition.key,
      frames: definition.frames.map((frame) => ({ key: definition.texture, frame })),
      frameRate: definition.frameRate,
      repeat: definition.repeat,
    });
  }
}
