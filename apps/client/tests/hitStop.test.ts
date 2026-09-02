import { describe, expect, it } from 'vitest';

import { MAX_FREEZE_SECONDS, createHitStop } from '../src/game/hitStop';

const FRAME = 1 / 60;

describe('hit stop', () => {
  it('passes time straight through when nothing has landed', () => {
    const hitStop = createHitStop();

    expect(hitStop.advance(FRAME)).toBe(FRAME);
    expect(hitStop.isFrozen()).toBe(false);
  });

  it('swallows simulation time while frozen', () => {
    const hitStop = createHitStop();
    hitStop.freeze(0.1);

    expect(hitStop.advance(FRAME)).toBe(0);
    expect(hitStop.isFrozen()).toBe(true);
  });

  it('hands back the remainder of the frame the freeze ends on', () => {
    const hitStop = createHitStop();
    hitStop.freeze(0.005);

    // Losing the rest of a long frame would make the game stutter twice over.
    expect(hitStop.advance(0.02)).toBeCloseTo(0.015, 6);
    expect(hitStop.isFrozen()).toBe(false);
  });

  it('freezes for about the requested time', () => {
    const hitStop = createHitStop();
    hitStop.freeze(0.1);

    let frozenFrames = 0;
    while (hitStop.isFrozen() && frozenFrames < 100) {
      hitStop.advance(FRAME);
      frozenFrames += 1;
    }

    expect(frozenFrames).toBe(Math.ceil(0.1 / FRAME));
  });

  it('takes the longest of overlapping freezes rather than adding them up', () => {
    const hitStop = createHitStop();
    hitStop.freeze(0.05);
    hitStop.freeze(0.02);
    hitStop.freeze(0.08);

    let total = 0;
    while (hitStop.isFrozen() && total < 1) {
      hitStop.advance(FRAME);
      total += FRAME;
    }

    // Three hits at once must not stack into a quarter-second stall.
    expect(total).toBeLessThan(0.08 + FRAME * 2);
  });

  it('never freezes longer than the cap, however wild the request', () => {
    const hitStop = createHitStop();
    hitStop.freeze(10);

    let total = 0;
    while (hitStop.isFrozen() && total < 2) {
      hitStop.advance(FRAME);
      total += FRAME;
    }

    // The cap is what keeps a frozen client from drifting far enough to trip
    // the server's displacement check later (PLAN §4).
    expect(total).toBeLessThanOrEqual(MAX_FREEZE_SECONDS + FRAME);
  });

  it('ignores a zero or negative freeze', () => {
    const hitStop = createHitStop();
    hitStop.freeze(0);
    hitStop.freeze(-1);

    expect(hitStop.isFrozen()).toBe(false);
    expect(hitStop.advance(FRAME)).toBe(FRAME);
  });

  it('ignores zero and negative frames', () => {
    const hitStop = createHitStop();
    expect(hitStop.advance(0)).toBe(0);
    expect(hitStop.advance(-1)).toBe(0);
  });

  it('resumes normally once the freeze is spent', () => {
    const hitStop = createHitStop();
    hitStop.freeze(FRAME);

    hitStop.advance(FRAME);
    expect(hitStop.advance(FRAME)).toBe(FRAME);
  });
});
