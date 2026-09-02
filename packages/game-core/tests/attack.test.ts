import { describe, expect, it } from 'vitest';

import {
  HAMMER,
  advanceAttack,
  beginCharge,
  canAttack,
  cancelCharge,
  chargeProgress,
  comboPower,
  createAttackState,
  gradeBonus,
  gradeFor,
  isCharging,
  isPastTapThreshold,
  releaseCharge,
  timingBands,
  type AttackState,
} from '../src/index';

const PERFECT_CENTRE = HAMMER.chargeSeconds * HAMMER.perfectCentreFraction;

/** Holds the button for a given time, in realistic frames. */
function holdFor(seconds: number, from = createAttackState(), step = 1 / 60): AttackState {
  let state = beginCharge(from);
  let remaining = seconds;
  while (remaining > 0) {
    const dt = Math.min(step, remaining);
    state = advanceAttack(state, dt);
    remaining -= dt;
  }
  return state;
}

/** Waits without holding the button. */
function wait(state: AttackState, seconds: number, step = 1 / 60): AttackState {
  let current = state;
  let remaining = seconds;
  while (remaining > 0) {
    const dt = Math.min(step, remaining);
    current = advanceAttack(current, dt);
    remaining -= dt;
  }
  return current;
}

/** One complete press-and-release. */
function swing(from: AttackState, holdSeconds: number, assist = false) {
  return releaseCharge(holdFor(holdSeconds, from), assist);
}

const TAP = HAMMER.tapThresholdSeconds / 2;

const bandWidth = (band: { startSeconds: number; endSeconds: number }): number =>
  band.endSeconds - band.startSeconds;

describe('tapping for a quick combo', () => {
  it('treats a short press as a light hit, not a charge', () => {
    const released = swing(createAttackState(), TAP);

    expect(released.swing?.kind).toBe('light');
    expect(released.swing?.comboCount).toBe(1);
  });

  it('recovers quickly enough for taps to chain', () => {
    expect(HAMMER.lightRecoverySeconds).toBeLessThan(HAMMER.heavyRecoverySeconds);

    const first = swing(createAttackState(), TAP);
    const ready = wait(first.state, HAMMER.lightRecoverySeconds + 0.01);

    expect(canAttack(ready)).toBe(true);
  });

  it('builds a chain up to the finisher and then starts over', () => {
    let state = createAttackState();
    const counts: number[] = [];

    for (let hit = 0; hit < HAMMER.comboLength + 1; hit += 1) {
      const released = swing(state, TAP);
      counts.push(released.swing?.comboCount ?? 0);
      state = wait(released.state, HAMMER.lightRecoverySeconds + 0.01);
    }

    expect(counts).toEqual([1, 2, 3, 1]);
  });

  it('drops the chain when the rhythm is broken', () => {
    const first = swing(createAttackState(), TAP);
    expect(first.swing?.comboCount).toBe(1);

    const dawdled = wait(first.state, HAMMER.comboWindowSeconds + 0.1);
    expect(dawdled.comboCount).toBe(0);

    const restarted = swing(dawdled, TAP);
    expect(restarted.swing?.comboCount).toBe(1);
  });

  it('keeps the chain alive for a tap just inside the window', () => {
    const first = swing(createAttackState(), TAP);
    const soon = wait(first.state, HAMMER.comboWindowSeconds - 0.05);

    expect(soon.comboCount).toBe(1);
    expect(swing(soon, TAP).swing?.comboCount).toBe(2);
  });

  it('rewards the finisher but keeps light hits weaker than any heavy swing', () => {
    expect(comboPower(3)).toBeGreaterThan(comboPower(1));
    expect(comboPower(3)).toBeLessThan(gradeBonus('great'));
    expect(comboPower(1)).toBeLessThan(gradeBonus('good'));
  });

  it('does not flash the charge meter for a tap', () => {
    expect(isPastTapThreshold(holdFor(TAP))).toBe(false);
    expect(isPastTapThreshold(holdFor(HAMMER.tapThresholdSeconds + 0.05))).toBe(true);
  });
});

