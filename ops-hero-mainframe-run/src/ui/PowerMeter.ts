/**
 * The segmented, colour-graded invincibility power meter (red -> orange -> yellow -> green ->
 * blue). Redrawn every frame per GAMEPLAY_SPEC.md section 11 -- a `Graphics` object is cheap to
 * clear and refill at this scale, so no dirty-tracking is needed.
 */
import type Phaser from 'phaser';

import { HUD } from '../config/Tuning';
import { POWER_METER_RAMP } from '../config/Palette';

export interface PowerMeterRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function drawPowerMeter(graphics: Phaser.GameObjects.Graphics, rect: PowerMeterRect, fraction: number): void {
  graphics.clear();
  const segments = HUD.POWER_METER_SEGMENTS;
  const segmentWidth = rect.width / segments;
  const filledCount = Math.round(Math.max(0, Math.min(1, fraction)) * segments);

  for (let i = 0; i < filledCount; i += 1) {
    const color = POWER_METER_RAMP[i] ?? POWER_METER_RAMP[POWER_METER_RAMP.length - 1] ?? 0xffffff;
    graphics.fillStyle(color, 1);
    const segX = Math.floor(rect.x + i * segmentWidth);
    const segW = Math.ceil(segmentWidth) - 1;
    graphics.fillRect(segX, rect.y, Math.max(1, segW), rect.height);
  }
}
