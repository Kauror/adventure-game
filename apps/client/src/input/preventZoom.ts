/**
 * Stops the browser zooming the game.
 *
 * A mistap during a fight zoomed the page on a real iPhone, and — because the
 * layout is fixed and nothing scrolls — there was then nothing to pinch or pan
 * back out with. The only escape was rotating the phone twice. For a
 * seven-year-old mid-fight that is the end of the session.
 *
 * The viewport meta tag does **not** prevent this. iOS Safari has deliberately
 * ignored `user-scalable=no` and `maximum-scale` since iOS 10, for accessibility
 * reasons, so `index.html` reads as though the problem is handled when it is
 * not. Two mechanisms remain, and both are needed:
 *
 *  - **double-tap zoom** is governed by `touch-action`, set across the whole
 *    `#app` subtree in styles.css;
 *  - **pinch zoom** is only preventable through Safari's non-standard
 *    `gesturestart` / `gesturechange` / `gestureend` events, which is what this
 *    module handles.
 *
 * Note what it deliberately does **not** do: cancel multi-touch `touchmove`.
 * That is the usual advice and it would break the game outright — steering with
 * one thumb while attacking with the other *is* a two-finger gesture, and
 * cancelling those touches would take the pointer events with them.
 *
 * Scoped to the game surface, so the in-page console can still be pinched and
 * scrolled: it is the only way to read anything on a phone, and shrinking it to
 * fit is sometimes the only way to use it.
 */

/** Safari-only events; absent everywhere else, which is harmless. */
const GESTURES = ['gesturestart', 'gesturechange', 'gestureend'] as const;

export function preventBrowserZoom(surface: HTMLElement): () => void {
  const block = (event: Event): void => {
    event.preventDefault();
  };

  for (const type of GESTURES) {
    // Not passive: a passive listener cannot preventDefault, and the browser
    // treats gesture listeners as passive by default in some versions.
    surface.addEventListener(type, block, { passive: false });
  }

  // Belt and braces for browsers that still map a fast double tap onto zoom
  // despite `touch-action`. Harmless where it is already handled.
  surface.addEventListener('dblclick', block, { passive: false });

  return () => {
    for (const type of GESTURES) {
      surface.removeEventListener(type, block);
    }
    surface.removeEventListener('dblclick', block);
  };
}
