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
  /**
   * What the game actually renders at.
   *
   * PLAN §26 names 60 as desirable and 30 as the floor; the game now caps at the
   * floor on purpose. A fixed camera and six-box characters gain little from the
   * extra frames, and a phone that stays cool for half an hour is worth more
   * than motion nobody asked for. It is a trade — input is read once per drawn
   * frame — so `?fps=60` exists to compare them, and 0A.12 is where the numbers
   * settle it. See game/frameCap.ts.
   */
  desiredFps: 30,
} as const;

/** Presentation constraints (PLAN §6, §11). */
export const PRESENTATION = {
  /** The game is played in landscape; portrait shows a rotate notice. */
  orientation: 'landscape',
} as const;
