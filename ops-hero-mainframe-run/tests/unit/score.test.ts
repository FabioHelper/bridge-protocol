import { describe, expect, it } from 'vitest';

import { ScoreSystem } from '../../src/systems/ScoreSystem';
import { HighScoreStore, type StorageLike } from '../../src/systems/HighScoreStore';
import { SCORING, WORLD } from '../../src/config/Tuning';

class FakeStorage implements StorageLike {
  private map = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

describe('ScoreSystem', () => {
  it('awards a flat value per token', () => {
    const score = new ScoreSystem();
    expect(score.collectToken()).toBe(SCORING.TOKEN);
    expect(score.score).toBe(SCORING.TOKEN);
  });

  it('chains consecutive airborne stomps 1x through 5x, capped', () => {
    const score = new ScoreSystem();
    expect(score.registerStomp()).toBe(SCORING.STOMP_BASE * 1);
    expect(score.registerStomp()).toBe(SCORING.STOMP_BASE * 2);
    expect(score.registerStomp()).toBe(SCORING.STOMP_BASE * 3);
    expect(score.registerStomp()).toBe(SCORING.STOMP_BASE * 4);
    expect(score.registerStomp()).toBe(SCORING.STOMP_BASE * 5);
    // Cap holds even after the 5th stomp.
    expect(score.registerStomp()).toBe(SCORING.STOMP_BASE * SCORING.MAX_STOMP_CHAIN_MULTIPLIER);
    expect(score.chainMultiplier).toBe(SCORING.MAX_STOMP_CHAIN_MULTIPLIER);
  });

  it('resets the chain on landing', () => {
    const score = new ScoreSystem();
    score.registerStomp();
    score.registerStomp();
    expect(score.chainMultiplier).toBe(2);
    score.registerLanding();
    expect(score.chainMultiplier).toBe(0);
    expect(score.registerStomp()).toBe(SCORING.STOMP_BASE * 1);
  });

  it('scores an invincible defeat as a flat value, independent of any chain', () => {
    const score = new ScoreSystem();
    score.registerStomp();
    score.registerStomp();
    const before = score.score;
    expect(score.registerInvincibleDefeat()).toBe(SCORING.INVINCIBLE_DEFEAT);
    expect(score.score).toBe(before + SCORING.INVINCIBLE_DEFEAT);
  });

  it('awards job and level completion bonuses', () => {
    const score = new ScoreSystem();
    expect(score.completeJob()).toBe(SCORING.JOB_COMPLETE);
  });

  it('computes a rounded time bonus against the par, and zero once past par', () => {
    const score = new ScoreSystem();
    // 500 ms under par -> ceil(500/1000) = 1 whole second remaining.
    const underPar = score.completeLevel(WORLD.PAR_TIME_MS - 500);
    expect(underPar.levelBonus).toBe(SCORING.LEVEL_COMPLETE);
    expect(underPar.timeBonus).toBe(SCORING.TIME_BONUS_PER_SECOND * 1);

    const score2 = new ScoreSystem();
    const overPar = score2.completeLevel(WORLD.PAR_TIME_MS + 10_000);
    expect(overPar.timeBonus).toBe(0);
  });

  it('never goes negative and is monotonically non-decreasing', () => {
    const score = new ScoreSystem();
    let previous = score.score;
    for (const action of [
      () => score.collectToken(),
      () => score.registerStomp(),
      () => score.registerInvincibleDefeat(),
      () => score.completeJob(),
    ]) {
      action();
      expect(score.score).toBeGreaterThanOrEqual(previous);
      expect(score.score).toBeGreaterThanOrEqual(0);
      previous = score.score;
    }
  });
});

describe('HighScoreStore', () => {
  it('reads 0 when nothing is stored', () => {
    const store = new HighScoreStore(new FakeStorage());
    expect(store.read()).toBe(0);
  });

  it('commits a higher score and keeps the stored value on a lower candidate', () => {
    const storage = new FakeStorage();
    const store = new HighScoreStore(storage);
    expect(store.commit(500)).toBe(500);
    expect(store.read()).toBe(500);
    expect(store.commit(200)).toBe(500);
    expect(store.read()).toBe(500);
    expect(store.commit(900)).toBe(900);
    expect(store.read()).toBe(900);
  });

  it('degrades a corrupt stored value to 0 rather than throwing', () => {
    const storage = new FakeStorage();
    storage.setItem('opshero.highscore.v1', 'not-a-number');
    const store = new HighScoreStore(storage);
    expect(store.read()).toBe(0);
    // A corrupt value should not block a future legitimate commit.
    expect(store.commit(100)).toBe(100);
  });

  it('degrades a negative stored value to 0', () => {
    const storage = new FakeStorage();
    storage.setItem('opshero.highscore.v1', '-5');
    const store = new HighScoreStore(storage);
    expect(store.read()).toBe(0);
  });
});
