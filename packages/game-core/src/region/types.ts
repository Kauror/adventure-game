/** Terrain kinds understood by the v1 region format. */
export type TerrainKind = 'floor' | 'wall' | 'platform';

/** What a single legend character means. */
export interface TileType {
  readonly walkable: boolean;
  /** Metres above the region floor. */
  readonly elevation: number;
  readonly terrain: TerrainKind;
}

/** Integer grid coordinate. `row` 0 is the north edge (see world.ts). */
export interface TileCoord {
  readonly col: number;
  readonly row: number;
}

/** A point on the horizontal plane, in metres. */
export interface WorldPoint {
  readonly x: number;
  readonly z: number;
}

/**
 * Typed objects placed on the grid. Deliberately a very small set: the v1
 * format only needs what Stage 0A actually uses. Gates, triggers and hiding
 * anchors join it when a stage needs them (PLAN §7).
 */
export type RegionObjectType = 'player-spawn' | 'enemy-spawn';

export interface RegionObject {
  readonly type: RegionObjectType;
  readonly id: string;
  readonly tile: TileCoord;
}

/** A parsed, validated region. Tiles are indexed `[row][col]`. */
export interface Region {
  readonly schemaVersion: 1;
  readonly id: string;
  /** i18n key, never a display string. */
  readonly nameKey: string;
  /** Width in tiles (east-west extent). */
  readonly width: number;
  /** Height in tiles (north-south extent). */
  readonly height: number;
  readonly tiles: readonly (readonly TileType[])[];
  readonly objects: readonly RegionObject[];
}
