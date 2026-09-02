import { TILE_METRES } from '../world';
import type {
  Region,
  RegionObject,
  RegionObjectType,
  TileCoord,
  TileType,
  WorldPoint,
} from './types';

/** Region extent in metres. */
export function regionSizeMetres(region: Region): {
  readonly width: number;
  readonly depth: number;
} {
  return {
    width: region.width * TILE_METRES,
    depth: region.height * TILE_METRES,
  };
}

export function isInsideGrid(region: Region, col: number, row: number): boolean {
  return col >= 0 && col < region.width && row >= 0 && row < region.height;
}

/** The tile at a grid coordinate, or `undefined` outside the grid. */
export function tileAt(region: Region, col: number, row: number): TileType | undefined {
  const rowTiles = region.tiles[row];
  if (rowTiles === undefined) {
    return undefined;
  }
  return rowTiles[col];
}

/** Outside the grid counts as not walkable, so nothing can leave the region. */
export function isWalkableTile(region: Region, col: number, row: number): boolean {
  return tileAt(region, col, row)?.walkable ?? false;
}

/**
 * Centre of a tile, in metres.
 * See world.ts for why the row axis is flipped.
 */
export function tileCentreToWorld(region: Region, col: number, row: number): WorldPoint {
  return {
    x: (col + 0.5) * TILE_METRES,
    z: (region.height - 1 - row + 0.5) * TILE_METRES,
  };
}

/**
 * The grid coordinate containing a world point. May be outside the grid — callers
 * that care should use `isInsideGrid` or `isWalkableWorld`.
 */
export function worldToTile(region: Region, x: number, z: number): TileCoord {
  return {
    col: Math.floor(x / TILE_METRES),
    row: region.height - 1 - Math.floor(z / TILE_METRES),
  };
}

export function isWalkableWorld(region: Region, x: number, z: number): boolean {
  const { col, row } = worldToTile(region, x, z);
  return isWalkableTile(region, col, row);
}

/** Elevation in metres at a world point; 0 outside the region. */
export function elevationAtWorld(region: Region, x: number, z: number): number {
  const { col, row } = worldToTile(region, x, z);
  return tileAt(region, col, row)?.elevation ?? 0;
}

/**
 * Resolves a single movement step against the grid.
 *
 * Each axis is tested separately, which is what produces wall sliding: walking
 * into a north wall while heading north-east still moves you east. Blocked axes
 * simply keep their previous value, so a blocked move is a no-op rather than a
 * stop-and-stick.
 *
 * This is a *step* resolver, not a path finder: it assumes `to` is close to
 * `from` (one frame of movement). For a long jump use `traceMovement`, which
 * subdivides. If `from` is itself unwalkable — which should not happen, spawns
 * are validated walkable — the result is simply the best of the two axes.
 */
export function clampMovement(region: Region, from: WorldPoint, to: WorldPoint): WorldPoint {
  let { x, z } = from;

  if (isWalkableWorld(region, to.x, z)) {
    x = to.x;
  }
  if (isWalkableWorld(region, x, to.z)) {
    z = to.z;
  }

  return { x, z };
}

/**
 * Walks from `from` towards `to` in small steps, resolving each against the
 * grid, and returns where it actually ended up.
 *
 * Needed because `clampMovement` only inspects the destination: a single large
 * step could otherwise tunnel straight through a wall into the space beyond.
 * Per-frame movement (0A.5) can call `clampMovement` directly; anything that
 * moves a long distance in one go must come through here.
 */
export function traceMovement(
  region: Region,
  from: WorldPoint,
  to: WorldPoint,
  stepMetres: number = TILE_METRES / 4,
): WorldPoint {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const distance = Math.hypot(dx, dz);

  if (distance === 0 || stepMetres <= 0) {
    return clampMovement(region, from, to);
  }

  const steps = Math.ceil(distance / stepMetres);
  let current = from;

  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const next = { x: from.x + dx * t, z: from.z + dz * t };
    const resolved = clampMovement(region, current, next);

    // Fully blocked on both axes — no point continuing along this line.
    if (resolved.x === current.x && resolved.z === current.z) {
      return current;
    }
    current = resolved;
  }

  return current;
}

export function findObject(region: Region, type: RegionObjectType): RegionObject | undefined {
  return region.objects.find((object) => object.type === type);
}

export function findObjects(region: Region, type: RegionObjectType): readonly RegionObject[] {
  return region.objects.filter((object) => object.type === type);
}

/** World position a spawn object sits at. */
export function spawnPoint(region: Region, type: RegionObjectType): WorldPoint | undefined {
  const object = findObject(region, type);
  if (object === undefined) {
    return undefined;
  }
  return tileCentreToWorld(region, object.tile.col, object.tile.row);
}
