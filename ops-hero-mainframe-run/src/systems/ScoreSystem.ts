/**
 * Pure scoring logic. No Phaser. See GAMEPLAY_SPEC.md section 8.
 *
 * Score only ever increases -- there is no code path that subtracts, so "monotonic and
 * never negative" holds by construction rather than needing a clamp.
 */
import { SCORING, WORLD } from '../config/Tuning';

export interface LevelCompleteBonus {
  readonly levelBonus: number;
  readonly timeBonus: number;
}

export class ScoreSystem {
  private total = 0;
  private stompChain = 0;

  public get score(): number {
    return this.total;
  }

  /** Current chain multiplier (0 while no airborne-stomp chain is active, up to the cap). */
  public get chainMultiplier(): number {
    return this.stompChain;
  }

  public collectToken(): number {
    return this.add(SCORING.TOKEN);
  }

  /** Call when the player touches the ground -- ends any in-progress stomp chain. */
  public registerLanding(): void {
    this.stompChain = 0;
  }

  /** Consecutive airborne stomps multiply 1x, 2x, ... up to MAX_STOMP_CHAIN_MULTIPLIER. */
  public registerStomp(): number {
    this.stompChain = Math.min(this.stompChain + 1, SCORING.MAX_STOMP_CHAIN_MULTIPLIER);
    return this.add(SCORING.STOMP_BASE * this.stompChain);
  }

  /** Flat value, independent of the stomp chain -- invincibility contact is not a jump-stomp. */
  public registerInvincibleDefeat(): number {
    return this.add(SCORING.INVINCIBLE_DEFEAT);
  }

  public completeJob(): number {
    return this.add(SCORING.JOB_COMPLETE);
  }

  /** @param elapsedMs Time since level start, used against the par for the time bonus. */
  public completeLevel(elapsedMs: number): LevelCompleteBonus {
    const remainingMs = Math.max(0, WORLD.PAR_TIME_MS - elapsedMs);
    const timeBonus = SCORING.TIME_BONUS_PER_SECOND * Math.ceil(remainingMs / 1000);
    const levelBonus = SCORING.LEVEL_COMPLETE;
    this.add(levelBonus + timeBonus);
    return { levelBonus, timeBonus };
  }

  private add(points: number): number {
    this.total += points;
    return points;
  }
}
