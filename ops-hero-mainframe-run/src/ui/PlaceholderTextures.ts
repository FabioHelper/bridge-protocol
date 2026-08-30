/**
 * Runtime fallback for a texture that failed to load: a magenta/black checkerboard at the exact
 * contracted dimensions (and, for a spritesheet, exact frame layout), so the game boots with
 * visibly-wrong-but-correctly-sized art rather than crashing. See SPEC.md section 5.4.
 */
import type Phaser from 'phaser';

import type { ImageEntry, ManifestEntry, SpritesheetEntry } from '../config/AssetKeys';
import { isSpritesheet } from '../config/AssetKeys';

const CHECKER_SIZE_PX = 4;
const MAGENTA = '#ff00ff';
const BLACK = '#000000';

function paintCheckerboard(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  for (let y = 0; y < height; y += CHECKER_SIZE_PX) {
    for (let x = 0; x < width; x += CHECKER_SIZE_PX) {
      const even = (Math.floor(x / CHECKER_SIZE_PX) + Math.floor(y / CHECKER_SIZE_PX)) % 2 === 0;
      ctx.fillStyle = even ? MAGENTA : BLACK;
      ctx.fillRect(x, y, CHECKER_SIZE_PX, CHECKER_SIZE_PX);
    }
  }
}

function generateImagePlaceholder(scene: Phaser.Scene, entry: ImageEntry): void {
  const texture = scene.textures.createCanvas(entry.key, entry.fallbackWidth, entry.fallbackHeight);
  if (!texture) return;
  paintCheckerboard(texture.context, entry.fallbackWidth, entry.fallbackHeight);
  texture.refresh();
}

function generateSpritesheetPlaceholder(scene: Phaser.Scene, entry: SpritesheetEntry): void {
  const width = entry.frameWidth * entry.frameCount;
  const texture = scene.textures.createCanvas(entry.key, width, entry.frameHeight);
  if (!texture) return;
  paintCheckerboard(texture.context, width, entry.frameHeight);
  texture.refresh();
  for (let i = 0; i < entry.frameCount; i += 1) {
    texture.add(i, 0, i * entry.frameWidth, 0, entry.frameWidth, entry.frameHeight);
  }
}

export function generatePlaceholderTexture(scene: Phaser.Scene, entry: ManifestEntry): void {
  if (scene.textures.exists(entry.key)) {
    return;
  }
  if (isSpritesheet(entry)) {
    generateSpritesheetPlaceholder(scene, entry);
  } else {
    generateImagePlaceholder(scene, entry);
  }
}
