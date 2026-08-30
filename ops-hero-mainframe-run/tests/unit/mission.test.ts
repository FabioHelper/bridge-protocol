import { describe, expect, it } from 'vitest';

import { MissionSystem } from '../../src/systems/MissionSystem';
import { MISSION } from '../../src/config/Tuning';

describe('MissionSystem', () => {
  it('starts with zero jobs complete and the exit locked', () => {
    const mission = new MissionSystem();
    expect(mission.jobsComplete).toBe(0);
    expect(mission.totalJobs).toBe(MISSION.TOTAL_JOBS);
    expect(mission.isExitUnlocked).toBe(false);
  });

  it('completes each of the four jobs and unlocks the exit only at 4/4', () => {
    const mission = new MissionSystem();
    for (let id = 1; id <= MISSION.TOTAL_JOBS; id += 1) {
      expect(mission.isExitUnlocked).toBe(false);
      expect(mission.complete(id)).toBe(true);
      expect(mission.isComplete(id)).toBe(true);
    }
    expect(mission.jobsComplete).toBe(MISSION.TOTAL_JOBS);
    expect(mission.isExitUnlocked).toBe(true);
  });

  it('is idempotent -- completing a job twice reports no new completion', () => {
    const mission = new MissionSystem();
    expect(mission.complete(1)).toBe(true);
    expect(mission.complete(1)).toBe(false);
    expect(mission.jobsComplete).toBe(1);
  });

  it('advances the objective text once every job is done', () => {
    const mission = new MissionSystem();
    expect(mission.objectiveText).toBe('COMPLETE ALL JOBS');
    for (let id = 1; id <= MISSION.TOTAL_JOBS; id += 1) {
      mission.complete(id);
    }
    expect(mission.objectiveText).toBe('REACH THE EXIT');
  });

  it('throws on an unknown job id', () => {
    const mission = new MissionSystem();
    expect(() => mission.complete(0)).toThrow(RangeError);
    expect(() => mission.complete(MISSION.TOTAL_JOBS + 1)).toThrow(RangeError);
    expect(() => mission.isComplete(-1)).toThrow(RangeError);
  });

  it('reports job pips in ascending id order', () => {
    const mission = new MissionSystem();
    mission.complete(2);
    const pips = mission.jobPips;
    expect(pips).toHaveLength(MISSION.TOTAL_JOBS);
    expect(pips[0]).toBe(false);
    expect(pips[1]).toBe(true);
    expect(pips[2]).toBe(false);
  });
});
