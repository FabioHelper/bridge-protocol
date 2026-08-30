/**
 * System-status message with a hold timer. Pure, no Phaser. See GAMEPLAY_SPEC.md section 11.
 *
 * Non-default messages hold for STATUS_MESSAGE_HOLD_MS then revert to the default. `PAUSED` is
 * the one exception -- it is driven directly by pause state elsewhere, not this timer, so it is
 * not set through `show()`.
 */
import { HUD } from '../config/Tuning';

export const StatusMessages = {
  DEFAULT: 'ALL SYSTEMS GO',
  ALERT_RAISED: 'ALERT RAISED',
  CHECKPOINT_SAVED: 'CHECKPOINT SAVED',
  POWER_SURGE_ACTIVE: 'POWER SURGE ACTIVE',
  JOBS_INCOMPLETE: 'JOBS INCOMPLETE',
  LIFE_LOST: 'LIFE LOST',
  PAUSED: 'PAUSED',
} as const;

export function jobCompleteMessage(jobNumber: number): string {
  return `JOB ${jobNumber} COMPLETE`;
}

export class SystemStatusController {
  private message: string = StatusMessages.DEFAULT;
  private holdRemainingMs = 0;

  public show(message: string): void {
    this.message = message;
    this.holdRemainingMs = HUD.STATUS_MESSAGE_HOLD_MS;
  }

  public update(deltaMs: number): void {
    if (this.holdRemainingMs <= 0) {
      return;
    }
    this.holdRemainingMs -= deltaMs;
    if (this.holdRemainingMs <= 0) {
      this.holdRemainingMs = 0;
      this.message = StatusMessages.DEFAULT;
    }
  }

  public get current(): string {
    return this.message;
  }
}
