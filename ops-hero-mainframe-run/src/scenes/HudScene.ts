/**
 * Runs in parallel with LevelScene at a higher depth. Draws the static HUD frames, then the
 * dynamic panels, consuming only the `RunState` snapshot in the registry -- it never reaches
 * into LevelScene's game objects. See SPEC.md section 5.2.
 */
import Phaser from 'phaser';

import { AssetKeys } from '../config/AssetKeys';
import { REGISTRY_KEYS, SceneKeys } from '../config/GameConfig';
import { HUD, JUICE, VIEWPORT } from '../config/Tuning';
import { Palette } from '../config/Palette';
import { createInitialRunState, type RunState } from '../systems/RunState';
import { HudTopPanel } from '../ui/HudTopPanel';
import { HudBottomPanel } from '../ui/HudBottomPanel';
import { MinimapPanel, ViewdataPanel } from '../ui/OverlayPanels';
import { GameEvents } from './GameEvents';

const DAMAGE_VIGNETTE_ALPHA = 0.35;

export class HudScene extends Phaser.Scene {
  private topPanel!: HudTopPanel;
  private bottomPanel!: HudBottomPanel;
  private minimap!: MinimapPanel;
  private viewdata!: ViewdataPanel;
  private pausedLabel!: Phaser.GameObjects.Text;
  private vignette!: Phaser.GameObjects.Rectangle;
  private textRefreshAccumulatorMs = 0;

  constructor() {
    super(SceneKeys.HUD);
  }

  public create(): void {
    this.cameras.main.setScroll(0, 0);
    this.addStaticFrames();

    this.topPanel = new HudTopPanel(this);
    this.bottomPanel = new HudBottomPanel(this);
    this.minimap = new MinimapPanel(this);
    this.viewdata = new ViewdataPanel(this);

    this.vignette = this.add.rectangle(0, 0, VIEWPORT.LOGICAL_WIDTH, VIEWPORT.LOGICAL_HEIGHT, Palette.ALERT_RED, 0);
    this.vignette.setOrigin(0, 0);
    this.vignette.setDepth(1000);

    this.pausedLabel = this.add
      .text(VIEWPORT.LOGICAL_WIDTH / 2, VIEWPORT.LOGICAL_HEIGHT / 2, 'PAUSED', {
        fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
        fontSize: '16px',
        color: '#ffffff',
      })
      .setOrigin(0.5, 0.5)
      .setDepth(1001)
      .setVisible(false);

    this.game.events.on(GameEvents.DAMAGE, () => this.flashVignette());
    this.textRefreshAccumulatorMs = 0;
  }

  private addStaticFrames(): void {
    this.add.image(0, 0, AssetKeys.HUD_TOP).setOrigin(0, 0).setDepth(900);
    this.add
      .image(0, VIEWPORT.LOGICAL_HEIGHT - VIEWPORT.HUD_BOTTOM_HEIGHT, AssetKeys.HUD_BOTTOM)
      .setOrigin(0, 0)
      .setDepth(900);
  }

  private flashVignette(): void {
    this.vignette.setAlpha(DAMAGE_VIGNETTE_ALPHA);
    this.tweens.add({ targets: this.vignette, alpha: 0, duration: JUICE.DAMAGE_VIGNETTE_DURATION_MS });
  }

  public override update(_time: number, deltaMs: number): void {
    const state = (this.registry.get(REGISTRY_KEYS.RUN_STATE) as RunState | undefined) ?? createInitialRunState(0);

    this.textRefreshAccumulatorMs += deltaMs;
    if (this.textRefreshAccumulatorMs >= HUD.TEXT_REFRESH_MS) {
      this.textRefreshAccumulatorMs -= HUD.TEXT_REFRESH_MS;
      this.topPanel.refreshText(state);
      this.bottomPanel.refreshText(state);
      this.viewdata.update(state);
    }

    this.topPanel.refreshFast(deltaMs);
    this.bottomPanel.refreshFast(deltaMs, state);
    this.minimap.update(state);
    this.pausedLabel.setVisible(state.paused);
  }
}
