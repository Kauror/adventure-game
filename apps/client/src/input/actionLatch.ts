/**
 * A queued action press.
 *
 * Actions are *edges*, not levels: a key or gamepad button reports "held", but
 * the game wants "was just pressed", exactly once. This turns one into the
 * other, and adds a short queue so a press made slightly too early still counts.
 *
 * That forgiveness is the point. A five-year-old presses dodge when they see the
 * attack coming, not when the cooldown happens to end, and the acceptance
 * criterion asks for a dodge that works "without twitch-level timing".
 *
 * Pure and free of the DOM so the timing rules can actually be tested.
 */
export interface ActionLatch {
  /** Feeds the current held state; latches on a rising edge. */
  readonly edge: (held: boolean, nowMs: number) => void;
  /** Latches directly, for sources that are already edges (an on-screen button). */
  readonly press: (nowMs: number) => void;
  /** True at most once per press, and only while the press is still fresh. */
  readonly consume: (nowMs: number) => boolean;
  readonly isQueued: (nowMs: number) => boolean;
}

export function createActionLatch(bufferMs: number): ActionLatch {
  let heldLastFrame = false;
  let latchedAtMs: number | null = null;

  const fresh = (nowMs: number): boolean => latchedAtMs !== null && nowMs - latchedAtMs <= bufferMs;

  return {
    edge: (held, nowMs) => {
      if (held && !heldLastFrame) {
        latchedAtMs = nowMs;
      }
      heldLastFrame = held;
    },

    press: (nowMs) => {
      latchedAtMs = nowMs;
    },

    isQueued: (nowMs) => fresh(nowMs),

    consume: (nowMs) => {
      if (latchedAtMs === null) {
        return false;
      }
      // Stale presses are dropped rather than firing much later, which would
      // feel like the game acting on its own.
      const usable = fresh(nowMs);
      latchedAtMs = null;
      return usable;
    },
  };
}
