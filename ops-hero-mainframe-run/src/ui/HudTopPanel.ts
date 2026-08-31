/**
 * Top bar dynamic fields: lives, score, jobs, alerts, tokens, PF-key highlight, status message
 * and the decorative activity graph. See BUILD_BRIEF.md section 9 and SPEC.md section 6.1.
 *
 * Field x-positions are measured directly off `public/assets/hud-top.png` (480x42) so every
 * dynamic value lands under the baked label it belongs to -- see the measurement notes beside
 * each constant. Text fields are mutated in place at HUD_TEXT_REFRESH_MS (`refreshText`); the PF
 * row and activity graph are visual-only and redrawn every frame via `refreshFast`.
 */
import type Phaser from 'phaser';

import { AssetKeys } from '../config/AssetKeys';
import { DEPTH, HUD } from '../config/Tuning';
import { Palette } from '../config/Palette';
import type { RunState } from '../systems/RunState';
import { createPixelText, setPixelText } from './PixelText';

/** Portrait spans roughly x=0..24, y=13..40 in hud-top.png; the lives count sits beside it. */
const LIVES_VALUE_X = 27;
const LIVES_VALUE_Y = 22;

/** Baked label runs: SCORE 81-103, JOBS 134-151, ALERTS 166-194, COINS 211-233 (all y=2-10). */
const SCORE_VALUE_X = 81;
const JOBS_VALUE_X = 134;
const ALERTS_VALUE_X = 166;
const COINS_ICON_X = 211;
const COINS_ICON_Y = 13;
const COINS_VALUE_X = 230;
const VALUE_ROW_Y = 14;

/** PF grid: 6 columns x 2 rows, boxes ~21x10, measured off the baked button art. */
const PF_START_X = 250;
const PF_SPACING_X = 23;
const PF_ROW1_Y = 14;
const PF_ROW2_Y = 26;
const PF_COLS = 6;
const PF_BOX_WIDTH = 21;
const PF_BOX_HEIGHT = 10;

/** SYS STATUS panel: header baked at y=6-13, default "ALL SYSTEMS GO" line baked at y=15-21. */
const STATUS_LABEL_X = 398;
const STATUS_LABEL_Y = 15;
const STATUS_CLEAR_X = 397;
const STATUS_CLEAR_Y = 14;
const STATUS_CLEAR_WIDTH = 81;
const STATUS_CLEAR_HEIGHT = 8;

/** Waveform box interior, measured off the baked border at x=398-478, y=24-33. */
const GRAPH_X = 400;
const GRAPH_Y = 26;
const GRAPH_WIDTH = 76;
const GRAPH_HEIGHT = 5;
const GRAPH_BAR_COUNT = 10;

export class HudTopPanel {
  private readonly livesLabel: Phaser.GameObjects.Text;
  private readonly scoreLabel: Phaser.GameObjects.Text;
  private readonly jobsLabel: Phaser.GameObjects.Text;
  private readonly alertsLabel: Phaser.GameObjects.Text;
  private readonly coinsIcon: Phaser.GameObjects.Sprite;
  private readonly coinsLabel: Phaser.GameObjects.Text;
  private readonly statusClear: Phaser.GameObjects.Graphics;
  private readonly statusLabel: Phaser.GameObjects.Text;
  private readonly pfGraphics: Phaser.GameObjects.Graphics;
  private readonly graphGraphics: Phaser.GameObjects.Graphics;
  private elapsedMs = 0;

