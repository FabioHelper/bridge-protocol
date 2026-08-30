/**
 * The declarative level blueprint. Authored as a sequence of segments laid down by a column
 * cursor (see `blueprintBuilder` below) rather than a hand-typed ASCII map, so the compiled
 * result is something `level.test.ts` can reason about instead of eyeballing a grid of
 * characters. No Phaser here. See GAMEPLAY_SPEC.md section 6 for the section plan this mirrors.
 *
 * Row convention: every placed object's `row` is the row index of the solid tile it stands ON
 * (feet at `row * TILE_SIZE`), except drones, whose `row` is the centre of their hover band.
 */
import { WORLD } from '../config/Tuning';

export type EnemyType = 'job-fail-bot' | 'alert-bot' | 'alert-drone' | 'spool-runaway';

export interface GroundSegment {
  readonly fromCol: number;
  readonly toCol: number;
  readonly row: number;
}

export interface PlatformSegment {
  readonly fromCol: number;
  readonly toCol: number;
  readonly row: number;
}

export interface BreakableSegment {
  readonly fromCol: number;
  readonly toCol: number;
  readonly row: number;
}

export interface PointFeature {
  readonly col: number;
  readonly row: number;
}

export interface JobTerminalBlueprint extends PointFeature {
  readonly id: number;
}

export interface EnemySpawnBlueprint {
  readonly type: EnemyType;
  readonly col: number;
  readonly row: number;
  readonly patrolFromCol: number;
  readonly patrolToCol: number;
}

export interface LevelBlueprint {
  readonly widthTiles: number;
  readonly heightTiles: number;
  readonly ground: readonly GroundSegment[];
  readonly platforms: readonly PlatformSegment[];
  readonly breakables: readonly BreakableSegment[];
  readonly tokens: readonly PointFeature[];
  readonly enemies: readonly EnemySpawnBlueprint[];
  readonly jobTerminals: readonly JobTerminalBlueprint[];
  readonly checkpoint: PointFeature;
  readonly exit: PointFeature;
  readonly invincibilityPickups: readonly PointFeature[];
  readonly playerStart: PointFeature;
}

/** Main floor row. Rows below this to the grid bottom are filled solid. */
const GROUND_ROW = 19;

/**
 * Sequential authoring helper: each call advances an internal column cursor, so segments are
 * defined by "how many tiles next" rather than by hand-computed absolute ranges. This is what
 * keeps a 300-tile blueprint free of off-by-one arithmetic errors.
 */
class BlueprintCursor {
  private col = 0;
  public readonly ground: GroundSegment[] = [];
  public readonly platforms: PlatformSegment[] = [];

  public get position(): number {
    return this.col;
  }

  /** Solid ground for `lengthTiles`, at `row`, filled to the grid bottom. */
  public groundRun(lengthTiles: number, row: number): this {
    this.ground.push({ fromCol: this.col, toCol: this.col + lengthTiles, row });
    this.col += lengthTiles;
    return this;
  }

  /** A chasm of `widthTiles`. If `bridgeRow` is given, a thin operations-layer bridge fills it. */
  public gap(widthTiles: number, bridgeRow?: number): this {
    if (bridgeRow !== undefined) {
      this.platforms.push({ fromCol: this.col, toCol: this.col + widthTiles, row: bridgeRow });
    }
    this.col += widthTiles;
    return this;
  }

  /** A decorative or reach-only platform above/around existing ground; never advances the cursor. */
  public platformAt(fromCol: number, toCol: number, row: number): this {
    this.platforms.push({ fromCol, toCol, row });
    return this;
  }
}

