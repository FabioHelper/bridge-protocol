/**
 * Turns a `CompiledLevel` into live Phaser game objects. Pure construction only -- no update
 * logic, no scoring, no collider wiring. `LevelScene` owns what happens after spawn.
 */
import type Phaser from 'phaser';

import { AssetKeys } from '../config/AssetKeys';
import type { CompiledEnemySpawn, CompiledLevel } from '../level/LevelBuilder';
import { Player } from '../entities/Player';
import { AlertBot } from '../entities/enemies/AlertBot';
import { AlertDrone } from '../entities/enemies/AlertDrone';
import type { Enemy } from '../entities/enemies/Enemy';
import { JobFailBot } from '../entities/enemies/JobFailBot';
import { SpoolRunaway } from '../entities/enemies/SpoolRunaway';
import { CommandToken, InvincibilityPickup } from '../entities/Collectibles';
import { ObjectiveMarker } from '../entities/ObjectiveMarkers';

export interface SpawnedLevel {
  readonly player: Player;
  readonly enemies: Enemy[];
  readonly tokens: CommandToken[];
  readonly pickups: InvincibilityPickup[];
  readonly jobMarkers: ObjectiveMarker[];
  readonly checkpointMarker: ObjectiveMarker;
  readonly exitMarker: ObjectiveMarker;
}

function spawnEnemy(
  scene: Phaser.Scene,
  spawn: CompiledEnemySpawn,
  gameplayLayer: Phaser.Tilemaps.TilemapLayer,
): Enemy {
  switch (spawn.type) {
    case 'job-fail-bot':
      return new JobFailBot(scene, spawn.x, spawn.y, spawn.patrolMinX, spawn.patrolMaxX, gameplayLayer);
    case 'alert-bot':
      return new AlertBot(scene, spawn.x, spawn.y, spawn.patrolMinX, spawn.patrolMaxX, gameplayLayer);
    case 'spool-runaway':
      return new SpoolRunaway(scene, spawn.x, spawn.y, spawn.patrolMinX, spawn.patrolMaxX, gameplayLayer);
    case 'alert-drone':
      return new AlertDrone(scene, spawn.x, spawn.y, spawn.patrolMinX, spawn.patrolMaxX);
  }
}

export function spawnLevel(
  scene: Phaser.Scene,
  compiled: CompiledLevel,
  gameplayLayer: Phaser.Tilemaps.TilemapLayer,
): SpawnedLevel {
  const player = new Player(scene, compiled.playerStart.x, compiled.playerStart.y);

  const enemies = compiled.enemies.map((spawn) => spawnEnemy(scene, spawn, gameplayLayer));

  const tokens = compiled.tokens.map((point) => new CommandToken(scene, point.x, point.y));

  const pickups = compiled.invincibilityPickups.map(
    (point) => new InvincibilityPickup(scene, point.x, point.y),
  );

  const jobMarkers = compiled.jobTerminals.map(
    (job) => new ObjectiveMarker(scene, job.x, job.y, AssetKeys.ENV_TERMINAL_MONITOR, 'job', job.id),
  );

  const checkpointMarker = new ObjectiveMarker(
    scene,
    compiled.checkpoint.x,
    compiled.checkpoint.y,
    AssetKeys.ENV_WARNING_BEACON_TALL,
    'checkpoint',
  );

  const exitMarker = new ObjectiveMarker(
    scene,
    compiled.exit.x,
    compiled.exit.y,
    AssetKeys.ENV_TERMINAL_MONITOR,
    'exit',
  );

  return { player, enemies, tokens, pickups, jobMarkers, checkpointMarker, exitMarker };
}
