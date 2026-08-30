import { describe, expect, it } from 'vitest';

import { InvincibilitySystem } from '../../src/systems/InvincibilitySystem';
import { INVINCIBILITY } from '../../src/config/Tuning';
import { INVINCIBILITY_TINTS } from '../../src/config/Palette';

describe('InvincibilitySystem', () => {
  it('is inactive until activated', () => {
    const inv = new InvincibilitySystem();
    expect(inv.isActive).toBe(false);
    expect(inv.remainingMs).toBe(0);
    expect(inv.meterFraction).toBe(0);
  });

  it('lasts exactly 8000 ms, with the boundary at t=8000 not t=8001', () => {
    const inv = new InvincibilitySystem();
    inv.activate();
    inv.update(INVINCIBILITY.DURATION_MS - 1);
    expect(inv.isActive).toBe(true);
    inv.update(1); // total elapsed now exactly 8000
    expect(inv.isActive).toBe(false);
    expect(inv.remainingMs).toBe(0);
  });

  it('clamps the meter fraction from 1 down to 0', () => {
    const inv = new InvincibilitySystem();
    inv.activate();
    expect(inv.meterFraction).toBe(1);
    inv.update(INVINCIBILITY.DURATION_MS / 2);
    expect(inv.meterFraction).toBeCloseTo(0.5, 5);
    inv.update(INVINCIBILITY.DURATION_MS / 2);
    expect(inv.meterFraction).toBe(0);
  });

  it('is expiring only in the final EXPIRING_WINDOW_MS', () => {
    const inv = new InvincibilitySystem();
    inv.activate();
    inv.update(INVINCIBILITY.DURATION_MS - INVINCIBILITY.EXPIRING_WINDOW_MS - 1);
    expect(inv.isExpiring).toBe(false);
    inv.update(1);
    expect(inv.isExpiring).toBe(true);
  });

  it('cycles the tint every 100 ms normally and every 50 ms while expiring', () => {
    const inv = new InvincibilitySystem();
    inv.activate();
    expect(inv.tintIntervalMs).toBe(INVINCIBILITY.TINT_INTERVAL_MS);
    inv.update(INVINCIBILITY.DURATION_MS - INVINCIBILITY.EXPIRING_WINDOW_MS);
    expect(inv.tintIntervalMs).toBe(INVINCIBILITY.TINT_INTERVAL_EXPIRING_MS);
  });

  it('never returns a tint index outside the defined tint array', () => {
    const inv = new InvincibilitySystem();
    inv.activate();
    for (let i = 0; i < 200; i += 1) {
      inv.update(37);
      expect(inv.tintIndex).toBeGreaterThanOrEqual(0);
      expect(inv.tintIndex).toBeLessThan(INVINCIBILITY_TINTS.length);
      expect(INVINCIBILITY_TINTS).toContain(inv.currentTint);
    }
  });

  it('refreshes to a full duration on re-activation rather than stacking', () => {
    const inv = new InvincibilitySystem();
    inv.activate();
    inv.update(6000);
    expect(inv.remainingMs).toBe(2000);
    inv.activate();
    expect(inv.remainingMs).toBe(INVINCIBILITY.DURATION_MS);
    expect(inv.isExpiring).toBe(false);
  });
});
