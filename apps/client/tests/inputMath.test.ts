import { describe, expect, it } from 'vitest';

import { applyDeadZone, clampMagnitude, isIdle, magnitude, ZERO } from '../src/input/inputMath';

describe('applyDeadZone', () => {
  it('suppresses drift inside the dead zone', () => {
    expect(applyDeadZone({ x: 0.1, y: 0 }, 0.2)).toEqual(ZERO);
    expect(applyDeadZone({ x: 0.1, y: 0.1 }, 0.2)).toEqual(ZERO);
    expect(applyDeadZone(ZERO, 0.2)).toEqual(ZERO);
  });

  it('rescales from the dead-zone edge so the slowest speed is genuinely slow', () => {
    // Without rescaling this would jump straight to 0.5 the moment it crossed
    // the dead zone, and a child could never creep up to an edge.
    const justOutside = applyDeadZone({ x: 0.21, y: 0 }, 0.2);
    expect(magnitude(justOutside)).toBeLessThan(0.05);
  });

  it('still reaches full deflection at the rim', () => {
    const full = applyDeadZone({ x: 1, y: 0 }, 0.2);
    expect(magnitude(full)).toBeCloseTo(1, 6);
  });

  it('preserves direction', () => {
    const result = applyDeadZone({ x: 0.6, y: 0.8 }, 0.2);
    // Original direction is (0.6, 0.8), already a unit vector.
    expect(result.x / magnitude(result)).toBeCloseTo(0.6, 6);
    expect(result.y / magnitude(result)).toBeCloseTo(0.8, 6);
  });

  it('is radial, not per-axis: a small diagonal nudge is still ignored', () => {
    // Both axes are below 0.2 individually and together, so nothing should move.
    expect(applyDeadZone({ x: 0.14, y: 0.14 }, 0.25)).toEqual(ZERO);
  });

  it('never exceeds unit length even for an over-deflected stick', () => {
    expect(magnitude(applyDeadZone({ x: 2, y: 2 }, 0.2))).toBeLessThanOrEqual(1.000001);
  });

  it('tolerates a nonsensical dead zone instead of dividing by zero', () => {
    expect(Number.isFinite(magnitude(applyDeadZone({ x: 1, y: 0 }, 1)))).toBe(true);
    expect(Number.isFinite(magnitude(applyDeadZone({ x: 1, y: 0 }, -5)))).toBe(true);
  });
});

describe('clampMagnitude', () => {
  it('leaves short vectors untouched', () => {
    expect(clampMagnitude({ x: 0.3, y: 0.4 })).toEqual({ x: 0.3, y: 0.4 });
  });

  it('clamps a diagonal to unit length', () => {
    const clamped = clampMagnitude({ x: 1, y: 1 });
    expect(magnitude(clamped)).toBeCloseTo(1, 6);
    expect(clamped.x).toBeCloseTo(clamped.y, 6);
  });

  it('handles the zero vector', () => {
    expect(clampMagnitude(ZERO)).toEqual(ZERO);
  });
});

describe('isIdle', () => {
  it('recognises no input', () => {
    expect(isIdle(ZERO)).toBe(true);
    expect(isIdle({ x: 0, y: 0.001 })).toBe(false);
  });
});
