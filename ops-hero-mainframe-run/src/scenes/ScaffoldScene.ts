/**
 * TEMPORARY scaffolding scene.
 *
 * The game itself is not implemented yet -- that work is deliberately held until the remaining
 * source boards arrive (see ASSET_INTAKE.md). This scene exists so the toolchain is provably
 * working end to end: it loads real textures from public/assets, reports which track they came
 * from, and proves nearest-neighbour rendering at 480x270.
 *
 * DELETE THIS FILE when BootScene/PreloadScene/MainMenuScene/LevelScene/HudScene/GameOverScene
 * land. Nothing else imports it except src/main.ts.
 */
import Phaser from 'phaser';

import { AssetKeys } from '../config/AssetKeys';
import { resolveAssetUrl } from '../config/AssetSource';
import { AnimationKeys, ANIMATIONS } from '../config/Animations';
import { Palette } from '../config/Palette';
import { SceneKeys } from '../config/GameConfig';
import { VIEWPORT } from '../config/Tuning';

const STATUS_LINES = [
  'OPS HERO: MAINFRAME RUN',
  'SCAFFOLD BUILD - GAME NOT YET IMPLEMENTED',
  '',
  'PIPELINE: READY   CONTRACT: v2   ASSETS: 48/48',
  'AWAITING SOURCE BOARDS IN assets/source/',
];

export class ScaffoldScene extends Phaser.Scene {
  private missingKeys: string[] = [];

  constructor() {
    super(SceneKeys.BOOT);
  }

  public preload(): void {
    // resolveAssetUrl keeps this identical between the web build and the single-file artifact build.
    // A representative slice, not the full manifest: this scene only proves loading works.
    this.load.spritesheet(AssetKeys.HERO, resolveAssetUrl('hero.png'), {
      frameWidth: 32,
      frameHeight: 48,
    });
    for (const [key, file] of [
      [AssetKeys.BG_FAR_SKY, 'bg-far-sky.png'],
      [AssetKeys.BG_MID_MOUNTAINS, 'bg-mid-mountains.png'],
      [AssetKeys.BG_NEAR_DATACENTER, 'bg-near-datacenter.png'],
      [AssetKeys.HUD_TOP, 'hud-top.png'],
      [AssetKeys.HUD_BOTTOM, 'hud-bottom.png'],
    ] as const) {
      this.load.image(key, resolveAssetUrl(file));
    }

    // Graceful missing-asset handling: record rather than crash.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      this.missingKeys.push(file.key);
    });
  }

  public create(): void {
    for (const definition of ANIMATIONS) {
      if (!this.textures.exists(definition.texture) || this.anims.exists(definition.key)) {
        continue;
      }
      this.anims.create({
        key: definition.key,
        frames: definition.frames.map((frame) => ({ key: definition.texture, frame })),
        frameRate: definition.frameRate,
        repeat: definition.repeat,
      });
    }

    this.addIfPresent(AssetKeys.BG_FAR_SKY, 0, VIEWPORT.PLAY_Y, 0);
    this.addIfPresent(AssetKeys.BG_NEAR_DATACENTER, 0, VIEWPORT.PLAY_Y + VIEWPORT.PLAY_HEIGHT, 1);
    this.addIfPresent(AssetKeys.HUD_TOP, 0, 0, 0);
    this.addIfPresent(AssetKeys.HUD_BOTTOM, 0, VIEWPORT.LOGICAL_HEIGHT, 1);

    if (this.textures.exists(AssetKeys.HERO)) {
      const hero = this.add.sprite(64, VIEWPORT.PLAY_Y + VIEWPORT.PLAY_HEIGHT - 8, AssetKeys.HERO);
      hero.setOrigin(0.5, 1);
      if (this.anims.exists(AnimationKeys.HERO_RUN)) {
        hero.play(AnimationKeys.HERO_RUN);
      }
      this.tweens.add({
        targets: hero,
        x: VIEWPORT.LOGICAL_WIDTH - 64,
        duration: 4000,
        yoyo: true,
        repeat: -1,
        onYoyo: () => hero.setFlipX(true),
        onRepeat: () => hero.setFlipX(false),
      });
    }

    const lines = [...STATUS_LINES];
    if (this.missingKeys.length > 0) {
      lines.push('', `MISSING TEXTURES: ${this.missingKeys.join(', ')}`);
    }
    this.add
      .text(8, VIEWPORT.PLAY_Y + 8, lines.join('\n'), {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '8px',
        color: `#${Palette.TEXT_PRIMARY.toString(16).padStart(6, '0')}`,
        resolution: 1,
      })
      .setResolution(1);

    // Minimal probe used by the Playwright smoke test.
    window.__OPS_HERO__ = {
      scene: SceneKeys.BOOT,
      lives: 0,
      errors: [...this.missingKeys],
    };
  }

  /** Anchored placement: y is the anchor edge, origin picks top (0) or bottom (1). */
  private addIfPresent(key: string, x: number, y: number, originY: 0 | 1): void {
    if (!this.textures.exists(key)) {
      return;
    }
    this.add.image(x, y, key).setOrigin(0, originY);
  }
}
