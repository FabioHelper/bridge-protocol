/** Results, high-score status and retry. Holds no run state -- everything arrives via scene data. */
import Phaser from 'phaser';

import { SceneKeys } from '../config/GameConfig';
import { Palette } from '../config/Palette';
import { HUD, VIEWPORT } from '../config/Tuning';
import { createPixelText } from '../ui/PixelText';

export interface GameOverData {
  readonly reason: 'complete' | 'out-of-lives';
  readonly score: number;
  readonly highScore: number;
  readonly jobsComplete: number;
  readonly totalJobs: number;
  readonly alerts: number;
  readonly tokens: number;
  readonly levelBonus: number;
  readonly timeBonus: number;
}

export class GameOverScene extends Phaser.Scene {
  private result!: GameOverData;
  private enterKey!: Phaser.Input.Keyboard.Key;

  constructor() {
    super(SceneKeys.GAME_OVER);
  }

  public init(data: GameOverData): void {
    this.result = data;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(Palette.HUD_PANEL_DARK);
    const d = this.result;
    const isNewHighScore = d.score > 0 && d.score >= d.highScore;

    createPixelText(
      this,
      120,
      50,
      d.reason === 'complete' ? 'LEVEL COMPLETE' : 'OUT OF LIVES',
      d.reason === 'complete' ? Palette.ACCENT_GOLD : Palette.ALERT_RED,
      14,
    );

    const lines = [
      `SCORE        ${d.score.toString().padStart(HUD.SCORE_DIGITS, '0')}`,
      d.reason === 'complete' ? `LEVEL BONUS  ${d.levelBonus}` : '',
      d.reason === 'complete' ? `TIME BONUS   ${d.timeBonus}` : '',
      `JOBS         ${d.jobsComplete} / ${d.totalJobs}`,
      `ALERTS       ${d.alerts}`,
      `TOKENS       ${d.tokens}`,
      '',
      `HIGH SCORE   ${d.highScore.toString().padStart(HUD.SCORE_DIGITS, '0')}${isNewHighScore ? '  NEW!' : ''}`,
    ].filter((line) => line.length > 0);

    createPixelText(this, 120, 90, lines.join('\n'), Palette.TEXT_PRIMARY);

    const prompt = createPixelText(this, 120, VIEWPORT.LOGICAL_HEIGHT - 40, 'PRESS ENTER FOR MAIN MENU', Palette.ACCENT_CYAN);
    this.tweens.add({ targets: prompt, alpha: 0.2, duration: 500, yoyo: true, repeat: -1 });

    const keyboard = this.input.keyboard;
    if (!keyboard) {
      throw new Error('keyboard plugin unavailable');
    }
    this.enterKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);

    window.__OPS_HERO__ = { scene: SceneKeys.GAME_OVER, lives: 0, errors: [] };
  }

  public override update(): void {
    if (Phaser.Input.Keyboard.JustDown(this.enterKey)) {
      this.scene.start(SceneKeys.MAIN_MENU);
    }
  }
}
