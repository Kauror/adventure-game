/**
 * Caps how often the game renders.
 *
 * Babylon draws on `requestAnimationFrame`, which means it will happily run at
 * whatever the display offers — 60 Hz, or 120 on a ProMotion iPhone. For a
 * fixed-camera game with six-box characters that is mostly wasted: the extra
 * frames buy very little movement fidelity and cost battery and heat, and heat
 * is the thing that turns a good thirty-minute session into a bad one on a phone
 * held in a child's hands.
 *
 * There is a real trade against it. Input is read once per rendered frame, so a
 * 30 fps cap roughly doubles the worst-case delay between a thumb moving and the
 * game noticing — from ~17 ms to ~33 ms. `?fps=60` restores the uncapped
 * behaviour for a side-by-side.
 *
 * **The first version of this made the game run in slow motion, and how it did
 * is worth keeping written down.**
 *
 * It was a gate: the render loop ran at full rate and `scene.render()` was
 * skipped on alternate ticks. The reasoning was that a skipped frame simply
 * hands the simulation a 33 ms delta instead of a 17 ms one. That was wrong,
 * because of *where Babylon measures time*. `AbstractEngine._processFrame`
 * calls `beginFrame()` — which recomputes `_deltaTime` — on **every**
 * `requestAnimationFrame` tick, before it invokes the render callback where the
 * gate lived. So the delta was always one *tick*, never one *rendered frame*:
 * every drawn frame was told 17 ms had passed when 33 ms really had, and the
 * entire world moved at half speed. On a 120 Hz phone, quarter speed.
 *
 * The cap is now `engine.maxFPS`, which Babylon tests in `_isOverFrameTime`
 * **before** `beginFrame`. A skipped tick therefore never touches the clock,
 * and a rendered frame is told exactly how long it has been since the last
 * rendered frame. The engine's accumulator also absorbs the arrival jitter that
 * the old `earlyTolerance` existed to paper over.
 *
 * The lesson is not "use the built-in one". It is that a frame cap is a change
 * to the **clock**, and a clock cannot be reasoned about from the outside: two
 * minutes reading where the engine samples time would have caught this before a
 * child ever played it.
 */

export const FRAME_CAP = {
  /** Frames per second the game aims for. PLAN §26 sets 30 as the floor. */
  targetFps: 30,
} as const;

/** `?fps=60` (or any number) overrides the cap; `?fps=0` removes it. */
export function frameCapFromLocation(search: string = window.location.search): number {
  const requested = new URLSearchParams(search).get('fps');
  if (requested === null) {
    return FRAME_CAP.targetFps;
  }

  const parsed = Number.parseInt(requested, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    // `?fps=0` means "as fast as the display will go".
    return 0;
  }
  return parsed;
}

/**
 * The part of the engine this needs.
 *
 * Structural rather than `AbstractEngine`, so the cap can be tested without
 * standing up a WebGL context to find out whether a number was assigned.
 */
export interface FrameCappable {
  maxFPS: number | undefined;
}

export interface FrameCap {
  /** Frames per second being aimed for; 0 when uncapped. */
  readonly targetFps: number;
  /**
   * Frames per second actually drawn.
   *
   * Measured here rather than taken from `engine.getFps()` because the two used
   * to disagree: Babylon opened and closed a frame on every animation tick, so
   * a 30 fps cap on a 60 Hz screen reported 60. `maxFPS` fixes that at the
   * source, but the whole value of this number is telling a capped 30 from a
   * struggling 30, and it is worth measuring the thing we actually care about
   * rather than inheriting it.
   */
  readonly renderedFps: () => number;
  /** Call once per drawn frame, so the reading counts renders and not ticks. */
  readonly recordFrame: (nowMs: number) => void;
}

/** Smoothing for the rendered-rate estimate: readable on a phone, not flickery. */
const RATE_SMOOTHING = 0.12;

/** Gaps longer than this are a stall, not a frame rate, and are not averaged in. */
const STALL_MS = 500;

/**
 * Caps the engine's frame rate and returns a meter for what it actually
 * achieved.
 *
 * `maxFPS` is `undefined` rather than 0 for "uncapped": that is the value
 * Babylon tests for, and 0 there means *never render*.
 */
export function applyFrameCap(engine: FrameCappable, fps: number): FrameCap {
  engine.maxFPS = fps > 0 ? fps : undefined;

  let lastMs = Number.NaN;
  let smoothedMs = 0;

  return {
    targetFps: fps > 0 ? fps : 0,
    renderedFps: () => (smoothedMs > 0 ? 1000 / smoothedMs : 0),
    recordFrame: (nowMs) => {
      const delta = nowMs - lastMs;
      lastMs = nowMs;

      // A phone waking, or a tab returning, is not a frame rate.
      if (!Number.isFinite(delta) || delta <= 0 || delta > STALL_MS) {
        return;
      }
      smoothedMs = smoothedMs === 0 ? delta : smoothedMs + (delta - smoothedMs) * RATE_SMOOTHING;
    },
  };
}
