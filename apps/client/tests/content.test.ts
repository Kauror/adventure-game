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
    // 26x26, sized to the authored arena: a walled square 24 m across holding a
    // 16 m circular fight floor. The grid is generated from the model's own
    // geometry rather than drawn by hand, which is the only reason the two can
    // be trusted to agree.
    expect(region.width).toBe(26);
    expect(region.height).toBe(26);
    expect(regionSizeMetres(region)).toEqual({ width: 26, depth: 26 });
  });

  it('names the model that draws it', () => {
    // The grid stopped describing how the region looks (PLAN §7): it is the
    // walkability truth, and an authored model is the scenery.
    expect(region.sceneModel).toBe('arena');
  });

  it('is not symmetric under transposition, so a row/column swap is caught', () => {
    /*
     * This used to be `width !== height`, which the old 32x22 arena gave for
     * free and this square one does not. Rather than drop the guard with the
     * shape that provided it, assert the property that actually matters: the
     * grid must differ from its own transpose, so reading rows as columns
     * cannot silently produce a plausible arena.
     *
     * The circular floor alone would *not* satisfy this — a disc is symmetric
     * about the diagonal. What breaks the symmetry is the scattered solid props
     * around the ring, which is worth knowing: if the props are ever removed,
     * this test starts passing for the wrong reason and should be revisited.
     */
    const transposed = (col: number, row: number) => tileAt(region, row, col);

    let differences = 0;
    for (let row = 0; row < region.height; row += 1) {
      for (let col = 0; col < region.width; col += 1) {
        if (tileAt(region, col, row)?.walkable !== transposed(col, row)?.walkable) {
          differences += 1;
        }
      }
    }

    expect(differences).toBeGreaterThan(0);
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

  it('is a sunken fighting floor ringed by higher ground', () => {
    // The authored arena is a pit, not a platform: fight floor at y=0, rim step
    // at +0.2, village ground at +0.4. That is the opposite of the previous
    // hand-built arena, and it is the direction that makes the fight readable —
    // the audience ground looks down into the ring.
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

    // The centre is the low point, and the edge is the high one.
    expect(tileAt(region, region.width / 2, region.height / 2)?.elevation).toBe(0);
    expect(tileAt(region, 2, region.height / 2)?.elevation).toBeGreaterThan(0);
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

    // Dressed from the art set, not built from the generic placeholders.
    expect(used).toContain('flagstone-teal');
    expect(used).toContain('rim');
    expect(used).toContain('stone');
    expect(used).not.toContain('floor');
    expect(used).not.toContain('platform');
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
