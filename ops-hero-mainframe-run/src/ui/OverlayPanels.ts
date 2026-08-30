/**
 * The MAP and VIEWDATA overlay panels -- inside the play viewport, top-right, per
 * BUILD_BRIEF.md section 4 and SPEC.md section 6.3. Both read only from a `RunState` snapshot,
 * never a live game object, keeping HudScene's "consume a snapshot, never touch game objects"
 * contract honest.
 */
import type Phaser from 'phaser';

import { AssetKeys } from '../config/AssetKeys';
import { DEPTH, VIEWPORT } from '../config/Tuning';
import { Palette } from '../config/Palette';
import type { RunState } from '../systems/RunState';
import { createPixelText, setPixelText } from './PixelText';

const MAP_WIDTH = 124;
const MAP_HEIGHT = 40;
const MAP_X = VIEWPORT.LOGICAL_WIDTH - MAP_WIDTH - 4;
const MAP_Y = VIEWPORT.PLAY_Y + 4;
const TRACK_MARGIN = 8;

export class MinimapPanel {
  private readonly background: Phaser.GameObjects.Image;
  private readonly graphics: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.background = scene.add.image(MAP_X, MAP_Y, AssetKeys.HUD_MINIMAP).setOrigin(0, 0);
    this.background.setDisplaySize(MAP_WIDTH, MAP_HEIGHT);
    this.background.setDepth(DEPTH.WORLD_PANEL);
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(DEPTH.WORLD_PANEL + 1);
  }

  public update(state: RunState): void {
    const g = this.graphics;
    g.clear();

    const trackY = MAP_Y + MAP_HEIGHT - 10;
    const trackLeft = MAP_X + TRACK_MARGIN;
    const trackRight = MAP_X + MAP_WIDTH - TRACK_MARGIN;
    const trackWidth = trackRight - trackLeft;

    g.lineStyle(1, Palette.HUD_BORDER, 1);
    g.lineBetween(trackLeft, trackY, trackRight, trackY);

    // Checkpoint tick.
    const checkpointX = trackLeft + trackWidth * state.checkpointProgress01;
    g.lineStyle(1, Palette.ACCENT_CYAN, 1);
    g.lineBetween(checkpointX, trackY - 3, checkpointX, trackY + 3);

    // Enemy dots.
    g.fillStyle(Palette.ALERT_RED, 1);
    for (const enemy of state.minimapEnemies) {
      g.fillRect(trackLeft + trackWidth * enemy.x01 - 1, trackY - 1, 2, 2);
    }

    // Player dot.
    g.fillStyle(Palette.WHITE, 1);
    const playerX = trackLeft + trackWidth * state.playerProgress01;
    g.fillCircle(playerX, trackY, 2);

    // Job pips.
    const pipSpacing = MAP_WIDTH / (state.jobPips.length + 1);
    state.jobPips.forEach((complete, index) => {
      g.fillStyle(complete ? Palette.ACCENT_GOLD : Palette.HUD_PANEL_DARK, 1);
      g.fillCircle(MAP_X + pipSpacing * (index + 1), MAP_Y + 8, 2);
    });
  }
}

const VIEWDATA_WIDTH = 124;
const VIEWDATA_HEIGHT = 60;
const VIEWDATA_X = MAP_X;
const VIEWDATA_Y = MAP_Y + MAP_HEIGHT + 4;
const VIEWDATA_LINE_COUNT = 4;

/**
 * `hud-viewdata.png` ships as a 16x16 fragment, too small to serve as the panel's own
 * background at contract dimensions -- the panel background here is drawn with `Graphics`
 * instead, with the contracted texture kept as a small corner glyph so it is still on screen.
 */
export class ViewdataPanel {
  private readonly background: Phaser.GameObjects.Graphics;
  private readonly badge: Phaser.GameObjects.Image;
  private readonly lines: Phaser.GameObjects.Text[];

  constructor(scene: Phaser.Scene) {
    this.background = scene.add.graphics();
    this.background.setDepth(DEPTH.WORLD_PANEL);
    this.background.fillStyle(Palette.HUD_PANEL_DARK, 0.85);
    this.background.fillRect(VIEWDATA_X, VIEWDATA_Y, VIEWDATA_WIDTH, VIEWDATA_HEIGHT);
    this.background.lineStyle(1, Palette.HUD_BORDER, 1);
    this.background.strokeRect(VIEWDATA_X, VIEWDATA_Y, VIEWDATA_WIDTH, VIEWDATA_HEIGHT);

    this.badge = scene.add.image(VIEWDATA_X + 2, VIEWDATA_Y + 2, AssetKeys.HUD_VIEWDATA).setOrigin(0, 0);
    this.badge.setDepth(DEPTH.WORLD_PANEL + 1);

    this.lines = Array.from({ length: VIEWDATA_LINE_COUNT }, (_, index) =>
      createPixelText(scene, VIEWDATA_X + 20, VIEWDATA_Y + 4 + index * 10, '', Palette.TEXT_PRIMARY, 6).setDepth(
        DEPTH.WORLD_PANEL + 1,
      ),
    );
  }

  public update(state: RunState): void {
    this.lines.forEach((label, index) => {
      setPixelText(label, state.viewdataLines[index] ?? '');
    });
  }
}
