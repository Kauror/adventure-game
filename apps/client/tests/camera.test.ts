import { DODGE, ENEMY } from '@adventure/game-core';
import { describe, expect, it } from 'vitest';

import { GAME_CAMERA, extentFromSearch } from '../src/game/camera';
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
    expect(GAME_CAMERA.verticalExtentMetres).toBe(5.7);
  });

  it('keeps the wind-up on screen, which is the constraint that matters', () => {
    /*
     * This assertion used to read `>= 8`, "because the enemy aggroes from 8 m",
     * and that was the wrong rule. Aggro is only where the enemy notices the
     * player and starts walking, at 2.6 m/s against a player who runs at 4.5 —
     * it can begin that walk off-screen and arrive in view without ever being a
     * surprise.
     *
     * What must be visible is the wind-up, which starts at `attackRangeMetres`
     * and runs for `windUpSeconds`. PLAN §11 asks for anticipation rather than
     * reaction, and a telegraph the player cannot see is exactly the bug the
     * first playtest reported about the old circular one.
     *
     * At a tilt of θ from the horizon, an orthographic vertical extent V covers
     * V / sin(θ) of ground — check it against the top-down case, where θ = 90°
     * and the two are equal.
     */
    const groundSpan =
      GAME_CAMERA.verticalExtentMetres / Math.sin(degreesToRadians(GAME_CAMERA.tiltDegrees));
    const halfSpan = groundSpan / 2;

    // The strike range, plus a metre so the swing is read rather than discovered.
    expect(halfSpan).toBeGreaterThanOrEqual(ENEMY.attackRangeMetres + 1);
  });

  it('keeps a sidestep on screen, since that is the taught counter', () => {
    // The telegraph is a 55-degree frontal wedge and the answer to it is to step
    // out of the wedge, not to run: a 3 m dodge sideways must leave both fighters
    // framed. Horizontal is the roomy axis — world X maps to screen without the
    // tilt's foreshortening — so this is the assertion that has slack, and it is
    // still worth pinning, because it is what stops the frame narrowing until
    // the counter stops being readable.
    const narrowLandscape = 16 / 9;
    const bounds = orthoBounds(GAME_CAMERA.verticalExtentMetres, narrowLandscape);

    expect(bounds.right).toBeGreaterThanOrEqual(DODGE.distanceMetres);
  });

  it('is a usable, non-degenerate camera', () => {
    expect(GAME_CAMERA.tiltDegrees).toBeGreaterThan(0);
    expect(GAME_CAMERA.tiltDegrees).toBeLessThan(90);
    expect(GAME_CAMERA.verticalExtentMetres).toBeGreaterThan(0);
  });
});

describe('extentFromSearch', () => {
  it('defaults to the settled framing', () => {
    expect(extentFromSearch('')).toBe(5.7);
    expect(extentFromSearch('?debug=1')).toBe(5.7);
  });

  it('still understands the old wide comparison', () => {
    expect(extentFromSearch('?zoom=wide')).toBe(12);
  });

  it('takes a number of metres, so framing can be settled on the device', () => {
    // The camera was tuned against a 1.8 m box and the character is now 1.3 m,
    // which is the whole reason this exists.
    expect(extentFromSearch('?zoom=7.5')).toBe(7.5);
    expect(extentFromSearch('?zoom=6.5&debug=1')).toBe(6.5);
  });

  it('ignores nonsense rather than producing a degenerate camera', () => {
    expect(extentFromSearch('?zoom=0')).toBe(5.7);
    expect(extentFromSearch('?zoom=-4')).toBe(5.7);
    expect(extentFromSearch('?zoom=500')).toBe(5.7);
    expect(extentFromSearch('?zoom=lähedale')).toBe(5.7);
  });
});
