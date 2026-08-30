/**
 * The playfield: tilemap, entities, colliders, camera, systems. Publishes a `RunState` snapshot
 * to the registry every frame for `HudScene` to read -- it never reaches into HudScene directly.
 * See SPEC.md section 5.2 and BUILD_BRIEF.md section 4.
 */
import Phaser from 'phaser';

import { AssetKeys } from '../config/AssetKeys';
import { REGISTRY_KEYS, SceneKeys } from '../config/GameConfig';
import { CAMERA, DEPTH, HUD, JUICE, TILE_SIZE, VIEWPORT } from '../config/Tuning';
import type { CompiledLevel } from '../level/LevelBuilder';
import { COMPILED_LEVEL } from '../level/LevelBuilder';
import { GAMEPLAY_COLLIDING_TILES } from '../level/TileIndex';
import { AlertDrone } from '../entities/enemies/AlertDrone';
import type { Enemy } from '../entities/enemies/Enemy';
import { InvincibilityEffects } from '../entities/InvincibilityEffects';
import { HighScoreStore } from '../systems/HighScoreStore';
import { StatusMessages } from '../systems/SystemStatus';
import { createInitialRunState, type RunState } from '../systems/RunState';
import { ParallaxBackdrop } from '../ui/Parallax';
import { LevelInteractions } from './LevelInteractions';
import { spawnLevel, type SpawnedLevel } from './LevelSpawner';

function narrowTilemapLayer(
  layer: Phaser.Tilemaps.TilemapLayer | Phaser.Tilemaps.TilemapGPULayer | null,
  name: string,
): Phaser.Tilemaps.TilemapLayer {
  if (!(layer instanceof Phaser.Tilemaps.TilemapLayer)) {
    throw new Error(`${name}: expected a TilemapLayer`);
  }
  return layer;
}

export class LevelScene extends Phaser.Scene {
  private world!: SpawnedLevel;
  private interactions!: LevelInteractions;
  private gameplayLayer!: Phaser.Tilemaps.TilemapLayer;
  private parallax!: ParallaxBackdrop;
  private invincibilityFx!: InvincibilityEffects;
  private highScoreStore!: HighScoreStore;
  private pauseKey!: Phaser.Input.Keyboard.Key;
  private escKey!: Phaser.Input.Keyboard.Key;
  private restartKey!: Phaser.Input.Keyboard.Key;
  private isPaused = false;
  private elapsedMs = 0;
  private lastLookaheadSign = 1;
  private ended = false;

  constructor() {
    super(SceneKeys.LEVEL);
  }

  public create(): void {
    const compiled = COMPILED_LEVEL;
    this.isPaused = false;
    this.elapsedMs = 0;
    this.ended = false;
    this.highScoreStore = new HighScoreStore(window.localStorage);

    this.parallax = new ParallaxBackdrop(this);
    const gameplayLayer = this.buildGameplayLayer(compiled);
    const operationsLayer = this.buildOperationsLayer(compiled);
    this.gameplayLayer = gameplayLayer;

    this.world = spawnLevel(this, compiled, gameplayLayer);
    this.interactions = new LevelInteractions(this, compiled.playerStart);
    this.invincibilityFx = new InvincibilityEffects(this, this.world.player);

    this.setupCamera(compiled);
    this.setupColliders(gameplayLayer, operationsLayer);
    this.setupOverlaps();
    this.setupKeys();

    this.world.player.on('landed', () => this.onPlayerLanded());
    this.world.player.on('jumped', () => this.onPlayerJumped());

    window.__OPS_HERO__ = { scene: SceneKeys.LEVEL, lives: this.interactions.lives, errors: [] };
  }

  private buildGameplayLayer(compiled: CompiledLevel): Phaser.Tilemaps.TilemapLayer {
    const data = compiled.gameplayGrid.map((row) => row.map((value) => value - 1));
    const tilemap = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = tilemap.addTilesetImage('gameplay-tiles', AssetKeys.GAMEPLAY_TILES, TILE_SIZE, TILE_SIZE);
    if (!tileset) throw new Error('gameplay tileset failed to load');
    const layer = narrowTilemapLayer(tilemap.createLayer(0, tileset, 0, 0), 'gameplay');
    layer.setCollision(GAMEPLAY_COLLIDING_TILES.map((value) => value - 1));
    layer.setDepth(DEPTH.TILEMAP);
    return layer;
  }

  private buildOperationsLayer(compiled: CompiledLevel): Phaser.Tilemaps.TilemapLayer {
    const data = compiled.operationsGrid.map((row) => row.map((value) => value - 1));
    const tilemap = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = tilemap.addTilesetImage('operations-tiles', AssetKeys.OPERATIONS_TILES, TILE_SIZE, TILE_SIZE);
    if (!tileset) throw new Error('operations tileset failed to load');
    const layer = narrowTilemapLayer(tilemap.createLayer(0, tileset, 0, 0), 'operations');
    layer.setCollisionByExclusion([-1]);
    layer.setDepth(DEPTH.TILEMAP);
    return layer;
  }

