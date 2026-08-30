/**
 * Game-rule reactions to overlaps and events: scoring, mission progress, damage/respawn,
 * alerts and the small viewdata log. `LevelScene` owns Phaser wiring (colliders, camera,
 * tilemap); this class owns what happens once an overlap fires.
 */
import type Phaser from 'phaser';

import { ENEMY, JUICE, PLAYER } from '../config/Tuning';
import { Palette } from '../config/Palette';
import type { Enemy } from '../entities/enemies/Enemy';
import type { CommandToken, InvincibilityPickup } from '../entities/Collectibles';
import type { ObjectiveMarker } from '../entities/ObjectiveMarkers';
import type { Player } from '../entities/Player';
import { InvincibilitySystem } from '../systems/InvincibilitySystem';
import { MissionSystem } from '../systems/MissionSystem';
import { ScoreSystem } from '../systems/ScoreSystem';
import { StatusMessages, SystemStatusController, jobCompleteMessage } from '../systems/SystemStatus';
import { createPixelText } from '../ui/PixelText';
import { GameEvents } from './GameEvents';

export type ContactOutcome = 'stomp' | 'invincible-defeat' | 'damage' | 'ignored';

const EXIT_SHAKE_COOLDOWN_MS = 600;
const VIEWDATA_MAX_LINES = 4;

export class LevelInteractions {
  public readonly score = new ScoreSystem();
  public readonly mission = new MissionSystem();
  public readonly invincibility = new InvincibilitySystem();
  public readonly status = new SystemStatusController();

  public lives = PLAYER.START_LIVES;
  public alerts = 0;
  public tokens = 0;
  public checkpointReached = false;
  public respawnPoint: { x: number; y: number };
  private readonly viewdataLines: string[] = [];
  private exitShakeCooldownMs = 0;

  constructor(private readonly scene: Phaser.Scene, playerStart: { x: number; y: number }) {
    this.respawnPoint = playerStart;
  }

  public get viewdataLog(): readonly string[] {
    return this.viewdataLines;
  }

  public update(deltaMs: number): void {
    this.invincibility.update(deltaMs);
    this.status.update(deltaMs);
    this.exitShakeCooldownMs = Math.max(0, this.exitShakeCooldownMs - deltaMs);
  }

  public collectToken(token: CommandToken): void {
    token.collect(() => undefined);
    this.tokens += 1;
    this.score.collectToken();
  }

  public collectPickup(pickup: InvincibilityPickup): void {
    pickup.collect(() => undefined);
    const wasActive = this.invincibility.isActive;
    this.invincibility.activate();
    this.status.show(StatusMessages.POWER_SURGE_ACTIVE);
    this.pushViewdataLine(wasActive ? '> POWER SURGE REFRESHED' : '> POWER SURGE ACTIVE');
  }

  public handleEnemyContact(player: Player, enemy: Enemy): ContactOutcome {
    if (enemy.isDefeated) {
      return 'ignored';
    }
    if (this.invincibility.isActive) {
      this.defeatByInvincibility(enemy);
      return 'invincible-defeat';
    }
    const body = player.body as Phaser.Physics.Arcade.Body;
    const enemyBody = enemy.body as Phaser.Physics.Arcade.Body;
    const isStomp = body.velocity.y > 0 && body.bottom <= enemyBody.top + ENEMY.STOMP_TOLERANCE_PX;
    if (isStomp) {
      this.defeatByStomp(player, enemy);
      return 'stomp';
    }
    if (player.isHitInvulnerable) {
      return 'ignored';
    }
    return 'damage';
  }

  private defeatByStomp(player: Player, enemy: Enemy): void {
    const points = this.score.registerStomp();
    this.spawnChainPopup(enemy.x, enemy.y - 24, `+${points} x${this.score.chainMultiplier}`);
    this.squashAndDefeat(enemy);
    player.bounce();
  }

  private defeatByInvincibility(enemy: Enemy): void {
    this.score.registerInvincibleDefeat();
    this.squashAndDefeat(enemy);
  }

  private squashAndDefeat(enemy: Enemy): void {
    this.scene.tweens.add({
      targets: enemy,
      scaleY: JUICE.STOMP_SQUASH_SCALE_Y,
      duration: JUICE.STOMP_SQUASH_DURATION_MS,
      yoyo: true,
      onComplete: () => enemy.defeat(),
    });
  }

  private spawnChainPopup(x: number, y: number, text: string): void {
    const label = createPixelText(this.scene, x, y, text, Palette.ACCENT_GOLD);
    label.setOrigin(0.5, 1);
    this.scene.tweens.add({
      targets: label,
      y: y - JUICE.CHAIN_POPUP_RISE_PX,
      alpha: 0,
      duration: JUICE.CHAIN_POPUP_DURATION_MS,
      onComplete: () => label.destroy(),
    });
  }

  public raiseAlert(): void {
    this.alerts += 1;
    this.status.show(StatusMessages.ALERT_RAISED);
  }

  /** @returns true when this was a life-ending loss (caller should end the level). */
  public damagePlayer(): boolean {
    this.alerts += 1;
    this.lives -= 1;
    this.status.show(StatusMessages.LIFE_LOST);
    this.scene.game.events.emit(GameEvents.DAMAGE);
    return this.lives <= 0;
  }

  public onJobTerminal(marker: ObjectiveMarker): void {
    if (marker.jobId === null || !this.mission.complete(marker.jobId)) {
      return;
    }
    this.score.completeJob();
    this.status.show(jobCompleteMessage(marker.jobId));
    marker.flashLit();
    this.pushViewdataLine(`> JOB${marker.jobId.toString().padStart(2, '0')} COMPLETE`);
    this.scene.game.events.emit(GameEvents.JOB_COMPLETE, marker.jobId);
  }

  public onCheckpoint(marker: ObjectiveMarker): void {
    if (this.checkpointReached) {
      return;
    }
    this.checkpointReached = true;
    this.respawnPoint = { x: marker.x, y: marker.y };
    this.status.show(StatusMessages.CHECKPOINT_SAVED);
    marker.flashLit();
    this.pushViewdataLine('> CHECKPOINT SAVED');
  }

  /** @returns true when the exit is unlocked and the level should end. */
  public onExit(marker: ObjectiveMarker): boolean {
    if (this.mission.isExitUnlocked) {
      return true;
    }
    if (this.exitShakeCooldownMs <= 0) {
      this.exitShakeCooldownMs = EXIT_SHAKE_COOLDOWN_MS;
      this.status.show(StatusMessages.JOBS_INCOMPLETE);
      marker.shake();
    }
    return false;
  }

  private pushViewdataLine(line: string): void {
    this.viewdataLines.push(line);
    if (this.viewdataLines.length > VIEWDATA_MAX_LINES) {
      this.viewdataLines.shift();
    }
  }
}
