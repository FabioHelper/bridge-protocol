/**
 * HUD text helper: integer coordinates and no anti-aliasing, so nearest-neighbour pixel art
 * never blurs against a fractional-pixel label. See SPEC.md section 4.
 */
import type Phaser from 'phaser';

import { HUD } from '../config/Tuning';

function toHexColor(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

export function createPixelText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  color: number,
  fontSizePx: number = HUD.FONT_SIZE_PX,
): Phaser.GameObjects.Text {
  const label = scene.add.text(Math.floor(x), Math.floor(y), text, {
    fontFamily: 'ui-monospace, Menlo, Consolas, monospace',
    fontSize: `${fontSizePx}px`,
    color: toHexColor(color),
  });
  label.setResolution(1);
  return label;
}

/** Mutates an existing label's text and position, keeping both integer. Avoids re-creating text objects every refresh. */
export function setPixelText(label: Phaser.GameObjects.Text, text: string, x?: number, y?: number): void {
  if (label.text !== text) {
    label.setText(text);
  }
  if (x !== undefined) {
    label.setX(Math.floor(x));
  }
  if (y !== undefined) {
    label.setY(Math.floor(y));
  }
}
