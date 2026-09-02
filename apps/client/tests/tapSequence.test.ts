import { describe, expect, it } from 'vitest';

import { createTapSequence } from '../src/debug/tapSequence';

describe('secret tap sequence', () => {
  it('fires on the final tap of a quick run', () => {
    const taps = createTapSequence(4, 1000);

    expect(taps.tap(0)).toBe(false);
    expect(taps.tap(100)).toBe(false);
    expect(taps.tap(200)).toBe(false);
    expect(taps.tap(300)).toBe(true);
  });

  it('does not fire on the way there', () => {
    const taps = createTapSequence(4, 1000);
    expect([taps.tap(0), taps.tap(50), taps.tap(100)]).toEqual([false, false, false]);
  });

  it('forgets a run that stalls, so idle prodding never adds up', () => {
    const taps = createTapSequence(4, 1000);

    taps.tap(0);
    taps.tap(100);
    taps.tap(200);
    // A long pause: the next tap starts a fresh run rather than completing this one.
    expect(taps.tap(5000)).toBe(false);
    expect(taps.progress()).toBe(1);
  });

  it('needs the full run again after firing', () => {
    const taps = createTapSequence(3, 1000);

    taps.tap(0);
    taps.tap(50);
    expect(taps.tap(100)).toBe(true);

    // One more tap must not immediately re-trigger.
    expect(taps.tap(150)).toBe(false);
    expect(taps.tap(200)).toBe(false);
    expect(taps.tap(250)).toBe(true);
  });

  it('tolerates taps right on the window boundary', () => {
    const taps = createTapSequence(2, 1000);

    taps.tap(0);
    // Exactly at the limit still counts; a hair over does not.
    expect(taps.tap(1000)).toBe(true);

    taps.reset();
    taps.tap(0);
    expect(taps.tap(1001)).toBe(false);
  });

  it('can be reset', () => {
    const taps = createTapSequence(3, 1000);

    taps.tap(0);
    taps.tap(50);
    taps.reset();

    expect(taps.progress()).toBe(0);
    expect(taps.tap(100)).toBe(false);
  });

  it('never accepts a one-tap sequence, which would fire by accident', () => {
    const taps = createTapSequence(1, 1000);
    expect(taps.tap(0)).toBe(false);
    expect(taps.tap(50)).toBe(true);
  });
});
