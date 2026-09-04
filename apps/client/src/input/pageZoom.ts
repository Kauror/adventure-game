/**
 * Undoes the browser's page zoom when it happens by accident.
 *
 * **Prevention was tried four times and failed four times.** `touch-action:
 * none` across the whole `#app` subtree, the viewport meta, a `dblclick`
 * blocker, a tap-sequence guard — the page still ended up at `5.00×`, which is
 * WebKit's maximum, during ordinary fast tapping.
 *
 * The measurement that finally arrived explains why that number and not some
 * other: double-tap smart zoom fits the *tapped element* to the screen, and the
 * action buttons are 68 px circles on a ~390 px screen. 390 / 68 is about 5.7,
 * clamped to 5. It is the attack button doing it, during exactly the fast
 * tapping the game is made of.
 *
 * So this stops arguing with the gesture and repairs the result instead, which
 * has three advantages over another guess:
 *
 *  - it does not care *how* the zoom happened, so it covers the double-tap, the
 *    stray pinch, and the per-site zoom iOS restores from a previous session —
 *    which is the one that made a home-screen install unopenable in 0A.10;
 *  - it cannot trap anyone. The old fix pinned `maximum-scale` in the markup
 *    permanently, so a phone that came up zoomed had every escape disabled.
 *    Here the clamp exists for a few hundred milliseconds and is then removed,
 *    so the page is left as scalable as it was found;
 *  - it is **measurable**. `visualViewport.scale` says whether it worked.
 *
 * The clamp itself is the long-standing WebKit workaround: briefly declare
 * `maximum-scale=1`, let the engine re-evaluate the viewport, then restore the
 * original content attribute.
 */

/** Above this the page is meaningfully zoomed. Below it, floating-point noise. */
export const ZOOM_THRESHOLD = 1.02;

/**
 * How long the scale must sit still before it is corrected.
 *
 * Long enough not to fight a pinch in progress: the viewport fires `resize`
 * throughout a gesture, so each event pushes this back and the correction only
 * runs once the fingers have stopped.
 */
export const SETTLE_MS = 500;

/** How long the clamped viewport stays in place before being restored. */
export const CLAMP_MS = 350;

export function readPageZoom(): number {
  return window.visualViewport?.scale ?? 1;
}

/**
 * Whether a scale reading should be corrected.
 *
 * Pure, so the decision can be tested without a viewport: everything that made
 * this bug survive four attempts was in the part that could not be run offline.
 */
export function shouldResetZoom(scale: number): boolean {
  return Number.isFinite(scale) && scale > ZOOM_THRESHOLD;
}

/**
 * Clamps the page back to 1x by rewriting the viewport meta and restoring it.
 *
 * Restoring matters as much as clamping. Left in place, `maximum-scale=1` is
 * precisely the trap of 0A.10.
 */
export function resetPageZoom(): void {
  const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  if (meta === null) {
    return;
  }

  const original = meta.getAttribute('content');
  if (original === null || original.includes('maximum-scale')) {
    // Already clamped by someone else; leave it rather than restore a value
    // that was never ours.
    return;
  }

  meta.setAttribute('content', `${original}, maximum-scale=1, user-scalable=no`);
  window.setTimeout(() => {
    meta.setAttribute('content', original);
  }, CLAMP_MS);
}

export interface ZoomGuard {
  readonly dispose: () => void;
}

/**
 * Watches the visual viewport and corrects an unwanted zoom once it settles.
 *
 * `onChange` is called with every reading so the interface can say what is
 * happening — a silent correction that fails looks identical to no correction
 * at all, and this bug has already cost four rounds of guessing.
 */
export function createZoomGuard(onChange: (scale: number) => void): ZoomGuard {
  const viewport = window.visualViewport;
  if (viewport === null || viewport === undefined) {
    return { dispose: () => undefined };
  }

  let settleTimer: number | undefined;
  let restoring = false;

  const correctLater = (): void => {
    window.clearTimeout(settleTimer);
    settleTimer = window.setTimeout(() => {
      if (restoring || !shouldResetZoom(readPageZoom())) {
        return;
      }

      // Guards against a loop: the reset changes the scale, which fires another
      // resize, which would otherwise schedule another reset.
      restoring = true;
      resetPageZoom();
      window.setTimeout(() => {
        restoring = false;
        onChange(readPageZoom());
      }, CLAMP_MS * 2);
    }, SETTLE_MS);
  };

  const update = (): void => {
    onChange(readPageZoom());
    correctLater();
  };

  viewport.addEventListener('resize', update);
  viewport.addEventListener('scroll', update);
  update();

  return {
    dispose: () => {
      window.clearTimeout(settleTimer);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    },
  };
}
