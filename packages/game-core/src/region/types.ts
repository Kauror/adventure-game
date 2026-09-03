/**
 * Terrain kinds understood by the v1 region format.
 *
 * Purely presentational: what a tile *is made of*, never what it does. The rules
 * read `walkable` and `elevation` and nothing else, so adding a surface here can
 * change how a region looks and can never change how it plays — which is what
 * makes it safe to keep widening as the art direction asks for more.
 *
 * `floor`, `wall` and `platform` are the original generic three. The rest name
 * real authored surfaces from the art set.
 */
export type TerrainKind =
  | 'floor'
  | 'wall'
  | 'platform'
  | 'flagstone'
  | 'flagstone-cracked'
  | 'flagstone-teal'
  | 'moss'
  | 'dirt'
  | 'dirt-mossy'
  | 'stone'
  | 'stone-broken'
  | 'rim';

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
export type RegionObjectType = 'player-spawn' | 'enemy-spawn' | 'prop';

export interface RegionObject {
  readonly type: RegionObjectType;
  readonly id: string;
  readonly tile: TileCoord;
  /**
   * Which model to draw. Required for a `prop`, absent for everything else.
   *
   * A name, not a path: the region says "brazier", and the client decides where
   * that file lives. Content that hardcoded `/models/props/brazier_bowl.glb`
   * would break the moment the assets moved, and regions are meant to outlive
   * the folder layout (PLAN §20).
   */
  readonly model?: string;
  /**
   * Rotation about the vertical axis, in degrees, clockwise from north.
   *
   * Degrees because a region file is written and read by people. Radians are
   * the renderer's business, and it converts on the way in.
   */
  readonly rotationDegrees?: number;
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