  private setupCamera(compiled: CompiledLevel): void {
    const camera = this.cameras.main;
    camera.setViewport(0, VIEWPORT.PLAY_Y, VIEWPORT.LOGICAL_WIDTH, VIEWPORT.PLAY_HEIGHT);
    camera.setBounds(0, 0, compiled.worldWidthPx, compiled.worldHeightPx);
    camera.setRoundPixels(true);
    camera.startFollow(this.world.player, true, CAMERA.LERP_X, CAMERA.LERP_Y);
    camera.setDeadzone(CAMERA.DEADZONE_WIDTH, CAMERA.DEADZONE_HEIGHT);
  }

  private setupColliders(gameplayLayer: Phaser.Tilemaps.TilemapLayer, operationsLayer: Phaser.Tilemaps.TilemapLayer): void {
    this.physics.add.collider(this.world.player, gameplayLayer);
    this.physics.add.collider(this.world.player, operationsLayer);
    for (const enemy of this.world.enemies) {
      enemy.on('alerted', () => this.interactions.raiseAlert());
      if (enemy instanceof AlertDrone) {
        continue; // airborne, ignores tiles entirely
      }
      this.physics.add.collider(enemy, gameplayLayer);
      this.physics.add.collider(enemy, operationsLayer);
    }
  }

  private setupOverlaps(): void {
    const player = this.world.player;
    for (const token of this.world.tokens) {
      this.physics.add.overlap(player, token, () => this.interactions.collectToken(token));
    }
    for (const pickup of this.world.pickups) {
      this.physics.add.overlap(player, pickup, () => this.interactions.collectPickup(pickup));
    }
    for (const enemy of this.world.enemies) {
      this.physics.add.overlap(player, enemy, () => this.onEnemyContact(enemy));
    }
    for (const marker of this.world.jobMarkers) {
      this.physics.add.overlap(player, marker, () => this.interactions.onJobTerminal(marker));
    }
    this.physics.add.overlap(player, this.world.checkpointMarker, () =>
      this.interactions.onCheckpoint(this.world.checkpointMarker),
    );
    this.physics.add.overlap(player, this.world.exitMarker, () => {
      if (this.interactions.onExit(this.world.exitMarker)) {
        this.endLevel('complete');
      }
    });
  }

  private setupKeys(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('keyboard plugin unavailable');
    const codes = Phaser.Input.Keyboard.KeyCodes;
    this.pauseKey = keyboard.addKey(codes.P);
    this.escKey = keyboard.addKey(codes.ESC);
    this.restartKey = keyboard.addKey(codes.R);
  }

  private onEnemyContact(enemy: Enemy): void {
    const outcome = this.interactions.handleEnemyContact(this.world.player, enemy);
    if (outcome === 'stomp' || outcome === 'invincible-defeat') {
      this.hitstop(JUICE.STOMP_FREEZE_MS);
    } else if (outcome === 'damage') {
      this.hitstop(JUICE.DAMAGE_FREEZE_MS);
      const gameOver = this.interactions.damagePlayer();
      if (gameOver) {
        this.endLevel('out-of-lives');
        return;
      }
      const respawn = this.interactions.respawnPoint;
      this.world.player.respawnAt(respawn.x, respawn.y);
    }
  }

  private hitstop(durationMs: number): void {
    this.physics.world.pause();
    this.time.delayedCall(durationMs, () => this.physics.world.resume());
  }

  private onPlayerJumped(): void {
    this.tweens.add({
      targets: this.world.player,
      scaleY: JUICE.JUMP_SQUASH_SCALE_Y,
      duration: JUICE.JUMP_SQUASH_DURATION_MS,
      yoyo: true,
    });
  }

  private onPlayerLanded(): void {
    this.interactions.score.registerLanding();
    this.tweens.add({
      targets: this.world.player,
      scaleY: JUICE.LAND_STRETCH_SCALE_Y,
      duration: JUICE.LAND_STRETCH_DURATION_MS,
      yoyo: true,
    });
  }

  private endLevel(reason: 'complete' | 'out-of-lives'): void {
    if (this.ended) return;
    this.ended = true;
    const bonus =
      reason === 'complete' ? this.interactions.score.completeLevel(this.elapsedMs) : { levelBonus: 0, timeBonus: 0 };
    const finalScore = this.interactions.score.score;
    const highScore = this.highScoreStore.commit(finalScore);
    this.scene.stop(SceneKeys.HUD);
    this.scene.start(SceneKeys.GAME_OVER, {
      reason,
      score: finalScore,
      highScore,
      jobsComplete: this.interactions.mission.jobsComplete,
      totalJobs: this.interactions.mission.totalJobs,
      alerts: this.interactions.alerts,
      tokens: this.interactions.tokens,
      levelBonus: bonus.levelBonus,
      timeBonus: bonus.timeBonus,
    });
  }

