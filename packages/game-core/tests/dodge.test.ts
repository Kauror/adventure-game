import { describe, expect, it } from 'vitest';

import {
  DODGE,
  advanceDodge,
  canDodge,
  createDodgeState,
  dodgeSpeed,
  isDodging,
  isInvulnerable,
  startDodge,
} from '../src/index';

const east = { x: 1, y: 0 };

/** Runs the dodge clock forward in realistic frames rather than one big jump. */
function tick(state = createDodgeState(), seconds: number, step = 1 / 60) {
  let current = state;
  let remaining = seconds;
  while (remaining > 0) {
    const dt = Math.min(step, remaining);
    current = advanceDodge(current, dt);
    remaining -= dt;
  }
  return current;
}

describe('starting a dodge', () => {
  it('begins ready', () => {
    const state = createDodgeState();
    expect(state.phase).toBe('ready');
    expect(canDodge(state)).toBe(true);
    expect(isDodging(state)).toBe(false);
    expect(isInvulnerable(state)).toBe(false);
  });

  it('enters the burst and normalises the direction', () => {
    const state = startDodge(createDodgeState(), { x: 3, y: 4 });

    expect(state.phase).toBe('dodging');
    expect(Math.hypot(state.direction.x, state.direction.y)).toBeCloseTo(1, 6);
    expect(state.direction.x).toBeCloseTo(0.6, 6);
    expect(state.direction.y).toBeCloseTo(0.8, 6);
  });

  it('refuses a directionless dodge rather than guessing one', () => {
    const state = createDodgeState();
    expect(startDodge(state, { x: 0, y: 0 })).toBe(state);
  });

  it('cannot be started again while already dodging', () => {
    const dodging = startDodge(createDodgeState(), east);
    const again = startDodge(dodging, { x: -1, y: 0 });

    expect(again).toBe(dodging);
    expect(again.direction.x).toBeCloseTo(1, 6);
  });

  it('cannot be started during the cooldown', () => {
    const cooling = tick(startDodge(createDodgeState(), east), DODGE.durationSeconds + 0.05);

    expect(cooling.phase).toBe('cooldown');
    expect(canDodge(cooling)).toBe(false);
    expect(startDodge(cooling, east)).toBe(cooling);
  });
});

describe('the dodge clock', () => {
  it('runs burst then cooldown then ready again', () => {
    const started = startDodge(createDodgeState(), east);
    expect(started.phase).toBe('dodging');

    const midBurst = tick(started, DODGE.durationSeconds / 2);
    expect(midBurst.phase).toBe('dodging');

    const cooling = tick(started, DODGE.durationSeconds + 0.01);
    expect(cooling.phase).toBe('cooldown');

    const recovered = tick(started, DODGE.durationSeconds + DODGE.cooldownSeconds + 0.01);
    expect(recovered.phase).toBe('ready');
    expect(canDodge(recovered)).toBe(true);
  });

  it('carries overshoot across phases, so frame rate cannot stretch a dodge', () => {
    const started = startDodge(createDodgeState(), east);

    const manySmall = tick(started, DODGE.durationSeconds + 0.2, 1 / 240);
    const fewLarge = tick(started, DODGE.durationSeconds + 0.2, 1 / 20);

    expect(manySmall.phase).toBe(fewLarge.phase);
    expect(manySmall.elapsedSeconds).toBeCloseTo(fewLarge.elapsedSeconds, 6);
  });

  it('resolves a frame long enough to span the whole burst and its cooldown', () => {
    const started = startDodge(createDodgeState(), east);
    const after = advanceDodge(started, DODGE.durationSeconds + DODGE.cooldownSeconds + 1);

    expect(after.phase).toBe('ready');
    expect(after.elapsedSeconds).toBe(0);
  });

  it('ignores zero and negative time', () => {
    const started = startDodge(createDodgeState(), east);
    expect(advanceDodge(started, 0)).toBe(started);
    expect(advanceDodge(started, -1)).toBe(started);
  });

  it('leaves a ready state alone', () => {
    const ready = createDodgeState();
    expect(advanceDodge(ready, 5)).toBe(ready);
  });
});

describe('invulnerability', () => {
  it('opens immediately, so pressing early is rewarded', () => {
    expect(isInvulnerable(startDodge(createDodgeState(), east))).toBe(true);
  });

  it('is a window inside the burst, not the whole of it', () => {
    expect(DODGE.invulnerableSeconds).toBeLessThan(DODGE.durationSeconds);

    const started = startDodge(createDodgeState(), east);
    const late = tick(started, DODGE.invulnerableSeconds + 0.01);

    expect(late.phase).toBe('dodging');
    expect(isInvulnerable(late)).toBe(false);
  });

  it('is never open outside a dodge', () => {
    expect(isInvulnerable(createDodgeState())).toBe(false);

    const cooling = tick(startDodge(createDodgeState(), east), DODGE.durationSeconds + 0.01);
    expect(isInvulnerable(cooling)).toBe(false);
  });
});

describe('dodge speed', () => {
  it('covers the configured distance over the configured duration', () => {
    expect(dodgeSpeed() * DODGE.durationSeconds).toBeCloseTo(DODGE.distanceMetres, 6);
  });

  it('is a burst — clearly faster than running', () => {
    expect(dodgeSpeed()).toBeGreaterThan(10);
  });
});
