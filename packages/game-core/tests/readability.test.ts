import { describe, expect, it } from 'vitest';

import {
  ENEMY,
  HAMMER,
  advanceAttack,
  beginCharge,
  createAttackState,
  gradeBonus,
  gradeFor,
  isWithinMeleeArc,
  releaseCharge,
  timingBands,
} from '../src/index';

/**
 * The rules an adult playtest found unreadable, pinned as behaviour.
 *
 * Every case here corresponds to something a person actually failed to
 * understand while holding a phone: that tapping had worked, that a charge was
 * building, which grade they had earned, or what the red circle on the ground
 * was asking them to do. The presentation fixes live in the client; these guard
 * the rules underneath them, so a later tuning pass cannot quietly undo the
 * thing that made them legible.
 */

/** Holds the button for `seconds`, then lets go. */
function pressFor(seconds: number, assist = false) {
  let state = beginCharge(createAttackState());
  const step = 1 / 240;
  for (let held = 0; held < seconds; held += step) {
    state = advanceAttack(state, step);
  }
  return releaseCharge(state, assist);
}

describe('a tap is a tap, and a hold is a hold', () => {
  it('treats an unhurried press as a tap', () => {
    // The threshold moved to 0.22 s because a child's press is not crisp and
    // taps were being swallowed by the charge. A 0.15 s press is still brisk.
    const { swing } = pressFor(0.15);
    expect(swing?.kind).toBe('light');
  });

  it('treats a deliberate hold as a charge', () => {
    const { swing } = pressFor(HAMMER.tapThresholdSeconds + 0.2);
    expect(swing?.kind).toBe('heavy');
  });

  it('leaves room for a slow tap without stealing the charge', () => {
    // Both halves matter: too low and a child's tap charges by accident, too
    // high and a deliberate charge feels unresponsive.
    expect(HAMMER.tapThresholdSeconds).toBeGreaterThanOrEqual(0.2);
    expect(HAMMER.tapThresholdSeconds).toBeLessThanOrEqual(0.3);
  });

  it('makes the first tap land on its own, without needing the combo', () => {
    const { swing } = pressFor(0.1);
    expect(swing?.comboCount).toBe(1);
    expect(swing?.power).toBeGreaterThan(0);
  });
});

describe('the charge is long enough to see', () => {
  it('is never shortened below the plan, and was lengthened for readability', () => {
    // PLAN §11 describes ~1.2 s. The roadmap permits lengthening for clarity
    // and forbids shortening; the playtest asked for exactly that.
    expect(HAMMER.chargeSeconds).toBeGreaterThanOrEqual(1.2);
  });

  it('slows the player without rooting them', () => {
    expect(HAMMER.chargingSpeedFactor).toBeGreaterThan(0.5);
    expect(HAMMER.chargingSpeedFactor).toBeLessThan(1);
  });

  it('keeps a run-up before the bands, so the meter can be watched arriving', () => {
    const bands = timingBands(false);
    expect(bands.great.startSeconds).toBeGreaterThan(HAMMER.tapThresholdSeconds);
  });
});

describe('a charged hit is worth committing to', () => {
  it('hits far harder than a tap', () => {
    const tap = HAMMER.baseDamage * 0.55;
    const perfect = HAMMER.baseDamage * gradeBonus('perfect');
    // "The charged hit felt similar to an ordinary attack" — it must not.
    expect(perfect / tap).toBeGreaterThanOrEqual(3);
  });

  it('still rewards the grade in the right order', () => {
    expect(gradeBonus('perfect')).toBeGreaterThan(gradeBonus('great'));
    expect(gradeBonus('great')).toBeGreaterThan(gradeBonus('good'));
  });

  it('never punishes a release: every grade is a hit', () => {
    for (const held of [0.3, 0.6, 0.93, 1.2, HAMMER.chargeSeconds]) {
      expect(pressFor(held).swing?.power).toBeGreaterThan(0);
    }
  });
});

describe('the telegraph describes the attack it precedes', () => {
  const at = (angle: number, distance: number) => ({
    x: Math.sin(angle) * distance,
    z: Math.cos(angle) * distance,
  });
  const origin = { x: 0, z: 0 };
  const inArc = (angle: number, distance: number) =>
    isWithinMeleeArc(
      origin,
      0,
      at(angle, distance),
      ENEMY.attackRangeMetres,
      ENEMY.attackHalfAngleRadians,
    );

  it('is a frontal wedge, not a circle', () => {
    // The drawn wedge uses these same two constants. If the attack ever became
    // omnidirectional this would fail, and the drawing would be a lie.
    expect(ENEMY.attackHalfAngleRadians).toBeLessThan(Math.PI / 2);
  });

  it('hits inside the drawn wedge', () => {
    expect(inArc(0, ENEMY.attackRangeMetres * 0.5)).toBe(true);
    expect(inArc(ENEMY.attackHalfAngleRadians * 0.9, ENEMY.attackRangeMetres * 0.9)).toBe(true);
  });

  it('misses just outside its edge, which is what makes sidestepping work', () => {
    expect(inArc(ENEMY.attackHalfAngleRadians * 1.1, ENEMY.attackRangeMetres * 0.9)).toBe(false);
  });

  it('misses beyond its reach, which is what makes backing off work', () => {
    expect(inArc(0, ENEMY.attackRangeMetres * 1.2)).toBe(false);
  });

  it('never reaches behind the enemy', () => {
    expect(inArc(Math.PI, ENEMY.attackRangeMetres * 0.5)).toBe(false);
  });
});

describe('the counterattack window can actually be used', () => {
  it('fits a full charge released on the sweet spot', () => {
    const bands = timingBands(false);
    // Being helpless for less time than the counterattack takes would make the
    // opening a lie — which is roughly what the playtester experienced.
    expect(ENEMY.recoverSeconds).toBeGreaterThanOrEqual(bands.perfect.endSeconds);
  });

  it('fits a whole tap combo', () => {
    const combo = HAMMER.comboLength * (HAMMER.tapThresholdSeconds + HAMMER.lightRecoverySeconds);
    expect(ENEMY.recoverSeconds).toBeGreaterThanOrEqual(combo - HAMMER.lightRecoverySeconds);
  });

  it('is shorter than the wind-up plus the strike, so it is a window and not a nap', () => {
    expect(ENEMY.recoverSeconds).toBeLessThan(ENEMY.windUpSeconds * 2);
  });
});

describe('assist widens the target without moving the floor', () => {
  it('makes both mastery bands wider', () => {
    const plain = timingBands(false);
    const helped = timingBands(true);

    const width = (b: { startSeconds: number; endSeconds: number }) =>
      b.endSeconds - b.startSeconds;
    expect(width(helped.perfect)).toBeGreaterThan(width(plain.perfect));
    expect(width(helped.great)).toBeGreaterThan(width(plain.great));
  });

  it('still leaves overcharging a real mistake', () => {
    const helped = timingBands(true);
    expect(helped.great.endSeconds).toBeLessThanOrEqual(
      HAMMER.chargeSeconds - HAMMER.minOverchargeSeconds,
    );
    // Holding to the very end must never be the best play, for anyone.
    expect(gradeFor(HAMMER.chargeSeconds, true)).toBe('good');
  });
});
