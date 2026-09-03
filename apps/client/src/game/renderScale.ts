/**
 * How many pixels the game is allowed to draw.
 *
 * Babylon was created with `adaptToDeviceRatio: true`, which renders at the
 * device pixel ratio — and the note left there said whether we could afford
 * full DPR was a measurement still to be made. This is that measurement's
 * answer: we cannot.
 *
 * A phone reports a ratio of 3. A 375x812 screen is therefore 1125x2436, which
 * is 2.7 million pixels — nine times what the same layout costs at ratio 1 —
 * and every one of them runs the fragment shader. Capping the frame rate at 30
 * did nothing for this, because the cost is per *pixel*, not per frame: half as
 * many frames of a load the GPU cannot finish is still a load it cannot finish.
 *
 * Two limits, and the tighter one wins:
 *
 *  - a **ratio cap**, because the return on sharpness falls off a cliff past 2x
 *    on a screen held at arm's length, especially for art authored as 64 px
 *    tiles and sampled with NEAREST — the pixels are meant to be visible;
 *  - a **pixel budget**, because a ratio cap alone still lets a large tablet
 *    ask for far more pixels than a small phone at the same ratio. The budget
 *    is what makes the worst case bounded rather than proportional to screen
 *    size.
 *
 * `?dpr=` overrides both, so the device baseline can compare honestly.
 */

export const RENDER_SCALE = {
  /** Never render at more than this multiple of CSS pixels. */
  maxDevicePixelRatio: 2,

  /**
   * Total pixels per frame, at most.
   *
   * ~1.4 M is a 1624x864 backbuffer: comfortably above a phone's CSS resolution
   * at 2x, and it keeps a big tablet from quietly asking for four times the
   * work of the device this was tuned on.
   */
  maxPixels: 1_400_000,
} as const;

/** `?dpr=1` pins the ratio; `?dpr=3` lifts the cap for a side-by-side. */
export function requestedDevicePixelRatio(search: string): number | null {
  const requested = new URLSearchParams(search).get('dpr');
  if (requested === null) {
    return null;
  }

  const parsed = Number.parseFloat(requested);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * The pixel ratio the game should actually render at.
 *
 * Never goes below 1: a backbuffer smaller than the CSS box is blurry in a way
 * players read as a broken game rather than a fast one, and no phone this
 * targets is slow enough to need it.
 */
export function effectiveDevicePixelRatio(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  search = '',
): number {
  const override = requestedDevicePixelRatio(search);
  if (override !== null) {
    return override;
  }

  const capped = Math.min(devicePixelRatio, RENDER_SCALE.maxDevicePixelRatio);

  const cssPixels = Math.max(1, cssWidth * cssHeight);
  const affordable = Math.sqrt(RENDER_SCALE.maxPixels / cssPixels);

  return Math.max(1, Math.min(capped, affordable));
}

/**
 * The same figure as Babylon wants it: CSS pixels per rendered pixel, so a
 * ratio of 2 is a scaling level of 0.5.
 */
export function hardwareScalingFor(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
  search = '',
): number {
  return 1 / effectiveDevicePixelRatio(cssWidth, cssHeight, devicePixelRatio, search);
}
