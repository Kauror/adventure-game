import { HAMMER, gradeFor, timingBands } from '@adventure/game-core';
import { describe, expect, it } from 'vitest';

import { chargeZone } from '../src/ui/chargeZone';

/**
 * The traffic light must agree with the grade the player actually gets.
 *
 * That is the whole risk in this design: a green lamp that lights a moment
 * before or after the PERFECT band would teach a child the wrong rhythm and
 * then punish them for learning it. So every case here is really the same
 * assertion — what the lamp says and what `gradeFor` decides are one thing.
 */

const bands = timingBands(false);
const assisted = timingBands(true);

describe('the lamp matches the grade', () => {
  it('shows green exactly across PERFECT', () => {
    expect(chargeZone(bands.perfect.startSeconds, bands).lamp).toBe('green');
    expect(chargeZone(bands.perfect.endSeconds, bands).lamp).toBe('green');
    const middle = (bands.perfect.startSeconds + bands.perfect.endSeconds) / 2;
    expect(chargeZone(middle, bands).lamp).toBe('green');
  });

  it('agrees with gradeFor at every point of the charge', () => {
    // The real invariant, swept rather than sampled at chosen points.
    for (let held = 0; held <= HAMMER.chargeSeconds; held += 0.01) {
      const { lamp } = chargeZone(held, bands);
      const grade = gradeFor(held, false);

      if (lamp === 'green') {
        expect(grade).toBe('perfect');
      } else if (lamp === 'amber') {
        expect(grade).toBe('great');
      } else {
        expect(grade).toBe('good');
      }
    }
  });

  it('agrees with gradeFor under assist too', () => {
    for (let held = 0; held <= HAMMER.chargeSeconds; held += 0.01) {
      const { lamp } = chargeZone(held, assisted);
      const grade = gradeFor(held, true);
      const expected = lamp === 'green' ? 'perfect' : lamp === 'amber' ? 'great' : 'good';
      expect(grade).toBe(expected);
    }
  });
});

describe('the sequence a player sees', () => {
  it('starts on red', () => {
    expect(chargeZone(0, bands).lamp).toBe('red');
  });

  it('runs red, amber, green on the way in', () => {
    const early = chargeZone(bands.great.startSeconds * 0.5, bands).lamp;
    const approaching = chargeZone(
      (bands.great.startSeconds + bands.perfect.startSeconds) / 2,
      bands,
    ).lamp;
    const onIt = chargeZone(
      (bands.perfect.startSeconds + bands.perfect.endSeconds) / 2,
      bands,
    ).lamp;

    expect([early, approaching, onIt]).toEqual(['red', 'amber', 'green']);
  });

  it('runs back down through amber to red when overcharged', () => {
    const falling = chargeZone((bands.perfect.endSeconds + bands.great.endSeconds) / 2, bands).lamp;
    const missed = chargeZone(HAMMER.chargeSeconds, bands).lamp;

    // Holding too long is a real mistake and the lights say so — but it is
    // still a hit, never a jam.
    expect(falling).toBe('amber');
    expect(missed).toBe('red');
  });

  it('stays red however long the button is held past the end', () => {
    expect(chargeZone(HAMMER.chargeSeconds * 10, bands).lamp).toBe('red');
  });
});

describe('progress through a lamp', () => {
  it('runs 0 to 1 across the opening red stretch', () => {
    expect(chargeZone(0, bands).progress).toBeCloseTo(0, 2);
    expect(chargeZone(bands.great.startSeconds * 0.999, bands).progress).toBeGreaterThan(0.99);
  });

  it('is what lets the next lamp warm up before it lights', () => {
    // Amber is a fraction of a second wide, so it cannot be the only warning
    // that green is coming. Anticipation, not reaction (PLAN §11).
    const early = chargeZone(bands.great.startSeconds * 0.2, bands).progress;
    const late = chargeZone(bands.great.startSeconds * 0.9, bands).progress;
    expect(late).toBeGreaterThan(early);
  });

  it('never divides by a zero-width stretch', () => {
    const degenerate = {
      perfect: { startSeconds: 0, endSeconds: 0 },
      great: { startSeconds: 0, endSeconds: 0 },
    };
    for (const held of [0, 0.5, 1]) {
      expect(Number.isFinite(chargeZone(held, degenerate).progress)).toBe(true);
    }
  });
});
