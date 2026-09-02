import { describe, expect, it } from 'vitest';

import {
  DODGE,
  advanceDodge,
  canDodge,
  createDodgeState,
  dodgeSpeed,
  isDodging,
  isWalkableWorld,
  parseRegion,
  startDodge,
  stepMovement,
  type DodgeState,
  type MoveDirection,
  type WorldPoint,
} from '../src/index';
import { rawTestRegion } from './fixtures';

const region = parseRegion(rawTestRegion());

/**
 * Drives dodge and movement together the way the client's frame loop does, so
 * the composition of the two — not just each in isolation — is covered.
 */
function simulate(
  from: WorldPoint,
  direction: MoveDirection,
  seconds: number,
  { dodgeAtStart = false, step = 1 / 60 } = {},
): { position: WorldPoint; dodge: DodgeState } {
  let position = from;
  let dodge = createDodgeState();
  let requested = dodgeAtStart;
  let remaining = seconds;

  while (remaining > 0) {
    const dt = Math.min(step, remaining);
    dodge = advanceDodge(dodge, dt);

    if (requested) {
      dodge = startDodge(dodge, direction);
      requested = false;
    }

    position = isDodging(dodge)
      ? stepMovement(region, position, dodge.direction, dt, dodgeSpeed())
      : stepMovement(region, position, direction, dt);

    remaining -= dt;
  }

  return { position, dodge };
}

describe('dodging through the world', () => {
  it('travels roughly the configured distance across open ground', () => {
    // Fixture row 1 is "#.++.#": tiles 1..4 are all walkable, so a burst east
    // from the west end has room to run.
    const from = { x: 1.5, z: 2.5 };
    const { position } = simulate(from, { x: 1, y: 0 }, DODGE.durationSeconds, {
      dodgeAtStart: true,
    });

    const travelled = position.x - from.x;
    // A shade under the full distance: the frame that ends the burst no longer
    // moves. Within one frame's worth is correct, not a bug.
    const oneFrame = dodgeSpeed() / 60;
    expect(travelled).toBeGreaterThan(DODGE.distanceMetres - oneFrame * 2);
    expect(travelled).toBeLessThanOrEqual(DODGE.distanceMetres + 1e-9);
  });

  it('is much faster than running for the same time', () => {
    const from = { x: 1.5, z: 2.5 };
    const dodged = simulate(from, { x: 1, y: 0 }, DODGE.durationSeconds, { dodgeAtStart: true });
    const walked = simulate(from, { x: 1, y: 0 }, DODGE.durationSeconds);

    expect(dodged.position.x - from.x).toBeGreaterThan((walked.position.x - from.x) * 2);
  });

  it('never passes through a wall, even at burst speed', () => {
    // Row 2 is "#.##.#": dodging east from tile (1,2) runs straight at a wall.
    const from = { x: 1.5, z: 1.5 };
    const { position } = simulate(from, { x: 1, y: 0 }, DODGE.durationSeconds, {
      dodgeAtStart: true,
    });

    expect(isWalkableWorld(region, position.x, position.z)).toBe(true);
    expect(position.x).toBeLessThan(2);
  });

  it('cannot be chained: a second dodge waits for the cooldown', () => {
    const from = { x: 1.5, z: 2.5 };

    // Immediately after the burst the dodge is still cooling down.
    const justAfter = simulate(from, { x: 1, y: 0 }, DODGE.durationSeconds + 0.05, {
      dodgeAtStart: true,
    });
    expect(canDodge(justAfter.dodge)).toBe(false);

    // Once the cooldown elapses it is available again.
    const later = simulate(
      from,
      { x: 1, y: 0 },
      DODGE.durationSeconds + DODGE.cooldownSeconds + 0.05,
      {
        dodgeAtStart: true,
      },
    );
    expect(canDodge(later.dodge)).toBe(true);
  });

  it('produces the same result at 30 fps as at 240 fps', () => {
    const from = { x: 1.5, z: 2.5 };
    const slow = simulate(from, { x: 1, y: 0 }, DODGE.durationSeconds, {
      dodgeAtStart: true,
      step: 1 / 30,
    });
    const fast = simulate(from, { x: 1, y: 0 }, DODGE.durationSeconds, {
      dodgeAtStart: true,
      step: 1 / 240,
    });

    // Within a frame of each other — frame rate must not change how far a dodge goes.
    expect(Math.abs(slow.position.x - fast.position.x)).toBeLessThan(dodgeSpeed() / 30);
  });
});
