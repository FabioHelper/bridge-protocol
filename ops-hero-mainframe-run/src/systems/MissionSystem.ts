/**
 * Job-terminal objective tracking. Pure, no Phaser. See GAMEPLAY_SPEC.md section 7.
 *
 * Mission/objective text follows the reference's voice. The objective line advances once every
 * job is done -- a judgement call, since the spec names both `COMPLETE ALL JOBS` and
 * `AVOID ALERTS` without pinning which shows when; `COMPLETE ALL JOBS` reads as the primary
 * objective while jobs remain, and once the gate opens the exit becomes the only thing left to do.
 */
import { MISSION } from '../config/Tuning';

const MISSION_TEXT = 'PROCESS END OF DAY REPORTS AND ARCHIVE';
const OBJECTIVE_IN_PROGRESS = 'COMPLETE ALL JOBS';
const OBJECTIVE_DONE = 'REACH THE EXIT';

export class MissionSystem {
  private readonly completedIds = new Set<number>();

  private static assertValidId(id: number): void {
    if (!Number.isInteger(id) || id < 1 || id > MISSION.TOTAL_JOBS) {
      throw new RangeError(`unknown job id: ${id}`);
    }
  }

  /** Idempotent: completing an already-complete job returns false and never double-scores. */
  public complete(id: number): boolean {
    MissionSystem.assertValidId(id);
    if (this.completedIds.has(id)) {
      return false;
    }
    this.completedIds.add(id);
    return true;
  }

  public isComplete(id: number): boolean {
    MissionSystem.assertValidId(id);
    return this.completedIds.has(id);
  }

  public get jobsComplete(): number {
    return this.completedIds.size;
  }

  public get totalJobs(): number {
    return MISSION.TOTAL_JOBS;
  }

  public get isExitUnlocked(): boolean {
    return this.completedIds.size >= MISSION.TOTAL_JOBS;
  }

  public get missionText(): string {
    return MISSION_TEXT;
  }

  public get objectiveText(): string {
    return this.isExitUnlocked ? OBJECTIVE_DONE : OBJECTIVE_IN_PROGRESS;
  }

  /** Job pips for the minimap/HUD, in ascending id order (1..TOTAL_JOBS). */
  public get jobPips(): readonly boolean[] {
    return Array.from({ length: MISSION.TOTAL_JOBS }, (_, index) => this.completedIds.has(index + 1));
  }
}
