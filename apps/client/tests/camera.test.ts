import { describe, expect, it } from 'vitest';

import { GAME_CAMERA } from '../src/game/camera';
import { degreesToRadians, orthoBounds, tiltToBeta } from '../src/game/cameraMath';

describe('tiltToBeta', () => {
  it('converts tilt from the horizon into Babylon beta (measured from +Y)', () => {
    // A 45 degree tilt sits halfway.
    expect(tiltToBeta(45)).toBeCloseTo(degreesToRadians(45), 5);
    // The chosen camera: 55 degrees down from the horizon.
    expect(tiltToBeta(55)).toBeCloseTo(degreesToRadians(35), 5);
    // Shallower tilt means a larger beta — the camera drops towards the horizon.
    expect(tiltToBeta(40)).toBeGreaterThan(tiltToBeta(55));
  });

  it('clamps away from straight-down and horizon-level, where the camera degenerates', () => {
    // beta of exactly 0 or PI/2 makes an ArcRotateCamera misbehave, so tilt is
    // clamped to [0.1, 89.9] degrees. Straight down therefore lands just shy of 0.
    expect(tiltToBeta(90)).toBeCloseTo(degreesToRadians(0.1), 6);
    expect(tiltToBeta(90)).toBeGreaterThan(0);

    expect(tiltToBeta(0)).toBeCloseTo(degreesToRadians(89.9), 6);
    expect(tiltToBeta(0)).toBeLessThan(Math.PI / 2);

    // Nonsense input is clamped rather than producing an unusable camera.
    expect(tiltToBeta(1000)).toBeCloseTo(tiltToBeta(90), 10);
    expect(tiltToBeta(-1000)).toBeCloseTo(tiltToBeta(0), 10);
  });
});

describe('orthoBounds', () => {
  it('keeps the vertical extent fixed and widens horizontally with the aspect', () => {
    const bounds = orthoBounds(12, 2);

    expect(bounds.top).toBe(6);
    expect(bounds.bottom).toBe(-6);
    expect(bounds.right).toBe(12);
    expect(bounds.left).toBe(-12);
  });

  it('is symmetric about the target', () => {
    const bounds = orthoBounds(9, 1.6);
    expect(bounds.left).toBe(-bounds.right);
    expect(bounds.bottom).toBe(-bounds.top);
  });

  it('shows a wider phone more world rather than smaller world', () => {
    // A character must look the same size on a phone and on a tablet.
    const phone = orthoBounds(12, 19.5 / 9);
    const tablet = orthoBounds(12, 4 / 3);

    expect(phone.top).toBe(tablet.top);
    expect(phone.right).toBeGreaterThan(tablet.right);
  });

  it('survives a degenerate aspect ratio instead of producing NaN', () => {
    for (const aspect of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      const bounds = orthoBounds(12, aspect);
      expect(Number.isFinite(bounds.left)).toBe(true);
      expect(Number.isFinite(bounds.right)).toBe(true);
    }
  });
});

describe('GAME_CAMERA', () => {
  it('is the configuration settled by ADR 0005', () => {
    // The tilt is the settled part and did not move. The framing did: 12 m read
    // as "distant rather than personal" on a real phone, so the default is now
    // 9 m — about 25% closer — with the old value still reachable as
    // `?zoom=wide` for comparison.
    expect(GAME_CAMERA.tiltDegrees).toBe(55);
    expect(GAME_CAMERA.verticalExtentMetres).toBe(9);
  });

  it('still frames more than the fight itself', () => {
    // A closer camera must not become a keyhole: the player has to see enough
    // of the arena to read walls and plan a dodge, and the enemy aggroes from
    // 8 m away. Anything under two tiles of margin around that is too tight.
    expect(GAME_CAMERA.verticalExtentMetres).toBeGreaterThanOrEqual(8);
  });

  it('is a usable, non-degenerate camera', () => {
    expect(GAME_CAMERA.tiltDegrees).toBeGreaterThan(0);
    expect(GAME_CAMERA.tiltDegrees).toBeLessThan(90);
    expect(GAME_CAMERA.verticalExtentMetres).toBeGreaterThan(0);
  });
});
