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
 * What is left here is the double-tap belt-and-braces for browsers that ignore
 * `touch-action`, and nothing else. If accidental pinches during two-thumb play
 * turn out to be real, the answer is to block gestures that *start on a
 * control*, not to take the escape hatch away again.
 */

export function preventBrowserZoom(surface: HTMLElement): () => void {
  const block = (event: Event): void => {
    event.preventDefault();
  };

  // Double-tap only. Deliberate pinch is left working on purpose — see above.
  surface.addEventListener('dblclick', block, { passive: false });

  return () => {
    surface.removeEventListener('dblclick', block);
  };
}
