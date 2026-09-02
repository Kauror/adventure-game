import { describe, expect, it } from 'vitest';

import {
  angleDifference,
  applyDamage,
  createHealth,
  distanceBetween,
  headingTo,
  healthFraction,
  isDead,
  isWithinMeleeArc,
} from '../src/index';

describe('health', () => {
  it('starts full', () => {
    const health = createHealth(10);
    expect(health.current).toBe(10);
    expect(health.max).toBe(10);
    expect(isDead(health)).toBe(false);
    expect(healthFraction(health)).toBe(1);
  });

  it('loses health when damaged', () => {
    expect(applyDamage(createHealth(10), 3).current).toBe(7);
  });

  it('never falls below zero, however hard the hit', () => {
    const dead = applyDamage(createHealth(10), 999);
    expect(dead.current).toBe(0);
    expect(isDead(dead)).toBe(true);
    expect(healthFraction(dead)).toBe(0);
  });

  it('ignores zero and negative damage rather than healing', () => {
    const health = createHealth(10);
    expect(applyDamage(health, 0)).toBe(health);
    expect(applyDamage(health, -5)).toBe(health);
  });

  it('reports a fraction usable by a health bar', () => {
    expect(healthFraction(applyDamage(createHealth(10), 5))).toBeCloseTo(0.5, 6);
  });
});

describe('headings', () => {
  it('points north for +Z, matching the fixed camera being north-up', () => {
    expect(headingTo({ x: 0, z: 0 }, { x: 0, z: 1 })).toBeCloseTo(0, 6);
  });

  it('points east for +X', () => {
    expect(headingTo({ x: 0, z: 0 }, { x: 1, z: 0 })).toBeCloseTo(Math.PI / 2, 6);
  });

  it('measures the shortest way round, across the wrap', () => {
    expect(angleDifference(0.1, -0.1)).toBeCloseTo(-0.2, 6);
    // Just either side of the ±PI seam: the short way is small, not almost 2PI.
    expect(Math.abs(angleDifference(Math.PI - 0.05, -Math.PI + 0.05))).toBeCloseTo(0.1, 6);
  });

  it('measures distance on the horizontal plane', () => {
    expect(distanceBetween({ x: 0, z: 0 }, { x: 3, z: 4 })).toBe(5);
  });
});

describe('melee arc', () => {
  const origin = { x: 0, z: 0 };
  const facingNorth = 0;
  const reach = 2;
  const halfAngle = Math.PI / 3; // 60 degrees each side

  it('hits a target in front and in range', () => {
    expect(isWithinMeleeArc(origin, facingNorth, { x: 0, z: 1.5 }, reach, halfAngle)).toBe(true);
  });

  it('misses a target that is too far away', () => {
    expect(isWithinMeleeArc(origin, facingNorth, { x: 0, z: 5 }, reach, halfAngle)).toBe(false);
  });

  it('misses a target behind the attacker, however close', () => {
    expect(isWithinMeleeArc(origin, facingNorth, { x: 0, z: -1 }, reach, halfAngle)).toBe(false);
  });

  it('misses a target just outside the arc, which is what sidestepping is', () => {
    const justInside = { x: Math.sin(halfAngle - 0.05), z: Math.cos(halfAngle - 0.05) };
    const justOutside = { x: Math.sin(halfAngle + 0.05), z: Math.cos(halfAngle + 0.05) };

    expect(isWithinMeleeArc(origin, facingNorth, justInside, reach, halfAngle)).toBe(true);
    expect(isWithinMeleeArc(origin, facingNorth, justOutside, reach, halfAngle)).toBe(false);
  });

  it('is symmetric about the facing direction', () => {
    const left = { x: -1, z: 1 };
    const right = { x: 1, z: 1 };

    expect(isWithinMeleeArc(origin, facingNorth, left, reach, halfAngle)).toBe(
      isWithinMeleeArc(origin, facingNorth, right, reach, halfAngle),
    );
  });

  it('follows the attacker round when they turn', () => {
    const east = { x: 1.5, z: 0 };

    expect(isWithinMeleeArc(origin, facingNorth, east, reach, halfAngle)).toBe(false);
    expect(isWithinMeleeArc(origin, Math.PI / 2, east, reach, halfAngle)).toBe(true);
  });

  it('counts a target standing exactly on the attacker as a hit', () => {
    expect(isWithinMeleeArc(origin, facingNorth, origin, reach, halfAngle)).toBe(true);
  });
});
