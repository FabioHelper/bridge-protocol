/**
 * Loads every entry in ASSET_MANIFEST via resolveAssetUrl, shows a minimal progress bar,
 * substitutes a checkerboard placeholder for anything that fails to load, registers every
 * animation once, then hands off to MainMenuScene. See SPEC.md section 5.2 and 5.4.
 */
import Phaser from 'phaser';

import { ASSET_MANIFEST, isSpritesheet } from '../config/AssetKeys';
import { resolveAssetUrl } from '../config/AssetSource';
import { SceneKeys } from '../config/GameConfig';
import { Palette } from '../config/Palette';
import { VIEWPORT } from '../config/Tuning';
import { registerAnimations } from '../ui/AnimationRegistry';
import { generatePlaceholderTexture } from '../ui/PlaceholderTextures';
import { createPixelText } from '../ui/PixelText';

const BAR_WIDTH = 200;
const BAR_HEIGHT = 8;
const BAR_X = (VIEWPORT.LOGICAL_WIDTH - BAR_WIDTH) / 2;
const BAR_Y = VIEWPORT.LOGICAL_HEIGHT / 2;

export class PreloadScene extends Phaser.Scene {
  private missingKeys: string[] = [];
  private progressBar!: Phaser.GameObjects.Graphics;

  constructor() {
    super(SceneKeys.PRELOAD);
  }

  public preload(): void {
    this.drawFrame();
    this.load.on(Phaser.Loader.Events.PROGRESS, (fraction: number) => this.drawProgress(fraction));
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      this.missingKeys.push(file.key);
    });

    for (const entry of ASSET_MANIFEST) {
      const url = resolveAssetUrl(entry.path);
      if (isSpritesheet(entry)) {
        this.load.spritesheet(entry.key, url, { frameWidth: entry.frameWidth, frameHeight: entry.frameHeight });
      } else {
        this.load.image(entry.key, url);
      }
    }
  }

  public create(): void {
    for (const key of this.missingKeys) {
      const entry = ASSET_MANIFEST.find((candidate) => candidate.key === key);
      if (entry) {
        generatePlaceholderTexture(this, entry);
      }
    }
    if (this.missingKeys.length > 0) {
      console.warn(`substituted placeholder textures for: ${this.missingKeys.join(', ')}`);
    }

    registerAnimations(this);
    this.scene.start(SceneKeys.MAIN_MENU);
  }

  private drawFrame(): void {
    createPixelText(this, VIEWPORT.LOGICAL_WIDTH / 2 - 30, BAR_Y - 16, 'LOADING', Palette.TEXT_PRIMARY);
    const frame = this.add.graphics();
    frame.lineStyle(1, Palette.HUD_BORDER, 1);
    frame.strokeRect(BAR_X, BAR_Y, BAR_WIDTH, BAR_HEIGHT);
    this.progressBar = this.add.graphics();
  }

  private drawProgress(fraction: number): void {
    this.progressBar.clear();
    this.progressBar.fillStyle(Palette.ACCENT_GOLD, 1);
    this.progressBar.fillRect(BAR_X + 1, BAR_Y + 1, Math.max(0, fraction * (BAR_WIDTH - 2)), BAR_HEIGHT - 2);
  }
}
