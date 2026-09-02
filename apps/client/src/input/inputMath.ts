/**
 * Pure input arithmetic, kept free of the DOM so it can be unit-tested.
 *
 * `y` is always **screen-up**, which is world +Z (north). That mapping is only
 * this simple because the camera is fixed and never rotates (ADR 0005) — if it
 * ever gained rotation, input would have to be transformed into camera space
 * here rather than used directly.
 */

export interface Vector2 {
  readonly x: number;
  readonly y: number;
}

export const ZERO: Vector2 = { x: 0, y: 0 };

/**
 * Applies a radial dead zone and rescales the remainder back to 0..1.
 *
 * Rescaling matters: without it, the moment a stick crosses the dead zone the
 * character jumps straight to dead-zone speed. With it, the slowest usable
 * speed is genuinely slow, which is what lets a small child creep up to an edge
 * instead of overshooting it.
 */
export function applyDeadZone(vector: Vector2, deadZone: number): Vector2 {
  const magnitude = Math.hypot(vector.x, vector.y);
  const limit = Math.min(0.99, Math.max(0, deadZone));

  if (magnitude <= limit || magnitude === 0) {
    return ZERO;
  }

  const rescaled = (magnitude - limit) / (1 - limit);
  const clamped = Math.min(1, rescaled);

  return {
    x: (vector.x / magnitude) * clamped,
    y: (vector.y / magnitude) * clamped,
  };
}

/** Limits a vector to unit length, leaving shorter vectors untouched. */
export function clampMagnitude(vector: Vector2, max = 1): Vector2 {
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude <= max || magnitude === 0) {
    return vector;
  }

  const scale = max / magnitude;
  return { x: vector.x * scale, y: vector.y * scale };
}

export function magnitude(vector: Vector2): number {
  return Math.hypot(vector.x, vector.y);
}

export function isIdle(vector: Vector2): boolean {
  return vector.x === 0 && vector.y === 0;
}
