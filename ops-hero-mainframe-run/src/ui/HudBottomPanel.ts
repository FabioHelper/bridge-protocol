/**
 * Bottom bar dynamic fields: mission/objective text, the item slot, decorative automation
 * cells and the segmented power meter. See BUILD_BRIEF.md section 9 and SPEC.md section 6.2.
 *
 * Compartment positions are measured directly off `public/assets/hud-bottom.png` (480x47) -- the
 * "CURRENT MISSION" / "OBJECTIVE" / "ITEM" / "AUTOMATION" / "POWER" headers and the five
 * automation robots are baked art; only the values below/inside them are drawn here.
 */
import type Phaser from 'phaser';

import { AssetKeys } from '../config/AssetKeys';
import { AnimationKeys } from '../config/Animations';
import { DEPTH, VIEWPORT } from '../config/Tuning';
import { Palette } from '../config/Palette';
import type { RunState } from '../systems/RunState';
import { createPixelText, setPixelText } from './PixelText';
import { drawPowerMeter } from './PowerMeter';

const BAR_Y = VIEWPORT.LOGICAL_HEIGHT - VIEWPORT.HUD_BOTTOM_HEIGHT;

/** Body-text row, below the baked "CURRENT MISSION" / "OBJECTIVE" headers (y=6-13). */
const BODY_ROW_Y = BAR_Y + 15;
const MISSION_X = 6;
const MISSION_WRAP_WIDTH = 82;
const OBJECTIVE_X = 96;
const OBJECTIVE_WRAP_WIDTH = 94;

/** ITEM box interior, measured off the baked border at x=194-250, y=5-38. */
const ITEM_SLOT_CENTER_X = 222;
const ITEM_SLOT_CENTER_Y = BAR_Y + 27;
const ITEM_SLOT_SCALE = 1.5;

/** Five baked robot icons at x=253..330, y=16-33 (spacing measured off the art). */
const AUTOMATION_START_X = 253;
const AUTOMATION_SPACING_X = 19;
const AUTOMATION_CELL_COUNT = 5;
const AUTOMATION_Y = BAR_Y + 16;
const AUTOMATION_CELL_WIDTH = 18;
const AUTOMATION_CELL_HEIGHT = 18;
const AUTOMATION_CELL_CYCLE_MS = 220;

/** Segmented bar interior, measured off the baked outline at x=344-470, y=20-30. */
const METER_RECT = { x: 344, y: BAR_Y + 20, width: 126, height: 10 };

export class HudBottomPanel {
  private readonly missionLabel: Phaser.GameObjects.Text;
  private readonly objectiveLabel: Phaser.GameObjects.Text;
  private readonly itemSlot: Phaser.GameObjects.Sprite;
  private readonly automationGraphics: Phaser.GameObjects.Graphics;
  private readonly meterGraphics: Phaser.GameObjects.Graphics;
  private elapsedMs = 0;

  constructor(scene: Phaser.Scene) {
    const depth = DEPTH.WORLD_PANEL + 1;

    this.missionLabel = createPixelText(scene, MISSION_X, BODY_ROW_Y, '', Palette.WHITE).setDepth(depth);
    this.missionLabel.setWordWrapWidth(MISSION_WRAP_WIDTH, true);
    this.objectiveLabel = createPixelText(scene, OBJECTIVE_X, BODY_ROW_Y, '', Palette.WHITE).setDepth(depth);
    this.objectiveLabel.setWordWrapWidth(OBJECTIVE_WRAP_WIDTH, true);

    this.itemSlot = scene.add.sprite(ITEM_SLOT_CENTER_X, ITEM_SLOT_CENTER_Y, AssetKeys.INVINCIBILITY_PICKUP, 0);
    this.itemSlot.setOrigin(0.5, 0.5);
    this.itemSlot.setScale(ITEM_SLOT_SCALE);
    this.itemSlot.setDepth(depth);
    this.itemSlot.setVisible(false);
    this.itemSlot.play(AnimationKeys.INVINCIBILITY_PICKUP_PULSE);

    this.automationGraphics = scene.add.graphics().setDepth(depth);
    this.meterGraphics = scene.add.graphics().setDepth(depth);
  }

  public refreshText(state: RunState): void {
    setPixelText(this.missionLabel, state.missionText);
    setPixelText(this.objectiveLabel, state.objectiveText);
    this.itemSlot.setVisible(state.invincibilityActive);
  }

  /** Meter and decorative automation cells redraw every frame per GAMEPLAY_SPEC section 11. */
  public refreshFast(deltaMs: number, state: RunState): void {
    this.elapsedMs += deltaMs;
    drawPowerMeter(this.meterGraphics, METER_RECT, state.powerFraction);
    this.drawAutomationCells();
  }

  /** A thin highlight outline cycles across the five baked robots -- the robots stay visible. */
  private drawAutomationCells(): void {
    const g = this.automationGraphics;
    g.clear();
    const activeIndex = Math.floor(this.elapsedMs / AUTOMATION_CELL_CYCLE_MS) % AUTOMATION_CELL_COUNT;
    const x = AUTOMATION_START_X + activeIndex * AUTOMATION_SPACING_X;
    g.lineStyle(1, Palette.ACCENT_CYAN, 1);
    g.strokeRect(x, AUTOMATION_Y, AUTOMATION_CELL_WIDTH, AUTOMATION_CELL_HEIGHT);
  }
}
