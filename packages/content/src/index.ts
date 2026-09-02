import testArena from '../regions/test-arena.json';

/**
 * Authored regions, exported as raw data.
 *
 * This package deliberately contains no logic and no types of its own: content
 * is data, and validating it is game-core's job (`parseRegion`). Exporting the
 * JSON as `unknown` keeps that boundary honest — a consumer cannot skip
 * validation by leaning on an inferred shape.
 */
export const regions: Readonly<Record<string, unknown>> = {
  'test-arena': testArena,
};

export const TEST_ARENA_ID = 'test-arena';
