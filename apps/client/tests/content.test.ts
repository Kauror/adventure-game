import { TEST_ARENA_ID, regions } from '@adventure/content';
import {
  isWalkableTile,
  isWalkableWorld,
  parseRegion,
  regionSizeMetres,
  spawnPoint,
  tileAt,
  findObjects,
} from '@adventure/game-core';
import { describe, expect, it } from 'vitest';

import { et } from '../src/i18n/et';

/**
 * Proves the acceptance criterion "map data can be loaded from structured
 * content": the shipped region is real data, parsed and validated by game-core,
 * not something hand-built in the client.
 */
const region = parseRegion(regions[TEST_ARENA_ID]);

describe('test arena content', () => {
  it('parses the shipped region', () => {
    expect(region.id).toBe('test-arena');
    // Enlarged from 20x14 so there is room to retreat, circle and use cover —
    // the old arena was small enough that backing away hit a wall.
    expect(region.width).toBe(32);
    expect(region.height).toBe(22);
    expect(regionSizeMetres(region)).toEqual({ width: 32, depth: 22 });
  });

  it('is not square, so a width/height transposition would be caught', () => {
    expect(region.width).not.toBe(region.height);
  });

  it('has its display name in the Estonian catalogue', () => {
    expect(Object.keys(et)).toContain(region.nameKey);
  });

  it('is sealed by an impassable border on all four edges', () => {
    for (let col = 0; col < region.width; col += 1) {
      expect(isWalkableTile(region, col, 0)).toBe(false);
      expect(isWalkableTile(region, col, region.height - 1)).toBe(false);
    }
    for (let row = 0; row < region.height; row += 1) {
      expect(isWalkableTile(region, 0, row)).toBe(false);
      expect(isWalkableTile(region, region.width - 1, row)).toBe(false);
    }
  });

  it('contains interior obstacles as well as the border', () => {
    let interiorWalls = 0;
    for (let row = 1; row < region.height - 1; row += 1) {
      for (let col = 1; col < region.width - 1; col += 1) {
        if (tileAt(region, col, row)?.walkable === false) {
          interiorWalls += 1;
        }
      }
    }
    expect(interiorWalls).toBeGreaterThan(0);
  });

  it('is a raised fighting floor ringed by lower ground', () => {
    // The arena is a platform with steps around it — which is what the art
    // set's rim_step tile is for — so the region has to carry two ground
    // levels. Note the test does *not* claim every raised tile is walkable:
    // the rim is a solid block standing on the raised floor, so it shares that
    // base height while being something you cannot walk on.
    let raisedFloor = 0;
    let groundLevelFloor = 0;

    for (let row = 0; row < region.height; row += 1) {
      for (let col = 0; col < region.width; col += 1) {
        const tile = tileAt(region, col, row);
        if (tile === undefined || !tile.walkable) {
          continue;
        }
        if (tile.elevation > 0) {
          raisedFloor += 1;
        } else {
          groundLevelFloor += 1;
        }
      }
    }

    expect(raisedFloor).toBeGreaterThan(0);
    expect(groundLevelFloor).toBeGreaterThan(0);
  });

  it('uses the authored surfaces rather than the generic placeholders', () => {
    const used = new Set<string>();
    for (let row = 0; row < region.height; row += 1) {
      for (let col = 0; col < region.width; col += 1) {
        const tile = tileAt(region, col, row);
        if (tile !== undefined) {
          used.add(tile.terrain);
        }
      }
    }

    // The arena is dressed from the art set, not built from 'floor'/'wall'.
    expect(used).toContain('flagstone');
    expect(used).toContain('moss');
    expect(used).toContain('rim');
    expect(used).not.toContain('floor');
  });

  it('places a player spawn and enemy spawns on walkable ground', () => {
    const player = spawnPoint(region, 'player-spawn');
    expect(player).toBeDefined();
    expect(isWalkableWorld(region, player!.x, player!.z)).toBe(true);

    const enemies = findObjects(region, 'enemy-spawn');
    expect(enemies.length).toBeGreaterThan(0);
    for (const enemy of enemies) {
      expect(isWalkableTile(region, enemy.tile.col, enemy.tile.row)).toBe(true);
    }
  });
});
