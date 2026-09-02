import { describe, expect, it } from 'vitest';

import {
  clampMovement,
  elevationAtWorld,
  isInsideGrid,
  isWalkableTile,
  isWalkableWorld,
  parseRegion,
  regionSizeMetres,
  spawnPoint,
  tileCentreToWorld,
  traceMovement,
  worldToTile,
} from '../src/index';
import { rawTestRegion } from './fixtures';

const region = parseRegion(rawTestRegion());

describe('region extent', () => {
  it('measures the grid in metres', () => {
    expect(regionSizeMetres(region)).toEqual({ width: 6, depth: 4 });
  });

  it('knows what is inside the grid', () => {
    expect(isInsideGrid(region, 0, 0)).toBe(true);
    expect(isInsideGrid(region, 5, 3)).toBe(true);
    expect(isInsideGrid(region, 6, 0)).toBe(false);
    expect(isInsideGrid(region, 0, 4)).toBe(false);
    expect(isInsideGrid(region, -1, 0)).toBe(false);
  });
});

describe('tile <-> world conversion', () => {
  it('places row 0 at the north (highest Z) edge', () => {
    // height is 4, so row 0 occupies z in [3, 4] and row 3 occupies z in [0, 1].
    expect(tileCentreToWorld(region, 0, 0)).toEqual({ x: 0.5, z: 3.5 });
    expect(tileCentreToWorld(region, 0, 3)).toEqual({ x: 0.5, z: 0.5 });
  });

  it('increases col with +X (east)', () => {
    expect(tileCentreToWorld(region, 5, 3)).toEqual({ x: 5.5, z: 0.5 });
  });

  it('round-trips every tile through world space', () => {
    for (let row = 0; row < region.height; row += 1) {
      for (let col = 0; col < region.width; col += 1) {
        const world = tileCentreToWorld(region, col, row);
        expect(worldToTile(region, world.x, world.z)).toEqual({ col, row });
      }
    }
  });

  it('maps points anywhere inside a tile to that tile, not just centres', () => {
    // Tile (1, 2) covers x in [1, 2] and z in [1, 2].
    expect(worldToTile(region, 1.01, 1.01)).toEqual({ col: 1, row: 2 });
    expect(worldToTile(region, 1.99, 1.99)).toEqual({ col: 1, row: 2 });
  });
});

describe('walkability', () => {
  it('reads the authored grid', () => {
    expect(isWalkableTile(region, 0, 0)).toBe(false); // border wall
    expect(isWalkableTile(region, 1, 1)).toBe(true); // floor
    expect(isWalkableTile(region, 2, 1)).toBe(true); // platform
    expect(isWalkableTile(region, 2, 2)).toBe(false); // interior wall
  });

  it('treats everything outside the grid as not walkable', () => {
    expect(isWalkableTile(region, -1, 1)).toBe(false);
    expect(isWalkableTile(region, 99, 1)).toBe(false);
    expect(isWalkableWorld(region, -10, -10)).toBe(false);
    expect(isWalkableWorld(region, 1000, 1000)).toBe(false);
  });

  it('reports elevation, including the raised platform', () => {
    expect(elevationAtWorld(region, 1.5, 2.5)).toBe(0); // floor
    expect(elevationAtWorld(region, 2.5, 2.5)).toBe(1); // platform
    expect(elevationAtWorld(region, -5, -5)).toBe(0); // outside
  });
});

describe('clampMovement', () => {
  const floor = { x: 1.5, z: 2.5 }; // tile (1, 1)

  it('allows movement across open ground', () => {
    expect(clampMovement(region, floor, { x: 2.5, z: 2.5 })).toEqual({ x: 2.5, z: 2.5 });
  });

  it('slides along a wall instead of stopping dead', () => {
    // Heading south-east into the wall at (2, 2): the east component survives.
    expect(clampMovement(region, floor, { x: 2.5, z: 1.5 })).toEqual({ x: 2.5, z: 2.5 });
  });

  it('refuses a move that is blocked on both axes', () => {
    // North-west from (1,1) is border wall on both sides.
    expect(clampMovement(region, floor, { x: 0.5, z: 3.5 })).toEqual(floor);
  });

  it('cannot leave the region', () => {
    expect(clampMovement(region, floor, { x: -3, z: 2.5 })).toEqual(floor);
    expect(clampMovement(region, floor, { x: 1.5, z: 99 })).toEqual(floor);
  });
});

describe('traceMovement', () => {
  it('reaches the destination when the path is clear', () => {
    const from = { x: 1.5, z: 2.5 };
    const to = { x: 4.5, z: 2.5 }; // straight along row 1, all walkable
    const result = traceMovement(region, from, to);
    expect(result.x).toBeCloseTo(4.5, 6);
    expect(result.z).toBeCloseTo(2.5, 6);
  });

  it('does not tunnel through a wall on a long step', () => {
    // Row 2 is "#.##.#": going from col 1 to col 4 crosses two wall tiles.
    // A naive destination-only check would teleport straight across them.
    const from = { x: 1.5, z: 1.5 };
    const to = { x: 4.5, z: 1.5 };
    const result = traceMovement(region, from, to);

    expect(result.x).toBeLessThan(2);
    expect(isWalkableWorld(region, result.x, result.z)).toBe(true);
    expect(worldToTile(region, result.x, result.z)).toEqual({ col: 1, row: 2 });
  });

  it('is a no-op when asked to move nowhere', () => {
    const from = { x: 1.5, z: 2.5 };
    expect(traceMovement(region, from, from)).toEqual(from);
  });
});

describe('spawns', () => {
  it('resolves spawn objects to world positions', () => {
    expect(spawnPoint(region, 'player-spawn')).toEqual({ x: 1.5, z: 2.5 });
    expect(spawnPoint(region, 'enemy-spawn')).toEqual({ x: 4.5, z: 1.5 });
  });

  it('places spawns on walkable ground', () => {
    for (const type of ['player-spawn', 'enemy-spawn'] as const) {
      const point = spawnPoint(region, type);
      expect(point).toBeDefined();
      expect(isWalkableWorld(region, point!.x, point!.z)).toBe(true);
    }
  });
});
