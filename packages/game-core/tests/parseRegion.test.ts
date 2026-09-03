import { describe, expect, it } from 'vitest';

import { parseRegion, RegionParseError } from '../src/index';
import { rawTestRegion } from './fixtures';

/** Fresh copy of the fixture with one mutation applied. */
function withRaw(mutate: (raw: Record<string, unknown>) => void): Record<string, unknown> {
  const raw = rawTestRegion();
  mutate(raw);
  return raw;
}

describe('parseRegion', () => {
  it('parses a valid region', () => {
    const region = parseRegion(rawTestRegion());

    expect(region.id).toBe('fixture');
    expect(region.nameKey).toBe('region.fixture.name');
    expect(region.width).toBe(6);
    expect(region.height).toBe(4);
    expect(region.tiles).toHaveLength(4);
    expect(region.tiles[0]).toHaveLength(6);
    expect(region.objects).toHaveLength(2);
  });

  it('resolves legend symbols into tile types', () => {
    const region = parseRegion(rawTestRegion());

    expect(region.tiles[1]?.[1]).toEqual({ walkable: true, elevation: 0, terrain: 'floor' });
    expect(region.tiles[1]?.[2]).toEqual({ walkable: true, elevation: 1, terrain: 'platform' });
    expect(region.tiles[0]?.[0]).toEqual({ walkable: false, elevation: 0, terrain: 'wall' });
  });

  it('rejects a non-rectangular grid', () => {
    const raw = withRaw((r) => {
      r['rows'] = ['######', '#.++.#', '#.##.', '######'];
    });
    expect(() => parseRegion(raw)).toThrow(RegionParseError);
    expect(() => parseRegion(raw)).toThrow(/rectangular/);
  });

  it('rejects a symbol that is not in the legend', () => {
    const raw = withRaw((r) => {
      r['rows'] = ['######', '#.?+.#', '#.##.#', '######'];
    });
    expect(() => parseRegion(raw)).toThrow(/not in the legend/);
  });

  it('rejects an unsupported schema version', () => {
    const raw = withRaw((r) => {
      r['schemaVersion'] = 2;
    });
    expect(() => parseRegion(raw)).toThrow(/schemaVersion/);
  });

  it('rejects a spawn placed inside a wall', () => {
    const raw = withRaw((r) => {
      r['objects'] = [{ type: 'player-spawn', id: 'spawn-player', tile: { col: 0, row: 0 } }];
    });
    expect(() => parseRegion(raw)).toThrow(/non-walkable/);
  });

  it('rejects a spawn outside the grid', () => {
    const raw = withRaw((r) => {
      r['objects'] = [{ type: 'player-spawn', id: 'spawn-player', tile: { col: 99, row: 0 } }];
    });
    expect(() => parseRegion(raw)).toThrow(/outside/);
  });

  it('requires exactly one player spawn', () => {
    const none = withRaw((r) => {
      r['objects'] = [{ type: 'enemy-spawn', id: 'spawn-enemy', tile: { col: 1, row: 1 } }];
    });
    expect(() => parseRegion(none)).toThrow(/exactly one player-spawn/);

    const two = withRaw((r) => {
      r['objects'] = [
        { type: 'player-spawn', id: 'a', tile: { col: 1, row: 1 } },
        { type: 'player-spawn', id: 'b', tile: { col: 4, row: 2 } },
      ];
    });
    expect(() => parseRegion(two)).toThrow(/exactly one player-spawn/);
  });

  it('rejects duplicate object ids', () => {
    const raw = withRaw((r) => {
      r['objects'] = [
        { type: 'player-spawn', id: 'same', tile: { col: 1, row: 1 } },
        { type: 'enemy-spawn', id: 'same', tile: { col: 4, row: 2 } },
      ];
    });
    expect(() => parseRegion(raw)).toThrow(/unique/);
  });

  it('rejects an unknown terrain kind', () => {
    const raw = withRaw((r) => {
      r['legend'] = {
        '#': { walkable: false, elevation: 0, terrain: 'lava' },
        '.': { walkable: true, elevation: 0, terrain: 'floor' },
        '+': { walkable: true, elevation: 1, terrain: 'platform' },
      };
    });
    expect(() => parseRegion(raw)).toThrow(/terrain must be one of/);
  });

  it('rejects structurally wrong input', () => {
    expect(() => parseRegion(null)).toThrow(RegionParseError);
    expect(() => parseRegion('nope')).toThrow(RegionParseError);
    expect(() => parseRegion({})).toThrow(RegionParseError);
    expect(() => parseRegion(withRaw((r) => (r['rows'] = [])))).toThrow(/rows must not be empty/);
  });
});

describe('props', () => {
  /**
   * A tiny region with a wall to stand things on.
   *
   * A valid player spawn is supplied unless the caller brings its own, because
   * a region needs exactly one and these cases are about props.
   */
  function withObjects(objects: unknown[]): unknown {
    const hasPlayer = objects.some(
      (object) => (object as { type?: string }).type === 'player-spawn',
    );
    const all = hasPlayer
      ? objects
      : [{ type: 'player-spawn', id: 'spawn', tile: { col: 2, row: 2 } }, ...objects];

    return {
      schemaVersion: 1,
      id: 'props',
      nameKey: 'region.props.name',
      legend: {
        '#': { walkable: false, elevation: 0, terrain: 'stone' },
        '.': { walkable: true, elevation: 0, terrain: 'flagstone' },
      },
      rows: ['####', '#..#', '#..#', '####'],
      objects: all,
    };
  }

  it('carries a model and a rotation', () => {
    const region = parseRegion(
      withObjects([
        { type: 'prop', id: 'a', tile: { col: 1, row: 1 }, model: 'brazier', rotationDegrees: 90 },
      ]),
    );

    const prop = region.objects.find((object) => object.type === 'prop')!;
    expect(prop.model).toBe('brazier');
    expect(prop.rotationDegrees).toBe(90);
  });

  it('defaults an unstated rotation to zero rather than leaving it undefined', () => {
    const region = parseRegion(
      withObjects([{ type: 'prop', id: 'a', tile: { col: 1, row: 1 }, model: 'crate' }]),
    );
    expect(region.objects.find((object) => object.type === 'prop')!.rotationDegrees).toBe(0);
  });

  it('rejects a prop with no model, which would place nothing and say nothing', () => {
    expect(() =>
      parseRegion(withObjects([{ type: 'prop', id: 'a', tile: { col: 1, row: 1 } }])),
    ).toThrow(RegionParseError);
  });

  it('lets a prop stand on solid ground, unlike a spawn', () => {
    // A pillar rises from the arena rim and a torch is mounted on a wall.
    // Requiring walkable ground under a prop would forbid both.
    expect(() =>
      parseRegion(
        withObjects([
          { type: 'prop', id: 'pillar', tile: { col: 0, row: 0 }, model: 'pillar-stump' },
        ]),
      ),
    ).not.toThrow();
  });

  it('still refuses to spawn a player inside a wall', () => {
    expect(() =>
      parseRegion(withObjects([{ type: 'player-spawn', id: 'p', tile: { col: 0, row: 0 } }])),
    ).toThrow(RegionParseError);
  });
});
