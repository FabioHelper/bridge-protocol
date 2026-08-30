/** The single place where pixelArt, roundPixels, scale mode and Arcade physics are configured. */
import Phaser from 'phaser';

import { VIEWPORT, WORLD } from './Tuning';
import { Palette } from './Palette';

export const SceneKeys = {
  BOOT: 'Boot',
  PRELOAD: 'Preload',
  MAIN_MENU: 'MainMenu',
  LEVEL: 'Level',
  HUD: 'Hud',
  GAME_OVER: 'GameOver',
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];

export const REGISTRY_KEYS = {
  /** The only channel by which run state crosses a scene boundary. */
  RUN_STATE: 'runState',
} as const;

export function createGameConfig(
  scenes: readonly Phaser.Types.Scenes.SceneType[],
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent: 'game-root',
    width: VIEWPORT.LOGICAL_WIDTH,
    height: VIEWPORT.LOGICAL_HEIGHT,
    backgroundColor: Palette.SKY,
    // Nearest-neighbour upscaling and integer positioning: together with the CSS
    // `image-rendering: pixelated` in index.html, this is what keeps the art crisp.
    pixelArt: true,
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: VIEWPORT.LOGICAL_WIDTH,
      height: VIEWPORT.LOGICAL_HEIGHT,
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: WORLD.GRAVITY_Y },
        debug: false,
      },
    },
    scene: [...scenes],
  };
}
