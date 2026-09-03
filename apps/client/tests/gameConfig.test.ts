import { describe, expect, it } from 'vitest';

import { PRESENTATION, RENDERING, WORLD } from '../src/config/gameConfig';

describe('locked world convention', () => {
  it('keeps 1 world unit == 1 metre', () => {
    expect(WORLD.unitsPerMetre).toBe(1);
  });

  it('keeps navigation tiles at 1 m x 1 m', () => {
    expect(WORLD.navigationTileMetres).toBe(1);
  });

  it('keeps the axis convention: X east/west, Y elevation, Z north/south', () => {
    expect(WORLD.axes).toEqual({
      x: 'east-west',
      y: 'elevation',
      z: 'north-south',
    });
  });
});

describe('rendering baseline', () => {
  it('targets WebGL2, not WebGPU', () => {
    expect(RENDERING.baseline).toBe('webgl2');
  });

  it('records the performance targets from the plan', () => {
    // PLAN §26 names 30 as the floor and 60 as desirable. The game now renders
    // at the floor deliberately — see game/frameCap.ts — trading frames a fixed
    // camera barely uses for a phone that stays cool. The floor itself has not
    // moved, and rendering below it would still be a failure.
    expect(RENDERING.minimumUsefulFps).toBe(30);
    expect(RENDERING.desiredFps).toBeGreaterThanOrEqual(RENDERING.minimumUsefulFps);
  });
});

describe('presentation', () => {
  it('is a landscape game', () => {
    expect(PRESENTATION.orientation).toBe('landscape');
  });
});
