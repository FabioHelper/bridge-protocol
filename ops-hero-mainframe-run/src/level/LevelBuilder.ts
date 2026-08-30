/**
 * Compiles the declarative `LevelBlueprint` into a tile grid pair plus pixel-space spawn lists.
 * No Phaser here -- `LevelScene` (in `src/scenes/`) is the only place this output touches a
 * tilemap. See GAMEPLAY_SPEC.md section 6.
 */
import { TILE_SIZE, WORLD } from '../config/Tuning';
import type { EnemyType, LevelBlueprint } from './LevelData';
import { LEVEL_BLUEPRINT } from './LevelData';
import { GameplayTile, OPERATIONS_TILE_FRAME_COUNT } from './TileIndex';

export interface PixelPoint {
  readonly x: number;
  readonly y: number;
}

export interface CompiledEnemySpawn extends PixelPoint {
  readonly type: EnemyType;
  readonly patrolMinX: number;
  readonly patrolMaxX: number;
}

export interface CompiledJobTerminal extends PixelPoint {
  readonly id: number;
}

export interface CompiledLevel {
  readonly widthTiles: number;
  readonly heightTiles: number;
  /** [row][col] -- values are `GameplayTile` indices. */
  readonly gameplayGrid: number[][];
  /** [row][col] -- 0 = empty, 1..12 = icon-block frame. */
  readonly operationsGrid: number[][];
  /** Per-column row of the walkable surface (ground or bridge), or null where there is none. */
  readonly groundProfile: readonly (number | null)[];
  readonly playerStart: PixelPoint;
  readonly tokens: readonly PixelPoint[];
  readonly enemies: readonly CompiledEnemySpawn[];
  readonly jobTerminals: readonly CompiledJobTerminal[];
  readonly checkpoint: PixelPoint;
  readonly exit: PixelPoint;
  readonly invincibilityPickups: readonly PixelPoint[];
  readonly worldWidthPx: number;
  readonly worldHeightPx: number;
  readonly killPlaneY: number;
}

function toPixel(col: number, row: number): PixelPoint {
  return { x: col * TILE_SIZE + TILE_SIZE / 2, y: row * TILE_SIZE };
}

function surfaceTileFor(isLeftEdge: boolean, isRightEdge: boolean): number {
  if (isLeftEdge && !isRightEdge) return GameplayTile.STONE_LEFT;
  if (isRightEdge && !isLeftEdge) return GameplayTile.STONE_RIGHT;
  return GameplayTile.STONE_CENTER;
}

function paintGameplayGrid(blueprint: LevelBlueprint, grid: number[][]): void {
  for (const segment of blueprint.ground) {
    for (let col = segment.fromCol; col < segment.toCol; col += 1) {
      const isLeftEdge = col === segment.fromCol;
      const isRightEdge = col === segment.toCol - 1;
      const topRow = grid[segment.row];
      if (topRow) {
        topRow[col] = surfaceTileFor(isLeftEdge, isRightEdge);
      }
      for (let row = segment.row + 1; row < blueprint.heightTiles; row += 1) {
        const belowRow = grid[row];
        if (belowRow) {
          belowRow[col] = GameplayTile.STONE_CENTER;
        }
      }
    }
  }
  for (const breakable of blueprint.breakables) {
    const row = grid[breakable.row];
    if (!row) continue;
    for (let col = breakable.fromCol; col < breakable.toCol; col += 1) {
      row[col] = GameplayTile.BREAKABLE;
    }
  }
}

function paintOperationsGrid(blueprint: LevelBlueprint, grid: number[][]): void {
  for (const platform of blueprint.platforms) {
    const row = grid[platform.row];
    if (!row) continue;
    for (let col = platform.fromCol; col < platform.toCol; col += 1) {
      // Deterministic frame cycling purely for visual variety -- these 12 icon blocks carry no
      // gameplay distinction beyond "collidable platform".
      row[col] = 1 + ((col + platform.row) % OPERATIONS_TILE_FRAME_COUNT);
    }
  }
}

function buildGroundProfile(blueprint: LevelBlueprint): (number | null)[] {
  const profile: (number | null)[] = new Array<number | null>(blueprint.widthTiles).fill(null);
  for (const segment of blueprint.ground) {
    for (let col = segment.fromCol; col < segment.toCol; col += 1) {
      profile[col] = segment.row;
    }
  }
  for (const platform of blueprint.platforms) {
    for (let col = platform.fromCol; col < platform.toCol; col += 1) {
      if (profile[col] === null && col >= 0 && col < profile.length) {
        profile[col] = platform.row;
      }
    }
  }
  return profile;
}

export function compileLevel(blueprint: LevelBlueprint = LEVEL_BLUEPRINT): CompiledLevel {
  const gameplayGrid: number[][] = Array.from({ length: blueprint.heightTiles }, () =>
    new Array<number>(blueprint.widthTiles).fill(GameplayTile.EMPTY),
  );
  const operationsGrid: number[][] = Array.from({ length: blueprint.heightTiles }, () =>
    new Array<number>(blueprint.widthTiles).fill(0),
  );

  paintGameplayGrid(blueprint, gameplayGrid);
  paintOperationsGrid(blueprint, operationsGrid);
  const groundProfile = buildGroundProfile(blueprint);

  const worldWidthPx = blueprint.widthTiles * TILE_SIZE;
  const worldHeightPx = blueprint.heightTiles * TILE_SIZE;

  const enemies: CompiledEnemySpawn[] = blueprint.enemies.map((spawn) => ({
    ...toPixel(spawn.col, spawn.row),
    type: spawn.type,
    patrolMinX: spawn.patrolFromCol * TILE_SIZE,
    patrolMaxX: spawn.patrolToCol * TILE_SIZE + TILE_SIZE,
  }));

  return {
    widthTiles: blueprint.widthTiles,
    heightTiles: blueprint.heightTiles,
    gameplayGrid,
    operationsGrid,
    groundProfile,
    playerStart: toPixel(blueprint.playerStart.col, blueprint.playerStart.row),
    tokens: blueprint.tokens.map((t) => toPixel(t.col, t.row)),
    enemies,
    jobTerminals: blueprint.jobTerminals.map((j) => ({ id: j.id, ...toPixel(j.col, j.row) })),
    checkpoint: toPixel(blueprint.checkpoint.col, blueprint.checkpoint.row),
    exit: toPixel(blueprint.exit.col, blueprint.exit.row),
    invincibilityPickups: blueprint.invincibilityPickups.map((p) => toPixel(p.col, p.row)),
    worldWidthPx,
    worldHeightPx,
    killPlaneY: worldHeightPx + WORLD.KILL_PLANE_MARGIN_PX,
  };
}

export const COMPILED_LEVEL: CompiledLevel = compileLevel();
