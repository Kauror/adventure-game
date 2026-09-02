import type { WorldPoint } from './region/types';

/**
 * Health and hit resolution.
 *
 * In game-core because PLAN §4 puts damage results under strict server
 * authority: the client may say "I swung", never "the enemy died". Both sides
 * therefore have to agree on what a hit is and what it costs.
 */

export interface Health {
  readonly current: number;
  readonly max: number;
}

export function createHealth(max: number): Health {
  const safeMax = Math.max(1, max);
  return { current: safeMax, max: safeMax };
}

/** Damage never pushes health below zero or above its maximum. */
export function applyDamage(health: Health, amount: number): Health {
  if (amount <= 0) {
    return health;
  }
  return { ...health, current: Math.max(0, health.current - amount) };
}

export function isDead(health: Health): boolean {
  return health.current <= 0;
}

/** 0..1, for health bars. */
export function healthFraction(health: Health): number {
  return health.max <= 0 ? 0 : Math.max(0, Math.min(1, health.current / health.max));
}

/**
 * Shortest signed angle between two headings, in radians.
 *
 * Headings use the same convention as the player's `facing`: `atan2(x, z)`, so
 * 0 points north (+Z), matching the fixed camera's up-the-screen direction.
 */
export function angleDifference(a: number, b: number): number {
  const twoPi = Math.PI * 2;
  const diff = ((((b - a + Math.PI) % twoPi) + twoPi) % twoPi) - Math.PI;
  return diff;
}

/** The heading from one point to another. */
export function headingTo(from: WorldPoint, to: WorldPoint): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

export function distanceBetween(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

/**
 * Whether a target is inside a melee swing: close enough, and in front.
 *
 * The arc is what makes both sides of the fight fair. It lets a player miss by
 * facing the wrong way, and — more importantly — it lets a child escape an
 * enemy's committed swing by stepping out of it, which is what "no unavoidable
 * damage" means in practice.
 */
export function isWithinMeleeArc(
  origin: WorldPoint,
  facing: number,
  target: WorldPoint,
  reachMetres: number,
  halfAngleRadians: number,
): boolean {
  const distance = distanceBetween(origin, target);
  if (distance > reachMetres) {
    return false;
  }
  // Standing on top of the target has no meaningful direction; count it as a hit
  // rather than letting a divide-by-zero decide.
  if (distance === 0) {
    return true;
  }

  return Math.abs(angleDifference(facing, headingTo(origin, target))) <= halfAngleRadians;
}
