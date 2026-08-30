/** Cross-scene notification names, carried on `this.game.events` (plain signals, no object refs). */
export const GameEvents = {
  DAMAGE: 'ops-hero:damage',
  JOB_COMPLETE: 'ops-hero:job-complete',
} as const;