export function buildLevelBlueprint(): LevelBlueprint {
  const c = new BlueprintCursor();
  const tokens: PointFeature[] = [];
  const enemies: EnemySpawnBlueprint[] = [];
  const jobTerminals: JobTerminalBlueprint[] = [];
  const breakables: BreakableSegment[] = [];
  const invincibilityPickups: PointFeature[] = [];

  // --- Section A: Cold start (0-38) -- flat ground, one 2-tile gap, JOB-01 on a 3-tile ledge.
  c.groundRun(16, GROUND_ROW); // cols 0-15, player spawns here
  c.platformAt(9, 11, GROUND_ROW - 7); // decorative icon-block formation #1
  tokens.push({ col: 6, row: GROUND_ROW - 1 }, { col: 8, row: GROUND_ROW - 1 }, { col: 10, row: GROUND_ROW - 1 });
  c.gap(2); // cols 16-17
  c.groundRun(9, GROUND_ROW); // cols 18-26
  c.platformAt(20, 22, GROUND_ROW - 7); // decorative icon-block formation #2
  c.groundRun(3, GROUND_ROW - 3); // cols 27-29, JOB-01 ledge (step of 3)
  jobTerminals.push({ id: 1, col: 28, row: GROUND_ROW - 3 });
  c.groundRun(3, GROUND_ROW); // cols 30-32, step back down
  c.groundRun(6, GROUND_ROW); // cols 33-38

  // --- Section B: Tape library (39-95) -- stepped platforms, two JobFailBots, 3/4-tile gaps.
  c.groundRun(10, GROUND_ROW); // cols 39-48
  enemies.push({ type: 'job-fail-bot', col: 44, row: GROUND_ROW, patrolFromCol: 40, patrolToCol: 48 });
  c.gap(3); // cols 49-51
  c.groundRun(8, GROUND_ROW - 2); // cols 52-59
  tokens.push(
    { col: 54, row: GROUND_ROW - 5 },
    { col: 55, row: GROUND_ROW - 6 },
    { col: 56, row: GROUND_ROW - 7 },
    { col: 57, row: GROUND_ROW - 6 },
    { col: 58, row: GROUND_ROW - 5 },
  );
  c.gap(4); // cols 60-63, the widest allowed
  c.groundRun(16, GROUND_ROW); // cols 64-79
  enemies.push({ type: 'job-fail-bot', col: 70, row: GROUND_ROW, patrolFromCol: 64, patrolToCol: 79 });
  enemies.push({ type: 'alert-bot', col: 74, row: GROUND_ROW, patrolFromCol: 66, patrolToCol: 78 });
  jobTerminals.push({ id: 2, col: 76, row: GROUND_ROW });
  c.groundRun(3, GROUND_ROW - 2); // cols 80-82
  c.groundRun(3, GROUND_ROW); // cols 83-85
  c.groundRun(3, GROUND_ROW - 3); // cols 86-88
  c.groundRun(3, GROUND_ROW); // cols 89-91
  c.groundRun(4, GROUND_ROW); // cols 92-95

  // --- Section C: Cooling aisle (96-150) -- two AlertDrones, a bridged 4-tile gap, high ledge, checkpoint.
  c.groundRun(14, GROUND_ROW); // cols 96-109
  enemies.push({ type: 'alert-drone', col: 103, row: GROUND_ROW - 9, patrolFromCol: 98, patrolToCol: 108 });
  c.gap(4, GROUND_ROW); // cols 110-113, floating icon-block bridge
  tokens.push({ col: 110, row: GROUND_ROW - 2 }, { col: 112, row: GROUND_ROW - 2 });
  c.groundRun(14, GROUND_ROW); // cols 114-127
  enemies.push({ type: 'alert-drone', col: 120, row: GROUND_ROW - 9, patrolFromCol: 114, patrolToCol: 126 });
  c.groundRun(3, GROUND_ROW - 3); // cols 128-130
  c.groundRun(3, GROUND_ROW - 6); // cols 131-133, the high ledge
  invincibilityPickups.push({ col: 132, row: GROUND_ROW - 6 });
  c.groundRun(3, GROUND_ROW - 3); // cols 134-136
  c.groundRun(3, GROUND_ROW); // cols 137-139
  c.groundRun(11, GROUND_ROW); // cols 140-150
  const checkpoint: PointFeature = { col: 150, row: GROUND_ROW };

  // --- Section D: Spool hall (151-205) -- two SpoolRunaways, breakable ceiling. JOB-03.
  c.groundRun(20, GROUND_ROW); // cols 151-170
  breakables.push({ fromCol: 155, toCol: 169, row: GROUND_ROW - 4 });
  enemies.push({ type: 'spool-runaway', col: 158, row: GROUND_ROW, patrolFromCol: 152, patrolToCol: 169 });
  enemies.push({ type: 'spool-runaway', col: 166, row: GROUND_ROW, patrolFromCol: 152, patrolToCol: 169 });
  tokens.push(
    { col: 156, row: GROUND_ROW - 1 },
    { col: 162, row: GROUND_ROW - 1 },
    { col: 168, row: GROUND_ROW - 1 },
  );
  c.gap(2); // cols 171-172
  c.groundRun(33, GROUND_ROW); // cols 173-205
  jobTerminals.push({ id: 3, col: 200, row: GROUND_ROW });

  // --- Section E: Power floor (206-265) -- mixed enemies, tightest jumps, second pickup, JOB-04.
  c.groundRun(10, GROUND_ROW); // cols 206-215
  enemies.push({ type: 'job-fail-bot', col: 210, row: GROUND_ROW, patrolFromCol: 206, patrolToCol: 215 });
  tokens.push({ col: 208, row: GROUND_ROW - 1 }, { col: 212, row: GROUND_ROW - 1 });
  c.gap(4); // cols 216-219, tightest jump #1
  c.groundRun(3, GROUND_ROW - 2); // cols 220-222
  enemies.push({ type: 'alert-drone', col: 221, row: GROUND_ROW - 8, patrolFromCol: 220, patrolToCol: 225 });
  c.groundRun(3, GROUND_ROW); // cols 223-225
  c.gap(4); // cols 226-229, tightest jump #2
  c.groundRun(12, GROUND_ROW); // cols 230-241
  enemies.push({ type: 'alert-bot', col: 236, row: GROUND_ROW, patrolFromCol: 232, patrolToCol: 241 });
  c.groundRun(3, GROUND_ROW - 3); // cols 242-244, second invincibility ledge
  invincibilityPickups.push({ col: 243, row: GROUND_ROW - 3 });
  c.groundRun(3, GROUND_ROW); // cols 245-247
  c.groundRun(10, GROUND_ROW); // cols 248-257
  enemies.push({ type: 'spool-runaway', col: 250, row: GROUND_ROW, patrolFromCol: 248, patrolToCol: 257 });
  jobTerminals.push({ id: 4, col: 253, row: GROUND_ROW });
  c.gap(3); // cols 258-260
  c.groundRun(5, GROUND_ROW); // cols 261-265

  // --- Section F: Exit run (266-299) -- descending staircase, token payout row, exit terminal.
  c.groundRun(6, GROUND_ROW); // cols 266-271
  for (let col = 266; col <= 271; col += 1) {
    tokens.push({ col, row: GROUND_ROW - 1 });
  }
  c.groundRun(4, GROUND_ROW + 2); // cols 272-275
  c.groundRun(4, GROUND_ROW + 4); // cols 276-279
  c.groundRun(20, GROUND_ROW + 4); // cols 280-299
  const exit: PointFeature = { col: 292, row: GROUND_ROW + 4 };

  if (c.position !== WORLD.WIDTH_IN_TILES) {
    throw new Error(`level blueprint covers ${c.position} columns, expected ${WORLD.WIDTH_IN_TILES}`);
  }

  return {
    widthTiles: WORLD.WIDTH_IN_TILES,
    heightTiles: WORLD.HEIGHT_IN_TILES,
    ground: c.ground,
    platforms: c.platforms,
    breakables,
    tokens,
    enemies,
    jobTerminals,
    checkpoint,
    exit,
    invincibilityPickups,
    playerStart: { col: 2, row: GROUND_ROW },
  };
}

export const LEVEL_BLUEPRINT: LevelBlueprint = buildLevelBlueprint();
