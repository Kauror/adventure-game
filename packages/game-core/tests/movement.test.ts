import { describe, expect, it } from 'vitest';

import {
  MOVEMENT,
  isPlausibleDisplacement,
  isWalkableWorld,
  parseRegion,
  stepMovement,
} from '../src/index';
import { rawTestRegion } from './fixtures';

const region = parseRegion(rawTestRegion());

/** Floor tile (1, 1): x in [1, 2], z in [2, 3]. */
const floor = { x: 1.5, z: 2.5 };

describe('stepMovement', () => {
  it('moves at max speed for a full-deflection input', () => {
    const result = stepMovement(region, floor, { x: 1, y: 0 }, 0.1);
    expect(result.x - floor.x).toBeCloseTo(MOVEMENT.maxSpeedMetresPerSecond * 0.1, 6);
    expect(result.z).toBe(floor.z);
  });

  it('scales with elapsed time, so speed is frame-rate independent', () => {
    const shortStep = stepMovement(region, floor, { x: 1, y: 0 }, 0.05);
    const longStep = stepMovement(region, floor, { x: 1, y: 0 }, 0.1);

    expect(longStep.x - floor.x).toBeCloseTo(2 * (shortStep.x - floor.x), 6);
  });

  it('moves at half speed for a half-deflected stick', () => {
    const half = stepMovement(region, floor, { x: 0.5, y: 0 }, 0.1);
    const full = stepMovement(region, floor, { x: 1, y: 0 }, 0.1);

    expect(half.x - floor.x).toBeCloseTo((full.x - floor.x) / 2, 6);
  });

  it('does not travel faster diagonally than straight', () => {
    // Holding two keys produces (1, 1), magnitude 1.41 — it must be clamped.
    const diagonal = stepMovement(region, floor, { x: 1, y: 1 }, 0.05);
    const straight = stepMovement(region, floor, { x: 1, y: 0 }, 0.05);

    const diagonalDistance = Math.hypot(diagonal.x - floor.x, diagonal.z - floor.z);
    const straightDistance = Math.hypot(straight.x - floor.x, straight.z - floor.z);

    expect(diagonalDistance).toBeCloseTo(straightDistance, 6);
  });

  it('stays put for no input or no elapsed time', () => {
    expect(stepMovement(region, floor, { x: 0, y: 0 }, 0.1)).toEqual(floor);
    expect(stepMovement(region, floor, { x: 1, y: 0 }, 0)).toEqual(floor);
    expect(stepMovement(region, floor, { x: 1, y: 0 }, -1)).toEqual(floor);
  });

  it('never walks into a wall, however long the frame', () => {
    // A 5 second frame at 4.5 m/s would otherwise cross the whole fixture region.
    const result = stepMovement(region, floor, { x: -1, y: 0 }, 5);
    expect(isWalkableWorld(region, result.x, result.z)).toBe(true);
  });

  it('caps an enormous frame so a resumed tab does not fling the player', () => {
    // A phone returning from lock reports a huge delta on its first frame back
    // (PLAN §6). Movement must be limited to one capped frame's worth.
    const huge = stepMovement(region, floor, { x: 1, y: 0 }, 30);
    const capped = stepMovement(region, floor, { x: 1, y: 0 }, MOVEMENT.maxFrameSeconds);

    expect(huge).toEqual(capped);
    expect(huge.x - floor.x).toBeLessThanOrEqual(
      MOVEMENT.maxSpeedMetresPerSecond * MOVEMENT.maxFrameSeconds + 1e-9,
    );
  });

  it('does not tunnel through a wall on a long step', () => {
    // Standing just west of the wall block at tiles (2,2) and (3,2), heading
    // east along row 2. A single destination-only check would land beyond it.
    const nearWall = { x: 1.9, z: 1.5 };
    const result = stepMovement(region, nearWall, { x: 1, y: 0 }, 10);

    expect(isWalkableWorld(region, result.x, result.z)).toBe(true);
    expect(result.x).toBeLessThan(2);
  });

  it('slides along a wall rather than sticking to it', () => {
    // Standing near the corner of the wall at tile (2,2) and heading south-east:
    // Z is blocked by the wall, X survives and carries the player along it.
    const nearCorner = { x: 1.9, z: 2.1 };
    const result = stepMovement(region, nearCorner, { x: 1, y: -1 }, 0.1);

    expect(result.x).toBeGreaterThan(nearCorner.x);
    expect(result.z).toBe(nearCorner.z);
    expect(isWalkableWorld(region, result.x, result.z)).toBe(true);
  });

  it('honours an explicit slower speed', () => {
    const slow = stepMovement(region, floor, { x: 1, y: 0 }, 0.1, 1);
    expect(slow.x - floor.x).toBeCloseTo(0.1, 6);
  });
});

describe('isPlausibleDisplacement', () => {
  it('accepts a legitimate step', () => {
    const to = stepMovement(region, floor, { x: 1, y: 0 }, 0.1);
    expect(isPlausibleDisplacement(floor, to, 0.1)).toBe(true);
  });

  it('accepts a small overshoot within tolerance', () => {
    const allowed = MOVEMENT.maxSpeedMetresPerSecond * 0.1;
    const to = { x: floor.x + allowed * 1.2, z: floor.z };
    expect(isPlausibleDisplacement(floor, to, 0.1)).toBe(true);
  });

  it('rejects a teleport', () => {
    expect(isPlausibleDisplacement(floor, { x: floor.x + 50, z: floor.z }, 0.1)).toBe(false);
  });

  it('rejects any movement in zero elapsed time', () => {
    expect(isPlausibleDisplacement(floor, { x: floor.x + 1, z: floor.z }, 0)).toBe(false);
  });
});
