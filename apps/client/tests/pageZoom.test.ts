import { describe, expect, it } from 'vitest';

import { SETTLE_MS, ZOOM_THRESHOLD, shouldResetZoom } from '../src/input/pageZoom';

/**
 * The zoom correction's decision, tested where it can actually be tested.
 *
 * Everything that let this bug survive four attempts lived in the part that
 * only exists on a real phone. What can be pinned down offline is the rule:
 * when is a scale reading wrong, and when is it just noise.
 */
describe('shouldResetZoom', () => {
  it('leaves an unzoomed page alone', () => {
    expect(shouldResetZoom(1)).toBe(false);
  });

  it('ignores floating-point noise around 1', () => {
    // The viewport reports fractional scales after a rotation; correcting those
    // would clamp the viewport constantly for no visible reason.
    expect(shouldResetZoom(1.001)).toBe(false);
    expect(shouldResetZoom(ZOOM_THRESHOLD)).toBe(false);
  });

  it('corrects the zoom that was actually reported from the device', () => {
    // 5.00x, WebKit's maximum: a 68 px button double-tapped on a 390 px screen.
    expect(shouldResetZoom(5)).toBe(true);
  });

  it('corrects a mild zoom too, since any zoom breaks a fixed layout', () => {
    expect(shouldResetZoom(1.3)).toBe(true);
  });

  it('never acts on a reading that is not a number', () => {
    // `visualViewport` is absent or lying in enough places that this matters:
    // clamping the viewport on a NaN would fight the user forever.
    expect(shouldResetZoom(Number.NaN)).toBe(false);
    expect(shouldResetZoom(Number.POSITIVE_INFINITY)).toBe(false);
  });

  it('waits long enough not to fight a pinch in progress', () => {
    // The viewport fires resize throughout a gesture and each one pushes the
    // timer back, so this only has to outlast the gaps *within* a pinch.
    expect(SETTLE_MS).toBeGreaterThanOrEqual(300);
  });
});
