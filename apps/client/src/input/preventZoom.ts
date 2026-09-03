/**
 * Stops the browser zooming the game **by accident**, and deliberately leaves
 * the deliberate path alone.
 *
 * A mistap during a fight zoomed the page on a real iPhone. The first fix
 * blocked everything — double-tap *and* pinch — and that was a worse bug than
 * the one it fixed: iOS Safari remembers a page zoom per site, so a phone that
 * was already zoomed stayed zoomed, and the only gesture that could undo it had
 * just been taken away. Every screen, including the rotate prompt, came up
 * magnified with no way out.
 *
 * So the rule now matches the actual complaint. A mistap is **one finger**:
 *
 *  - **double-tap zoom** is the accident, and `touch-action` across the `#app`
 *    subtree (see styles.css) prevents it;
 *  - **pinch zoom** takes two fingers moving apart on purpose. Nobody does that
 *    by mistake, and it is the only way back from a zoom the browser is already
 *    holding. It stays.
 *
 * The viewport meta tag is no help either way: iOS Safari has ignored
 * `user-scalable=no` and `maximum-scale` since iOS 10.
 *
 * `touch-action` turned out not to be enough. A player reported the zoom back
 * after five to seven quick taps — which is what combat is — on a build where
 * `#app *` was already `touch-action: none`. Whatever iOS is doing, it is not
 * honouring that for a fast sequence of taps, and `dblclick` never arrives to
 * be cancelled because Safari does not fire it for the gesture it decides is a
 * zoom.
 *
 * So the tap sequence is tracked directly and the second tap of a pair has its
 * default cancelled, which is the one thing Safari has always respected. Two
 * properties make this safe:
 *
 *  - **it only ever looks at single-finger taps**, so a deliberate two-finger
 *    pinch is untouched and remains the way back from a zoom the browser is
 *    already holding;
 *  - **it costs the game nothing**, because every control fires on
 *    `pointerdown` and the joystick on pointer events. Cancelling a `touchend`
 *    default suppresses the synthesised `click`, and gameplay does not use one.
 *    The debug panel does, so taps landing there are left alone.
 */

/** Two taps closer together than this are a double-tap, not two taps. */
const DOUBLE_TAP_MS = 350;

/** Taps inside this are ordinary buttons that want their click. */
const CLICKABLE_SELECTOR = '.ui-readout';

export function preventBrowserZoom(surface: HTMLElement): () => void {
  const block = (event: Event): void => {
    event.preventDefault();
  };

  // Kept for browsers that do fire it — Android Chrome does.
  surface.addEventListener('dblclick', block, { passive: false });

  // Null rather than 0: `timeStamp` is measured from page load, so a zero
  // sentinel makes the very first tap of a session look like the second half of
  // a double-tap and cancels it.
  let lastTapAt: number | null = null;

  const onTouchEnd = (event: TouchEvent): void => {
    // Any multi-finger gesture resets the sequence and is otherwise ignored.
    if (event.touches.length > 0 || event.changedTouches.length !== 1) {
      lastTapAt = null;
      return;
    }

    // Duck-typed rather than `instanceof Element`: this runs before any DOM
    // globals are guaranteed, and the tests deliberately have no document.
    const target = event.target as { closest?: (selector: string) => unknown } | null;
    if (typeof target?.closest === 'function' && target.closest(CLICKABLE_SELECTOR) != null) {
      lastTapAt = null;
      return;
    }

    const now = event.timeStamp;
    if (lastTapAt !== null && now - lastTapAt < DOUBLE_TAP_MS) {
      event.preventDefault();
      // Reset rather than carry the timestamp forward, so a burst of taps is a
      // series of independent pairs. Leaving it set would let one long burst
      // suppress every tap after the second, and the fourth tap of a fight is
      // not a zoom attempt.
      lastTapAt = null;
      return;
    }

    lastTapAt = now;
  };

  surface.addEventListener('touchend', onTouchEnd, { passive: false });

  return () => {
    surface.removeEventListener('dblclick', block);
    surface.removeEventListener('touchend', onTouchEnd);
  };
}
