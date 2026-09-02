import { traceMovement } from './region/grid';
import type { Region, WorldPoint } from './region/types';

/**
 * Movement rules.
 *
 * These live in game-core because the server will need exactly the same numbers:
 * PLAN §4 makes movement client-authoritative but *sanity-checked*, and a
 * per-tick displacement cap is only meaningful if both sides agree what the
 * maximum speed is.
 */
export const MOVEMENT = {
  /**
   * Metres per second at full input. A brisk run — a person walks about 1.4 m/s
   * and sprints about 6 — chosen so the 20 x 14 m test arena takes a few
   * seconds to cross rather than being a single dash.
   */
  maxSpeedMetresPerSecond: 4.5,

  /**
   * Tolerance for the server's future displacement check: how much further than
   * `maxSpeed * dt` a client may report before it is treated as a violation.
   * Generous on purpose — the threat model is our own children, and a false
   * positive rubber-bands an honest player.
   */
  speedCheckTolerance: 1.35,

  /**
   * Longest frame a single movement step will honour, in seconds.
   *
   * This is a phone-specific safeguard, not a nicety. A backgrounded tab that
   * resumes — which PLAN §6 treats as the *normal* session, not an edge case —
   * reports an enormous delta on its first frame back. Without a cap the child
   * would unlock their phone and find themselves flung across the map. A hitch
   * should slow the game down, never teleport the player.
   */
  maxFrameSeconds: 0.1,
} as const;

/** A direction on the horizontal plane. `y` is screen-up, which is world +Z (north). */
export interface MoveDirection {
  readonly x: number;
  readonly y: number;
}

/**
 * Advances a position by one frame of input, resolved against the grid.
 *
 * The direction is clamped to unit length first, so holding two keys does not
 * travel faster than holding one — the classic diagonal-speed bug.
 */
export function stepMovement(
  region: Region,
  from: WorldPoint,
  direction: MoveDirection,
  deltaSeconds: number,
  speedMetresPerSecond: number = MOVEMENT.maxSpeedMetresPerSecond,
): WorldPoint {
  const magnitude = Math.hypot(direction.x, direction.y);
  if (magnitude === 0 || deltaSeconds <= 0) {
    return from;
  }

  // Never scale *up* a partially deflected stick: a joystick at half tilt should
  // move at half speed.
  const scale = magnitude > 1 ? 1 / magnitude : 1;
  const frame = Math.min(deltaSeconds, MOVEMENT.maxFrameSeconds);
  const distance = speedMetresPerSecond * frame;

  const to = {
    x: from.x + direction.x * scale * distance,
    z: from.z + direction.y * scale * distance,
  };

  // `traceMovement` rather than a single `clampMovement`: a dropped frame can
  // ask for a step longer than a tile, and a single destination check would
  // tunnel straight through a wall. For an ordinary 60 fps frame this
  // subdivides into exactly one step, so it costs nothing in the normal case.
  return traceMovement(region, from, to);
}

/**
 * Whether a reported movement is physically possible in the elapsed time.
 * Unused until the server exists (Stage 0B); defined here so both sides will
 * share one implementation rather than inventing two.
 */
export function isPlausibleDisplacement(
  from: WorldPoint,
  to: WorldPoint,
  deltaSeconds: number,
  speedMetresPerSecond: number = MOVEMENT.maxSpeedMetresPerSecond,
): boolean {
  const travelled = Math.hypot(to.x - from.x, to.z - from.z);
  const allowed = speedMetresPerSecond * Math.max(0, deltaSeconds) * MOVEMENT.speedCheckTolerance;
  return travelled <= allowed;
}
