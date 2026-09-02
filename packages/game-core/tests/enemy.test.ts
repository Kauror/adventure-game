import { describe, expect, it } from 'vitest';

import {
  DODGE,
  ENEMY,
  HAMMER,
  MOVEMENT,
  advanceEnemy,
  createEnemy,
  damageEnemy,
  distanceBetween,
  gradeBonus,
  isEnemyDead,
  isTelegraphing,
  parseRegion,
  respawnEnemy,
  windUpProgress,
  type EnemyState,
  type Region,
  type WorldPoint,
} from '../src/index';
import { rawTestRegion } from './fixtures';

const region: Region = parseRegion(rawTestRegion());

/** Open floor in the fixture: tiles (1,1) and (2,1) are walkable. */
const SPAWN: WorldPoint = { x: 1.5, z: 2.5 };
const FAR_AWAY: WorldPoint = { x: 40, z: 40 };

/** Runs the enemy for a while against a stationary target. */
function run(
  state: EnemyState,
  target: WorldPoint,
  seconds: number,
  step = 1 / 60,
): { state: EnemyState; strikes: number; respawns: number } {
  let current = state;
  let strikes = 0;
  let respawns = 0;
  let remaining = seconds;

  while (remaining > 0) {
    const dt = Math.min(step, remaining);
    const update = advanceEnemy(current, region, target, dt);
    current = update.state;
    if (update.strikeLanded) {
      strikes += 1;
    }
    if (update.readyToRespawn) {
      respawns += 1;
    }
    remaining -= dt;
  }

  return { state: current, strikes, respawns };
}

/** Advances until the enemy reaches a phase, or gives up. */
function runUntil(
  state: EnemyState,
  target: WorldPoint,
  predicate: (state: EnemyState) => boolean,
  limitSeconds = 20,
): EnemyState {
  let current = state;
  const step = 1 / 60;

  for (let elapsed = 0; elapsed < limitSeconds; elapsed += step) {
    if (predicate(current)) {
      return current;
    }
    current = advanceEnemy(current, region, target, step).state;
  }

  return current;
}

describe('the fight is always winnable — no unavoidable damage', () => {
  it('is slower than the player, so walking away always works', () => {
    expect(ENEMY.speedMetresPerSecond).toBeLessThan(MOVEMENT.maxSpeedMetresPerSecond);
  });

  it('telegraphs for far longer than a dodge takes', () => {
    // There must be time to see it, decide, and act — not merely to react.
    expect(ENEMY.windUpSeconds).toBeGreaterThan(DODGE.durationSeconds * 3);
  });

  it('can always be escaped by dodging, because a dodge outruns its reach', () => {
    expect(DODGE.distanceMetres).toBeGreaterThan(ENEMY.attackRangeMetres);
  });

  it('leaves enough recovery to land a fully charged hammer', () => {
    // Otherwise dodging would earn nothing and trading blows would be optimal.
    expect(ENEMY.recoverSeconds).toBeGreaterThan(
      HAMMER.chargeSeconds * HAMMER.perfectCentreFraction,
    );
  });

  it('leaves enough recovery for a whole three-tap combo', () => {
    const comboSeconds =
      HAMMER.comboLength * (HAMMER.tapThresholdSeconds + HAMMER.lightRecoverySeconds);
    expect(ENEMY.recoverSeconds).toBeGreaterThanOrEqual(comboSeconds - HAMMER.lightRecoverySeconds);
  });

  it('can be killed in a sane number of hits, by either path', () => {
    const perfectHeavy = HAMMER.baseDamage * gradeBonus('perfect');
    const hitsToKill = ENEMY.maxHealth / perfectHeavy;

    expect(hitsToKill).toBeGreaterThan(2);
    expect(hitsToKill).toBeLessThan(8);
  });
});

describe('noticing the player', () => {
  it('waits, unbothered, while the player is far away', () => {
    const { state } = run(createEnemy(SPAWN), FAR_AWAY, 3);

    expect(state.phase).toBe('idle');
    expect(state.position).toEqual(SPAWN);
  });

  it('gives chase once the player comes close', () => {
    const enemy = createEnemy(SPAWN);
    const target = { x: 4.5, z: 2.5 };

    const chasing = runUntil(enemy, target, (s) => s.phase === 'pursue');
    expect(chasing.phase).toBe('pursue');

    const { state } = run(chasing, target, 0.5);
    expect(distanceBetween(state.position, target)).toBeLessThan(distanceBetween(SPAWN, target));
  });

  it('gives up and settles once the player leaves its range', () => {
    const chasing = runUntil(createEnemy(SPAWN), { x: 4.5, z: 2.5 }, (s) => s.phase === 'pursue');
    const { state } = run(chasing, FAR_AWAY, 2);

    expect(state.phase).toBe('idle');
  });

  it('never walks through a wall while chasing', () => {
    // Tile (2,2) and (3,2) are wall; chase across them.
    const enemy = createEnemy({ x: 1.5, z: 1.5 });
    const { state } = run(enemy, { x: 4.5, z: 1.5 }, 4);

    expect(state.position.x).toBeLessThan(2);
  });
});

