import { describe, expect, it } from 'vitest';

import { LEVEL_BLUEPRINT } from '../../src/level/LevelData';
import { compileLevel } from '../../src/level/LevelBuilder';
import { GAMEPLAY_COLLIDING_TILES, GameplayTile } from '../../src/level/TileIndex';
import { REACHABILITY, TILE_SIZE, WORLD } from '../../src/config/Tuning';

const compiled = compileLevel(LEVEL_BLUEPRINT);

function isColliding(tileValue: number): boolean {
  return GAMEPLAY_COLLIDING_TILES.includes(tileValue);
}

describe('level grid shape', () => {
  it('is exactly 300 x 24 tiles', () => {
    expect(compiled.widthTiles).toBe(WORLD.WIDTH_IN_TILES);
    expect(compiled.heightTiles).toBe(WORLD.HEIGHT_IN_TILES);
    expect(compiled.gameplayGrid).toHaveLength(WORLD.HEIGHT_IN_TILES);
    expect(compiled.operationsGrid).toHaveLength(WORLD.HEIGHT_IN_TILES);
    for (const row of compiled.gameplayGrid) {
      expect(row).toHaveLength(WORLD.WIDTH_IN_TILES);
    }
    expect(compiled.groundProfile).toHaveLength(WORLD.WIDTH_IN_TILES);
  });

  it('places the kill plane below the grid bottom by the configured margin', () => {
    expect(compiled.killPlaneY).toBe(compiled.worldHeightPx + WORLD.KILL_PLANE_MARGIN_PX);
  });
});

describe('level reachability', () => {
  it('never has a gap wider than REACHABILITY.MAX_GAP_TILES', () => {
    let runLength = 0;
    let maxRun = 0;
    for (const cell of compiled.groundProfile) {
      if (cell === null) {
        runLength += 1;
        maxRun = Math.max(maxRun, runLength);
      } else {
        runLength = 0;
      }
    }
    expect(maxRun).toBeLessThanOrEqual(REACHABILITY.MAX_GAP_TILES);
  });

  it('never has a step between adjacent walkable columns higher than REACHABILITY.MAX_STEP_TILES', () => {
    const profile = compiled.groundProfile;
    for (let col = 0; col < profile.length - 1; col += 1) {
      const here = profile[col];
      const next = profile[col + 1];
      if (here === null || here === undefined || next === null || next === undefined) continue;
      expect(Math.abs(here - next)).toBeLessThanOrEqual(REACHABILITY.MAX_STEP_TILES);
    }
  });

  it('has at least one walkable column (the level is not entirely a chasm)', () => {
    expect(compiled.groundProfile.some((cell) => cell !== null)).toBe(true);
  });
});

describe('objective placement', () => {
  it('stands every job terminal directly on solid ground', () => {
    for (const job of LEVEL_BLUEPRINT.jobTerminals) {
      expect(compiled.groundProfile[job.col]).toBe(job.row);
    }
  });

  it('stands the checkpoint directly on solid ground', () => {
    expect(compiled.groundProfile[LEVEL_BLUEPRINT.checkpoint.col]).toBe(LEVEL_BLUEPRINT.checkpoint.row);
  });

  it('places the checkpoint at tile 150 per GAMEPLAY_SPEC', () => {
    expect(LEVEL_BLUEPRINT.checkpoint.col).toBe(150);
  });

  it('stands the exit directly on solid ground, at tile 292', () => {
    expect(LEVEL_BLUEPRINT.exit.col).toBe(292);
    expect(compiled.groundProfile[LEVEL_BLUEPRINT.exit.col]).toBe(LEVEL_BLUEPRINT.exit.row);
  });

  it('defines exactly MISSION.TOTAL_JOBS-worth of job terminals with unique ids', () => {
    const ids = LEVEL_BLUEPRINT.jobTerminals.map((j) => j.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(4);
  });
});

describe('enemy placement', () => {
  it('never spawns an enemy inside a solid tile', () => {
    for (const enemy of LEVEL_BLUEPRINT.enemies) {
      const bodyRow = compiled.gameplayGrid[enemy.row - 1];
      const bodyTile = bodyRow ? bodyRow[enemy.col] : undefined;
      expect(bodyTile === undefined || !isColliding(bodyTile)).toBe(true);
    }
  });

  it('stands every ground enemy (non-drone) on a colliding tile', () => {
    for (const enemy of LEVEL_BLUEPRINT.enemies) {
      if (enemy.type === 'alert-drone') continue;
      const standRow = compiled.gameplayGrid[enemy.row];
      const standTile = standRow ? standRow[enemy.col] : undefined;
      expect(standTile !== undefined && isColliding(standTile)).toBe(true);
    }
  });
});

describe('tile painting', () => {
  it('marks every filled gameplay cell with a colliding tile type', () => {
    for (const row of compiled.gameplayGrid) {
      for (const tile of row) {
        if (tile === GameplayTile.EMPTY) continue;
        expect(isColliding(tile)).toBe(true);
      }
    }
  });

  it('keeps every operations tile within the contracted 1..12 frame range', () => {
    for (const row of compiled.operationsGrid) {
      for (const tile of row) {
        expect(tile).toBeGreaterThanOrEqual(0);
        expect(tile).toBeLessThanOrEqual(12);
      }
    }
  });
});

describe('pixel conversion', () => {
  it('converts tile coordinates to pixels using TILE_SIZE', () => {
    expect(compiled.worldWidthPx).toBe(WORLD.WIDTH_IN_TILES * TILE_SIZE);
    expect(compiled.worldHeightPx).toBe(WORLD.HEIGHT_IN_TILES * TILE_SIZE);
    expect(compiled.playerStart.x).toBe(LEVEL_BLUEPRINT.playerStart.col * TILE_SIZE + TILE_SIZE / 2);
  });
});
