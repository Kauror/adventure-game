/**
 * A tiny hand-built region used by the game-core tests.
 *
 * Layout (row 0 is the north edge):
 *
 * ```text
 *   col 012345
 * row 0 ######
 * row 1 #.++.#
 * row 2 #.##.#
 * row 3 ######
 * ```
 *
 * The two interior columns are separated by a wall block, which is what makes
 * the wall-sliding and tunnelling tests meaningful.
 */
export function rawTestRegion(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: 'fixture',
    nameKey: 'region.fixture.name',
    legend: {
      '#': { walkable: false, elevation: 0, terrain: 'wall' },
      '.': { walkable: true, elevation: 0, terrain: 'floor' },
      '+': { walkable: true, elevation: 1, terrain: 'platform' },
    },
    rows: ['######', '#.++.#', '#.##.#', '######'],
    objects: [
      { type: 'player-spawn', id: 'spawn-player', tile: { col: 1, row: 1 } },
      { type: 'enemy-spawn', id: 'spawn-enemy', tile: { col: 4, row: 2 } },
    ],
  };
}
