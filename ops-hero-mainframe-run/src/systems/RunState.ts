/**
 * The plain, serialisable snapshot that crosses the LevelScene -> HudScene boundary. Pure data,
 * no Phaser, no methods. See SPEC.md section 5.3: HudScene must consume this and never touch
 * game objects directly.
 */
import { MISSION, PLAYER } from '../config/Tuning';
import { StatusMessages } from './SystemStatus';

/** A minimap dot in normalised 0..1 level-progress / lane space. */
export interface MinimapMarker {
  readonly x01: number;
  readonly y01: number;
}

export interface RunState {
  readonly lives: number;
  readonly score: number;
  readonly highScore: number;
  readonly jobsComplete: number;
  readonly totalJobs: number;
  readonly jobPips: readonly boolean[];
  readonly alerts: number;
  readonly tokens: number;
  readonly chainMultiplier: number;
  readonly activePfKey: number;
  readonly statusMessage: string;
  readonly missionText: string;
  readonly objectiveText: string;
  readonly powerFraction: number;
  readonly invincibilityActive: boolean;
  readonly playerProgress01: number;
  readonly checkpointProgress01: number;
  readonly checkpointReached: boolean;
  readonly minimapEnemies: readonly MinimapMarker[];
  readonly viewdataLines: readonly string[];
  readonly paused: boolean;
  readonly elapsedMs: number;
}

export function createInitialRunState(highScore: number): RunState {
  return {
    lives: PLAYER.START_LIVES,
    score: 0,
    highScore,
    jobsComplete: 0,
    totalJobs: MISSION.TOTAL_JOBS,
    jobPips: Array.from({ length: MISSION.TOTAL_JOBS }, () => false),
    alerts: 0,
    tokens: 0,
    chainMultiplier: 0,
    activePfKey: 0,
    statusMessage: StatusMessages.DEFAULT,
    missionText: '',
    objectiveText: '',
    powerFraction: 0,
    invincibilityActive: false,
    playerProgress01: 0,
    checkpointProgress01: 0,
    checkpointReached: false,
    minimapEnemies: [],
    viewdataLines: [],
    paused: false,
    elapsedMs: 0,
  };
}
