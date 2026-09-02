/**
 * Pure camera arithmetic, kept free of Babylon so it can be unit-tested.
 *
 * The game camera is fixed: the player never rotates or zooms it (PLAN §2), and
 * 0A.4 settled its shape for good — orthographic, tilted 55° from the horizon.
 * See docs/decisions/0005-fixed-camera.md.
 */

export interface CameraConfig {
  /**
   * Downward tilt from the horizon, in degrees. 90 would look straight down;
   * 0 would be at ground level.
   */
  readonly tiltDegrees: number;
  /** How many metres of world are visible top-to-bottom on screen. */
  readonly verticalExtentMetres: number;
}

export interface OrthoBounds {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

const DEGREES_TO_RADIANS = Math.PI / 180;

export function degreesToRadians(degrees: number): number {
  return degrees * DEGREES_TO_RADIANS;
}

/**
 * Babylon's ArcRotateCamera measures `beta` from the +Y axis: 0 looks straight
 * down, 90° sits at the horizon. Design conversations are much easier in terms
 * of tilt from the horizon, so the config uses that and converts here.
 */
export function tiltToBeta(tiltDegrees: number): number {
  const clamped = Math.min(89.9, Math.max(0.1, tiltDegrees));
  return degreesToRadians(90 - clamped);
}

/**
 * Orthographic bounds for a given vertical extent and viewport aspect ratio.
 *
 * The vertical extent is the fixed quantity: a phone held in landscape is much
 * wider than it is tall, and it should reveal more world to the sides rather
 * than shrinking everything. A phone and a tablet therefore draw a character at
 * the same size.
 */
export function orthoBounds(verticalExtentMetres: number, aspect: number): OrthoBounds {
  const safeExtent = Math.max(0.001, verticalExtentMetres);
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;

  const top = safeExtent / 2;
  const right = top * safeAspect;

  return { left: -right, right, top, bottom: -top };
}
