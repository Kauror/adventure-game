/**
 * Client-side configuration.
 *
 * The world/coordinate convention deliberately does NOT live here: it is a game
 * rule shared with the future server, so it lives in `@adventure/game-core` and
 * is only re-exported for convenience. There must never be a second competing
 * coordinate system (docs/decisions/0002).
 */
export { WORLD, TILE_METRES } from '@adventure/game-core';

/**
 * Rendering baseline (PLAN §26). WebGL2 is the supported path; WebGPU is a
 * measured opt-in later and must not shape the architecture now.
 */
export const RENDERING = {
  baseline: 'webgl2',
  minimumUsefulFps: 30,
  desiredFps: 60,
} as const;

/** Presentation constraints (PLAN §6, §11). */
export const PRESENTATION = {
  /** The game is played in landscape; portrait shows a rotate notice. */
  orientation: 'landscape',
} as const;