  constructor(scene: Phaser.Scene) {
    const depth = DEPTH.WORLD_PANEL + 1;

    this.livesLabel = createPixelText(scene, LIVES_VALUE_X, LIVES_VALUE_Y, '', Palette.WHITE).setDepth(depth);
    this.scoreLabel = createPixelText(scene, SCORE_VALUE_X, VALUE_ROW_Y, '', Palette.WHITE).setDepth(depth);
    this.jobsLabel = createPixelText(scene, JOBS_VALUE_X, VALUE_ROW_Y, '', Palette.TEXT_PRIMARY).setDepth(depth);
    this.alertsLabel = createPixelText(scene, ALERTS_VALUE_X, VALUE_ROW_Y, '', Palette.ALERT_RED).setDepth(depth);

    this.coinsIcon = scene.add.sprite(COINS_ICON_X, COINS_ICON_Y, AssetKeys.COMMAND_TOKEN, 0);
    this.coinsIcon.setOrigin(0, 0);
    this.coinsIcon.setDepth(depth);
    this.coinsLabel = createPixelText(scene, COINS_VALUE_X, VALUE_ROW_Y, '', Palette.WHITE).setDepth(depth);

    this.statusClear = scene.add.graphics().setDepth(depth - 1);
    this.statusLabel = createPixelText(scene, STATUS_LABEL_X, STATUS_LABEL_Y, '', Palette.TEXT_PRIMARY).setDepth(
      depth,
    );

    this.pfGraphics = scene.add.graphics().setDepth(depth);
    this.graphGraphics = scene.add.graphics().setDepth(depth);
  }

  /** String fields: called at HUD_TEXT_REFRESH_MS. */
  public refreshText(state: RunState): void {
    setPixelText(this.livesLabel, `×${state.lives.toString().padStart(HUD.COUNTER_DIGITS, '0')}`);
    setPixelText(this.scoreLabel, state.score.toString().padStart(HUD.SCORE_DIGITS, '0'));
    setPixelText(this.jobsLabel, `${state.jobsComplete.toString().padStart(HUD.COUNTER_DIGITS, '0')}/${state.totalJobs}`);
    setPixelText(this.alertsLabel, state.alerts.toString().padStart(HUD.COUNTER_DIGITS, '0'));
    setPixelText(this.coinsLabel, `×${state.tokens.toString().padStart(HUD.COUNTER_DIGITS, '0')}`);

    this.statusClear.clear();
    this.statusClear.fillStyle(Palette.HUD_PANEL, 1);
    this.statusClear.fillRect(STATUS_CLEAR_X, STATUS_CLEAR_Y, STATUS_CLEAR_WIDTH, STATUS_CLEAR_HEIGHT);
    setPixelText(this.statusLabel, state.statusMessage);

    this.drawPfRow(state.activePfKey);
  }

  /** Visual-only fields: called every frame. */
  public refreshFast(deltaMs: number): void {
    this.elapsedMs += deltaMs;
    this.drawActivityGraph();
  }

  private drawPfRow(activePfKey: number): void {
    const g = this.pfGraphics;
    g.clear();
    for (let i = 0; i < HUD.PF_KEY_COUNT; i += 1) {
      const active = i + 1 === activePfKey;
      const col = i % PF_COLS;
      const row = Math.floor(i / PF_COLS);
      const x = PF_START_X + col * PF_SPACING_X;
      const y = row === 0 ? PF_ROW1_Y : PF_ROW2_Y;
      if (active) {
        g.lineStyle(1, Palette.ACCENT_GOLD, 1);
        g.strokeRect(x, y, PF_BOX_WIDTH, PF_BOX_HEIGHT);
      }
    }
  }

  private drawActivityGraph(): void {
    const g = this.graphGraphics;
    g.clear();
    const barWidth = GRAPH_WIDTH / GRAPH_BAR_COUNT;
    for (let i = 0; i < GRAPH_BAR_COUNT; i += 1) {
      const phase = this.elapsedMs / 1000 + i * 0.4;
      const level = (Math.sin(phase) + 1) / 2;
      const barHeight = Math.max(1, level * GRAPH_HEIGHT);
      g.fillStyle(Palette.ACCENT_CYAN, 1);
      g.fillRect(GRAPH_X + i * barWidth, GRAPH_Y + (GRAPH_HEIGHT - barHeight), barWidth - 1, barHeight);
    }
  }
}
