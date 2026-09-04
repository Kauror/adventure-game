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
 * A tap-sequence guard was tried here and **made the problem worse on the
 * device**, so it has been taken out again rather than defended. It cancelled
 * the default of the second tap of any quick pair, on the theory that Safari
 * was not honouring `touch-action` for fast sequences. The player's report
 * after it shipped was that the zoom was "even more broken".
 *
 * That is two guesses in a row at a bug that cannot be reproduced on a desktop,
 * and a third would be worse than none: every attempt so far has been a change
 * to how touches are handled during a fight, which is the most dangerous part
 * of the app to keep experimenting in blind.
 *
 * So what is left is `touch-action` in styles.css plus `dblclick` for browsers
 * that fire it, and the next move is **measurement, not another guess**. The
 * debug readout has shown `visualViewport.scale` on its viewport line since
 * 0A.1 — the `@1.00×` in "Vaade" — which answers the question nobody has yet
 * asked it: whether the page is zoomed at all, and by how much. Until that
 * number comes back from a real session, nothing here should change.
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
