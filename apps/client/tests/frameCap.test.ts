import { describe, expect, it } from 'vitest';

import { FRAME_CAP, createFrameGate, frameCapFromLocation } from '../src/game/frameCap';

/**
 * The frame cap, checked against the display rates it actually meets.
 *
 * The failure this guards is specific and easy to ship: a cap implemented as
 * "has the interval elapsed?" rejects the 33.4 ms frame on a 60 Hz display
 * about as often as it accepts it, and delivers 20 fps while looking correct in
 * the code. Simulating real frame arrivals is the only way to catch that.
 */

/** Runs `seconds` of frames arriving at `displayHz` and counts what is drawn. */
function renderedFrames(fps: number, displayHz: number, seconds = 2): number {
  const gate = createFrameGate(fps);
  const step = 1000 / displayHz;
  let drawn = 0;

  for (let i = 0; i < seconds * displayHz; i += 1) {
    // Real frames are not perfectly spaced; a little jitter is the normal case.
    const jitter = (i % 3) * 0.4 - 0.4;
    if (gate.shouldRender(i * step + jitter)) {
      drawn += 1;
    }
  }
  return drawn / seconds;
}

describe('the frame gate hits its target on real displays', () => {
  it('gives 30 fps on a 60 Hz display, not 20', () => {
    expect(renderedFrames(30, 60)).toBeGreaterThanOrEqual(29);
    expect(renderedFrames(30, 60)).toBeLessThanOrEqual(31);
  });

  it('gives 30 fps on a 120 Hz ProMotion display', () => {
    expect(renderedFrames(30, 120)).toBeGreaterThanOrEqual(29);
    expect(renderedFrames(30, 120)).toBeLessThanOrEqual(31);
  });

  it('never asks for more frames than the display offers', () => {
    // A 60 fps target on a 30 Hz display should simply draw every frame.
    expect(renderedFrames(60, 30)).toBe(30);
  });

  it('draws everything when uncapped', () => {
    expect(renderedFrames(0, 60)).toBe(60);
  });

  it('draws the very first frame rather than waiting an interval', () => {
    expect(createFrameGate(30).shouldRender(0)).toBe(true);
  });

  it('does not owe a burst of frames after a long stall', () => {
    // A phone waking or a tab returning can leave a gap of seconds. The gate
    // must resume, not try to catch up on everything it missed.
    const gate = createFrameGate(30);
    gate.shouldRender(0);

    expect(gate.shouldRender(10_000)).toBe(true);
    // The next frame is one interval later, not immediately.
    expect(gate.shouldRender(10_005)).toBe(false);
    expect(gate.shouldRender(10_040)).toBe(true);
  });
});

describe('choosing the cap', () => {
  it('caps at the plan floor by default', () => {
    expect(frameCapFromLocation('')).toBe(FRAME_CAP.targetFps);
    expect(FRAME_CAP.targetFps).toBe(30);
  });

  it('can be raised for a side-by-side comparison', () => {
    expect(frameCapFromLocation('?fps=60')).toBe(60);
  });

  it('treats zero and nonsense as uncapped, rather than freezing the game', () => {
    // A cap of 0 must mean "draw everything", never "draw nothing".
    expect(frameCapFromLocation('?fps=0')).toBe(0);
    expect(frameCapFromLocation('?fps=banana')).toBe(0);
    expect(frameCapFromLocation('?fps=-5')).toBe(0);
  });
});
