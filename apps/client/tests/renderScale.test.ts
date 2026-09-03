import { describe, expect, it } from 'vitest';

import {
  RENDER_SCALE,
  effectiveDevicePixelRatio,
  hardwareScalingFor,
} from '../src/game/renderScale';

describe('effectiveDevicePixelRatio', () => {
  it('caps a phone reporting 3x at the ratio limit', () => {
    // iPhone 13 mini, landscape.
    expect(effectiveDevicePixelRatio(812, 375, 3)).toBe(RENDER_SCALE.maxDevicePixelRatio);
  });

  it('never renders below the CSS resolution', () => {
    // A huge window at 1x is still allowed to be sharp, just not supersampled.
    expect(effectiveDevicePixelRatio(3840, 2160, 1)).toBe(1);
  });

  it('leaves a modest 1x display alone', () => {
    expect(effectiveDevicePixelRatio(900, 460, 1)).toBe(1);
  });

  it('holds the pixel budget on a large screen even under the ratio cap', () => {
    // A 1440x900 tablet at 2x would be 5.2 M pixels; the budget wins.
    const ratio = effectiveDevicePixelRatio(1440, 900, 2);
    expect(ratio).toBeLessThan(RENDER_SCALE.maxDevicePixelRatio);
    expect(1440 * 900 * ratio * ratio).toBeCloseTo(RENDER_SCALE.maxPixels, 0);
  });

  it('lets ?dpr override both limits in either direction', () => {
    expect(effectiveDevicePixelRatio(812, 375, 3, '?dpr=3')).toBe(3);
    expect(effectiveDevicePixelRatio(812, 375, 3, '?dpr=1')).toBe(1);
  });

  it('ignores nonsense rather than rendering a zero-sized buffer', () => {
    expect(effectiveDevicePixelRatio(812, 375, 3, '?dpr=0')).toBe(2);
    expect(effectiveDevicePixelRatio(812, 375, 3, '?dpr=banana')).toBe(2);
  });
});

describe('hardwareScalingFor', () => {
  it('inverts the ratio, which is the convention Babylon uses', () => {
    expect(hardwareScalingFor(812, 375, 3)).toBeCloseTo(0.5);
    expect(hardwareScalingFor(900, 460, 1)).toBeCloseTo(1);
  });
});