  public override update(_time: number, deltaMs: number): void {
    if (this.checkPauseAndRestart()) {
      this.publishRunState();
      return;
    }
    if (this.ended) return;

    this.elapsedMs += deltaMs;
    this.world.player.update(deltaMs);
    for (const enemy of this.world.enemies) {
      enemy.update(deltaMs, this.world.player.x, this.world.player.y);
    }
    this.interactions.update(deltaMs);
    this.invincibilityFx.update(deltaMs, this.interactions.invincibility);
    this.parallax.update(this.cameras.main.scrollX);
    this.updateCameraLookahead();
    this.checkBreakableBump();
    this.checkKillPlane(COMPILED_LEVEL);
    this.publishRunState();
  }

  private checkPauseAndRestart(): boolean {
    if (Phaser.Input.Keyboard.JustDown(this.restartKey)) {
      this.scene.restart();
      return true;
    }
    if (Phaser.Input.Keyboard.JustDown(this.pauseKey) || Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.isPaused = !this.isPaused;
      if (this.isPaused) {
        this.physics.world.pause();
      } else {
        this.physics.world.resume();
      }
    }
    return this.isPaused;
  }

  private updateCameraLookahead(): void {
    const sign = this.world.player.flipX ? -1 : 1;
    if (sign === this.lastLookaheadSign) return;
    this.lastLookaheadSign = sign;
    this.tweens.add({
      targets: this.cameras.main.followOffset,
      x: sign * JUICE.CAMERA_LOOKAHEAD_PX,
      duration: JUICE.CAMERA_LOOKAHEAD_EASE_MS,
      ease: 'Sine.easeOut',
    });
  }

  private checkBreakableBump(): void {
    const body = this.world.player.body as Phaser.Physics.Arcade.Body;
    if (!body.blocked.up || body.velocity.y >= 0) return;
    const tile = this.gameplayLayer.getTileAtWorldXY(body.center.x, body.top - 1);
    // GameplayTile.BREAKABLE (8) minus the Phaser empty-tile offset of 1.
    if (tile && tile.index === 7) {
      this.gameplayLayer.removeTileAt(tile.x, tile.y);
    }
  }

  private checkKillPlane(compiled: CompiledLevel): void {
    if (this.world.player.y <= compiled.killPlaneY) return;
    const gameOver = this.interactions.damagePlayer();
    if (gameOver) {
      this.endLevel('out-of-lives');
      return;
    }
    const respawn = this.interactions.respawnPoint;
    this.world.player.respawnAt(respawn.x, respawn.y);
  }

  private publishRunState(): void {
    const state = this.buildRunState();
    this.registry.set(REGISTRY_KEYS.RUN_STATE, state);
    window.__OPS_HERO__ = {
      scene: SceneKeys.LEVEL,
      lives: this.interactions.lives,
      errors: [],
      playerX: this.world.player.x,
      playerY: this.world.player.y,
    };
  }

  private buildRunState(): RunState {
    const compiled = COMPILED_LEVEL;
    const base = createInitialRunState(this.highScoreStore.read());
    const activePfKey = (Math.floor(this.elapsedMs / 500) % HUD.PF_KEY_COUNT) + 1;
    return {
      ...base,
      lives: this.interactions.lives,
      score: this.interactions.score.score,
      jobsComplete: this.interactions.mission.jobsComplete,
      totalJobs: this.interactions.mission.totalJobs,
      jobPips: this.interactions.mission.jobPips,
      alerts: this.interactions.alerts,
      tokens: this.interactions.tokens,
      chainMultiplier: this.interactions.score.chainMultiplier,
      activePfKey,
      statusMessage: this.isPaused ? StatusMessages.PAUSED : this.interactions.status.current,
      missionText: this.interactions.mission.missionText,
      objectiveText: this.interactions.mission.objectiveText,
      powerFraction: this.interactions.invincibility.meterFraction,
      invincibilityActive: this.interactions.invincibility.isActive,
      playerProgress01: Math.max(0, Math.min(1, this.world.player.x / compiled.worldWidthPx)),
      checkpointProgress01: compiled.checkpoint.x / compiled.worldWidthPx,
      checkpointReached: this.interactions.checkpointReached,
      minimapEnemies: this.world.enemies
        .filter((enemy) => !enemy.isDefeated)
        .map((enemy) => ({ x01: enemy.x / compiled.worldWidthPx, y01: 0.5 })),
      viewdataLines: this.interactions.viewdataLog,
      paused: this.isPaused,
      elapsedMs: this.elapsedMs,
    };
  }
}
