/**
 * Golden-aura invincibility timing and tint-cycle state. Pure, no Phaser.
 * See GAMEPLAY_SPEC.md section 10 and BUILD_BRIEF.md section 8.
 *
 * Deliberately does NOT touch the player's collision body -- nothing in this file, or anything
 * that reads it, may resize or reposition a physics body. That rule is enforced by convention
 * here and by the "body never changes" contract tested against the Player entity.
 */
import { INVINCIBILITY } from '../config/Tuning';
import { INVINCIBILITY_TINTS } from '../config/Palette';

export class InvincibilitySystem {
  private elapsedMs = 0;
  private active = false;

  /** Activating while already active REFRESHES to a full duration; it never stacks. */
  public activate(): void {
    this.active = true;
    this.elapsedMs = 0;
  }

  public update(deltaMs: number): void {
    if (!this.active) {
      return;
    }
    this.elapsedMs += deltaMs;
    if (this.elapsedMs >= INVINCIBILITY.DURATION_MS) {
      this.active = false;
      this.elapsedMs = INVINCIBILITY.DURATION_MS;
    }
  }

  public get isActive(): boolean {
    return this.active;
  }

  public get remainingMs(): number {
    return this.active ? INVINCIBILITY.DURATION_MS - this.elapsedMs : 0;
  }

  /** 1 at activation, 0 once expired -- what the power meter fills to. */
  public get meterFraction(): number {
    if (!this.active) {
      return 0;
    }
    return Math.max(0, Math.min(1, this.remainingMs / INVINCIBILITY.DURATION_MS));
  }

  /** True only during the final EXPIRING_WINDOW_MS of an active run. */
  public get isExpiring(): boolean {
    return this.active && this.remainingMs <= INVINCIBILITY.EXPIRING_WINDOW_MS;
  }

  public get tintIntervalMs(): number {
    return this.isExpiring ? INVINCIBILITY.TINT_INTERVAL_EXPIRING_MS : INVINCIBILITY.TINT_INTERVAL_MS;
  }

  /** Index into INVINCIBILITY_TINTS for the tint that should be showing right now. */
  public get tintIndex(): number {
    if (!this.active) {
      return 0;
    }
    return Math.floor(this.elapsedMs / this.tintIntervalMs) % INVINCIBILITY_TINTS.length;
  }

  public get currentTint(): number {
    return INVINCIBILITY_TINTS[this.tintIndex] ?? INVINCIBILITY_TINTS[0] ?? 0xffffff;
  }
}
