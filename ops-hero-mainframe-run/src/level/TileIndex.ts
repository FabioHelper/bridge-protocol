/**
 * Tile index maps for the two tilemap layers, mirrored verbatim from GAMEPLAY_SPEC.md section 6.
 * Value 0 is always "empty" on both layers (Phaser reserves tile index 0 for "nothing here").
 * No Phaser here -- these are plain numeric constants used by LevelBuilder and the tile-array
 * output it produces.
 */

/** `gameplay-tiles.png` -- 9 frames, ground/structure tiles plus objective markers. */
export const GameplayTile = {
  EMPTY: 0,
  TERMINAL_COMMAND: 1,
  STONE_LEFT: 2,
  STONE_CENTER: 3,
  STONE_RIGHT: 4,
  STONE_UNDER: 5,
  DARK_INACTIVE: 6,
  WARNING: 7,
  BREAKABLE: 8,
  EXIT_TERMINAL: 9,
} as const;

/** Tiles that stop the player -- everything except empty and the two non-collide markers. */
export const GAMEPLAY_COLLIDING_TILES: readonly number[] = [
  GameplayTile.STONE_LEFT,
  GameplayTile.STONE_CENTER,
  GameplayTile.STONE_RIGHT,
  GameplayTile.STONE_UNDER,
  GameplayTile.DARK_INACTIVE,
  GameplayTile.WARNING,
  GameplayTile.BREAKABLE,
];

/**
 * `operations-tiles.png` -- 12 independent icon-block frames used as platforms. The reference
 * shows them as generic metallic operational blocks; the game does not need to distinguish which
 * of the 12 a given tile is beyond "which frame to draw", so LevelBuilder just cycles through
 * them for visual variety. All 12 collide -- they exist to be stood on.
 */
export const OPERATIONS_TILE_EMPTY = 0;
export const OPERATIONS_TILE_FRAME_COUNT = 12;
