/**
 * The locked world/coordinate convention (PLAN §7, docs/decisions/0002).
 *
 * This lives in game-core rather than in the client because it is a *game rule*:
 * the server will simulate against the same grid, and there must never be a
 * second competing coordinate system anywhere in the project.
 */
export const WORLD = {
  /** 1 Babylon/world unit == 1 metre. */
  unitsPerMetre: 1,
  /** 1 navigation tile == 1 m x 1 m. */
  navigationTileMetres: 1,
  axes: {
    x: 'east-west',
    y: 'elevation',
    z: 'north-south',
  },
} as const;

/**
 * Grid-to-world mapping, stated once so nothing has to guess:
 *
 * - A region occupies `x ∈ [0, width]` and `z ∈ [0, height]` metres. Its
 *   south-west corner sits at the world origin; nothing is centred, so the
 *   conversions stay free of offset terms.
 * - `col` increases with **+X (east)**.
 * - **`rows[0]` is the NORTH edge** of the region and **+Z points north**.
 *   Row index therefore increases southward, which is why converting between
 *   row and Z involves the `height - 1 - row` flip below.
 *
 * The flip exists so that an authored text map reads north-up, the way it will
 * be looked at. It is confined to these two functions and covered by tests —
 * do not reimplement it anywhere else.
 */
export const TILE_METRES = WORLD.navigationTileMetres;
