/**
 * Top bar dynamic fields: lives, score, jobs, alerts, tokens, PF-key highlight, status message
 * and the decorative activity graph. See BUILD_BRIEF.md section 9 and SPEC.md section 6.1.
 *
 * Text fields are mutated in place at HUD_TEXT_REFRESH_MS (`refreshText`); the PF row and
 * activity graph are visual-only and redrawn every frame via `refreshFast`.
 */
import type Phaser from 'phaser';

import { DEPTH, HUD, VIEWPORT } from '../config/Tuning';
import { Palette } from '../config/Palette';
import type { RunState } from '../systems/RunState';
import { createPixelText, setPixelText } from './PixelText';

const PF_ROW_Y = 20;
const PF_START_X = 6;
const PF_SPACING = 11;
const GRAPH_X = 420;
const GRAPH_Y = 4;
const GRAPH_WIDTH = 50;
const GRAPH_HEIGHT = 12;
const GRAPH_BAR_COUNT = 10;

export class HudTopPanel {
  private readonly statsLabel: Phaser.GameObjects.Text;
  private readonly statusLabel: Phaser.GameObjects.Text;
  private readonly pfGraphics: Phaser.GameObjects.Graphics;
  private readonly graphGraphics: Phaser.GameObjects.Graphics;
  private elapsedMs = 0;

  constructor(scene: Phaser.Scene) {
    this.statsLabel = createPixelText(scene, 6, 3, '', Palette.TEXT_PRIMARY).setDepth(DEPTH.WORLD_PANEL + 1);
    this.statusLabel = createPixelText(scene, VIEWPORT.LOGICAL_WIDTH / 2, 3, '', Palette.ACCENT_GOLD).setDepth(
      DEPTH.WORLD_PANEL + 1,
    );
    this.pfGraphics = scene.add.graphics().setDepth(DEPTH.WORLD_PANEL + 1);
    this.graphGraphics = scene.add.graphics().setDepth(DEPTH.WORLD_PANEL + 1);
  }

  /** String fields: called at HUD_TEXT_REFRESH_MS. */
  public refreshText(state: RunState): void {
    const score = state.score.toString().padStart(HUD.SCORE_DIGITS, '0');
    const alerts = state.alerts.toString().padStart(HUD.COUNTER_DIGITS, '0');
    const tokens = state.tokens.toString().padStart(HUD.COUNTER_DIGITS, '0');
    setPixelText(
      this.statsLabel,
      `LV${state.lives} SCORE ${score} JOBS ${state.jobsComplete}/${state.totalJobs} ALERT ${alerts} TOK ${tokens}`,
    );
    setPixelText(this.statusLabel, state.statusMessage);
    this.statusLabel.setX(Math.floor(VIEWPORT.LOGICAL_WIDTH / 2 - this.statusLabel.width / 2));

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
      g.fillStyle(active ? Palette.ACCENT_GOLD : Palette.HUD_PANEL_DARK, 1);
      g.fillRect(PF_START_X + i * PF_SPACING, PF_ROW_Y, 8, 5);
      g.lineStyle(1, active ? Palette.ACCENT_GOLD : Palette.TEXT_DIM, 1);
      g.strokeRect(PF_START_X + i * PF_SPACING, PF_ROW_Y, 8, 5);
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
