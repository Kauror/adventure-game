import { isWalkableTile } from './grid';
import type { Region, RegionObject, RegionObjectType, TerrainKind, TileType } from './types';

/**
 * Validates untrusted region data into a `Region`.
 *
 * Deliberately hand-written rather than pulling in a schema library: the format
 * is small, the errors can then name the exact tile or object at fault, and the
 * project avoids a dependency it does not yet need. When the content set grows
 * past a handful of regions this becomes the core of the CI content validator
 * (PLAN §20) and can be revisited then.
 */

export class RegionParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RegionParseError';
  }
}

/**
 * Kept in step with `TerrainKind` by hand, because the validator has to reject
 * an unknown surface at load rather than let it reach the renderer, and a type
 * cannot check a string that arrived from a JSON file.
 * `tests/parseRegion.test.ts` asserts the two lists agree.
 */
const TERRAIN_KINDS: readonly TerrainKind[] = [
  'floor',
  'wall',
  'platform',
  'flagstone',
  'flagstone-cracked',
  'flagstone-teal',
  'moss',
  'dirt',
  'dirt-mossy',
  'stone',
  'stone-broken',
  'rim',
];
const OBJECT_TYPES: readonly RegionObjectType[] = ['player-spawn', 'enemy-spawn'];

function fail(message: string): never {
  throw new RegionParseError(message);
}

function asRecord(value: unknown, what: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail(`${what} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, what: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${what} must be a non-empty string`);
  }
  return value;
}

function asFiniteNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    fail(`${what} must be a finite number`);
  }
  return value;
}

function asBoolean(value: unknown, what: string): boolean {
  if (typeof value !== 'boolean') {
    fail(`${what} must be a boolean`);
  }
  return value;
}

function asArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) {
    fail(`${what} must be an array`);
  }
  return value;
}

function parseTileType(raw: unknown, symbol: string): TileType {
  const record = asRecord(raw, `legend entry "${symbol}"`);
  const terrain = asString(record['terrain'], `legend entry "${symbol}".terrain`);

  if (!TERRAIN_KINDS.includes(terrain as TerrainKind)) {
    fail(`legend entry "${symbol}".terrain must be one of: ${TERRAIN_KINDS.join(', ')}`);
  }

  return {
    walkable: asBoolean(record['walkable'], `legend entry "${symbol}".walkable`),
    elevation: asFiniteNumber(record['elevation'], `legend entry "${symbol}".elevation`),
    terrain: terrain as TerrainKind,
  };
}

function parseObject(raw: unknown, index: number, width: number, height: number): RegionObject {
  const record = asRecord(raw, `objects[${index}]`);
  const type = asString(record['type'], `objects[${index}].type`);

  if (!OBJECT_TYPES.includes(type as RegionObjectType)) {
    fail(`objects[${index}].type must be one of: ${OBJECT_TYPES.join(', ')}`);
  }

  const tile = asRecord(record['tile'], `objects[${index}].tile`);
  const col = asFiniteNumber(tile['col'], `objects[${index}].tile.col`);
  const row = asFiniteNumber(tile['row'], `objects[${index}].tile.row`);

  if (!Number.isInteger(col) || !Number.isInteger(row)) {
    fail(`objects[${index}].tile must use integer col/row`);
  }
  if (col < 0 || col >= width || row < 0 || row >= height) {
    fail(`objects[${index}].tile (${col}, ${row}) is outside the ${width}x${height} grid`);
  }

  return {
    type: type as RegionObjectType,
    id: asString(record['id'], `objects[${index}].id`),
    tile: { col, row },
  };
}

export function parseRegion(raw: unknown): Region {
  const record = asRecord(raw, 'region');

  const schemaVersion = asFiniteNumber(record['schemaVersion'], 'schemaVersion');
  if (schemaVersion !== 1) {
    fail(`unsupported region schemaVersion ${schemaVersion} (this build understands 1)`);
  }

  const id = asString(record['id'], 'id');
  const nameKey = asString(record['nameKey'], 'nameKey');

  const legendRecord = asRecord(record['legend'], 'legend');
  const legend = new Map<string, TileType>();
  for (const [symbol, value] of Object.entries(legendRecord)) {
    if (symbol.length !== 1) {
      fail(`legend keys must be single characters, got "${symbol}"`);
    }
    legend.set(symbol, parseTileType(value, symbol));
  }
  if (legend.size === 0) {
    fail('legend must define at least one tile type');
  }

  const rawRows = asArray(record['rows'], 'rows');
  if (rawRows.length === 0) {
    fail('rows must not be empty');
  }

  const rows = rawRows.map((row, index) => asString(row, `rows[${index}]`));
  const width = rows[0]?.length ?? 0;
  const height = rows.length;

  const tiles: TileType[][] = rows.map((row, rowIndex) => {
    if (row.length !== width) {
      fail(
        `rows[${rowIndex}] has length ${row.length}, expected ${width} — the grid must be rectangular`,
      );
    }

    return [...row].map((symbol, colIndex) => {
      const tile = legend.get(symbol);
      if (tile === undefined) {
        fail(`rows[${rowIndex}][${colIndex}] uses "${symbol}", which is not in the legend`);
      }
      return tile;
    });
  });

  const objects = asArray(record['objects'], 'objects').map((raw, index) =>
    parseObject(raw, index, width, height),
  );

  const region: Region = { schemaVersion: 1, id, nameKey, width, height, tiles, objects };

  // A spawn inside a wall is the kind of mistake that is silent until a child
  // is stuck in scenery, so it is a parse error rather than a runtime surprise.
  for (const object of objects) {
    if (!isWalkableTile(region, object.tile.col, object.tile.row)) {
      fail(
        `object "${object.id}" spawns on a non-walkable tile (${object.tile.col}, ${object.tile.row})`,
      );
    }
  }

  const playerSpawns = objects.filter((object) => object.type === 'player-spawn');
  if (playerSpawns.length !== 1) {
    fail(`a region needs exactly one player-spawn, found ${playerSpawns.length}`);
  }

  const ids = new Set(objects.map((object) => object.id));
  if (ids.size !== objects.length) {
    fail('object ids must be unique within a region');
  }

  return region;
}
