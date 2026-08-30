/** Title, high score, controls legend, Enter to start. Holds no run state of its own. */
import Phaser from 'phaser';

import { AssetKeys } from '../config/AssetKeys';
import { SceneKeys } from '../config/GameConfig';
import { Palette } from '../config/Palette';
import { PLAYER, HUD } from '../config/Tuning';
import { HighScoreStore } from '../systems/HighScoreStore';
import { createPixelText } from '../ui/PixelText';

export class MainMenuScene extends Phaser.Scene {
  private enterKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super(SceneKeys.MAIN_MENU);
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(Palette.SKY);
    if (this.textures.exists(AssetKeys.BG_FAR_SKY)) {
      this.add.image(0, 0, AssetKeys.BG_FAR_SKY).setOrigin(0, 0);
    }
    if (this.textures.exists(AssetKeys.HUD_TOP)) {
      this.add.image(0, 0, AssetKeys.HUD_TOP).setOrigin(0, 0);
    }

    createPixelText(this, 140, 60, 'OPS HERO: MAINFRAME RUN', Palette.TEXT_HEADING, 12);
    createPixelText(this, 150, 90, 'THE BATCH WINDOW IS CLOSING.', Palette.TEXT_PRIMARY);
    createPixelText(this, 150, 100, 'CLEAR FOUR JOBS. GET OUT.', Palette.TEXT_PRIMARY);

    const highScore = new HighScoreStore(window.localStorage).read();
    createPixelText(
      this,
      150,
      120,
      `HIGH SCORE ${highScore.toString().padStart(HUD.SCORE_DIGITS, '0')}`,
      Palette.ACCENT_GOLD,
    );

    createPixelText(this, 150, 150, 'MOVE  <-/A  D/->', Palette.TEXT_DIM);
    createPixelText(this, 150, 160, 'JUMP  SPACE / W / UP', Palette.TEXT_DIM);
    createPixelText(this, 150, 170, 'PAUSE P / ESC   RESTART R', Palette.TEXT_DIM);

    const prompt = createPixelText(this, 150, 200, 'PRESS ENTER TO START', Palette.ACCENT_CYAN);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('keyboard plugin unavailable');
    }
    this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    window.__OPS_HERO__ = { scene: SceneKeys.MAIN_MENU, lives: PLAYER.START_LIVES, errors: [] };
  }

  public override update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.scene.start(SceneKeys.LEVEL);
      this.scene.start(SceneKeys.HUD);
    }
  }
}
