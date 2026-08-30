/**
 * Bottom bar dynamic fields: mission/objective text, the item slot, decorative automation
 * cells and the segmented power meter. See BUILD_BRIEF.md section 9 and SPEC.md section 6.2.
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
const ITEM_SLOT_X = 6;
const ITEM_SLOT_Y = BAR_Y + 30;
const AUTOMATION_X = 60;
const AUTOMATION_Y = BAR_Y + 32;
const AUTOMATION_CELL_COUNT = 8;
const AUTOMATION_CELL_CYCLE_MS = 220;
const METER_RECT = { x: 260, y: BAR_Y + 40, width: 210, height: 8 };

export class HudBottomPanel {
  private readonly missionLabel: Phaser.GameObjects.Text;
  private readonly objectiveLabel: Phaser.GameObjects.Text;
  private readonly itemSlot: Phaser.GameObjects.Sprite;
  private readonly automationGraphics: Phaser.GameObjects.Graphics;
  private readonly meterGraphics: Phaser.GameObjects.Graphics;
  private elapsedMs = 0;

  constructor(scene: Phaser.Scene) {
    this.missionLabel = createPixelText(scene, 6, BAR_Y + 4, '', Palette.TEXT_HEADING).setDepth(DEPTH.WORLD_PANEL + 1);
    this.objectiveLabel = createPixelText(scene, 6, BAR_Y + 14, '', Palette.TEXT_PRIMARY).setDepth(
      DEPTH.WORLD_PANEL + 1,
    );

    this.itemSlot = scene.add.sprite(ITEM_SLOT_X, ITEM_SLOT_Y, AssetKeys.INVINCIBILITY_PICKUP, 0);
    this.itemSlot.setOrigin(0, 0);
    this.itemSlot.setDepth(DEPTH.WORLD_PANEL + 1);
    this.itemSlot.setVisible(false);
    this.itemSlot.play(AnimationKeys.INVINCIBILITY_PICKUP_PULSE);

    this.automationGraphics = scene.add.graphics().setDepth(DEPTH.WORLD_PANEL + 1);
    this.meterGraphics = scene.add.graphics().setDepth(DEPTH.WORLD_PANEL + 1);
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

  private drawAutomationCells(): void {
    const g = this.automationGraphics;
    g.clear();
    const activeIndex = Math.floor(this.elapsedMs / AUTOMATION_CELL_CYCLE_MS) % AUTOMATION_CELL_COUNT;
    for (let i = 0; i < AUTOMATION_CELL_COUNT; i += 1) {
      g.fillStyle(i === activeIndex ? Palette.ACCENT_CYAN : Palette.HUD_PANEL_DARK, 1);
      g.fillRect(AUTOMATION_X + i * 10, AUTOMATION_Y, 8, 8);
      g.lineStyle(1, Palette.HUD_BORDER, 1);
      g.strokeRect(AUTOMATION_X + i * 10, AUTOMATION_Y, 8, 8);
    }
  }
}
