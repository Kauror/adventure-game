/**
 * Hit stop: a very brief freeze on impact.
 *
 * The cheapest and most effective piece of game feel there is. Stopping the
 * world for a few dozen milliseconds is what makes a hammer land like a hammer
 * rather than like a number changing.
 *
 * **Client-only, and deliberately so.** This scales the *simulation* delta, and
 * the server (Stage 0B) will never freeze — so it must stay short enough that a
 * frozen client never drifts far enough to trip the server's displacement check
 * (PLAN §4). That is what `MAX_FREEZE_SECONDS` guards, and why hit stop must
 * never grow into "slow motion".
 */

/** Nothing may freeze longer than this, however many impacts land at once. */
export const MAX_FREEZE_SECONDS = 0.12;

/**
 * Remainders below this are treated as spent.
 *
 * Subtracting frame times from a duration leaves floating-point crumbs — a
 * freeze of 0.1 s consumed in 1/60 s frames ends on about 1e-17 s remaining,
 * which would otherwise count as a whole extra frozen frame.
 */
const SPENT_EPSILON = 1e-6;

export interface HitStop {
  /** Requests a freeze. Overlapping requests take the longest, never the sum. */
  readonly freeze: (seconds: number) => void;
  /**
   * Converts real elapsed time into simulation time.
   * Returns 0 while frozen, and the leftover on the frame a freeze ends.
   */
  readonly advance: (realDeltaSeconds: number) => number;
  readonly isFrozen: () => boolean;
}

export function createHitStop(): HitStop {
  let remaining = 0;

  return {
    freeze: (seconds) => {
      if (seconds <= 0) {
        return;
      }
      // Longest wins rather than accumulating: three hits in a row should feel
      // punchy, not turn the game into a slideshow.
      remaining = Math.min(MAX_FREEZE_SECONDS, Math.max(remaining, seconds));
    },

    advance: (realDeltaSeconds) => {
      if (realDeltaSeconds <= 0) {
        return 0;
      }
      if (remaining <= 0) {
        return realDeltaSeconds;
      }

      const consumed = Math.min(realDeltaSeconds, remaining);
      remaining -= consumed;
      if (remaining < SPENT_EPSILON) {
        remaining = 0;
      }
      // Hand back whatever is left of the frame, so a freeze that ends mid-frame
      // does not also swallow the rest of it.
      return realDeltaSeconds - consumed;
    },

    isFrozen: () => remaining > 0,
  };
}
