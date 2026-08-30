/**
 * The 3-layer parallax backdrop. Each layer is a `TileSprite` pinned to the camera
 * (`setScrollFactor(0)`) and scrolled via `tilePositionX`, which repeats seamlessly regardless of
 * the source strip's width -- no duplicated sprites needed. See SPEC.md section 4.1.
 *
 * Layers are shorter than the viewport and anchored (sky to the top, the other two to the
 * bottom); the camera clear colour fills the remainder. `tilePositionX` is always floored so the
 * camera scroll can never land on a fractional pixel (GDD.md section 7).
 */
import type Phaser from 'phaser';

import { AssetKeys } from '../config/AssetKeys';
import { DEPTH, PARALLAX, VIEWPORT } from '../config/Tuning';

interface LayerSpec {
  readonly texture: string;
  readonly factor: number;
  readonly depth: number;
  readonly anchorBottom: boolean;
}

const LAYER_SPECS: readonly LayerSpec[] = [
  { texture: AssetKeys.BG_FAR_SKY, factor: PARALLAX.FAR_SKY_FACTOR, depth: DEPTH.BG_FAR, anchorBottom: false },
  { texture: AssetKeys.BG_MID_MOUNTAINS, factor: PARALLAX.MID_MOUNTAINS_FACTOR, depth: DEPTH.BG_MID, anchorBottom: true },
  {
    texture: AssetKeys.BG_NEAR_DATACENTER,
    factor: PARALLAX.NEAR_DATACENTER_FACTOR,
    depth: DEPTH.BG_NEAR,
    anchorBottom: true,
  },
];

class ParallaxLayer {
  private readonly sprite: Phaser.GameObjects.TileSprite;
  private readonly factor: number;

  constructor(scene: Phaser.Scene, spec: LayerSpec) {
    const height = scene.textures.get(spec.texture).getSourceImage().height;
    const y = spec.anchorBottom ? VIEWPORT.PLAY_Y + VIEWPORT.PLAY_HEIGHT - height : VIEWPORT.PLAY_Y;

    this.sprite = scene.add.tileSprite(0, y, VIEWPORT.LOGICAL_WIDTH, height, spec.texture);
    this.sprite.setOrigin(0, 0);
    this.sprite.setScrollFactor(0);
    this.sprite.setDepth(spec.depth);
    this.factor = spec.factor;
  }

  public update(cameraScrollX: number): void {
    this.sprite.tilePositionX = Math.floor(cameraScrollX * this.factor);
  }
}

export class ParallaxBackdrop {
  private readonly layers: readonly ParallaxLayer[];

  constructor(scene: Phaser.Scene) {
    this.layers = LAYER_SPECS.map((spec) => new ParallaxLayer(scene, spec));
  }

  public update(cameraScrollX: number): void {
    for (const layer of this.layers) {
      layer.update(cameraScrollX);
    }
  }
}
