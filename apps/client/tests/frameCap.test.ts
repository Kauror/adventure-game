import { describe, expect, it } from 'vitest';

import type { FrameCappable } from '../src/game/frameCap';
import { FRAME_CAP, applyFrameCap, frameCapFromLocation } from '../src/game/frameCap';

/**
 * The frame cap.
 *
 * These are mostly here because of what the previous implementation did. It
 * capped the rate by skipping `scene.render()` inside the render loop, and by
 * every test written at the time it worked: 30 frames a second went past on a
 * 60 Hz display, and the reported rate agreed.
 *
 * The game ran at half speed anyway. Babylon recomputes its delta in
 * `beginFrame()`, which runs on every animation tick — before the callback the
 * skipping happened in — so a drawn frame was told 17 ms had passed when 33 ms
 * really had. Every test passed while a player watched the world move in slow
 * motion.
 *
 * No test that counts frames can catch that, so these assert the *mechanism*
 * instead: the cap must be handed to the engine, which applies it before it
 * samples the clock.
 */

function fakeEngine(): FrameCappable {
  return { maxFPS: undefined };
}

describe('the cap is enforced by the engine, not by dropping renders', () => {
  it('hands the target to the engine', () => {
    // The whole fix. If this is not set, the cap is being enforced somewhere
    // that runs after Babylon has already measured the frame, and the
    // simulation will run slow by exactly the ratio of the two rates.
    const engine = fakeEngine();
    applyFrameCap(engine, 30);
    expect(engine.maxFPS).toBe(30);
  });

  it('uncaps with undefined, never with zero', () => {
    // Babylon tests `maxFPS === undefined` for "no cap". A zero there sets a
    // minimum frame time of MAX_VALUE, which means never drawing again.
    const engine = fakeEngine();
    applyFrameCap(engine, 0);
    expect(engine.maxFPS).toBeUndefined();
  });

  it('carries the target for anything that wants to display it', () => {
    expect(applyFrameCap(fakeEngine(), 30).targetFps).toBe(30);
    expect(applyFrameCap(fakeEngine(), 0).targetFps).toBe(0);
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

describe('the rate it reports is the rate it draws', () => {
  /** Feeds `seconds` of frames arriving at `displayHz` and returns the meter. */
  function run(displayHz: number, seconds = 3) {
    const cap = applyFrameCap(fakeEngine(), 30);
    const step = 1000 / displayHz;
    for (let i = 0; i < seconds * displayHz; i += 1) {
      cap.recordFrame(i * step);
    }
    return cap;
  }

  it('reports the rate frames actually arrived at', () => {
    expect(Math.round(run(30).renderedFps())).toBe(30);
  });

  it('reports the truth when the device cannot keep up', () => {
    // A 30 fps target delivering 20 must read as 20, never as the target: the
    // only reason this number is on screen is to tell a capped 30 from a
    // struggling one.
    expect(Math.round(run(20).renderedFps())).toBe(20);
  });

  it('reads zero before any frame has been drawn', () => {
    expect(applyFrameCap(fakeEngine(), 30).renderedFps()).toBe(0);
  });

  it('does not average in a stall, which is not a frame rate', () => {
    const cap = applyFrameCap(fakeEngine(), 30);
    for (let i = 0; i < 60; i += 1) {
      cap.recordFrame(i * (1000 / 30));
    }
    const steady = cap.renderedFps();

    // The phone slept for four seconds.
    cap.recordFrame(60 * (1000 / 30) + 4000);
    expect(cap.renderedFps()).toBeCloseTo(steady, 5);
  });
});