describe('holding for strength', () => {
  it('treats a held press as a heavy swing', () => {
    const released = swing(createAttackState(), PERFECT_CENTRE);

    expect(released.swing?.kind).toBe('heavy');
    expect(released.swing?.grade).toBe('perfect');
    expect(released.swing?.comboCount).toBe(0);
  });

  it('hits harder than the whole light path', () => {
    expect(gradeBonus('perfect')).toBeGreaterThan(comboPower(HAMMER.comboLength));
  });

  it('rewards releasing on the sweet spot', () => {
    expect(gradeFor(PERFECT_CENTRE, false)).toBe('perfect');
  });

  it('gives GREAT just outside PERFECT', () => {
    const bands = timingBands(false);
    expect(gradeFor(bands.perfect.startSeconds - 0.01, false)).toBe('great');
    expect(gradeFor(bands.perfect.endSeconds + 0.01, false)).toBe('great');
  });

  it('can be missed in both directions — too early and too late', () => {
    const bands = timingBands(false);

    // Released just after the tap threshold: a weak heavy swing.
    expect(gradeFor(HAMMER.tapThresholdSeconds + 0.01, false)).toBe('good');
    // Overcharged past the window.
    expect(gradeFor(bands.great.endSeconds + 0.01, false)).toBe('good');
    // There is real room to overcharge, or holding could never be a mistake.
    expect(HAMMER.chargeSeconds).toBeGreaterThan(bands.great.endSeconds + 0.05);
  });

  it('caps the charge instead of swinging on its own', () => {
    const overheld = holdFor(HAMMER.chargeSeconds * 3);

    expect(isCharging(overheld)).toBe(true);
    expect(overheld.elapsedSeconds).toBeCloseTo(HAMMER.chargeSeconds, 6);
    expect(chargeProgress(overheld)).toBe(1);
  });

  it('resets any chain in progress', () => {
    const tapped = swing(createAttackState(), TAP);
    const ready = wait(tapped.state, HAMMER.lightRecoverySeconds + 0.01);
    expect(ready.comboCount).toBe(1);

    const heavy = swing(ready, PERFECT_CENTRE);
    expect(heavy.state.comboCount).toBe(0);
  });

  it('costs a longer recovery than a tap', () => {
    const heavy = swing(createAttackState(), PERFECT_CENTRE);

    const early = wait(heavy.state, HAMMER.lightRecoverySeconds + 0.01);
    expect(canAttack(early)).toBe(false);

    const recovered = wait(heavy.state, HAMMER.heavyRecoverySeconds + 0.01);
    expect(canAttack(recovered)).toBe(true);
  });
});

describe('timing bands', () => {
  it('nests PERFECT inside GREAT, both centred on the sweet spot', () => {
    const bands = timingBands(false);

    expect(bands.great.startSeconds).toBeLessThan(bands.perfect.startSeconds);
    expect(bands.great.endSeconds).toBeGreaterThan(bands.perfect.endSeconds);

    const centre = (bands.perfect.startSeconds + bands.perfect.endSeconds) / 2;
    expect(centre).toBeCloseTo(PERFECT_CENTRE, 6);
  });

  it('is wide enough that a small child is not asked to hit a frame', () => {
    // PLAN 11: the PERFECT band is never narrower than 250 ms.
    expect(bandWidth(timingBands(false).perfect)).toBeGreaterThanOrEqual(0.25);
  });

  it('starts after the tap threshold, so a tap can never be graded', () => {
    expect(timingBands(false).great.startSeconds).toBeGreaterThan(HAMMER.tapThresholdSeconds);
  });

  it('stays inside the charge, so no part of a band is unreachable', () => {
    for (const assist of [false, true]) {
      const bands = timingBands(assist);
      expect(bands.great.startSeconds).toBeGreaterThanOrEqual(0);
      expect(bands.great.endSeconds).toBeLessThanOrEqual(HAMMER.chargeSeconds);
      expect(bands.perfect.startSeconds).toBeGreaterThanOrEqual(0);
      expect(bands.perfect.endSeconds).toBeLessThanOrEqual(HAMMER.chargeSeconds);
    }
  });
});

