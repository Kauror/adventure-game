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
 * game noticing — from ~17 ms to ~33 ms. The playtest called movement
 * responsiveness good at 60, so this is worth measuring rather than assuming;
 * `?fps=60` restores the uncapped behaviour for a side-by-side, which is exactly
 * the comparison the 0A.12 device baseline exists to make.
 *
 * Skipping a frame skips the *simulation* too, because the game steps inside
 * `onBeforeRenderObservable`. That is correct rather than a compromise: the step
 * simply receives a 33 ms delta instead of a 17 ms one, and `stepMovement`
 * already caps a frame at 100 ms so nothing can tunnel through a wall.
 */

export const FRAME_CAP = {
  /** Frames per second the game aims for. PLAN §26 sets 30 as the floor. */
  targetFps: 30,

  /**
   * How early a frame may arrive and still be drawn, as a fraction of the
   * interval.
   *
   * Without this the cap is far worse than it looks. On a 60 Hz display frames
   * land every ~16.7 ms, so a strict "has 33.3 ms passed?" test rejects the
   * frame at 33.4 ms roughly as often as it accepts it — and the result is
   * 20 fps, not 30. Accepting a frame that is within 10% of due collapses that
   * jitter without letting the rate drift upward.
   */
  earlyTolerance: 0.9,
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

export interface FrameGate {
  /** True when this frame should be drawn. Advances the clock when it is. */
  readonly shouldRender: (nowMs: number) => boolean;
  /** Frames per second being aimed for; 0 when uncapped. */
  readonly targetFps: number;
}

/**
 * A gate that lets roughly `fps` frames through per second.
 *
 * The clock advances to the time the frame was *due*, not the time it arrived,
 * so a late frame does not push every subsequent one later and quietly turn a
 * 30 fps cap into 28.
 */
export function createFrameGate(fps: number): FrameGate {
  if (fps <= 0) {
    return { shouldRender: () => true, targetFps: 0 };
  }

  const interval = 1000 / fps;
  // How early a frame may arrive and still count as due.
  const slack = interval * (1 - FRAME_CAP.earlyTolerance);
  let due = Number.NEGATIVE_INFINITY;

  return {
    targetFps: fps,
    shouldRender: (nowMs) => {
      if (nowMs + slack < due) {
        return false;
      }

      // A long stall — a phone waking, a tab returning — must not leave the
      // gate owing a burst of frames it will never catch up on.
      due = nowMs - due > interval * 4 ? nowMs + interval : due + interval;
      return true;
    },
  };
}