describe('the swing', () => {
  const adjacent: WorldPoint = { x: 2.4, z: 2.5 };

  it('runs idle -> pursue -> wind-up -> strike -> recover, in that order', () => {
    const seen: string[] = [];
    let state = createEnemy(SPAWN);

    for (let i = 0; i < 60 * 6; i += 1) {
      state = advanceEnemy(state, region, adjacent, 1 / 60).state;
      if (seen[seen.length - 1] !== state.phase) {
        seen.push(state.phase);
      }
    }

    expect(seen.slice(0, 4)).toEqual(['pursue', 'windUp', 'strike', 'recover']);
  });

  it('telegraphs before it strikes, and the telegraph fills up', () => {
    const winding = runUntil(createEnemy(SPAWN), adjacent, isTelegraphing);
    expect(isTelegraphing(winding)).toBe(true);
    expect(windUpProgress(winding)).toBeLessThan(0.2);

    const later = run(winding, adjacent, ENEMY.windUpSeconds * 0.8).state;
    expect(windUpProgress(later)).toBeGreaterThan(0.6);
  });

  it('lands on a player who stands still', () => {
    const { strikes } = run(createEnemy(SPAWN), adjacent, 4);
    expect(strikes).toBeGreaterThanOrEqual(1);
  });

  it('misses a player who steps out of the arc during the wind-up', () => {
    const winding = runUntil(createEnemy(SPAWN), adjacent, isTelegraphing);

    // Player retreats out of reach while the swing is still winding up.
    const escaped = { x: winding.position.x + ENEMY.attackRangeMetres + 1.5, z: adjacent.z };
    let strikes = 0;
    let state = winding;

    for (let i = 0; i < 60; i += 1) {
      const update = advanceEnemy(state, region, escaped, 1 / 60);
      state = update.state;
      if (update.strikeLanded) {
        strikes += 1;
      }
      if (state.phase === 'recover') {
        break;
      }
    }

    expect(strikes).toBe(0);
  });

  it('commits to the direction it wound up in, so sidestepping beats it', () => {
    const winding = runUntil(createEnemy(SPAWN), adjacent, isTelegraphing);
    const lockedFacing = winding.facing;

    // Player circles round behind while the swing is committed.
    const behind = { x: winding.position.x - 1.2, z: winding.position.z };
    const after = run(winding, behind, ENEMY.windUpSeconds * 0.9);

    expect(after.state.facing).toBe(lockedFacing);
    expect(after.strikes).toBe(0);
  });

  it('is helpless for a moment afterwards', () => {
    const striking = runUntil(createEnemy(SPAWN), adjacent, (s) => s.phase === 'recover');
    const stillRecovering = run(striking, adjacent, ENEMY.recoverSeconds * 0.5).state;

    expect(stillRecovering.phase).toBe('recover');
  });
});

describe('taking damage and dying', () => {
  it('loses health without dying to a single hit', () => {
    const hurt = damageEnemy(createEnemy(SPAWN), HAMMER.baseDamage);

    expect(hurt.health.current).toBeLessThan(ENEMY.maxHealth);
    expect(isEnemyDead(hurt)).toBe(false);
  });

  it('dies once its health runs out', () => {
    const dead = damageEnemy(createEnemy(SPAWN), ENEMY.maxHealth);

    expect(isEnemyDead(dead)).toBe(true);
    expect(dead.health.current).toBe(0);
  });

  it('does not have its committed swing interrupted by being hit', () => {
    const winding = runUntil(createEnemy(SPAWN), { x: 2.4, z: 2.5 }, isTelegraphing);
    const hurt = damageEnemy(winding, 1);

    expect(hurt.phase).toBe('windUp');
  });

  it('stops chasing and striking once dead', () => {
    const dead = damageEnemy(createEnemy(SPAWN), ENEMY.maxHealth);
    const { state, strikes } = run(dead, { x: 2.4, z: 2.5 }, 2);

    expect(state.phase).toBe('dead');
    expect(strikes).toBe(0);
    expect(state.position).toEqual(SPAWN);
  });

  it('cannot be damaged further once dead', () => {
    const dead = damageEnemy(createEnemy(SPAWN), ENEMY.maxHealth);
    expect(damageEnemy(dead, 5)).toBe(dead);
  });

  it('signals exactly once that it is ready to come back', () => {
    const dead = damageEnemy(createEnemy(SPAWN), ENEMY.maxHealth);
    const { respawns } = run(dead, FAR_AWAY, ENEMY.respawnSeconds * 2);

    expect(respawns).toBe(1);
  });

  it('comes back whole, at its spawn, so the fight can be had again', () => {
    const dead = damageEnemy(createEnemy(SPAWN), ENEMY.maxHealth);
    const fresh = respawnEnemy(dead);

    expect(fresh.phase).toBe('idle');
    expect(fresh.health.current).toBe(ENEMY.maxHealth);
    expect(fresh.position).toEqual(SPAWN);
  });
});

describe('frame independence', () => {
  it('reaches the same phase at 30 fps as at 240 fps', () => {
    const target = { x: 2.4, z: 2.5 };
    const slow = run(createEnemy(SPAWN), target, 1.5, 1 / 30);
    const fast = run(createEnemy(SPAWN), target, 1.5, 1 / 240);

    expect(slow.state.phase).toBe(fast.state.phase);
  });

  it('ignores zero and negative time', () => {
    const enemy = createEnemy(SPAWN);
    expect(advanceEnemy(enemy, region, SPAWN, 0).state).toBe(enemy);
    expect(advanceEnemy(enemy, region, SPAWN, -1).state).toBe(enemy);
  });
});