describe('assist', () => {
  it('widens both mastery bands', () => {
    const plain = timingBands(false);
    const assisted = timingBands(true);

    expect(bandWidth(assisted.perfect)).toBeGreaterThan(bandWidth(plain.perfect));
    expect(bandWidth(assisted.great)).toBeGreaterThan(bandWidth(plain.great));
  });

  it('turns a near miss into a hit without moving the sweet spot', () => {
    const plain = timingBands(false);
    const justOutside = plain.perfect.startSeconds - 0.05;

    expect(gradeFor(justOutside, false)).toBe('great');
    expect(gradeFor(justOutside, true)).toBe('perfect');
    expect(gradeFor(PERFECT_CENTRE, true)).toBe('perfect');
  });

  it('never narrows the success floor: the worst timing still lands', () => {
    expect(gradeFor(HAMMER.chargeSeconds, true)).toBe('good');
    expect(gradeFor(HAMMER.chargeSeconds, false)).toBe('good');
  });

  it('never makes an assisted player worse off at any timing', () => {
    const rank = { good: 0, great: 1, perfect: 2 } as const;
    for (let t = 0; t <= HAMMER.chargeSeconds; t += 0.02) {
      expect(rank[gradeFor(t, true)]).toBeGreaterThanOrEqual(rank[gradeFor(t, false)]);
    }
  });

  it('does not change what counts as a tap', () => {
    expect(swing(createAttackState(), TAP, true).swing?.kind).toBe('light');
  });
});

describe('the attack state machine', () => {
  it('starts idle and ready', () => {
    const state = createAttackState();
    expect(state.phase).toBe('idle');
    expect(canAttack(state)).toBe(true);
    expect(chargeProgress(state)).toBe(0);
  });

  it('fills the meter from 0 to 1 while charging', () => {
    expect(chargeProgress(holdFor(0))).toBeCloseTo(0, 2);
    expect(chargeProgress(holdFor(HAMMER.chargeSeconds / 2))).toBeCloseTo(0.5, 1);
    expect(chargeProgress(holdFor(HAMMER.chargeSeconds))).toBeCloseTo(1, 2);
  });

  it('cannot start a new attack until recovery ends', () => {
    const released = swing(createAttackState(), TAP);
    expect(canAttack(released.state)).toBe(false);
    expect(beginCharge(released.state)).toBe(released.state);
  });

  it('does nothing when releasing without a press', () => {
    const idle = createAttackState();
    const released = releaseCharge(idle, false);

    expect(released.swing).toBeNull();
    expect(released.state).toBe(idle);
  });

  it('can be cancelled, losing the swing', () => {
    const cancelled = cancelCharge(holdFor(0.5));

    expect(cancelled.phase).toBe('idle');
    expect(canAttack(cancelled)).toBe(true);

    const idle = createAttackState();
    expect(cancelCharge(idle)).toBe(idle);
  });

  it('ignores zero and negative time', () => {
    const charging = beginCharge(createAttackState());
    expect(advanceAttack(charging, 0)).toBe(charging);
    expect(advanceAttack(charging, -1)).toBe(charging);
  });

  it('grades the same at 30 fps as at 240 fps', () => {
    const slow = swing(createAttackState(), PERFECT_CENTRE);
    const fast = releaseCharge(holdFor(PERFECT_CENTRE, createAttackState(), 1 / 240), false);

    expect(slow.swing?.grade).toBe(fast.swing?.grade);
  });
});

describe('grade bonus', () => {
  it('rewards better timing and stays bounded for the server to clamp against', () => {
    expect(gradeBonus('good')).toBe(1);
    expect(gradeBonus('great')).toBeGreaterThan(gradeBonus('good'));
    expect(gradeBonus('perfect')).toBeGreaterThan(gradeBonus('great'));
    // PLAN 4: the server clamps a claimed grade to this table.
    expect(gradeBonus('perfect')).toBeLessThanOrEqual(2);
  });
});
