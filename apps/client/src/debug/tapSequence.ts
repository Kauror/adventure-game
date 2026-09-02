/**
 * A secret tap sequence.
 *
 * The debug tools have to be reachable on a phone with no keyboard and no
 * developer tools, but must never be somewhere a child can find by accident.
 * A run of quick taps in one corner is the usual answer: deliberate enough that
 * nobody stumbles into it, simple enough to do one-handed while the game is
 * misbehaving.
 *
 * Pure, so the timing rules can actually be tested.
 */
export interface TapSequence {
  /** Records a tap. Returns true on the tap that completes the sequence. */
  readonly tap: (nowMs: number) => boolean;
  /** Taps counted so far, for anything that wants to hint at progress. */
  readonly progress: () => number;
  readonly reset: () => void;
}

export function createTapSequence(requiredTaps = 4, windowMs = 1200): TapSequence {
  const taps = Math.max(2, requiredTaps);
  let count = 0;
  let lastTapMs = Number.NEGATIVE_INFINITY;

  return {
    tap: (nowMs) => {
      // A pause resets the run, so slow, idle prodding never accumulates into
      // an activation.
      count = nowMs - lastTapMs > windowMs ? 1 : count + 1;
      lastTapMs = nowMs;

      if (count >= taps) {
        count = 0;
        lastTapMs = Number.NEGATIVE_INFINITY;
        return true;
      }
      return false;
    },

    progress: () => count,

    reset: () => {
      count = 0;
      lastTapMs = Number.NEGATIVE_INFINITY;
    },
  };
}
